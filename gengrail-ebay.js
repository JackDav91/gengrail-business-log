/*
 GENGRAIL TCG — eBay Channel v5 — LIVE PRODUCTION SYNC
 Exact integration for the current Gengrail Business Log.
 ---------------------------------------------------------
 Main app storage key: gengrailBizV1
 Existing Sales form IDs:
 si, sd, sq, sp, spl, sf, spo, spa, so, snotes, adds

 Live production API bridge. No eBay credentials are stored here; all privileged calls go through the Cloudflare Worker.
*/

(() => {
  'use strict';

  const EBAY_KEY = 'gengrail_ebay_channel_v3';
  const LEGACY_KEYS = ['gengrail_ebay_channel_v2','gengrail_ebay_channel_v1'];
  const MAIN_KEY = 'gengrailBizV1';

  const clone = x => JSON.parse(JSON.stringify(x));
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const uid = p => `${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const nowISO = () => new Date().toISOString();
  const today = () => new Date().toISOString().slice(0,10);
  const money = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(num(n));
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const defaults = {
    version: 6,
    connection: { status:'awaiting_authorisation', sellerName:'', lastSync:null, lastError:'' },
    listings: [],
    orders: [],
    live: {
      syncing:false,
      lastOrdersSync:null,
      lastPoliciesSync:null,
      paymentPolicies:[],
      fulfillmentPolicies:[],
      returnPolicies:[]
    },
    settings: {
      autoMarkSold:true,
      feedMainLog:true,
      marketplaceId:'EBAY_GB',
      currency:'GBP',
      format:'FIXED_PRICE',
      listingDuration:'GTC',
      merchantLocationKey:'',
      paymentPolicyId:'',
      fulfillmentPolicyId:'',
      returnPolicyId:''
    }
  };

  function loadState(){
    try{
      let raw = localStorage.getItem(EBAY_KEY);
      if(!raw){
        for(const k of LEGACY_KEYS){
          raw = localStorage.getItem(k);
          if(raw) break;
        }
      }
      if(!raw) return clone(defaults);
      const p=JSON.parse(raw);
      return {
        ...clone(defaults), ...p,
        connection:{...defaults.connection,...(p.connection||{})},
        live:{...defaults.live,...(p.live||{})},
        settings:{...defaults.settings,...(p.settings||{})}
      };
    }catch{
      return clone(defaults);
    }
  }

  let state=loadState();

  function saveState(){
    localStorage.setItem(EBAY_KEY,JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('gengrail:ebay-updated',{detail:getSummary()}));
  }

  function mainDB(){
    try{
      const db=JSON.parse(localStorage.getItem(MAIN_KEY));
      if(db && Array.isArray(db.purchases) && Array.isArray(db.sales)) return db;
    }catch{}
    return null;
  }

  function soldQty(db,pid){
    return db.sales.filter(s=>s.pid===pid).reduce((a,s)=>a+num(s.q),0);
  }

  function qtyLeft(db,p){
    return Math.max(0,num(p.q)-soldQty(db,p.id));
  }

  function stockOptions(){
    const db=mainDB();
    if(!db) return [];
    return db.purchases
      .filter(p=>qtyLeft(db,p)>0)
      .map(p=>({
        id:p.id,
        title:p.name||'Unnamed stock item',
        category:p.cat||'',
        cost:num(p.cost),
        qtyLeft:qtyLeft(db,p),
        unitCost:num(p.q)?num(p.cost)/num(p.q):0
      }));
  }

  function netProfit(o){
    return num(o.salePrice)-num(o.purchaseCost)-num(o.platformFees)-num(o.postageCost)-num(o.packagingCost)-num(o.otherCosts);
  }

  function getSummary(){
    const active=state.listings.filter(x=>x.status==='LISTED');
    const sold=state.orders.filter(x=>x.status!=='CANCELLED');
    return {
      activeListings:active.length,
      draftListings:state.listings.filter(x=>x.status==='DRAFT').length,
      listedValue:active.reduce((s,x)=>s+num(x.listPrice)*num(x.quantity||1),0),
      totalSales:sold.reduce((s,x)=>s+num(x.salePrice),0),
      totalFees:sold.reduce((s,x)=>s+num(x.platformFees),0),
      netProfit:sold.reduce((s,x)=>s+num(x.netProfit),0),
      fedToMainSales:sold.filter(x=>x.mainLogSynced).length,
      lastSync:state.connection.lastSync
    };
  }

  function addListing(data={}){
    const stock=stockOptions().find(x=>String(x.id)===String(data.inventoryId));
    const listing={
      id:uid('LST'),
      inventoryId:data.inventoryId||'',
      sku:data.sku||uid('SKU'),
      title:data.title||stock?.title||'Untitled Gengrail item',
      category:data.category||stock?.category||'Trading Card',
      condition:data.condition||'Ungraded',
      purchaseCost:num(data.purchaseCost!==''?data.purchaseCost:stock?.unitCost),
      listPrice:num(data.listPrice),
      quantity:Math.max(1,parseInt(data.quantity||1,10)),
      ebayItemId:data.ebayItemId||'',
      ebayUrl:data.ebayUrl||'',
      status:data.status||'DRAFT',
      createdAt:nowISO(),
      updatedAt:nowISO()
    };
    state.listings.unshift(listing);
    saveState(); render();
    return listing;
  }


  function apiCondition(condition='Ungraded'){
    const c=String(condition||'').toLowerCase();
    if(c.includes('graded') && !c.includes('ungraded')) return 'LIKE_NEW';
    if(c.includes('ungraded')) return 'USED_VERY_GOOD';
    if(c==='new') return 'NEW';
    return 'USED_VERY_GOOD';
  }

  function parseAspects(text=''){
    const out={};
    String(text||'').split(/\n+/).forEach(line=>{
      const i=line.indexOf(':');
      if(i<1)return;
      const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();
      if(k&&v)out[k]=[v];
    });
    return out;
  }

  function aspectsText(aspects={}){
    return Object.entries(aspects||{}).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):v}`).join('\n');
  }


  const LIVE_BACKEND = 'https://gengrail-ebay-backend.gengrailtcg.workers.dev';

  async function liveGet(path){
    const res=await fetch(LIVE_BACKEND+path,{
      method:'GET',
      cache:'no-store',
      headers:{Accept:'application/json'}
    });
    let data=null;
    try{ data=await res.json(); }catch{}
    if(!res.ok) throw new Error((data&&data.message)||(`HTTP ${res.status}`));
    return data;
  }

  function policyArrays(payload){
    const p=payload?.payment?.data||{};
    const f=payload?.fulfillment?.data||{};
    const r=payload?.returns?.data||{};
    return {
      paymentPolicies:Array.isArray(p.paymentPolicies)?p.paymentPolicies:[],
      fulfillmentPolicies:Array.isArray(f.fulfillmentPolicies)?f.fulfillmentPolicies:[],
      returnPolicies:Array.isArray(r.returnPolicies)?r.returnPolicies:[]
    };
  }

  function listingBySku(sku=''){
    const needle=String(sku||'').trim();
    if(!needle)return null;
    return state.listings.find(x=>String(x.sku||'').trim()===needle) || null;
  }

  function normaliseLiveOrders(payload){
    const orders=Array.isArray(payload?.data?.orders)?payload.data.orders:[];
    const out=[];
    orders.forEach(o=>{
      const lines=Array.isArray(o.lineItems)&&o.lineItems.length?o.lineItems:[{}];
      lines.forEach((li,idx)=>{
        const sku=String(li.sku||'').trim();
        const listing=listingBySku(sku);
        const qty=Math.max(1,parseInt(li.quantity||1,10));
        const totalValue=li?.total?.value ?? li?.lineItemCost?.value ?? (
          li?.unitPrice?.value!=null ? num(li.unitPrice.value)*qty : 0
        );
        const status=String(o.orderPaymentStatus||'').toUpperCase()==='PAID'
          ? (String(o.orderFulfillmentStatus||'').toUpperCase()==='FULFILLED'?'FULFILLED':'PAID')
          : (o.orderPaymentStatus||o.orderFulfillmentStatus||'ORDERED');

        out.push({
          id:`EBAY-${o.orderId||'ORDER'}-${li.lineItemId||idx}`,
          listingId:listing?.id||'',
          inventoryId:listing?.inventoryId||'',
          sku:sku||listing?.sku||'',
          title:li.title||listing?.title||'eBay order',
          ebayItemId:li.legacyItemId||listing?.ebayItemId||'',
          ebayOrderId:o.orderId||'',
          ebayLineItemId:li.lineItemId||'',
          buyerRef:o?.buyer?.username||o?.buyer?.buyerRegistrationAddress?.email||'',
          quantity:qty,
          purchaseCost:num(listing?.purchaseCost)*qty,
          salePrice:num(totalValue),
          platformFees:0,
          postageCost:0,
          packagingCost:0,
          otherCosts:0,
          soldAt:o.creationDate||o.lastModifiedDate||nowISO(),
          status,
          source:'ebay_api',
          mainLogSynced:false,
          mainLogMessage: listing
            ? 'Imported from eBay. Ready to feed into the main Sales log.'
            : 'Imported from eBay, but no matching Gengrail SKU was found.',
          liveUpdatedAt:nowISO()
        });
      });
    });
    return out;
  }

  function mergeLiveOrders(rows){
    let added=0,updated=0;
    rows.forEach(incoming=>{
      const existing=state.orders.find(x=>
        (incoming.ebayOrderId && x.ebayOrderId===incoming.ebayOrderId &&
          String(x.ebayLineItemId||'')===String(incoming.ebayLineItemId||'')) ||
        x.id===incoming.id
      );
      if(existing){
        const keepSynced=existing.mainLogSynced;
        const keepMessage=existing.mainLogMessage;
        Object.assign(existing,incoming);
        existing.mainLogSynced=keepSynced;
        if(keepSynced) existing.mainLogMessage=keepMessage;
        existing.netProfit=netProfit(existing);
        updated++;
      }else{
        incoming.netProfit=netProfit(incoming);
        state.orders.unshift(incoming);
        added++;
      }
    });
    return {added,updated};
  }

  async function syncConnection(){
    const d=await liveGet('/api/ebay/status');
    const connected=!!(d?.ok && d.environment==='production' && d.connected);
    state.connection.status=connected?'connected':'awaiting_authorisation';
    state.connection.lastError=connected?'':'Production eBay connection is not available.';
    return d;
  }

  async function syncPolicies(){
    const d=await liveGet('/api/ebay/policies');
    const a=policyArrays(d);
    state.live.paymentPolicies=a.paymentPolicies;
    state.live.fulfillmentPolicies=a.fulfillmentPolicies;
    state.live.returnPolicies=a.returnPolicies;
    state.live.lastPoliciesSync=nowISO();

    // Safe convenience: only auto-select when eBay returns exactly one choice.
    if(!state.settings.paymentPolicyId && a.paymentPolicies.length===1)
      state.settings.paymentPolicyId=String(a.paymentPolicies[0].paymentPolicyId||'');
    if(!state.settings.fulfillmentPolicyId && a.fulfillmentPolicies.length===1)
      state.settings.fulfillmentPolicyId=String(a.fulfillmentPolicies[0].fulfillmentPolicyId||'');
    if(!state.settings.returnPolicyId && a.returnPolicies.length===1)
      state.settings.returnPolicyId=String(a.returnPolicies[0].returnPolicyId||'');
    return d;
  }

  async function syncOrders(){
    const d=await liveGet('/api/ebay/orders?limit=50');
    const merged=mergeLiveOrders(normaliseLiveOrders(d));
    state.live.lastOrdersSync=nowISO();
    return {...merged, raw:d};
  }

  async function syncLive({quiet=false}={}){
    if(state.live.syncing)return;
    state.live.syncing=true;
    state.connection.lastError='';
    render();
    try{
      await syncConnection();
      if(state.connection.status==='connected'){
        // Policies and orders are independent: keep any successful result even
        // if the other endpoint fails.
        const results=await Promise.allSettled([syncPolicies(),syncOrders()]);
        const failures=results.filter(x=>x.status==='rejected');
        if(failures.length){
          state.connection.lastError=failures.map(x=>String(x.reason?.message||x.reason)).join(' | ');
        }
        state.connection.lastSync=nowISO();
      }
      saveState();
      if(!quiet){
        const e=state.connection.lastError;
        alert(e ? 'eBay sync completed with a warning:\n\n'+e : 'eBay sync complete.');
      }
    }catch(err){
      state.connection.status='error';
      state.connection.lastError=String(err?.message||err);
      saveState();
      if(!quiet) alert('eBay sync failed:\n\n'+state.connection.lastError);
    }finally{
      state.live.syncing=false;
      saveState();
      render();
    }
  }

  function feedImportedOrder(id){
    const order=state.orders.find(x=>x.id===id);
    if(!order)return;
    if(order.mainLogSynced)return alert('This eBay line item is already in the main Sales log.');
    if(!order.inventoryId)return alert('This eBay order could not be linked to Gengrail Stock. Match the SKU first, then sync again.');
    const result=exactFeedToMainSales(order);
    order.mainLogSynced=result.ok;
    order.mainLogMessage=result.message;
    order.netProfit=netProfit(order);
    saveState();
    render();
    alert(result.message);
  }

  function localReadiness(listing){
    const missing=[];
    if(!listing.sku)missing.push('SKU');
    if(!listing.title)missing.push('title');
    if(!listing.description)missing.push('description');
    if(!num(listing.listPrice))missing.push('price');
    if(!num(listing.quantity))missing.push('quantity');
    if(!listing.categoryId)missing.push('eBay leaf category');
    if(!Object.keys(listing.aspects||{}).length)missing.push('item specifics');
    if(!listing.conditionApi)missing.push('API condition');
    if(['LIKE_NEW','USED_VERY_GOOD'].includes(listing.conditionApi) &&
       (!listing.conditionDescriptorName || !listing.conditionDescriptorValue)){
      missing.push('card condition descriptor');
    }
    if(!num(listing.photoCount))missing.push('product photo');
    return missing;
  }

  function publishPrerequisites(){
    const s=state.settings||{};
    const missing=[];
    if(!s.merchantLocationKey)missing.push('inventory location');
    if(!s.paymentPolicyId)missing.push('payment policy');
    if(!s.fulfillmentPolicyId)missing.push('fulfilment policy');
    if(!s.returnPolicyId)missing.push('return policy');
    return missing;
  }

  function apiPayload(listing){
    const settings=state.settings||{};
    const conditionDescriptors=[];
    if(listing.conditionDescriptorName && listing.conditionDescriptorValue){
      conditionDescriptors.push({
        name:String(listing.conditionDescriptorName),
        values:[String(listing.conditionDescriptorValue)]
      });
    }
    return {
      inventoryItem:{
        sku:listing.sku,
        availability:{shipToLocationAvailability:{quantity:num(listing.quantity)}},
        condition:listing.conditionApi||apiCondition(listing.condition),
        ...(conditionDescriptors.length?{conditionDescriptors}:{}),
        product:{
          title:listing.title,
          description:listing.description||'',
          aspects:listing.aspects||{},
          imageUrls:['<uploaded eBay/HTTPS image URL(s) inserted by API bridge>']
        }
      },
      offer:{
        sku:listing.sku,
        marketplaceId:settings.marketplaceId||'EBAY_GB',
        format:settings.format||'FIXED_PRICE',
        categoryId:listing.categoryId||'',
        availableQuantity:num(listing.quantity),
        merchantLocationKey:settings.merchantLocationKey||'',
        listingPolicies:{
          paymentPolicyId:settings.paymentPolicyId||'',
          fulfillmentPolicyId:settings.fulfillmentPolicyId||'',
          returnPolicyId:settings.returnPolicyId||''
        },
        pricingSummary:{price:{value:num(listing.listPrice).toFixed(2),currency:settings.currency||'GBP'}},
        listingDuration:settings.listingDuration||'GTC'
      }
    };
  }


  function upsertFromStock(data={}){
    const inventoryId=String(data.inventoryId||'');
    const sku=String(data.sku||'');
    let listing=state.listings.find(x=>
      (inventoryId && String(x.inventoryId||'')===inventoryId) ||
      (sku && String(x.sku||'')===sku)
    );

    const patch={
      inventoryId:data.inventoryId||listing?.inventoryId||'',
      sku:data.sku||listing?.sku||uid('SKU'),
      title:data.title||listing?.title||'Untitled Gengrail item',
      category:data.category||listing?.category||'Trading Card',
      condition:data.condition||listing?.condition||'Ungraded',
      purchaseCost:num(data.purchaseCost!==''?data.purchaseCost:listing?.purchaseCost),
      listPrice:num(data.listPrice!==''?data.listPrice:listing?.listPrice),
      quantity:Math.max(1,parseInt(data.quantity||listing?.quantity||1,10)),
      photoCount:Math.max(0,parseInt(data.photoCount||listing?.photoCount||0,10)),
      description:data.description??listing?.description??'',
      ebayItemId:data.ebayItemId??listing?.ebayItemId??'',
      ebayUrl:data.ebayUrl??listing?.ebayUrl??'',
      categoryId:data.categoryId??listing?.categoryId??'',
      aspects:data.aspects??listing?.aspects??{},
      conditionApi:data.conditionApi??listing?.conditionApi??apiCondition(data.condition||listing?.condition||'Ungraded'),
      conditionDescriptorName:data.conditionDescriptorName??listing?.conditionDescriptorName??'',
      conditionDescriptorValue:data.conditionDescriptorValue??listing?.conditionDescriptorValue??'',
      status:data.status||listing?.status||'DRAFT',
      updatedAt:nowISO()
    };

    if(listing){
      Object.assign(listing,patch);
    }else{
      listing={id:uid('LST'),createdAt:nowISO(),...patch};
      state.listings.unshift(listing);
    }

    saveState();
    render();
    return listing;
  }

  /* If an older module lost its separate draft record but the master Stock
     record still says DRAFT (or carries an eBay listing reference), rebuild
     the local draft from Stock rather than asking the user to re-enter it. */
  function recoverDraftsFromMainStock(){
    const db=mainDB();
    if(!db?.purchases?.length)return 0;
    let recovered=0;

    db.purchases.forEach(p=>{
      const shouldRecover=(String(p.ebayStatus||'').toUpperCase()==='DRAFT') || !!p.ebayListingRef;
      if(!shouldRecover)return;

      const exists=state.listings.some(x=>
        String(x.inventoryId||'')===String(p.id) ||
        (p.sku && String(x.sku||'')===String(p.sku))
      );
      if(exists)return;

      state.listings.unshift({
        id:p.ebayListingRef||uid('LST'),
        inventoryId:p.id,
        sku:p.sku||'',
        title:p.name||'Untitled Gengrail item',
        category:p.cat||'Trading Card',
        condition:p.condition||'Ungraded',
        purchaseCost:num(p.q)?num(p.cost)/num(p.q):num(p.cost),
        listPrice:num(p.listPrice),
        quantity:1,
        photoCount:num(p.photoCount),
        description:p.notes||'',
        ebayItemId:p.ebayItemId||'',
        ebayUrl:p.ebayUrl||'',
        categoryId:'',
        aspects:{},
        conditionApi:apiCondition(p.condition||'Ungraded'),
        conditionDescriptorName:'',
        conditionDescriptorValue:'',
        status:'DRAFT',
        createdAt:nowISO(),
        updatedAt:nowISO(),
        recoveredFromStock:true
      });
      recovered++;
    });

    if(recovered)saveState();
    return recovered;
  }

  function exactFeedToMainSales(order){
    const required=['si','sd','sq','sp','spl','sf','spo','spa','so','snotes','adds'];
    const missing=required.filter(id=>!document.getElementById(id));
    if(missing.length) return {ok:false,message:'Main Sales form fields missing: '+missing.join(', ')};

    if(!order.inventoryId) return {ok:false,message:'This eBay listing is not linked to a Gengrail Stock item.'};

    const si=document.getElementById('si');
    const option=[...si.options].find(o=>String(o.value)===String(order.inventoryId));
    if(!option) return {ok:false,message:'The linked Stock item is no longer available in the Sales dropdown.'};

    si.value=order.inventoryId;
    document.getElementById('sd').value=(order.soldAt||today()).slice(0,10);
    document.getElementById('sq').value=Math.max(1,parseInt(order.quantity||1,10));
    document.getElementById('sp').value=num(order.salePrice).toFixed(2);
    document.getElementById('spl').value='eBay';
    document.getElementById('sf').value=num(order.platformFees).toFixed(2);
    document.getElementById('spo').value=num(order.postageCost).toFixed(2);
    document.getElementById('spa').value=num(order.packagingCost).toFixed(2);
    document.getElementById('so').value=num(order.otherCosts).toFixed(2);

    const noteParts=[
      'eBay',
      order.ebayOrderId ? `Order ${order.ebayOrderId}` : '',
      order.ebayLineItemId ? `Line ${order.ebayLineItemId}` : '',
      order.ebayItemId ? `Item ${order.ebayItemId}` : '',
      order.buyerRef ? `Buyer ref ${order.buyerRef}` : ''
    ].filter(Boolean);
    document.getElementById('snotes').value=noteParts.join(' • ');

    const before=mainDB()?.sales?.length ?? -1;
    document.getElementById('adds').click();
    const after=mainDB()?.sales?.length ?? -1;

    if(before>=0 && after===before+1){
      return {ok:true,message:'Sale added to the main Gengrail Sales log.'};
    }
    return {ok:false,message:'The existing Gengrail Sales form did not confirm a new sale. Nothing is assumed.'};
  }

  function recordSale(data={}){
    const listing=state.listings.find(x=>x.id===data.listingId);
    const order={
      id:uid('ORD'),
      listingId:listing?.id||'',
      inventoryId:listing?.inventoryId||'',
      sku:listing?.sku||'',
      title:listing?.title||'eBay sale',
      ebayItemId:listing?.ebayItemId||'',
      ebayOrderId:data.ebayOrderId||'',
      buyerRef:data.buyerRef||'',
      quantity:Math.max(1,parseInt(data.quantity||1,10)),
      purchaseCost:num(listing?.purchaseCost)*Math.max(1,parseInt(data.quantity||1,10)),
      salePrice:num(data.salePrice),
      platformFees:num(data.platformFees),
      postageCost:num(data.postageCost),
      packagingCost:num(data.packagingCost),
      otherCosts:num(data.otherCosts),
      soldAt:data.soldAt||nowISO(),
      status:'PAID',
      source:'manual',
      mainLogSynced:false,
      mainLogMessage:''
    };
    order.netProfit=netProfit(order);

    if(state.settings.feedMainLog){
      const result=exactFeedToMainSales(order);
      order.mainLogSynced=result.ok;
      order.mainLogMessage=result.message;
    }

    state.orders.unshift(order);

    if(listing && state.settings.autoMarkSold && order.mainLogSynced){
      listing.status='SOLD';
      listing.updatedAt=nowISO();
    }

    saveState(); render();

    setTimeout(()=>{
      if(order.mainLogSynced){
        alert('Success: this eBay sale has been added to the existing Gengrail Sales log. Dashboard and Tax figures now use the normal Gengrail calculations.');
      }else{
        alert('The eBay transaction was saved in the eBay Channel, but was NOT added to the main Sales log.\n\n'+order.mainLogMessage);
      }
    },50);

    return order;
  }

  function deleteListing(id){
    const listing=state.listings.find(x=>x.id===id);
    if(!listing) return;
    const hasOrder=state.orders.some(o=>o.listingId===id);
    if(hasOrder && !confirm('This listing has an eBay sale linked to it. Delete the listing record anyway?')) return;
    if(!hasOrder && !confirm(`Delete eBay listing "${listing.title}"?`)) return;
    state.listings=state.listings.filter(x=>x.id!==id);
    saveState(); render();
  }

  function deleteEbaySale(id){
    const order=state.orders.find(x=>x.id===id);
    if(!order) return;

    let msg=`Delete eBay sale "${order.title}"`;
    if(order.ebayOrderId) msg+=` (${order.ebayOrderId})`;
    msg+='?';
    if(!confirm(msg)) return;

    // If a matching main Sales record still exists, only remove it when we can
    // identify it safely by the exact eBay order ID stored in its notes.
    let removedMain=false;
    if(order.mainLogSynced && order.ebayOrderId){
      const db=mainDB();
      if(db){
        const needle=`Order ${order.ebayOrderId}`;
        const matches=db.sales.filter(s=>
          String(s.pl||'').toLowerCase()==='ebay' &&
          String(s.notes||'').includes(needle)
        );
        if(matches.length===1){
          if(confirm('A matching entry still exists in the main Sales log. Remove that matching Sales entry too?')){
            db.sales=db.sales.filter(s=>s.id!==matches[0].id);
            localStorage.setItem(MAIN_KEY,JSON.stringify(db));
            removedMain=true;
          }
        }
      }
    }

    state.orders=state.orders.filter(x=>x.id!==id);

    const listing=state.listings.find(x=>x.id===order.listingId);
    if(listing){
      const stillHasOrder=state.orders.some(o=>o.listingId===listing.id && o.status!=='CANCELLED');
      if(!stillHasOrder){
        const db=mainDB();
        const stockStillExists=!!db?.purchases?.some(p=>p.id===listing.inventoryId);
        listing.status=stockStillExists ? 'LISTED' : 'SOLD';
        listing.updatedAt=nowISO();
      }
    }

    saveState(); render();

    // Refresh the main app if we changed its sales data directly.
    if(removedMain){
      location.reload();
    }
  }

  function exportData(){
    return {module:'gengrail-ebay',version:5,exportedAt:nowISO(),data:clone(state)};
  }

  function importData(payload){
    if(!payload) return false;
    const incoming=payload.module==='gengrail-ebay'?payload.data:(payload.ebay||payload);
    if(!incoming||typeof incoming!=='object') return false;
    state={
      ...clone(defaults),...incoming,
      connection:{...defaults.connection,...(incoming.connection||{})},
      live:{...defaults.live,...(incoming.live||{})},
      settings:{...defaults.settings,...(incoming.settings||{})}
    };
    saveState();render();return true;
  }

  function setConnection(status,sellerName=''){
    state.connection.status=status;
    if(sellerName) state.connection.sellerName=sellerName;
    saveState();render();
  }

  function markSynced(){
    state.connection.lastSync=nowISO();
    saveState();render();
  }

  function injectStyles(){
    if(document.getElementById('gengrail-ebay-styles')) return;
    const s=document.createElement('style');
    s.id='gengrail-ebay-styles';
    s.textContent=`
      #gengrail-ebay-channel{max-width:1000px;margin:18px auto;font-family:system-ui,-apple-system,sans-serif;color:#f4f1ea}
      #gengrail-ebay-channel *{box-sizing:border-box}
      .ge-panel{background:linear-gradient(#171717,#101010);border:1px solid #303030;border-radius:13px;padding:14px;box-shadow:6px 6px #000;margin-top:12px}
      .ge-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .ge-title{font:24px Impact,sans-serif;letter-spacing:.04em;margin:0}.ge-title b{color:#e0ad16}
      .ge-badge{display:inline-block;border:1px solid #66491d;background:#171107;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;color:#f2c84b}
      .ge-badge.ok{border-color:#315d3e;background:#101b13;color:#82dda0}
      .ge-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
      .ge-stat{background:#090909;border:1px solid #2d2d2d;border-radius:8px;padding:11px}
      .ge-stat small{color:#888;font-weight:800;font-size:10px}.ge-stat b{display:block;font-size:21px;margin-top:3px}
      .ge-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      .ge-btn{background:#e0ad16;border:0;border-radius:7px;padding:12px 14px;font-weight:900;color:#080808}
      .ge-btn.alt{background:#252525;color:#fff;border:1px solid #444}
      .ge-btn.danger{background:#5b2020;color:#fff;border:1px solid #8a3b3b;padding:7px 10px;margin-top:9px}
      .ge-note{border-left:4px solid #e0ad16;padding:10px;background:#0a0a0a;color:#ccc;font-size:12px;line-height:1.5;margin-top:10px}
      .ge-section-title{font:18px Impact,sans-serif;letter-spacing:.04em;margin:15px 0 8px;color:#f2c84b}
      .ge-card{background:#090909;border:1px solid #2d2d2d;border-radius:8px;padding:11px;margin:7px 0}
      .ge-card-top{display:flex;justify-content:space-between;gap:10px}.ge-card-title{font-weight:900}.ge-card-sub{font-size:10px;color:#888;margin-top:3px}
      .ge-status{font-size:10px;font-weight:900;color:#82dda0}.ge-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
      .ge-row span{display:block;color:#888;font-size:9px}.ge-row b{font-size:13px}
      .ge-empty{color:#777;font-size:11px;padding:8px 0}
      .ge-modal{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:12px}
      .ge-sheet{width:min(700px,100%);max-height:90vh;overflow:auto;background:#141414;border:1px solid #3a3a3a;border-radius:16px 16px 8px 8px;padding:16px}
      .ge-close{float:right;background:none;border:0;color:#aaa;font-size:24px}.ge-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ge-form .full{grid-column:1/-1}
      .ge-form label{display:block;color:#aaa;font-size:11px;font-weight:800;margin-bottom:5px}.ge-form input,.ge-form select{width:100%;background:#080808;color:#fff;border:1px solid #3a3a3a;border-radius:7px;padding:11px;font-size:16px}
      @media(max-width:700px){.ge-grid{grid-template-columns:1fr 1fr}.ge-form{grid-template-columns:1fr}.ge-form .full{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function modal(inner){
    const w=document.createElement('div');
    w.className='ge-modal';
    w.innerHTML=`<div class="ge-sheet"><button class="ge-close">×</button>${inner}</div>`;
    w.querySelector('.ge-close').onclick=()=>w.remove();
    w.onclick=e=>{if(e.target===w)w.remove()};
    document.body.appendChild(w);
    return w;
  }


  function publishingSetupForm(){
    const s=state.settings;
    const payment=state.live.paymentPolicies||[];
    const fulfillment=state.live.fulfillmentPolicies||[];
    const returns=state.live.returnPolicies||[];
    const opt=(rows,idKey,nameKey,current)=>[
      '<option value="">Choose…</option>',
      ...rows.map(x=>`<option value="${esc(x[idKey]||'')}" ${String(x[idKey]||'')===String(current||'')?'selected':''}>${esc(x[nameKey]||x[idKey]||'Unnamed policy')}</option>`)
    ].join('');
    const m=modal(`
      <h3>eBay publishing setup</h3>
      <div class="ge-note">${state.live.lastPoliciesSync
        ? `Live eBay policies last synced <b>${esc(new Date(state.live.lastPoliciesSync).toLocaleString('en-GB'))}</b>.`
        : 'No live eBay policy sync has been completed yet.'}</div>
      <form class="ge-form" id="ge-publish-settings">
        <div><label>Marketplace</label><select name="marketplaceId"><option value="EBAY_GB">eBay UK (EBAY_GB)</option></select></div>
        <div><label>Currency</label><input name="currency" value="${esc(s.currency||'GBP')}"></div>
        <div><label>Format</label><select name="format"><option value="FIXED_PRICE">Fixed price</option></select></div>
        <div><label>Duration</label><select name="listingDuration"><option value="GTC">Good 'Til Cancelled (GTC)</option></select></div>
        <div class="full"><label>Merchant location key</label><input name="merchantLocationKey" value="${esc(s.merchantLocationKey||'')}" placeholder="Still needs an Inventory Location API endpoint"></div>
        <div><label>Payment policy</label><select name="paymentPolicyId">${opt(payment,'paymentPolicyId','name',s.paymentPolicyId)}</select></div>
        <div><label>Fulfilment policy</label><select name="fulfillmentPolicyId">${opt(fulfillment,'fulfillmentPolicyId','name',s.fulfillmentPolicyId)}</select></div>
        <div><label>Return policy</label><select name="returnPolicyId">${opt(returns,'returnPolicyId','name',s.returnPolicyId)}</select></div>
        <button class="ge-btn full" type="submit">SAVE PUBLISHING SETUP</button>
      </form>
      <button class="ge-btn alt" id="ge-sync-policies" style="margin-top:8px">SYNC LIVE EBAY POLICIES</button>
    `);
    const f=m.querySelector('form');
    f.onsubmit=e=>{
      e.preventDefault();
      Object.assign(state.settings,Object.fromEntries(new FormData(f).entries()));
      saveState();render();m.remove();
    };
    m.querySelector('#ge-sync-policies').onclick=async()=>{
      m.remove();
      await syncLive();
      publishingSetupForm();
    };
  }

  function editDraftForm(id){
    const x=state.listings.find(v=>v.id===id);
    if(!x)return;
    const missing=localReadiness(x);
    const m=modal(`
      <h3>eBay draft details</h3>
      <div class="ge-note">${missing.length
        ? `Local draft still needs: <b>${esc(missing.join(', '))}</b>.`
        : '<b>Local listing data complete.</b> Seller policies/location and image upload will be attached by the API bridge.'}</div>
      <form class="ge-form" id="ge-edit-draft">
        <div class="full"><label>eBay title</label><input name="title" value="${esc(x.title||'')}" maxlength="80"></div>
        <div><label>SKU</label><input name="sku" value="${esc(x.sku||'')}"></div>
        <div><label>List price (£)</label><input name="listPrice" type="number" min="0" step=".01" value="${num(x.listPrice).toFixed(2)}"></div>
        <div><label>Quantity</label><input name="quantity" type="number" min="1" value="${Math.max(1,num(x.quantity))}"></div>
        <div><label>eBay leaf Category ID</label><input name="categoryId" inputmode="numeric" value="${esc(x.categoryId||'')}" placeholder="Resolved by Taxonomy API"></div>
        <div><label>API condition</label><select name="conditionApi">
          <option value="USED_VERY_GOOD" ${x.conditionApi==='USED_VERY_GOOD'?'selected':''}>Ungraded — USED_VERY_GOOD</option>
          <option value="LIKE_NEW" ${x.conditionApi==='LIKE_NEW'?'selected':''}>Graded — LIKE_NEW</option>
          <option value="NEW" ${x.conditionApi==='NEW'?'selected':''}>New — NEW</option>
        </select></div>
        <div><label>Condition descriptor ID</label><input name="conditionDescriptorName" value="${esc(x.conditionDescriptorName||'')}" placeholder="e.g. Card Condition descriptor ID"></div>
        <div><label>Descriptor value ID</label><input name="conditionDescriptorValue" value="${esc(x.conditionDescriptorValue||'')}" placeholder="Resolved by Metadata API"></div>
        <div class="full"><label>Item specifics</label><textarea name="aspects" placeholder="One per line, for example&#10;Game: Pokémon TCG&#10;Card Name: Pikachu&#10;Set: Base Set">${esc(aspectsText(x.aspects||{}))}</textarea></div>
        <div class="full"><label>Description</label><textarea name="description">${esc(x.description||'')}</textarea></div>
        <button class="ge-btn full" type="submit">SAVE EBAY DETAILS</button>
      </form>
      <button class="ge-btn alt" id="ge-view-payload" style="margin-top:8px">VIEW API PAYLOAD</button>
    `);
    const f=m.querySelector('form');
    f.onsubmit=e=>{
      e.preventDefault();
      const d=Object.fromEntries(new FormData(f).entries());
      x.title=d.title.trim();x.sku=d.sku.trim();x.listPrice=num(d.listPrice);x.quantity=Math.max(1,parseInt(d.quantity||1,10));
      x.categoryId=d.categoryId.trim();x.conditionApi=d.conditionApi;
      x.conditionDescriptorName=d.conditionDescriptorName.trim();x.conditionDescriptorValue=d.conditionDescriptorValue.trim();
      x.aspects=parseAspects(d.aspects);x.description=d.description.trim();x.updatedAt=nowISO();
      saveState();render();m.remove();
    };
    m.querySelector('#ge-view-payload').onclick=()=>{
      const payload=apiPayload(x);
      const p=modal(`<h3>Inventory API payload preview</h3><div class="ge-note">Preview only — no eBay request is sent. Local device photos still need to be uploaded/hosted before the final imageUrls can be supplied.</div><pre style="white-space:pre-wrap;overflow:auto;background:#080808;border:1px solid #333;border-radius:8px;padding:10px;font-size:11px">${esc(JSON.stringify(payload,null,2))}</pre>`);
    };
  }

  function listingForm(){
    const stock=stockOptions();
    const opts=stock.map(x=>`<option value="${esc(x.id)}" data-title="${esc(x.title)}" data-cost="${x.unitCost}" data-cat="${esc(x.category)}">${esc(x.title)} — ${x.qtyLeft} left — ${money(x.unitCost)} each</option>`).join('');
    const m=modal(`
      <h3>Add eBay listing</h3>
      <form class="ge-form" id="ge-listing-form">
        <div class="full"><label>Link to Gengrail Stock</label><select name="inventoryId"><option value="">Choose stock item…</option>${opts}</select></div>
        <div class="full"><label>Item / card title</label><input name="title" required></div>
        <div><label>Purchase cost per item</label><input name="purchaseCost" type="number" min="0" step=".01"></div>
        <div><label>eBay list price</label><input name="listPrice" type="number" min="0" step=".01" required></div>
        <div><label>Quantity</label><input name="quantity" type="number" min="1" value="1"></div>
        <div><label>SKU</label><input name="sku"></div>
        <div><label>eBay item ID</label><input name="ebayItemId"></div>
        <div><label>Category</label><input name="category"></div>
        <div><label>Condition</label><select name="condition"><option>Ungraded</option><option>Graded</option><option>New</option><option>Used</option></select></div>
        <div class="full"><label>eBay listing URL</label><input name="ebayUrl" type="url"></div>
        <button class="ge-btn full" type="submit">SAVE LISTING</button>
      </form>
    `);
    const f=m.querySelector('form');
    f.elements.inventoryId.onchange=()=>{
      const o=f.elements.inventoryId.selectedOptions[0];
      if(o?.value){
        f.elements.title.value=o.dataset.title||'';
        f.elements.purchaseCost.value=num(o.dataset.cost).toFixed(2);
        f.elements.category.value=o.dataset.cat||'';
      }
    };
    f.onsubmit=e=>{
      e.preventDefault();
      if(!f.elements.inventoryId.value) return alert('Choose the matching Gengrail Stock item first.');
      addListing(Object.fromEntries(new FormData(f).entries()));
      m.remove();
    };
  }

  function saleForm(){
    const listed=state.listings.filter(x=>x.status==='LISTED');
    const opts=listed.map(x=>`<option value="${esc(x.id)}">${esc(x.title)} — ${money(x.listPrice)}</option>`).join('');
    const m=modal(`
      <h3>Record eBay sale</h3>
      <div class="ge-note">This transaction will be passed directly into your existing Sales tab using the linked Stock item.</div>
      <form class="ge-form" id="ge-sale-form">
        <div class="full"><label>eBay listing</label><select name="listingId"><option value="">Choose listing…</option>${opts}</select></div>
        <div><label>Sale date</label><input name="soldAt" type="date" value="${today()}"></div>
        <div><label>Quantity sold</label><input name="quantity" type="number" min="1" value="1"></div>
        <div><label>Total sale price (£)</label><input name="salePrice" type="number" min="0" step=".01" required></div>
        <div><label>eBay fees (£)</label><input name="platformFees" type="number" min="0" step=".01" value="0"></div>
        <div><label>Postage cost (£)</label><input name="postageCost" type="number" min="0" step=".01" value="0"></div>
        <div><label>Packaging allocation (£)</label><input name="packagingCost" type="number" min="0" step=".01" value="0"></div>
        <div><label>Other sale costs (£)</label><input name="otherCosts" type="number" min="0" step=".01" value="0"></div>
        <div><label>eBay order ID</label><input name="ebayOrderId"></div>
        <div><label>Buyer reference</label><input name="buyerRef"></div>
        <button class="ge-btn full" type="submit">RECORD & FEED TO SALES</button>
      </form>
    `);
    const f=m.querySelector('form');
    f.elements.listingId.onchange=()=>{
      const x=state.listings.find(v=>v.id===f.elements.listingId.value);
      if(x && !f.elements.salePrice.value) f.elements.salePrice.value=num(x.listPrice).toFixed(2);
    };
    f.onsubmit=e=>{
      e.preventDefault();
      if(!f.elements.listingId.value) return alert('Choose the eBay listing that sold.');
      recordSale(Object.fromEntries(new FormData(f).entries()));
      m.remove();
    };
  }

  function render(){
    injectStyles();
    let root=document.getElementById('gengrail-ebay-channel');
    if(!root){
      root=document.createElement('section');
      root.id='gengrail-ebay-channel';
      document.getElementById('sales')?.appendChild(root) || document.querySelector('.app')?.appendChild(root) || document.body.appendChild(root);
    }

    const s=getSummary();
    const linked=!!mainDB() && !!document.getElementById('adds');
    const status=state.connection.status==='connected'?'Connected':'Awaiting eBay API';

    const listings=state.listings.slice(0,10).map(x=>`
      <div class="ge-card">
        <div class="ge-card-top"><div><div class="ge-card-title">${esc(x.title)}</div><div class="ge-card-sub">${esc(x.sku)} · linked to Stock</div></div><div class="ge-status">${esc(x.status)}</div></div>
        <div class="ge-row"><div><span>COST</span><b>${money(x.purchaseCost)}</b></div><div><span>LISTED</span><b>${money(x.listPrice)}</b></div><div><span>CHANNEL</span><b>eBay</b></div></div>
        <div class="ge-note" style="margin-top:8px">${localReadiness(x).length
          ? `<b>API readiness:</b> ${localReadiness(x).length} local field${localReadiness(x).length===1?'':'s'} still needed`
          : '<b>API readiness:</b> local listing data complete ✓'}</div>
        <div class="ge-actions">
          <button class="ge-btn ge-edit-draft" data-id="${esc(x.id)}">EDIT EBAY DETAILS</button>
          <button class="ge-btn danger ge-del-listing" data-id="${esc(x.id)}">DELETE LISTING</button>
        </div>
      </div>`).join('');

    const sales=state.orders.slice(0,10).map(x=>`
      <div class="ge-card">
        <div class="ge-card-top"><div><div class="ge-card-title">${esc(x.title)}</div><div class="ge-card-sub">${esc(x.ebayOrderId||x.id)}${x.sku?` · SKU ${esc(x.sku)}`:''}</div></div><div class="ge-status">${x.mainLogSynced?'SALES ✓':esc(x.status||'EBAY')}</div></div>
        <div class="ge-row"><div><span>SALE</span><b>${money(x.salePrice)}</b></div><div><span>QTY</span><b>${Math.max(1,num(x.quantity))}</b></div><div><span>SOURCE</span><b>${x.source==='ebay_api'?'LIVE':'MANUAL'}</b></div></div>
        ${x.source==='ebay_api' && !x.mainLogSynced
          ? `<div class="ge-actions"><button class="ge-btn ge-feed-order" data-id="${esc(x.id)}" ${x.inventoryId?'':'disabled'}>${x.inventoryId?'FEED TO SALES':'SKU NOT LINKED'}</button></div>`
          : ''}
        <button class="ge-btn danger ge-del-sale" data-id="${esc(x.id)}">DELETE EBAY SALE</button>
      </div>`).join('');

    root.innerHTML=`
      <div class="ge-panel">
        <div class="ge-head"><h2 class="ge-title"><b>eBay</b> CHANNEL</h2><span class="ge-badge">${status}</span></div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="ge-badge ${linked?'ok':''}">${linked?'MAIN LOG LINKED ✓':'MAIN LOG NOT DETECTED'}</span>
          ${s.draftListings?`<span class="ge-badge">${s.draftListings} EBAY DRAFT${s.draftListings===1?'':'S'}</span>`:''}
        </div>

        <div class="ge-grid">
          <div class="ge-stat"><small>Active listings</small><b>${s.activeListings}</b></div>
          <div class="ge-stat"><small>Listed value</small><b>${money(s.listedValue)}</b></div>
          <div class="ge-stat"><small>eBay sales</small><b>${money(s.totalSales)}</b></div>
          <div class="ge-stat"><small>Fed to Sales</small><b>${s.fedToMainSales}</b></div>
        </div>

        <div class="ge-actions">
          <button class="ge-btn" id="ge-add-listing">+ ADD DRAFT</button>
          <button class="ge-btn alt" id="ge-record-sale">RECORD SALE</button>
          <button class="ge-btn alt" id="ge-publishing-setup">PUBLISHING SETUP</button>
          <button class="ge-btn alt" id="ge-live-sync" ${state.live.syncing?'disabled':''}>${state.live.syncing?'SYNCING…':'SYNC EBAY'}</button>
        </div>
        <div class="ge-note">${state.connection.lastError
          ? `<b>Live sync warning:</b> ${esc(state.connection.lastError)}`
          : state.connection.lastSync
            ? `Live eBay sync: <b>${esc(new Date(state.connection.lastSync).toLocaleString('en-GB'))}</b>.`
            : 'Live eBay sync has not run yet.'}</div>
        <div class="ge-note">${publishPrerequisites().length
          ? `Live publishing setup still needs: <b>${esc(publishPrerequisites().join(', '))}</b>.`
          : '<b>Seller publishing setup complete ✓</b>'}</div>

        <div class="ge-note">${linked
          ? 'This eBay channel is linked to the existing Gengrail Stock and Sales system. A successful eBay sale will populate the existing Sales log, which then drives Dashboard and Tax figures.'
          : 'The eBay panel is loaded, but the existing Gengrail business database or Sales form was not detected.'}</div>

        <div class="ge-section-title">LATEST LISTINGS</div>
        ${listings||'<div class="ge-empty">No eBay listings logged yet.</div>'}
        <div class="ge-section-title">LATEST EBAY SALES</div>
        ${sales||'<div class="ge-empty">No eBay sales logged yet.</div>'}
      </div>
    `;

    root.querySelector('#ge-add-listing').onclick=listingForm;
    root.querySelector('#ge-record-sale').onclick=saleForm;
    root.querySelector('#ge-publishing-setup').onclick=publishingSetupForm;
    root.querySelector('#ge-live-sync').onclick=()=>syncLive();
    root.querySelectorAll('.ge-feed-order').forEach(b=>b.onclick=()=>feedImportedOrder(b.dataset.id));
    root.querySelectorAll('.ge-edit-draft').forEach(b=>b.onclick=()=>editDraftForm(b.dataset.id));
    root.querySelectorAll('.ge-del-listing').forEach(b=>b.onclick=()=>deleteListing(b.dataset.id));
    root.querySelectorAll('.ge-del-sale').forEach(b=>b.onclick=()=>deleteEbaySale(b.dataset.id));
  }

  window.GengrailEbay={
    getState:()=>clone(state),
    getSummary,
    stockOptions,
    addListing,
    upsertFromStock,
    recordSale,
    deleteListing,
    deleteEbaySale,
    exactFeedToMainSales,
    exportData,
    importData,
    setConnection,
    markSynced,
    apiPayload,
    localReadiness,
    publishPrerequisites,
    syncLive,
    syncOrders,
    syncPolicies,
    feedImportedOrder,
    render,
    storageKey:EBAY_KEY
  };

  function boot(){
    recoverDraftsFromMainStock();
    render();
    setTimeout(()=>syncLive({quiet:true}),700);
  }

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && state.connection.status==='connected'){
      const last=Date.parse(state.connection.lastSync||0)||0;
      if(Date.now()-last>5*60*1000) syncLive({quiet:true});
    }
  });

  document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded',boot)
    : boot();
})();