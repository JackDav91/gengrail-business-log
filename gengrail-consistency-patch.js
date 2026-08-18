/* GENGRAIL CONSISTENCY PATCH v1.0
   One commercial policy for Stock, Pricing Calculator, eBay listing and Profit Engine guardrails.
   Current seller context: eBay UK PRIVATE seller — £0 seller transaction fee; Buyer Protection is buyer-paid.
   Accounting remains factual; packaging allocation is used for unit economics only and is not double-counted in accounting KPIs.
*/
(function(){
'use strict';
if(window.__gengrailConsistencyPatchV1)return;
window.__gengrailConsistencyPatchV1=true;

const CFG_KEY='gengrail_listing_policy_v1';
const DEFAULT_CFG={sellerMode:'PRIVATE_UK',businessFeeRate:.135,businessOrderFee:.40,promotedRate:0,internationalRate:0};
const STAGES={
 SEED:{key:'SEED',minimumMargin:.10,preferredMargin:.15,minimumROI:.10,marketUndercut:.03,label:'Velocity first · protect 10%'},
 BUILD:{key:'BUILD',minimumMargin:.15,preferredMargin:.20,minimumROI:.15,marketUndercut:.02,label:'15% floor · 20% preferred · protect velocity'},
 SCALE:{key:'SCALE',minimumMargin:.15,preferredMargin:.20,minimumROI:.20,marketUndercut:.01,label:'15% floor · 20% preferred'}
};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const r2=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(num(v));
const byId=id=>document.getElementById(id);
function readCfg(){try{return {...DEFAULT_CFG,...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch{return {...DEFAULT_CFG}}}
function writeCfg(next){const cfg={...readCfg(),...next};try{localStorage.setItem(CFG_KEY,JSON.stringify(cfg))}catch{}return cfg}
function currentMode(){try{const g=typeof window.getGrailPlanState==='function'?window.getGrailPlanState():null;const k=String(g?.mode||'SEED').toUpperCase();return STAGES[k]?k:'SEED'}catch{return'SEED'}}
function stage(mode=currentMode()){return STAGES[String(mode||'SEED').toUpperCase()]||STAGES.SEED}
function sellerMode(){return String(readCfg().sellerMode||'PRIVATE_UK').toUpperCase()}
function sellerFee({itemPrice=0,buyerPost=0,mode=sellerMode(),businessFeeRate=null,businessOrderFee=null,promotedRate=null,internationalRate=null}={}){
 const cfg=readCfg(),total=Math.max(0,num(itemPrice)+num(buyerPost));
 const m=String(mode||cfg.sellerMode).toUpperCase();
 const promo=Math.max(0,num(promotedRate??cfg.promotedRate)),intl=Math.max(0,num(internationalRate??cfg.internationalRate));
 if(m==='PRIVATE_UK')return r2(total*(promo+intl));
 const rate=Math.max(0,num(businessFeeRate??cfg.businessFeeRate)),fixed=Math.max(0,num(businessOrderFee??cfg.businessOrderFee));
 return r2(total*(rate+promo+intl)+fixed);
}
function unitProfit({itemPrice=0,cost=0,buyerPost=0,outboundPost=0,pack=0,other=0,mode=sellerMode(),feeOverride=null}={}){
 const price=Math.max(0,num(itemPrice)),bp=Math.max(0,num(buyerPost)),fees=feeOverride==null?sellerFee({itemPrice:price,buyerPost:bp,mode}):Math.max(0,num(feeOverride));
 const profit=r2(price+bp-fees-Math.max(0,num(outboundPost))-Math.max(0,num(pack))-Math.max(0,num(other))-Math.max(0,num(cost)));
 return {itemPrice:price,buyerPost:bp,fees,profit,margin:price>0?profit/price:0,roi:num(cost)>0?profit/num(cost):null,grossCash:r2(price+bp)};
}
function solveFloor({cost=0,buyerPost=0,outboundPost=0,pack=0,other=0,targetMargin=.10,mode=sellerMode()}={}){
 const target=Math.max(0,Math.min(.60,num(targetMargin))),works=p=>{const e=unitProfit({itemPrice:p,cost,buyerPost,outboundPost,pack,other,mode});return e.margin+1e-9>=target&&e.profit>=0};
 let lo=0,hi=Math.max(1,num(cost)+num(outboundPost)+num(pack)+num(other)+10);
 for(let i=0;i<30&&!works(hi);i++)hi*=1.6;
 for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(works(mid))hi=mid;else lo=mid}
 return r2(Math.ceil(hi*100)/100);
}
function quote({cost=0,market=0,buyerPost=0,outboundPost=0,pack=0,other=0,mode=currentMode()}={}){
 const st=stage(mode),mkt=Math.max(0,num(market)),floor=solveFloor({cost,buyerPost,outboundPost,pack,other,targetMargin:st.minimumMargin,mode:sellerMode()});
 const competitive=mkt>0?r2(mkt*(1-st.marketUndercut)):floor;
 const recommended=r2(Math.max(floor,competitive));
 const preferredFloor=solveFloor({cost,buyerPost,outboundPost,pack,other,targetMargin:st.preferredMargin,mode:sellerMode()});
 const economics=unitProfit({itemPrice:recommended,cost,buyerPost,outboundPost,pack,other,mode:sellerMode()});
 const constrained=mkt>0&&floor>mkt+.009;
 return {mode:st.key,stage:st,market:mkt,floor,preferredFloor,competitive,recommended,constrained,economics,sellerMode:sellerMode()};
}
function marketFromRecognition(r){
 const m=r?.marketPricing||r?.pricing||{};
 const vals=[m.suggestedMarketValue,m.activeMedian,m.median,m.marketValue,m.conservativeMarket,r?.suggestedListPrice].map(num).filter(v=>v>0);
 return vals[0]||0;
}
function postageFor({category='Raw Single',market=0}={}){
 try{const p=window.GengrailPostage?.autoSelect?.({category,value:market})||{};return {buyerPost:num(p.buyerPost),outboundPost:num(p.postCost),pack:num(p.packCost)}}catch{return {buyerPost:0,outboundPost:0,pack:.30}}
}
function quoteStock(p){
 const market=typeof window.marketValueFromProductMeta==='function'?num(window.marketValueFromProductMeta(p)):marketFromRecognition(p?.productMeta||{});
 const post=postageFor({category:p?.cat||'Raw Single',market});
 const unitCost=num(p?.q)>0?num(p.cost)/num(p.q):num(p?.cost);
 return quote({cost:unitCost,market,...post});
}

/* Existing Profit Engine databases are migrated on every load so old 30% SEED rules cannot survive in local storage. */
function migrateProfitPolicy(){
 try{
  if(typeof db==='undefined'||!db||!window.GengrailProfitEngine)return;
  const s=window.GengrailProfitEngine.ensureState(db),gp=s.config.grailPlan||(s.config.grailPlan={});
  gp.modes=[
   {key:'SEED',min:0,max:499.99,purpose:'Velocity first while building the bankroll',minimumROI:10,minimumNetMargin:10,preferredNetMargin:15,minimumConfidence:.80},
   {key:'BUILD',min:500,max:1999.99,purpose:'Compound with velocity',minimumROI:15,minimumNetMargin:15,preferredNetMargin:20,minimumConfidence:.80},
   {key:'SCALE',min:2000,max:null,purpose:'Deploy capital into stronger absolute opportunities',minimumROI:20,minimumNetMargin:15,preferredNetMargin:20,minimumConfidence:.80}
  ];
  gp.listingPolicyVersion=1;gp.velocityFirst=true;
  if(typeof save==='function')save();
 }catch(e){console.warn('[Gengrail consistency] Profit policy migration skipped',e)}
}

/* Raw + graded catalogue suggestions now use the same stage-aware listing policy. */
try{
 const legacyMarketSuggested=typeof marketSuggestedPrice==='function'?marketSuggestedPrice:null;
 marketSuggestedPrice=function(r){
  const market=marketFromRecognition(r)||(legacyMarketSuggested?num(legacyMarketSuggested(r)):0);if(!(market>0))return 0;
  const q=Math.max(1,num(byId('pq')?.value)||1),cost=num(byId('pp')?.value)/q,cat=byId('pc')?.value||'Raw Single',post=postageFor({category:cat,market});
  return quote({cost,market,...post}).recommended;
 };
}catch(e){console.warn('[Gengrail consistency] market suggestion hook skipped',e)}

/* Pricing Calculator: private eBay means zero seller transaction fee. Optional promoted/international fees remain seller costs. */
try{
 const legacyFee=typeof priceFeeBreakdown==='function'?priceFeeBreakdown:null;
 if(legacyFee)priceFeeBreakdown=function(itemPrice){
  const platform=typeof pricePlatform!=='undefined'?String(pricePlatform):'ebay';
  if(platform!=='ebay'||sellerMode()!=='PRIVATE_UK')return legacyFee(itemPrice);
  const buyerPost=num(byId('priceBuyerPost')?.value),total=num(itemPrice)+buyerPost,promo=Math.max(0,num(byId('priceAdRate')?.value)/100),intl=Math.max(0,num(byId('priceIntl')?.value)/100),adFee=total*promo,intlFee=total*intl;
  return {platformFee:0,adFee,intlFee,totalFees:adFee+intlFee,label:'eBay Private UK',detail:'£0 seller transaction fee. Buyer Protection is charged to the buyer and is not a seller cost.',buyerTotal:total};
 };
 adaptiveBuyTier=function(){const st=stage();return {label:`${st.key} VELOCITY`,margin:st.minimumMargin,roi:st.minimumROI,minProfit:0,baseBuffer:st.key==='SEED'?.02:st.key==='BUILD'?.03:.04}};
}catch(e){console.warn('[Gengrail consistency] calculator hooks skipped',e)}

function refreshCalculatorRecommendation(){
 try{
  if(typeof priceCalc!=='function'||!byId('priceMarketValue'))return;
  const legacy=priceCalc;
  if(legacy.__consistencyWrapped)return;
  const wrapped=function(){legacy();try{
   const market=num(byId('priceMarketValue')?.value),hasCost=String(byId('priceCost')?.value||'').trim()!=='',cost=hasCost?num(byId('priceCost')?.value):0,buyerPost=num(byId('priceBuyerPost')?.value),outboundPost=num(byId('pricePostCost')?.value),pack=num(byId('pricePack')?.value),q=quote({cost,market,buyerPost,outboundPost,pack}),e=q.economics;
   if(market>0){if(typeof lastSuggestedPrice!=='undefined')lastSuggestedPrice=q.recommended;if(byId('priceSuggested'))byId('priceSuggested').textContent=money(q.recommended);if(byId('priceProfit'))byId('priceProfit').textContent=hasCost?`At your entered buy cost: ${money(e.profit)} projected unit profit · ${(e.margin*100).toFixed(1)}% net margin · ${money(e.fees)} seller fees.`:`${q.mode} recommendation: price for velocity while protecting a ${(q.stage.minimumMargin*100).toFixed(0)}% net margin floor.`;if(byId('pricePolicyStrip'))byId('pricePolicyStrip').innerHTML=`<b>${q.mode} LISTING POLICY</b> · velocity price ${money(q.competitive)} · protected floor ${money(q.floor)} · preferred ${(q.stage.preferredMargin*100).toFixed(0)}% margin${q.constrained?' · <strong>MARKET CONSTRAINED</strong>':''}.`;}
  }catch(err){console.warn('[Gengrail consistency] calculator recommendation',err)}};wrapped.__consistencyWrapped=true;priceCalc=wrapped;
 }catch(e){console.warn('[Gengrail consistency] calculator wrapper skipped',e)}
}

/* Drafting from Stock uses the same recommendation instead of cost × 1.30. */
function hookEbayDraft(){
 try{
  if(typeof prepareEbayFromStock!=='function'||prepareEbayFromStock.__consistencyWrapped)return;
  const legacy=prepareEbayFromStock;
  const wrapped=function(pid){const out=legacy.apply(this,arguments);try{if(typeof db!=='undefined'){const p=(db.purchases||[]).find(x=>String(x.id)===String(pid));if(p){const q=quoteStock(p),el=byId('ed-price');if(el&&q.recommended>0){el.value=q.recommended.toFixed(2);el.dataset.gengrailFloor=String(q.floor);el.dataset.gengrailMode=q.mode;el.title=q.constrained?`${q.mode}: required floor ${money(q.floor)} is above current market evidence.`:`${q.mode}: velocity recommendation; protected floor ${money(q.floor)}.`;}}}}catch(e){console.warn('[Gengrail consistency] eBay draft pricing',e)}return out};wrapped.__consistencyWrapped=true;prepareEbayFromStock=wrapped;
 }catch(e){console.warn('[Gengrail consistency] eBay draft hook skipped',e)}
}

/* Final eBay publish guardrail: no accidental listing below the current stage floor. */
function hookEbayPublish(){
 try{
  const api=window.GengrailEbay;if(!api||typeof api.publishOffer!=='function'||api.publishOffer.__consistencyWrapped)return;
  const legacy=api.publishOffer.bind(api);
  const wrapped=async function(payload){
   try{if(typeof db!=='undefined'&&payload?.sku){const p=(db.purchases||[]).find(x=>String(x.sku)===String(payload.sku));if(p){const q=quoteStock(p),price=num(payload.price);if(price+0.009<q.floor)throw new Error(`Gengrail ${q.mode} floor protects ${Math.round(q.stage.minimumMargin*100)}% net margin. Minimum viable item price is ${money(q.floor)}; entered price is ${money(price)}.`)}}}catch(e){if(/^Gengrail /.test(String(e?.message||''))){alert(e.message);throw e}console.warn('[Gengrail consistency] publish guardrail',e)}
   return legacy(payload);
  };wrapped.__consistencyWrapped=true;api.publishOffer=wrapped;
 }catch(e){console.warn('[Gengrail consistency] publish hook skipped',e)}
}

/* Manual Sales: capture buyer-paid postage separately so unit profit matches imported eBay sales. */
function patchManualSale(){
 const salePrice=byId('sp'),saveBtn=byId('adds');if(!salePrice||!saveBtn)return;
 if(!byId('sbp')){const box=document.createElement('div');box.innerHTML='<label>Buyer postage charged (£)</label><input id="sbp" step=".01" type="number" value="0">';salePrice.closest('div')?.insertAdjacentElement('afterend',box)}
 if(saveBtn.__buyerPostWrapped)return;
 const legacy=saveBtn.onclick;saveBtn.onclick=function(e){const bp=num(byId('sbp')?.value),before=(typeof db!=='undefined'&&Array.isArray(db.sales))?db.sales.length:0;const out=legacy?.call(this,e);try{if(typeof db!=='undefined'&&db.sales.length>before){const s=db.sales[db.sales.length-1];s.buyerPost=bp;if(sellerMode()==='PRIVATE_UK'&&/^ebay$/i.test(String(s.pl||'')))s.fee=0;if(byId('sbp'))byId('sbp').value='0';if(typeof save==='function')save()}}catch(err){console.warn('[Gengrail consistency] manual buyer postage',err)}return out};saveBtn.__buyerPostWrapped=true;
}

function mountSellerModeUi(){
 const anchor=byId('priceBuyingStrategy');if(!anchor||byId('gengrailEbaySellerMode'))return;
 const row=document.createElement('div');row.className='full';row.innerHTML=`<label>eBay seller mode</label><select id="gengrailEbaySellerMode"><option value="PRIVATE_UK">Private UK — £0 transaction fee</option><option value="BUSINESS_UK">Business UK — seller fee schedule</option></select><div class="note" style="margin-top:6px">Private UK: eBay Buyer Protection is paid by the buyer and is not deducted from your item proceeds. Actual postage, packaging and optional promoted/international fees remain costs.</div>`;
 anchor.closest('div')?.insertAdjacentElement('afterend',row);const sel=byId('gengrailEbaySellerMode');sel.value=sellerMode();sel.addEventListener('change',()=>{writeCfg({sellerMode:sel.value});try{priceCalc()}catch{}});
}
function mountStockPolicyNote(){const el=byId('plist');if(!el||byId('gengrailStockPolicyNote'))return;const n=document.createElement('div');n.id='gengrailStockPolicyNote';n.className='note';n.style.marginTop='6px';n.textContent=`${stage().key}: recommended list price prioritises velocity while protecting the ${Math.round(stage().minimumMargin*100)}% net-margin floor.`;el.closest('div')?.appendChild(n)}

function init(){migrateProfitPolicy();refreshCalculatorRecommendation();hookEbayDraft();hookEbayPublish();patchManualSale();mountSellerModeUi();mountStockPolicyNote();document.documentElement.dataset.gengrailEbaySellerMode=sellerMode();window.dispatchEvent(new CustomEvent('gengrail:consistency-ready',{detail:{version:1,sellerMode:sellerMode(),stage:currentMode()}}))}
window.GengrailListingPolicy={version:1,STAGES,readConfig:readCfg,setConfig:writeCfg,currentMode,stage,sellerMode,sellerFee,unitProfit,solveFloor,quote,quoteStock,marketFromRecognition,postageFor};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
window.addEventListener('gengrail:main-updated',()=>setTimeout(()=>{migrateProfitPolicy();hookEbayPublish();mountStockPolicyNote()},0));
})();