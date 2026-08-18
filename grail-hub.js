/* GENGRAIL GRAIL HUB v2.2 — lean buying workspace + stable discovery universe
   Opportunity Stream discovers from a stable market universe; liquidity controls affordability, not visibility.
*/
(function(){
'use strict';
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v)||0);
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]||c));
let layoutLock=null;

/*
 Direct Opportunity Stream discovery must remain responsive on mobile.
 Keep the remote discovery universe broad, but tag these requests so the legacy visual gate
 does not run expensive image verification on the whole result set. The stream itself still
 applies collector-number, accessory, vintage and grader/raw filtering before comping.
*/
(function installStableDiscoveryUniverse(){
 if(window.__gengrailStableDiscoveryUniverseInstalled)return;
 window.__gengrailStableDiscoveryUniverseInstalled=true;
 const upstreamFetch=window.fetch.bind(window);
 const SEARCH_PATH='/api/ebay/opportunities/search';
 const STABLE_MIN_CEILING=6000;
 window.fetch=function(input,init){
  try{
   const raw=input instanceof URL?input.toString():(typeof input==='string'?input:String(input?.url||''));
   if(raw&&raw.includes(SEARCH_PATH)){
    const u=new URL(raw,location.href),requested=Number(u.searchParams.get('max_price')||0);
    u.searchParams.set('_gengrail_stream','direct');
    if(requested>0){
     const discoveryCeiling=Math.max(STABLE_MIN_CEILING,requested);
     u.searchParams.set('max_price',String(discoveryCeiling));
     window.__gengrailDiscoveryUniverse={requestedLiquidityCeiling:requested,remoteDiscoveryCeiling:discoveryCeiling,principle:'liquidity_controls_affordability_not_visibility'};
    }
    if(input instanceof Request)return upstreamFetch(new Request(u.toString(),input),init);
    return upstreamFetch(u.toString(),init);
   }
  }catch(e){console.warn('[Gengrail] discovery universe patch fallback',e)}
  return upstreamFetch(input,init);
 };
})();

function state(){try{return typeof window.getGrailPlanState==='function'?window.getGrailPlanState():null}catch{return null}}
function restoreLayout(){const y=layoutLock?.scrollY??window.scrollY;document.documentElement.classList.remove('grail-hub-open');document.body.classList.remove('grail-hub-open');document.documentElement.style.overflow=layoutLock?.htmlOverflow||'';document.documentElement.style.overflowX=layoutLock?.htmlOverflowX||'';document.body.style.overflow=layoutLock?.bodyOverflow||'';document.body.style.overflowX=layoutLock?.bodyOverflowX||'';document.body.style.width=layoutLock?.bodyWidth||'';document.body.style.position=layoutLock?.bodyPosition||'';layoutLock=null;requestAnimationFrame(()=>window.scrollTo(0,y))}
function lockLayout(){if(layoutLock)return;layoutLock={scrollY:window.scrollY,htmlOverflow:document.documentElement.style.overflow,htmlOverflowX:document.documentElement.style.overflowX,bodyOverflow:document.body.style.overflow,bodyOverflowX:document.body.style.overflowX,bodyWidth:document.body.style.width,bodyPosition:document.body.style.position};document.documentElement.classList.add('grail-hub-open');document.body.classList.add('grail-hub-open');document.documentElement.style.overflow='hidden';document.documentElement.style.overflowX='hidden';document.body.style.overflow='hidden';document.body.style.overflowX='hidden';document.body.style.width='100%'}
function openExisting(matchers){const nodes=[...document.querySelectorAll('button,[role="button"],a')];const el=nodes.find(n=>matchers.some(re=>re.test((n.textContent||'').trim())));if(!el)return false;close();setTimeout(()=>el.click(),0);return true}
function ensureUiOverride(){let st=document.getElementById('grailHubV21Override');if(st)return;st=document.createElement('style');st.id='grailHubV21Override';st.textContent='.grail-hub-section:last-child{display:block!important}.grail-buying-grid{display:grid!important;grid-template-columns:1fr!important;gap:14px!important}.grail-buying-grid #grailOpportunityAction{grid-column:auto!important}.grail-buying-quick{margin-bottom:18px!important}.grail-buying-grid .grail-action-card{min-height:145px!important;width:100%!important}';document.head.appendChild(st)}
function render(){ensureUiOverride();const root=document.getElementById('grailHubOverlay');if(!root)return;const shell=root.querySelector('.grail-hub-shell');if(!shell)return;const g=state()||{},liq=Number(g.availableGrailPlanLiquidity||0),mode=String(g.mode||'SEED').toUpperCase();shell.innerHTML=`<div class="grail-hub-head"><button class="grail-hub-back" type="button" id="grailHubBack">←</button><div><div class="grail-hub-title">GRAIL HUB</div><div class="grail-hub-sub">Buying tools & live market discovery</div></div></div><section class="grail-hub-section grail-buying-quick"><div class="grail-state-strip"><div class="grail-state-cell"><small>DEPLOYABLE LIQUIDITY</small><b>${money(liq)}</b></div><div class="grail-state-cell"><small>BUYING MODE</small><b>${esc(mode)}</b></div></div></section><section class="grail-hub-section"><div class="grail-hub-section-title">BUYING WORKSPACE</div><div class="grail-action-grid grail-buying-grid"><button class="grail-action-card primary" id="grailOpportunityAction" type="button"><span class="grail-action-icon">⌁</span><b>OPPORTUNITY STREAM</b><span>Find live eBay listings priced below clean comparable listings.</span></button><button class="grail-action-card" id="grailPricingAction" type="button"><span class="grail-action-icon">£</span><b>PRICING CALCULATOR</b><span>Identify and value raw cards or graded slabs before buying or listing.</span></button></div></section>`;shell.querySelector('#grailHubBack').onclick=close;shell.querySelector('#grailOpportunityAction').onclick=()=>{if(window.GengrailSelectableStream&&typeof window.GengrailSelectableStream.render==='function')window.GengrailSelectableStream.render()};shell.querySelector('#grailPricingAction').onclick=()=>{if(!openExisting([/PRICING CALCULATOR/i,/WORK OUT TRUE VALUE/i]))alert('Pricing Calculator navigation is not available from this build yet.')};}
function open(){let root=document.getElementById('grailHubOverlay');if(!root){root=document.createElement('div');root.id='grailHubOverlay';root.className='grail-hub-overlay';root.innerHTML='<div class="grail-hub-shell"></div>';document.body.appendChild(root)}lockLayout();root.hidden=false;root.scrollTop=0;root.scrollLeft=0;render()}
function close(){const root=document.getElementById('grailHubOverlay');if(root){root.hidden=true;root.scrollTop=0;root.scrollLeft=0}restoreLayout()}
function bindBuying(){const buttons=[...document.querySelectorAll('button')];const buying=buttons.find(b=>/^BUYING$/i.test((b.querySelector('.home-label')?.textContent||b.textContent||'').trim()));if(!buying||buying.dataset.grailHubBound)return;buying.dataset.grailHubBound='1';buying.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open()},true)}
window.GengrailGrailHub={open,close,render};
window.addEventListener('gengrail:main-updated',()=>{if(!document.getElementById('grailHubOverlay')?.hidden)render()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bindBuying,0));else setTimeout(bindBuying,0);
})();