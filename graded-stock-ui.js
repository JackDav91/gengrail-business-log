(()=>{
'use strict';
const $=id=>document.getElementById(id);
let active=false,mode='';
function addStyle(){if($('gradedStockUiStyle'))return;const s=document.createElement('style');s.id='gradedStockUiStyle';s.textContent=`
.product-intake-launcher.stock-intake-active .compact-intake-note,
.product-intake-launcher.stock-intake-active .product-intake-grid,
.product-intake-launcher.stock-intake-active>.recognition-ready,
.product-intake-launcher.stock-intake-active>[data-graded-status="stock"]{display:none!important}
.product-intake-launcher.stock-intake-active{padding-bottom:0}
#aiIntakeWorkspace.graded-stock-workspace{display:block!important;border-color:#6b5215;border-left-color:#e0ad16;background:linear-gradient(180deg,#151107 0%,#090909 100%)}
#aiIntakeWorkspace.graded-stock-workspace #gradedStockBridge{margin:0!important;border:0!important;border-bottom:1px solid rgba(224,173,22,.22)!important;border-radius:0!important;background:transparent!important;padding:16px!important}
#aiIntakeWorkspace.graded-stock-workspace #stockEntryPanel.ai-integrated{display:block!important}
.stock-intake-reset{display:block;width:100%;margin:12px 0 0;padding:12px 14px;border-radius:10px;border:1px solid #494949;background:#242424;color:#fff;font-weight:900;letter-spacing:.02em}
.stock-intake-reset:active{transform:translateY(1px)}
`;document.head.appendChild(s)}
function launcher(){return document.querySelector('.product-intake-launcher')}
function workspace(){return $('aiIntakeWorkspace')}
function panel(){return $('stockEntryPanel')}
function slabCard(){return $('gradedStockBridge')}
function removeReset(){document.querySelector('.stock-intake-reset')?.remove()}
function reset(){active=false;mode='';const l=launcher(),w=workspace(),p=panel(),b=slabCard();l?.classList.remove('stock-intake-active');w?.classList.remove('graded-stock-workspace');removeReset();if(p){p.classList.remove('ai-integrated');if(l&&p.parentNode===w)l.after(p)}if(b)b.hidden=true}
function ensureReset(host,before){if(document.querySelector('.stock-intake-reset'))return;const r=document.createElement('button');r.type='button';r.className='stock-intake-reset';r.textContent='CHANGE / ADD ANOTHER CARD';r.onclick=()=>{reset();const l=launcher();setTimeout(()=>l?.scrollIntoView({behavior:'smooth',block:'start'}),20)};host.insertBefore(r,before||null)}
function activateManual(){const l=launcher(),p=panel();if(!l||!p||p.hidden)return;active=true;mode='manual';addStyle();l.classList.add('stock-intake-active');ensureReset(p,p.querySelector('.actions'));setTimeout(()=>p.scrollIntoView({behavior:'smooth',block:'start'}),30)}
function activateRaw(){const l=launcher(),w=workspace(),p=panel();if(!l||!w||w.hidden)return;active=true;mode='raw';addStyle();l.classList.add('stock-intake-active');if(p&&!p.hidden)ensureReset(w,p);setTimeout(()=>w.scrollIntoView({behavior:'smooth',block:'start'}),30)}
function activateGraded(){const b=slabCard(),p=panel(),w=workspace(),l=launcher();if(!b||!p||!w||!l||b.hidden)return;active=true;mode='graded';addStyle();l.classList.add('stock-intake-active');w.hidden=false;w.classList.add('graded-stock-workspace');p.classList.add('ai-integrated');if($('stockEntryTitle'))$('stockEntryTitle').textContent='PURCHASE DETAILS';if(b.parentNode!==w)w.prepend(b);if(p.parentNode!==w)w.appendChild(p);p.hidden=false;ensureReset(w,p);setTimeout(()=>w.scrollIntoView({behavior:'smooth',block:'start'}),30)}
function evaluate(){const b=slabCard(),w=workspace(),p=panel();if(b&&!b.hidden){if(mode!=='graded')activateGraded();return}if(w&&!w.hidden){if(!active||mode!=='raw')activateRaw();return}if(p&&!p.hidden){if(!active||mode!=='manual')activateManual();return}if(active)reset()}
function watch(){addStyle();const mo=new MutationObserver(()=>setTimeout(evaluate,0));mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});$('startManualIntake')?.addEventListener('click',()=>setTimeout(evaluate,60));$('cancelStockEntry')?.addEventListener('click',()=>setTimeout(reset,0));$('addp')?.addEventListener('click',()=>setTimeout(()=>{if(panel()?.hidden)reset();else evaluate()},120));document.addEventListener('click',e=>{if(e.target?.matches?.('[data-graded-import="stock"]'))reset()},true);setTimeout(evaluate,50)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();