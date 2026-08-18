/* GENGRAIL CATALOGUE LIVE PRICING v1.0
   Keeps Stock intake recommendation live as quantity / acquisition cost / category changes.
   Uses the central Gengrail Listing Policy: SEED velocity first with protected 10% net margin.
*/
(function(){
'use strict';
if(window.__gengrailCatalogueLivePricingV1)return;
window.__gengrailCatalogueLivePricingV1=true;
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(num(v));
const $=id=>document.getElementById(id);
let legacySuggested=typeof marketSuggestedPrice==='function'?marketSuggestedPrice:null;
function rawMarket(r){
 const mp=r?.marketPricing||{};
 const direct=num(mp.suggestedGbp||mp.suggestedMarketValue||mp.activeMedian||mp.median||mp.marketValue||mp.conservativeMarket);
 if(direct>0)return direct;
 const vals=[mp?.gbp?.trend,mp?.gbp?.avg7,mp?.gbp?.avg30].map(num).filter(v=>v>0).sort((a,b)=>a-b);
 if(vals.length){const i=Math.floor(vals.length/2);return vals.length%2?vals[i]:(vals[i-1]+vals[i])/2}
 const fallback=legacySuggested?num(legacySuggested(r)):0;
 return fallback>0?fallback:0;
}
function price99AtOrAbove(v){const n=num(v);if(!(n>0))return 0;const whole=Math.floor(n),at99=whole+.99;return Number((at99+1e-9>=n?at99:whole+1.99).toFixed(2))}
function recognition(){try{if(typeof currentRecognition!=='undefined'&&currentRecognition)return currentRecognition;if(typeof pendingRecognition!=='undefined'&&pendingRecognition)return pendingRecognition}catch{}return null}
function quoteFor(r){
 const policy=window.GengrailListingPolicy;if(!policy||!r)return null;
 const market=rawMarket(r);if(!(market>0))return null;
 const qty=Math.max(1,num($('pq')?.value)||1),cost=num($('pp')?.value)/qty,cat=$('pc')?.value||'Raw Single';
 const post=policy.postageFor?policy.postageFor({category:cat,market}):{buyerPost:0,outboundPost:0,pack:.30};
 const q=policy.quote({cost,market,...post});
 q.recommendedPsych=price99AtOrAbove(q.recommended);
 q.marketSource=market;
 q.costPerUnit=cost;
 return q;
}
/* Override the global intake suggestion so Use Suggested Price and saved productMeta use the live policy too. */
marketSuggestedPrice=function(r){const q=quoteFor(r);return q?.recommendedPsych||0};
function ensurePolicyLine(card){
 let line=card?.querySelector('.gengrail-live-policy');if(line)return line;
 line=document.createElement('div');line.className='gengrail-live-policy';line.style.cssText='margin-top:10px;padding:10px 12px;border-left:4px solid #82dda0;background:#07120a;color:#b8c7bc;font-size:12px;line-height:1.45;border-radius:6px';
 card?.appendChild(line);return line;
}
function updateDisplay(){
 const r=recognition(),q=quoteFor(r);if(!q)return;
 const card=document.querySelector('.ai-approved-market,.market-price-card.on');if(!card)return;
 const main=card.querySelector('.market-price-main');if(main)main.textContent=`${money(q.recommendedPsych)} suggested`;
 const line=ensurePolicyLine(card);
 if(line)line.innerHTML=`<b style="color:#82dda0">${q.mode} VELOCITY PRICE</b> · ${money(q.recommendedPsych)} recommended · protected ${Math.round(q.stage.minimumMargin*100)}% floor ${money(q.floor)} · acquisition ${money(q.costPerUnit)} / unit${q.constrained?' · <b style="color:#ffd36f">MARKET CONSTRAINED</b>':''}`;
 const panel=card.closest('.ai-approved-card,.ai-review-card')||card.parentElement;
 const buttons=[...(panel?.querySelectorAll('button')||[])];
 const use=buttons.find(b=>/USE SUGGESTED PRICE/i.test(b.textContent||''));if(use){use.disabled=false;use.dataset.liveSuggested=String(q.recommendedPsych);}
}
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(updateDisplay,60)}
function bind(){['pp','pq','pc','pcondition','pcapitalorigin'].forEach(id=>{const el=$(id);if(!el||el.dataset.gengrailLivePricingBound)return;el.dataset.gengrailLivePricingBound='1';el.addEventListener('input',schedule);el.addEventListener('change',schedule)});schedule()}
const observer=new MutationObserver(()=>bind());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();observer.observe(document.body,{childList:true,subtree:true})});else{bind();observer.observe(document.body,{childList:true,subtree:true})}
window.addEventListener('gengrail:main-updated',schedule);
window.GengrailCatalogueLivePricing={version:'1.0',recalculate:updateDisplay,quoteForCurrent:()=>quoteFor(recognition())};
})();