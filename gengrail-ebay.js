/*
 GENGRAIL TCG — eBay Channel v4
 Exact integration for the current Gengrail Business Log.
 ---------------------------------------------------------
 Main app storage key: gengrailBizV1
 Existing Sales form IDs:
 si, sd, sq, sp, spl, sf, spo, spa, so, snotes, adds

 This module remains pre-live-API: no eBay credentials are stored here.
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
    version: 4,
    connection: { status:'awaiting_authorisation', sellerName:'', lastSync:null },
    listings: [],
    orders: [],
    settings: { autoMarkSold:true, feedMainLog:true }
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
      status:'LISTED',
      createdAt:nowISO(),
      updatedAt:nowISO()
    };
    state.listings.unshift(listing);
    saveState(); render();
    return listing;
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
    return {module:'gengrail-ebay',version:4,exportedAt:nowISO(),data:clone(state)};
  }

  function importData(payload){
    if(!payload) return false;
    const incoming=payload.module==='gengrail-ebay'?payload.data:(payload.ebay||payload);
    if(!incoming||typeof incoming!=='object') return false;
    state={
      ...clone(defaults),...incoming,
      connection:{...defaults.connection,...(incoming.connection||{})},
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
      .ge-title{font:24px Impact,sans-serif;letter-spacing:.04em;margin:0}.ge-title b{color:#ff7a00}
      .ge-badge{display:inline-block;border:1px solid #66491d;background:#171107;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;color:#ffb04c}
      .ge-badge.ok{border-color:#315d3e;background:#101b13;color:#82dda0}
      .ge-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
      .ge-stat{background:#090909;border:1px solid #2d2d2d;border-radius:8px;padding:11px}
      .ge-stat small{color:#888;font-weight:800;font-size:10px}.ge-stat b{display:block;font-size:21px;margin-top:3px}
      .ge-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      .ge-btn{background:#ff7a00;border:0;border-radius:7px;padding:12px 14px;font-weight:900;color:#080808}
      .ge-btn.alt{background:#252525;color:#fff;border:1px solid #444}
      .ge-btn.danger{background:#5b2020;color:#fff;border:1px solid #8a3b3b;padding:7px 10px;margin-top:9px}
      .ge-note{border-left:4px solid #ff7a00;padding:10px;background:#0a0a0a;color:#ccc;font-size:12px;line-height:1.5;margin-top:10px}
      .ge-section-title{font:18px Impact,sans-serif;letter-spacing:.04em;margin:15px 0 8px;color:#ffb04c}
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
        <button class="ge-btn danger ge-del-listing" data-id="${esc(x.id)}">DELETE LISTING</button>
      </div>`).join('');

    const sales=state.orders.slice(0,10).map(x=>`
      <div class="ge-card">
        <div class="ge-card-top"><div><div class="ge-card-title">${esc(x.title)}</div><div class="ge-card-sub">${esc(x.ebayOrderId||x.id)}</div></div><div class="ge-status">${x.mainLogSynced?'SALES ✓':'EBAY ONLY'}</div></div>
        <div class="ge-row"><div><span>SALE</span><b>${money(x.salePrice)}</b></div><div><span>FEES</span><b>${money(x.platformFees)}</b></div><div><span>NET PROFIT</span><b>${money(x.netProfit)}</b></div></div>
        <button class="ge-btn danger ge-del-sale" data-id="${esc(x.id)}">DELETE EBAY SALE</button>
      </div>`).join('');

    root.innerHTML=`
      <div class="ge-panel">
        <div class="ge-head"><h2 class="ge-title"><b>eBay</b> CHANNEL</h2><span class="ge-badge">${status}</span></div>
        <div style="margin-top:8px"><span class="ge-badge ${linked?'ok':''}">${linked?'MAIN LOG LINKED ✓':'MAIN LOG NOT DETECTED'}</span></div>

        <div class="ge-grid">
          <div class="ge-stat"><small>Active listings</small><b>${s.activeListings}</b></div>
          <div class="ge-stat"><small>Listed value</small><b>${money(s.listedValue)}</b></div>
          <div class="ge-stat"><small>eBay sales</small><b>${money(s.totalSales)}</b></div>
          <div class="ge-stat"><small>Fed to Sales</small><b>${s.fedToMainSales}</b></div>
        </div>

        <div class="ge-actions">
          <button class="ge-btn" id="ge-add-listing">+ ADD LISTING</button>
          <button class="ge-btn alt" id="ge-record-sale">RECORD SALE</button>
        </div>

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
    root.querySelectorAll('.ge-del-listing').forEach(b=>b.onclick=()=>deleteListing(b.dataset.id));
    root.querySelectorAll('.ge-del-sale').forEach(b=>b.onclick=()=>deleteEbaySale(b.dataset.id));
  }

  window.GengrailEbay={
    getState:()=>clone(state),
    getSummary,
    stockOptions,
    addListing,
    recordSale,
    deleteListing,
    deleteEbaySale,
    exactFeedToMainSales,
    exportData,
    importData,
    setConnection,
    markSynced,
    render,
    storageKey:EBAY_KEY
  };

  document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded',render)
    : render();
})();