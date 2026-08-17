/* GENGRAIL PROFIT ENGINE DASHBOARD v1.3
   Read-only presentation layer for Profit Engine, business financials,
   allocation protection visibility and the Home Screen live performance ticker.
*/
(function(){
'use strict';
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v)||0);
const pct=v=>`${Number(v||0).toFixed(1)}%`;
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
const text=id=>document.getElementById(id)?.textContent?.trim()||'—';
const dbRead=()=>{try{return JSON.parse(localStorage.getItem('gengrailBizV1')||'null')}catch{return null}};
const potLabel={STOCK_LIQUIDITY:'Stock / Liquidity',TAX_RESERVE:'Tax Reserve',BUSINESS_RESERVE:'Business Reserve',GROWTH_FUND:'Growth Fund',OWNER_POT:'Owner Pot'};

function ensureStyles(){
 if(document.getElementById('profitEngineDiagnosticStyles'))return;
 const s=document.createElement('style');s.id='profitEngineDiagnosticStyles';
 s.textContent=`
 #profitEngineDiagnostic{border:1px solid #31543b;border-left:5px solid #58c77a;background:linear-gradient(180deg,#0b160e,#0a0d0b);border-radius:13px;padding:14px;margin-top:12px;box-shadow:6px 6px #000}
 #profitEngineDiagnostic .ped-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
 #profitEngineDiagnostic .ped-title{font:24px Impact,sans-serif;letter-spacing:.04em}
 #profitEngineDiagnostic .ped-badge{border:1px solid #31543b;color:#78e39a;background:#07110a;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;white-space:nowrap}
 #profitEngineDiagnostic .ped-sub{color:#8fa596;font-size:11px;line-height:1.45;margin-top:3px}
 #profitEngineDiagnostic .ped-hero{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
 #profitEngineDiagnostic .ped-box{background:#07110a;border:1px solid #294d34;border-radius:9px;padding:10px;min-width:0}
 #profitEngineDiagnostic .ped-box small{display:block;color:#8fa596;font-size:9px;font-weight:900;letter-spacing:.04em}
 #profitEngineDiagnostic .ped-box b{display:block;margin-top:3px;font-size:18px;color:#eef6f0;word-break:break-word}
 #profitEngineDiagnostic .ped-box.accent b{color:#78e39a;font-size:22px}
 #profitEngineDiagnostic .ped-section{margin-top:12px;padding-top:12px;border-top:1px solid #25332a}
 #profitEngineDiagnostic .ped-section-title{color:#70e09a;font-size:10px;font-weight:950;letter-spacing:.14em;margin-bottom:8px}
 #profitEngineDiagnostic .ped-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
 #profitEngineDiagnostic .ped-pot{background:#080b09;border:1px solid #28362c;border-radius:8px;padding:9px;min-width:0}
 #profitEngineDiagnostic .ped-pot small{display:block;color:#888;font-size:9px;font-weight:900}
 #profitEngineDiagnostic .ped-pot b{display:block;margin-top:3px;font-size:16px;word-break:break-word}
 #profitEngineDiagnostic .ped-pot.owner-readiness{grid-column:1/-1}
 #profitEngineDiagnostic .ped-note{margin-top:8px;border-left:3px solid #8a6c25;padding:7px 9px;background:#171107;color:#d7c48f;font-size:9.5px;line-height:1.4}
 #profitEngineDiagnostic .ped-protection{border:1px solid #8a6c25;background:#171107;border-radius:10px;padding:9px;margin-top:8px}
 #profitEngineDiagnostic .ped-protection strong{color:#ffd36f;display:block;font-size:11px;margin-bottom:4px}
 #profitEngineDiagnostic .ped-redirect{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #4b3b1c;padding-top:5px;margin-top:5px;font-size:10px}
 #profitEngineDiagnostic .ped-redirect span:last-child{color:#ffd36f;font-weight:900;text-align:right}
 #profitEngineDiagnostic .ped-split{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:6px;font-size:9.5px;margin-top:3px}
 #profitEngineDiagnostic .ped-split.head{color:#8f8f8f;font-weight:900}
 #profitEngineDiagnostic .ped-split:not(.head){padding:3px 0;border-top:1px solid #302b1d}
 #profitEngineDiagnostic .ped-financials{border-color:#4a4026}
 #profitEngineDiagnostic .ped-financials b{color:#f2f0e8}
 #profitEngineDiagnostic .ped-financials.outcome{border-color:#31543b;background:#08120b}
 #profitEngineDiagnostic .ped-financials.outcome b{color:#78e39a}
 #profitEngineDiagnostic .ped-accounting-note{border-left-color:#4a4a3d;background:#0b0b09;color:#aaa394;font-size:9px;padding:7px 9px}
 .gengrail-performance-ticker{margin:20px 0 6px;border-top:1px solid #6e5019;border-bottom:1px solid #6e5019;background:linear-gradient(90deg,#080808,#111007,#080808);overflow:hidden;position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent}
 .gengrail-performance-ticker:before,.gengrail-performance-ticker:after{content:'';position:absolute;top:0;bottom:0;width:32px;z-index:2;pointer-events:none}
 .gengrail-performance-ticker:before{left:0;background:linear-gradient(90deg,#080808,transparent)}
 .gengrail-performance-ticker:after{right:0;background:linear-gradient(270deg,#080808,transparent)}
 .gengrail-ticker-track{display:flex;width:max-content;align-items:center;white-space:nowrap;animation:gengrailTicker 32s linear infinite;padding:12px 0}
 .gengrail-performance-ticker:active .gengrail-ticker-track{animation-play-state:paused}
 .gengrail-ticker-item{display:inline-flex;align-items:center;gap:7px;color:#f4f1ea;font-size:11px;font-weight:900;letter-spacing:.035em;text-transform:uppercase;padding:0 17px}
 .gengrail-ticker-item b{color:#78e39a;font-size:12px}
 .gengrail-ticker-dot{color:#e0ad16;font-weight:950}
 @keyframes gengrailTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
 @media(prefers-reduced-motion:reduce){.gengrail-ticker-track{animation:none;overflow:auto;max-width:100vw}}
 @media(min-width:700px){#profitEngineDiagnostic .ped-grid{grid-template-columns:repeat(5,1fr)}#profitEngineDiagnostic .ped-hero{grid-template-columns:repeat(4,1fr)}#profitEngineDiagnostic .ped-pot.owner-readiness{grid-column:auto}}`;
 document.head.appendChild(s);
}
function stageLabel(g){return g?.profitStage?.label||`Stage ${g?.currentProfitStage||1}`}
function currentCorpTax(){
 try{
   if(typeof window.corp==='function'&&typeof window.accountingProfit==='function')return Number(window.corp(window.accountingProfit()))||0;
 }catch{}
 const a=latestAllocation();return Number(a?.protectionTargets?.taxReserve)||0;
}
function latestAllocation(){
 const db=dbRead(),rows=Array.isArray(db?.profitEngine?.allocations)?db.profitEngine.allocations:[];
 return [...rows].reverse().find(a=>a?.status==='ACTIVE'&&a?.classification==='TRADING')||null;
}
function protectionHtml(a){
 if(!a)return '';
 const nominal=a.nominalAmounts||{},actual=a.actualAmounts||{},redirects=Array.isArray(a.redirects)?a.redirects:[];
 const rows=['STOCK_LIQUIDITY','TAX_RESERVE','BUSINESS_RESERVE','GROWTH_FUND','OWNER_POT'].map(k=>`<div class="ped-split"><span>${esc(potLabel[k])}</span><span>${money(nominal[k])}</span><span>${money(actual[k])}</span></div>`).join('');
 const target=Number(a.protectionTargets?.taxReserve)||currentCorpTax();
 const current=dbRead()?.profitEngine?.ledger?.filter(x=>x?.pot==='TAX_RESERVE').reduce((s,x)=>s+(Number(x.amount)||0),0)||0;
 const redirectHtml=redirects.length?redirects.map(r=>`<div class="ped-redirect"><span>${esc(potLabel[r.from]||r.from)} → ${esc(potLabel[r.to]||r.to)}<br><small>${esc(String(r.reason||'').replaceAll('_',' '))}</small></span><span>${money(r.amount)}</span></div>`).join(''):'<div class="ped-note">No protected-pot adjustments were required for the latest trading sale.</div>';
 return `<div class="ped-section"><div class="ped-section-title">LATEST PROFIT SPLIT</div><div class="ped-protection"><strong>${redirects.length?'TAX RESERVE PROTECTION ACTIVE':'PROFIT SPLIT APPLIED'}</strong><div class="ped-split head"><span>POT</span><span>NOMINAL</span><span>ACTUAL</span></div>${rows}${redirectHtml}${Number.isFinite(target)?`<div class="ped-note">Protected Tax requirement: ${money(target)} · Current Tax Reserve: ${money(current)} · Remaining protection gap: ${money(Math.max(0,target-current))}</div>`:''}</div></div>`;
}
function financialsHtml(){return `<div class="ped-section"><div class="ped-section-title">BUSINESS FINANCIALS</div><div class="ped-grid">
 <div class="ped-pot ped-financials"><small>SALES REVENUE</small><b>${esc(text('rev'))}</b></div>
 <div class="ped-pot ped-financials"><small>COGS</small><b>${esc(text('cogskpi'))}</b></div>
 <div class="ped-pot ped-financials"><small>GROSS PROFIT</small><b>${esc(text('grossprofit'))}</b></div>
 <div class="ped-pot ped-financials"><small>SELLING FEES</small><b>${esc(text('sellfees'))}</b></div>
 <div class="ped-pot ped-financials"><small>DIRECT COSTS</small><b>${esc(text('directcosts'))}</b></div>
 <div class="ped-pot ped-financials"><small>OPERATING EXPENSES</small><b>${esc(text('opex'))}</b></div>
 <div class="ped-pot ped-financials outcome"><small>REALISED PRE-TAX PROFIT</small><b>${esc(text('profit'))}</b></div>
 <div class="ped-pot ped-financials"><small>CORP TAX REQUIREMENT</small><b>${money(currentCorpTax())}</b></div>
 <div class="ped-pot ped-financials outcome"><small>RETAINED AFTER-TAX</small><b>${esc(text('retained'))}</b></div>
 </div></div>`}
function dashboardState(){
 const getG=window.getGrailPlanState,getF=window.getProfitFinanceSnapshot;
 if(typeof getG!=='function'||typeof getF!=='function')return null;
 try{const g=getG(),f=getF();return g&&f?{g,f}:null}catch{return null}
}
function tickerMarkup(g,f){
 const pots=f.potBalances||{},items=[
  ['Profit today',money(f.realisedNetTradingProfitToday)],
  ['Deployable',money(g.availableGrailPlanLiquidity)],
  ['Profit Split',`Stage ${g.currentProfitStage} · ${stageLabel(g)}`],
  ['Grail Plan',`${g.mode} · ${money(g.targetRange?.min)}–${money(g.targetRange?.max)}`],
  ['30-day avg/day',money(g.trends?.avg30)],
  ['Owner readiness',g.ownerReadiness?.status||'NOT READY'],
  ['Self-funded',pct(g.selfFundedPercentage)],
  ['Tax Reserve',`${money(pots.TAX_RESERVE)} / ${money(currentCorpTax())}`]
 ];
 const run=items.map(([k,v])=>`<span class="gengrail-ticker-item"><span>${esc(k)}</span><b>${esc(v)}</b><span class="gengrail-ticker-dot">◆</span></span>`).join('');
 return `<div class="gengrail-ticker-track">${run}${run}</div>`;
}
function renderTicker(){
 const ticker=document.getElementById('gengrailPerformanceTicker');if(!ticker)return;
 const state=dashboardState();
 ticker.innerHTML=state?tickerMarkup(state.g,state.f):'<div class="gengrail-ticker-track"><span class="gengrail-ticker-item"><b>Gengrail Profit Engine live</b><span>No trading data yet</span></span></div>';
}
function openFinance(){
 const candidates=[...document.querySelectorAll('button,[role="button"],a')];
 const finance=candidates.find(el=>/^FINANCE$/i.test((el.textContent||'').trim())||/performance, costs,\s*funding and tax/i.test(el.textContent||''));
 if(finance){finance.click();return}
 const target=document.getElementById('finance');if(target&&typeof window.showSection==='function')window.showSection('finance');
}
function mountTicker(){
 const home=document.querySelector('.home-screen');if(!home)return;
 let ticker=document.getElementById('gengrailPerformanceTicker');
 if(!ticker){
   ticker=document.createElement('div');ticker.id='gengrailPerformanceTicker';ticker.className='gengrail-performance-ticker';ticker.setAttribute('role','button');ticker.setAttribute('aria-label','Open Finance. Live Gengrail trading performance.');ticker.onclick=openFinance;
   const footer=[...home.querySelectorAll('*')].find(el=>(el.textContent||'').trim().toUpperCase()==='GENGRAIL TCG');
   if(footer){footer.style.display='none';footer.insertAdjacentElement('afterend',ticker)}else home.appendChild(ticker);
 }
 renderTicker();
}
function render(){
 const host=document.getElementById('profitEngineDiagnostic');if(!host)return;
 const state=dashboardState();
 if(!state){host.innerHTML='<div class="ped-title">PROFIT ENGINE</div><div class="ped-note">Profit Engine state is not available yet.</div>';return}
 const {g,f}=state,pots=f.potBalances||{},tr=g.trends||{},owner=g.ownerReadiness||{};
 host.innerHTML=`
  <div class="ped-head"><div><div class="ped-title">PROFIT ENGINE</div><div class="ped-sub">Business performance, protected liquidity and Grail Plan readiness</div></div><span class="ped-badge">LIVE</span></div>
  <div class="ped-hero">
   <div class="ped-box accent"><small>TODAY'S REALISED TRADING PROFIT</small><b>${money(f.realisedNetTradingProfitToday)}</b></div>
   <div class="ped-box"><small>PROFIT SPLIT STAGE</small><b>${esc(`Stage ${g.currentProfitStage} · ${stageLabel(g)}`)}</b></div>
   <div class="ped-box accent"><small>DEPLOYABLE LIQUIDITY</small><b>${money(g.availableGrailPlanLiquidity)}</b></div>
   <div class="ped-box"><small>GRAIL PLAN</small><b>${esc(g.mode)} · ${money(g.targetRange?.min)}–${money(g.targetRange?.max)}</b></div>
  </div>
  <div class="ped-section"><div class="ped-section-title">PROFIT SPLIT POTS</div><div class="ped-grid">
   <div class="ped-pot"><small>STOCK / LIQUIDITY</small><b>${money(pots.STOCK_LIQUIDITY)}</b></div>
   <div class="ped-pot"><small>TAX RESERVE</small><b>${money(pots.TAX_RESERVE)}</b></div>
   <div class="ped-pot"><small>BUSINESS RESERVE</small><b>${money(pots.BUSINESS_RESERVE)}</b></div>
   <div class="ped-pot"><small>GROWTH FUND</small><b>${money(pots.GROWTH_FUND)}</b></div>
   <div class="ped-pot"><small>OWNER POT</small><b>${money(pots.OWNER_POT)}</b></div>
  </div></div>
  ${protectionHtml(latestAllocation())}
  <div class="ped-section"><div class="ped-section-title">TRADING PERFORMANCE</div><div class="ped-grid">
   <div class="ped-pot"><small>7-DAY AVG / DAY</small><b>${money(tr.avg7)}</b></div>
   <div class="ped-pot"><small>30-DAY AVG / DAY</small><b>${money(tr.avg30)}</b></div>
   <div class="ped-pot"><small>90-DAY AVG / DAY</small><b>${money(tr.avg90)}</b></div>
   <div class="ped-pot"><small>180-DAY AVG / DAY</small><b>${money(tr.avg180)}</b></div>
   <div class="ped-pot owner-readiness"><small>OWNER READINESS</small><b>${esc(owner.status||'NOT READY')}</b></div>
  </div></div>
  <div class="ped-section"><div class="ped-section-title">CAPITAL ORIGIN</div><div class="ped-grid">
   <div class="ped-pot"><small>OWNER CASH CONTRIBUTIONS</small><b>${money(g.ownerCashContributions)}</b></div>
   <div class="ped-pot"><small>BOOTSTRAP CAPITAL</small><b>${money(g.bootstrapCapital)}</b></div>
   <div class="ped-pot"><small>RETAINED TRADING PROFIT</small><b>${money(g.retainedTradingProfit)}</b></div>
   <div class="ped-pot"><small>CAPITAL IN INVENTORY</small><b>${money(g.capitalCommittedToInventory)}</b></div>
   <div class="ped-pot"><small>SELF-FUNDED</small><b>${pct(g.selfFundedPercentage)}</b></div>
  </div></div>
  ${financialsHtml()}
  <div class="ped-note ped-accounting-note">Accounting KPIs remain calculated by Gengrail's accounting functions. Grail Plan uses protected deployable liquidity and realised trading profit.</div>`;
 renderTicker();
}
function mount(){
 ensureStyles();const dash=document.getElementById('dash');
 if(dash){
   const legacy=dash.querySelector('.panel');if(legacy){legacy.style.display='none';legacy.dataset.profitEngineLegacy='hidden'}
   let host=document.getElementById('profitEngineDiagnostic');
   if(!host){host=document.createElement('div');host.id='profitEngineDiagnostic';if(legacy)legacy.insertAdjacentElement('afterend',host);else dash.prepend(host)}
   render();
   ['rev','cogskpi','grossprofit','sellfees','directcosts','opex','profit','retained'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.dataset.profitDiagnosticObserved){el.dataset.profitDiagnosticObserved='1';new MutationObserver(render).observe(el,{subtree:true,childList:true,characterData:true})}})
 }
 mountTicker();
}
window.addEventListener('gengrail:main-updated',()=>setTimeout(()=>{render();mountTicker()},0));
window.addEventListener('storage',()=>setTimeout(()=>{render();mountTicker()},0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0));else setTimeout(mount,0);
})();