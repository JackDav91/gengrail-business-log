/* GENGRAIL GRAIL HUB v1.6 — daily discovery foundation + layout restore
   Consumes Profit Engine state and the existing Opportunity Finder economics.
   Active listings are evidence only; no sold-price or sell-through data is fabricated.
*/
(function(){
'use strict';
const EBAY_BACKEND='https://gengrail-ebay-backend.gengrailtcg.workers.dev';
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v)||0);
const pct=v=>`${(Number(v||0)*100).toFixed(0)}%`;
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clean=v=>String(v||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9./]+/g,' ').replace(/\s+/g,' ').trim();
const DAILY_SHEET_KEY='gengrail_grail_daily_sheet_v1';
const DISCOVERY_CONFIG=Object.freeze({
  version:3,
  refreshHours:24,
  // Discovery works best when each lane creates a genuine peer-priced set rather than a broad character soup.
  lanes:['Pokemon Charizard 4/102','Pokemon Pikachu 58/102','Pokemon Blastoise 2/102','Pokemon Venusaur 15/102','Pokemon Lugia 9/111','Pokemon Umbreon 13/75'],
  floorRoi:10,
  preferredRoi:20,
  floorMargin:10
});
let streamState={query:'',rows:[],safe:[],lastPlan:null,loading:false,error:'',discoveryLoading:false,dailySheet:null,view:'daily'};
let layoutLock=null;

function state(){try{return typeof window.getGrailPlanState==='function'?window.getGrailPlanState():null}catch{return null}}
function loadDailySheet(){try{const sheet=JSON.parse(localStorage.getItem(DAILY_SHEET_KEY)||'null');if(!sheet)return null;if(Number(sheet.configVersion)!==Number(DISCOVERY_CONFIG.version)){localStorage.removeItem(DAILY_SHEET_KEY);return null}return sheet}catch{try{localStorage.removeItem(DAILY_SHEET_KEY)}catch{}return null}}
function saveDailySheet(sheet){try{localStorage.setItem(DAILY_SHEET_KEY,JSON.stringify(sheet))}catch{}streamState.dailySheet=sheet;return sheet}
function sheetAgeText(sheet){if(!sheet?.generatedAt)return 'No daily sheet built yet.';const generated=new Date(sheet.generatedAt),due=new Date(sheet.refreshDue);return `Built ${generated.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} · refresh due ${due.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}`}
function restoreLayout(){
  const y=layoutLock?.scrollY??window.scrollY;
  document.documentElement.classList.remove('grail-hub-open');document.body.classList.remove('grail-hub-open');
  document.documentElement.style.overflow=layoutLock?.htmlOverflow||'';document.documentElement.style.overflowX=layoutLock?.htmlOverflowX||'';
  document.body.style.overflow=layoutLock?.bodyOverflow||'';document.body.style.overflowX=layoutLock?.bodyOverflowX||'';document.body.style.width=layoutLock?.bodyWidth||'';document.body.style.position=layoutLock?.bodyPosition||'';
  document.documentElement.scrollLeft=0;document.body.scrollLeft=0;const root=document.getElementById('grailHubOverlay');if(root)root.scrollLeft=0;
  layoutLock=null;requestAnimationFrame(()=>window.scrollTo(0,y));
}
function lockLayout(){
  if(layoutLock)return;
  layoutLock={scrollY:window.scrollY,htmlOverflow:document.documentElement.style.overflow,htmlOverflowX:document.documentElement.style.overflowX,bodyOverflow:document.body.style.overflow,bodyOverflowX:document.body.style.overflowX,bodyWidth:document.body.style.width,bodyPosition:document.body.style.position};
  document.documentElement.classList.add('grail-hub-open');document.body.classList.add('grail-hub-open');
  document.documentElement.style.overflow='hidden';document.documentElement.style.overflowX='hidden';document.body.style.overflow='hidden';document.body.style.overflowX='hidden';document.body.style.width='100%';
}


function ensureMiniRefresh(root){
  const head=root?.querySelector('.grail-hub-head');
  if(!head||head.querySelector('.grail-refresh-mini'))return;
  const source=root.querySelector('#grailRefreshAction');
  if(!source)return;
  const b=document.createElement('button');b.type='button';b.className='grail-refresh-mini';b.textContent='↻';b.setAttribute('aria-label','Refresh plan state');b.addEventListener('click',()=>source.click());head.appendChild(b);
}
function statusCopy(g){
  if(!g)return 'Profit Engine state is not available yet.';
  if(g.liquidityConstrained)return `Opportunity capture constrained · additional liquidity required ${money(g.liquidityShortfall)}`;
  if(Number(g.availableGrailPlanLiquidity)<=0)return 'No deployable liquidity is currently available. Protected pots remain ring-fenced.';
  return `${g.mode} mode is active. Search objectives are subordinate to ROI, margin, confidence, market depth and liquidity protection.`;
}
function openExisting(labelMatchers){
  const nodes=[...document.querySelectorAll('button,[role="button"],a')];
  const el=nodes.find(n=>labelMatchers.some(re=>re.test((n.textContent||'').trim())));
  if(el){close();setTimeout(()=>el.click(),0);return true}
  return false;
}
function median(values=[]){const a=values.filter(x=>x>0).slice().sort((a,b)=>a-b);if(!a.length)return 0;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2}
function percentile(values=[],q=.5){const a=values.filter(x=>x>0).slice().sort((a,b)=>a-b);if(!a.length)return 0;if(a.length===1)return a[0];const pos=(a.length-1)*Math.max(0,Math.min(1,q)),lo=Math.floor(pos),hi=Math.ceil(pos),w=pos-lo;return a[lo]*(1-w)+a[hi]*w}
function listingPrice(item){const p=num(item?.price?.value||item?.priceGbp);const c=String(item?.price?.currency||item?.currency||'GBP').toUpperCase();return c==='GBP'?p:0}
function shippingPrice(item){const rows=Array.isArray(item?.shippingOptions)?item.shippingOptions:[];for(const row of rows){const p=num(row?.shippingCost?.value);const c=String(row?.shippingCost?.currency||'GBP').toUpperCase();if(c==='GBP'&&p>=0)return p}return 0}
function obviousReject(t){return /\b(proxy|replica|reproduction|custom|fan art|fanart|digital|code card|empty slab|slab only|case only|repack|mystery|orica|lot|bundle|collection|job lot|break|metal card|gold card|keychain|key chain|keyring|key ring|novelty|magnetic case|extended artwork|display case|display frame|card holder|card stand|protective case|acrylic case|card not included|card is not included|no card included|without card|empty case|case for|frame for|holder for)\b/.test(t)}
function printingFamily(t,cardNumber){
  if(/\b(celebrations|25th anniversary)\b/.test(t))return 'CELEBRATIONS';
  if(/\b(evolutions|xy evolutions|2016)\b/.test(t))return 'EVOLUTIONS';
  if(/\b(base set 2|base set ii)\b/.test(t))return 'BASE_SET_2';
  if(/\b(shadowless)\b/.test(t))return 'BASE_SET_SHADOWLESS';
  if(/\b(base set|wotc|wizards of the coast|1999)\b/.test(t))return 'BASE_SET';
  if(cardNumber==='4/102'&&/\b(wizards|wizard|vintage)\b/.test(t))return 'BASE_SET';
  return 'UNKNOWN';
}
function rawCondition(title,itemCondition=''){
  const t=clean(`${title} ${itemCondition}`);
  if(/\b(damaged|damage|dmg|creased|crease|water damage|torn)\b/.test(t))return 'DMG';
  if(/\b(heavily played|heavy play|hp condition|hp played|hp)\b/.test(t))return 'HP';
  if(/\b(moderately played|moderate play|mp condition|mp)\b/.test(t))return 'MP';
  if(/\b(lightly played|light play|lp condition|lp)\b/.test(t))return 'LP';
  if(/\b(near mint|nm condition|mint condition|pack fresh|nm)\b/.test(t))return 'NM';
  return 'UNKNOWN';
}
function graderFrom(t){if(/\b(bgs|beckett)\b/.test(t))return 'BGS';if(/\bpsa\b/.test(t))return 'PSA';if(/\bcgc\b/.test(t))return 'CGC';if(/\bace\b/.test(t))return 'ACE';if(/\bsgc\b/.test(t))return 'SGC';return ''}
function gradeFrom(t,grader){if(!grader)return '';const aliases=grader==='BGS'?'(?:bgs|beckett)':grader.toLowerCase();let m=t.match(new RegExp('\\b'+aliases+'\\s*(?:grade\\s*)?(10|[1-9](?:\\.5)?)\\b','i'));if(!m)m=t.match(/\b(?:grade|graded)\s*(10|[1-9](?:\.5)?)\b/i);return m?m[1]:''}
const STOP=new Set(['pokemon','pokémon','tcg','card','cards','english','japanese','holo','holofoil','rare','ultra','secret','mint','nm','near','gem','graded','grade','psa','bgs','beckett','cgc','ace','sgc','new','listing','official','authentic','2023','2024','2025','2026']);
function tokensFor(title){return clean(title).split(' ').filter(x=>x.length>2&&!STOP.has(x)&&!/^\d+(?:\.\d+)?$/.test(x)&&!/^\d+\/\d+$/.test(x)).slice(0,12)}
function similarity(a,b){const A=new Set(a),B=new Set(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.max(A.size,B.size)}
function parseListing(item){
  const title=String(item?.title||'').trim(),t=clean(title);if(!title||obviousReject(t))return null;
  if(!/pokemon|pokémon/i.test(title))return null;
  const n=title.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);if(!n)return null;
  const cardNumber=`${Number(n[1])}/${Number(n[2])}`;
  // Collector number is necessary but not sufficient: require positive evidence that the listing is the card itself.
  const actualCardSignal=/\b(card|tcg|holo|holofoil|rare|unlimited|1st edition|first edition|shadowless|wotc|pokemon)\b/.test(t);
  const accessoryNoun=/\b(case|keychain|key ring|keyring|frame|holder|stand|display|novelty|magnet|magnetic|acrylic|artwork)\b/.test(t);
  if(!actualCardSignal||accessoryNoun)return null;
  const grader=graderFrom(t),grade=gradeFrom(t,grader);
  if(grader&&!grade)return null;
  if(!grader&&/\bgraded|slab\b/.test(t))return null;
  const ask=listingPrice(item);if(!(ask>0))return null;
  const type=grader?'GRADED':'RAW',family=printingFamily(t,cardNumber),condition=type==='RAW'?rawCondition(title,item?.condition||''):'GRADED';
  return {item,title,t,cardNumber,grader,grade,type,printingFamily:family,condition,ask,inbound:shippingPrice(item),tokens:tokensFor(title)};
}
function peerRows(row,all){
  return all.filter(x=>{
    if(x===row||x.cardNumber!==row.cardNumber||x.grader!==row.grader||x.grade!==row.grade)return false;
    if(x.printingFamily!==row.printingFamily)return false;
    if(row.type==='RAW'&&x.condition!==row.condition)return false;
    return similarity(row.tokens,x.tokens)>=.42;
  });
}
function confidenceFor(peers,simAvg,row){
  const depth=Math.min(.28,Math.max(0,peers)*.025);
  const identity=Math.max(0,Math.min(.22,simAvg*.22));
  const printing=row.printingFamily==='UNKNOWN'?.045:.12;
  const condition=row.type==='GRADED'?.08:(row.condition==='UNKNOWN'?.035:.08);
  const graded=row.type==='GRADED'?.025:0;
  return Math.min(.96,.30+depth+identity+printing+condition+graded);
}
function existingEconomics(v){
  if(typeof window.oppAnalyseValues==='function')return window.oppAnalyseValues(v);
  const sale=v.resale,feeRate=.135,fees=sale*feeRate,landed=v.ask+v.inbound,proceeds=(sale*v.confidence)-((sale*v.confidence)*feeRate)-v.outbound-v.pack,profit=proceeds-landed,roi=landed>0?profit/landed*100:0,margin=sale*v.confidence>0?profit/(sale*v.confidence)*100:0;
  return {...v,fees,landed,proceeds,profit,roi,margin,decision:profit>0&&roi>=v.minRoi?'BUY':'PASS',score:0,maxItem:0};
}
function modeScore(a,g){
  const roi=Math.max(0,Math.min(1,a.roi/Math.max(1,g.minimumROI*2)));
  const margin=Math.max(0,Math.min(1,a.margin/Math.max(1,g.minimumNetMargin*2)));
  const conf=Math.max(0,Math.min(1,(a.confidence-.7)/.27));
  const depth=Math.max(0,Math.min(1,a.peerCount/8));
  const profit=Math.max(0,Math.min(1,a.profit/Math.max(5,num(g.targetRange?.min))));
  const capital=Math.max(0,1-(a.landed/Math.max(1,num(g.availableGrailPlanLiquidity))));
  const m=String(g.mode||'SEED').toUpperCase();
  let score;
  if(m==='SCALE')score=profit*.32+roi*.16+margin*.12+conf*.18+depth*.12+capital*.10;
  else if(m==='BUILD')score=profit*.25+roi*.23+margin*.13+conf*.18+depth*.11+capital*.10;
  else score=roi*.27+margin*.13+conf*.22+depth*.18+capital*.15+profit*.05;
  return Math.round(score*100);
}
function accessoryTitleReject(title){const t=clean(title);return /\b(keychain|key chain|keyring|key ring|novelty|extended artwork|extended art|magnetic case|case|display|frame|holder|stand|card not included|no card included|without card|replica|reproduction|proxy|custom)\b/.test(t)}
function rankListings(items,g){
  const parsed=items.map(parseListing).filter(Boolean),rows=[];
  const outbound=num(localStorage.getItem('gengrailOpp_oppOutbound'))||4.10;
  const pack=num(localStorage.getItem('gengrailOpp_oppPack'))||.30;
  for(const r of parsed){
    const peers=peerRows(r,parsed);if(peers.length<3)continue;
    const simAvg=peers.reduce((s,x)=>s+similarity(r.tokens,x.tokens),0)/peers.length;
    const peerPrices=peers.map(x=>x.ask),marketMedian=median(peerPrices),lowerBand=percentile(peerPrices,.35),resale=((marketMedian+lowerBand)/2);if(!(resale>r.ask))continue;
    const confidence=confidenceFor(peers.length,simAvg,r);if(!(confidence>0))continue;
    const e=existingEconomics({id:r.item.itemId||'',title:r.title,source:'eBay live',confidence,ask:r.ask,inbound:r.inbound,resale,sellPlatform:'ebay',outbound,pack,minRoi:DISCOVERY_CONFIG.floorRoi,minProfit:1,url:String(r.item.itemWebUrl||'')});
    e.cardNumber=r.cardNumber;e.grader=r.grader;e.grade=r.grade;e.type=r.type;e.printingFamily=r.printingFamily;e.condition=r.condition;e.peerCount=peers.length;e.marketMedian=marketMedian;e.conservativeAnchor=resale;e.lowerBand=lowerBand;e.image=String(r.item?.image?.imageUrl||'');e.seller=r.item?.seller||null;e.similarity=simAvg;
    const conditionKnown=e.type!=='RAW'||e.condition!=='UNKNOWN'; // UNKNOWN raw condition remains REVIEW-only and cannot enter Grail Plan.
    e.discoveryPass=conditionKnown&&e.profit>0&&e.roi>=DISCOVERY_CONFIG.floorRoi&&e.margin>=DISCOVERY_CONFIG.floorMargin&&confidence>=num(g.minimumConfidence);
    e.preferredPass=e.discoveryPass&&e.roi>=DISCOVERY_CONFIG.preferredRoi;
    // Grail Plan may use viable 10%+ candidates, but ranking explicitly favours 20%+ opportunities.
    e.qualityPass=e.discoveryPass;
    e.liquidityPass=e.landed<=num(g.availableGrailPlanLiquidity);
    e.safe=e.qualityPass&&e.liquidityPass;
    e.rankScore=modeScore(e,g);
    if(e.preferredPass)e.rankScore=Math.min(100,e.rankScore+8);
    rows.push(e);
  }
  const uniq=new Map();
  rows.sort((a,b)=>b.rankScore-a.rankScore||b.profit-a.profit).forEach(x=>{if(!uniq.has(x.id))uniq.set(x.id,x)});
  return [...uniq.values()].filter(x=>!accessoryTitleReject(x.title)).sort((a,b)=>Number(b.safe)-Number(a.safe)||b.rankScore-a.rankScore||b.profit-a.profit);
}
function buildBasket(rows,g){
  const liquidity=num(g.availableGrailPlanLiquidity),targetMin=num(g.targetRange?.min),targetMax=num(g.targetRange?.max),safe=rows.filter(x=>x.qualityPass&&x.landed<=liquidity);
  const pool=safe.slice(0,14),candidates=[];
  function consider(chosen,cost,profit,score){if(!chosen.length)return;candidates.push({chosen:[...chosen],cost,profit,score,inBand:profit>=targetMin&&profit<=targetMax,reaches:profit>=targetMin,overshoot:Math.max(0,profit-targetMax)})}
  function walk(start,chosen,ids,cost,profit,score){consider(chosen,cost,profit,score);if(chosen.length>=4)return;for(let i=start;i<pool.length;i++){const x=pool[i],key=[x.cardNumber,x.grader,x.grade,x.printingFamily,x.condition].join('|');if(ids.has(key)||cost+x.landed>liquidity)continue;ids.add(key);chosen.push(x);walk(i+1,chosen,ids,cost+x.landed,profit+x.profit,score+x.rankScore);chosen.pop();ids.delete(key)}}
  walk(0,[],new Set(),0,0,0);
  const good=candidates.filter(x=>x.reaches).sort((a,b)=>Number(b.inBand)-Number(a.inBand)||a.chosen.length-b.chosen.length||(a.inBand?a.cost-b.cost:a.overshoot-b.overshoot)||b.score-a.score||a.cost-b.cost);
  const best=good[0]||candidates.sort((a,b)=>b.profit-a.profit||b.score-a.score||a.cost-b.cost)[0]||{chosen:[],cost:0,profit:0};
  let status='NO HIGH-CONFIDENCE ROUTE FOUND',shortfall=0,unlocked=0;
  if(best.chosen.length&&best.profit>=targetMin)status=best.profit<=targetMax?'TARGET ROUTE FOUND':'TARGET EXCEEDED BY BEST SENSIBLE ROUTE';
  else if(best.chosen.length)status='TARGET CONSTRAINED BY MARKET QUALITY';
  const over=rows.filter(x=>x.qualityPass&&x.landed>liquidity).sort((a,b)=>a.landed-b.landed)[0];
  if(!best.chosen.length&&over){status='TARGET CONSTRAINED BY LIQUIDITY';shortfall=Math.max(0,over.landed-liquidity);unlocked=over.profit}
  return {status,chosen:best.chosen,cost:best.cost,profit:best.profit,targetMin,targetMax,shortfall,unlocked};
}
function streamStatus(rows,g){const safe=rows.filter(x=>x.safe),quality=rows.filter(x=>x.qualityPass);if(streamState.error)return streamState.error;if(streamState.loading)return 'Scanning current eBay listings and building comparable peer groups…';if(!rows.length)return 'No defensible peer-priced opportunities found in this search. Try a specific Pokémon, set, or collector number.';if(safe.length)return `${safe.length} opportunity${safe.length===1?'':'ies'} currently clear the ${g.mode} guardrails.`;if(quality.length)return 'Strong market-quality candidates exist, but current deployable liquidity blocks them.';return 'Listings were found, but none clear ROI, margin and confidence together.'}
function resultCard(a,i){
  const condition=a.type==='RAW'?` · ${a.condition}`:'';
  const family=a.printingFamily&&a.printingFamily!=='UNKNOWN'?` · ${a.printingFamily.replaceAll('_',' ')}`:'';
  const reason=`${a.peerCount} condition-matched current listings · ${(a.confidence*100).toFixed(0)}% confidence · ${a.type}${a.grader?` · ${a.grader} ${a.grade}`:''}${condition}${family}`;
  return `<article class="grail-opportunity ${a.safe?'':'review'}"><img src="${esc(a.image||'icon-192.png')}" alt=""><div class="grail-opportunity-main"><div class="grail-opportunity-top"><h3>${esc(a.title)}</h3><span class="grail-opportunity-rank">#${i+1} · ${a.rankScore}/100</span></div><div class="grail-opportunity-sub">${esc(reason)}</div><div class="grail-opportunity-grid"><div><small>LANDED BUY</small><b>${money(a.landed)}</b></div><div><small>CONSERVATIVE MARKET</small><b>${money(a.conservativeAnchor)}</b></div><div><small>NET PROFIT</small><b class="good">${money(a.profit)}</b></div><div><small>ROI / MARGIN</small><b>${a.roi.toFixed(0)}% / ${a.margin.toFixed(0)}%</b></div></div><div class="grail-opportunity-reason">Peer median ${money(a.marketMedian)} · buying anchor blends the median with the lower market band. Active asking prices remain evidence, not sold prices.</div><div class="grail-opportunity-actions">${a.url?`<button class="grail-open-listing" data-open-listing="${esc(a.id)}">OPEN EBAY</button>`:''}<button class="grail-add-plan" data-plan-item="${esc(a.id)}">${a.safe?'PLAN CANDIDATE':(a.type==='RAW'&&a.condition==='UNKNOWN'?'REVIEW · CONDITION UNKNOWN':'REVIEW')}</button></div></div></article>`;
}
function planHtml(plan){if(!plan)return '';const cls=plan.status==='TARGET ROUTE FOUND'?'good':'';return `<div class="grail-plan-preview"><div class="grail-plan-preview-title">GRAIL PLAN · LIVE CANDIDATES</div><h3>${esc(plan.status)}</h3><p>${plan.status==='TARGET ROUTE FOUND'?'Smallest sensible basket reaches today’s target band without exceeding deployable liquidity.':plan.status==='TARGET EXCEEDED BY BEST SENSIBLE ROUTE'?'No route lands inside the target band; this is the smallest sensible high-confidence route above it.':plan.status==='TARGET CONSTRAINED BY LIQUIDITY'?`A strong candidate needs ${money(plan.shortfall)} more deployable liquidity and could unlock about ${money(plan.unlocked)} projected net profit.`:'The current live candidate set does not safely reach the lower target. Gengrail will not weaken the guardrails to force a route.'}</p><div class="grail-plan-preview-grid"><div><small>CAPITAL DEPLOYED</small><b>${money(plan.cost)}</b></div><div><small>PROJECTED NET PROFIT</small><b>${money(plan.profit)}</b></div><div><small>PURCHASES</small><b>${plan.chosen.length}</b></div></div>${plan.chosen.length?`<div class="grail-plan-basket">${plan.chosen.map(x=>`<div class="grail-plan-basket-row"><span>${esc(x.title)}</span><span>${money(x.landed)} → ${money(x.profit)}</span></div>`).join('')}</div>`:''}</div>`}
function renderStream(){
  const root=document.getElementById('grailHubOverlay'),g=state();if(!root||!g)return;
  const sheet=streamState.dailySheet||loadDailySheet();streamState.dailySheet=sheet;
  const usingDaily=streamState.view!=='targeted'&&!!sheet;
  const rows=usingDaily?(Array.isArray(sheet.rows)?sheet.rows:[]):streamState.rows;
  const safe=rows.filter(x=>x.safe),quality=rows.filter(x=>x.qualityPass),plan=usingDaily?buildBasket(rows,g):(streamState.lastPlan||buildBasket(rows,g));if(!usingDaily)streamState.lastPlan=plan;
  root.querySelector('.grail-hub-shell').innerHTML=`<div class="grail-hub-head"><button class="grail-hub-back" type="button" id="grailStreamBack">←</button><div><div class="grail-hub-title">OPPORTUNITY STREAM</div><div class="grail-hub-sub">Live eBay candidates ranked for ${esc(g.mode)} mode</div></div></div><div class="grail-stream-toolbar"><div class="grail-stream-mode ${usingDaily?'daily':'targeted'}"><b>${usingDaily?'DAILY SHEET':'TARGETED SEARCH RESULTS'}</b>${!usingDaily&&sheet?'<button id="grailReturnDaily" type="button">RETURN TO DAILY SHEET</button>':''}</div><label for="grailStreamQuery">TARGETED EBAY SEARCH</label><div class="grail-stream-search"><input id="grailStreamQuery" value="${esc(usingDaily?'':streamState.query)}" placeholder="e.g. Pokemon Charizard 4/102"><button id="grailStreamScan" type="button">${streamState.loading?'SCANNING…':'SCAN LIVE'}</button></div><div class="grail-discovery-row"><button id="grailDailyBuild" type="button">${streamState.discoveryLoading?'BUILDING DAILY SHEET…':'BUILD DAILY SHEET'}</button><span>${esc(sheetAgeText(sheet))}</span></div><div class="grail-stream-hint">Daily Sheet is the default opportunity set and refreshes every 24 hours. Use targeted search for a temporary card-specific check.</div></div><div class="grail-stream-summary"><div><small>LISTINGS RANKED</small><b>${rows.length}</b></div><div><small>CLEAR GUARDRAILS</small><b>${safe.length}</b></div><div><small>QUALITY PASS</small><b>${quality.length}</b></div><div><small>DEPLOYABLE</small><b>${money(g.availableGrailPlanLiquidity)}</b></div></div><div class="grail-stream-state ${safe.length?'good':streamState.error?'bad':''}">${esc(streamStatus(rows,g))}</div>${planHtml(plan)}<section class="grail-hub-section"><div class="grail-hub-section-title">${usingDaily?'DAILY SHEET RANKED LISTINGS':'TARGETED SEARCH RESULTS'}</div><div class="grail-stream-results">${rows.length?rows.slice(0,20).map(resultCard).join(''):`<div class="grail-stream-empty">${usingDaily?'No ranked Daily Sheet opportunities yet. Build the Daily Sheet to scan the configured market universe.':'No ranked opportunities in this targeted search. Try a specific Pokémon, set, or collector number.'}</div>`}</div></section>`;
  root.querySelector('#grailStreamBack').onclick=render;
  root.querySelector('#grailStreamScan').onclick=scanStream;
  root.querySelector('#grailDailyBuild').onclick=buildDailySheet;
  const returnDaily=root.querySelector('#grailReturnDaily');if(returnDaily)returnDaily.onclick=()=>{streamState.view='daily';streamState.error='';streamState.loading=false;renderStream()};
  root.querySelector('#grailStreamQuery').addEventListener('keydown',e=>{if(e.key==='Enter')scanStream()});
  root.querySelectorAll('[data-open-listing]').forEach(b=>b.onclick=()=>{const a=rows.find(x=>String(x.id)===String(b.dataset.openListing));if(a?.url)window.open(a.url,'_blank','noopener')});
  root.querySelectorAll('[data-plan-item]').forEach(b=>b.onclick=()=>{const a=rows.find(x=>String(x.id)===String(b.dataset.planItem));if(!a)return;alert(a.safe?`This candidate already qualifies for the live Grail Plan.\n\nProjected net profit: ${money(a.profit)}\nROI: ${a.roi.toFixed(1)}%\nCapital required: ${money(a.landed)}`:`This listing is visible for review but does not currently clear every Grail Plan guardrail.`)});
}
async function buildDailySheet(){
  const g=state();if(!g||streamState.discoveryLoading)return;
  streamState.discoveryLoading=true;streamState.error='';renderStream();
  try{
    const maxPrice=Math.max(1,num(g.availableGrailPlanLiquidity)),all=[],seen=new Set();
    for(const q of DISCOVERY_CONFIG.lanes){
      const u=new URL(EBAY_BACKEND+'/api/ebay/opportunities/search');u.searchParams.set('q',q);u.searchParams.set('limit','100');u.searchParams.set('max_price',String(maxPrice));
      const res=await fetch(u,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{accept:'application/json'}});const d=await res.json().catch(()=>null);
      if(!res.ok||!d?.ok)continue;
      for(const item of (Array.isArray(d.itemSummaries)?d.itemSummaries:[])){const id=String(item?.itemId||item?.itemWebUrl||'');if(!id||seen.has(id))continue;seen.add(id);all.push(item)}
    }
    const ranked=rankListings(all,g),rows=ranked.filter(x=>!accessoryTitleReject(x.title)&&x.profit>0&&x.roi>0&&x.margin>0),plan=buildBasket(rows,g),now=Date.now(),sheet={schema:1,configVersion:DISCOVERY_CONFIG.version,generatedAt:new Date(now).toISOString(),refreshDue:new Date(now+DISCOVERY_CONFIG.refreshHours*3600000).toISOString(),mode:g.mode,targetRange:g.targetRange,deployableLiquidity:num(g.availableGrailPlanLiquidity),lanes:[...DISCOVERY_CONFIG.lanes],listingCount:all.length,rankedCount:rows.length,qualityCount:rows.filter(x=>x.qualityPass).length,safeCount:rows.filter(x=>x.safe).length,plan:{status:plan.status,cost:plan.cost,profit:plan.profit,chosen:plan.chosen.map(x=>({id:x.id,title:x.title,url:x.url,landed:x.landed,profit:x.profit,roi:x.roi,margin:x.margin,confidence:x.confidence,type:x.type,cardNumber:x.cardNumber,grader:x.grader,grade:x.grade,condition:x.condition,printingFamily:x.printingFamily}))},rows:rows.slice(0,40)};
    saveDailySheet(sheet);streamState.rows=rows;streamState.safe=rows.filter(x=>x.safe);streamState.lastPlan=plan;streamState.query='';streamState.view='daily';
  }catch(e){streamState.error=String(e?.message||e||'Daily discovery failed.');}
  finally{streamState.discoveryLoading=false;renderStream()}
}
async function scanStream(){
  const g=state(),input=document.getElementById('grailStreamQuery');if(!g||!input)return;const q=input.value.trim();if(!q)return alert('Enter an eBay search first.');
  streamState.query=q;streamState.view='targeted';streamState.loading=true;streamState.error='';streamState.rows=[];streamState.lastPlan=null;renderStream();
  try{
    const u=new URL(EBAY_BACKEND+'/api/ebay/opportunities/search');u.searchParams.set('q',q);u.searchParams.set('limit','100');
    const res=await fetch(u,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',headers:{accept:'application/json'}});const d=await res.json().catch(()=>null);
    if(!res.ok||!d?.ok)throw new Error(d?.message||`Opportunity search failed (${res.status})`);
    const items=Array.isArray(d.itemSummaries)?d.itemSummaries:[];streamState.rows=rankListings(items,g);streamState.lastPlan=buildBasket(streamState.rows,g);
  }catch(e){streamState.error=String(e?.message||e||'Live opportunity search failed.');}
  finally{streamState.loading=false;renderStream()}
}
function showPlan(){
  const g=state();if(!g)return;const plan=buildBasket(streamState.rows,g);streamState.lastPlan=plan;
  if(!streamState.rows.length){renderStream();return}
  renderStream();const el=document.querySelector('.grail-plan-preview');el?.scrollIntoView({behavior:'smooth',block:'start'});
}
function render(){
  const root=document.getElementById('grailHubOverlay');if(!root)return;
  const g=state();
  if(!g){root.querySelector('.grail-hub-shell').innerHTML=`<div class="grail-hub-head"><button class="grail-hub-back" type="button" id="grailHubBack">←</button><div><div class="grail-hub-title">GRAIL HUB</div><div class="grail-hub-sub">Buying command centre</div></div></div><div class="grail-status">Profit Engine state is not available yet.</div>`;root.querySelector('#grailHubBack').onclick=close;return}
  const stage=g.profitStage||{};
  root.querySelector('.grail-hub-shell').innerHTML=`
    <div class="grail-hub-head"><button class="grail-hub-back" type="button" id="grailHubBack">←</button><div><div class="grail-hub-title">GRAIL HUB</div><div class="grail-hub-sub">Today's route to projected profit</div></div></div>
    <section class="grail-plan-hero"><div class="grail-plan-kicker"><span>GRAIL PLAN</span><span class="grail-plan-mode">${esc(g.mode)}</span></div><div class="grail-plan-question">Build today’s smallest sensible route to projected profit.</div><div class="grail-plan-copy">The plan uses only deployable business liquidity. Protected Tax, Reserve, Growth and Owner funds stay outside the buying bankroll unless explicitly configured otherwise.</div><div class="grail-plan-target"><div><small>AVAILABLE GRAIL PLAN LIQUIDITY</small><b>${money(g.availableGrailPlanLiquidity)}</b></div><div class="secondary"><small>TODAY'S PROJECTED NET PROFIT OBJECTIVE</small><b>${money(g.targetRange?.min)}–${money(g.targetRange?.max)}</b></div></div><div class="grail-guardrails"><div class="grail-guardrail"><small>DISCOVERY FLOOR</small><b>${DISCOVERY_CONFIG.floorRoi}% ROI</b></div><div class="grail-guardrail"><small>PREFERRED BUY</small><b>${DISCOVERY_CONFIG.preferredRoi}%+ ROI</b></div><div class="grail-guardrail"><small>MIN CONFIDENCE</small><b>${pct(g.minimumConfidence)}</b></div></div><div class="grail-status ${g.liquidityConstrained?'':'good'}">${esc(statusCopy(g))}</div></section>
    <section class="grail-hub-section"><div class="grail-hub-section-title">BUYING WORKSPACE</div><div class="grail-action-grid"><button class="grail-action-card primary" id="grailPlanAction" type="button"><span class="grail-action-icon">♛</span><b>Grail Plan</b><span>Build the best sensible purchase basket from live opportunities and today's bankroll.</span></button><button class="grail-action-card" id="grailOpportunityAction" type="button"><span class="grail-action-icon">⌁</span><b>Opportunity Stream</b><span>Scan live eBay listings and rank candidates against today's Grail Plan guardrails.</span></button><button class="grail-action-card" id="grailPricingAction" type="button"><span class="grail-action-icon">£</span><b>Pricing Calculator</b><span>Identify, value and test raw cards or graded slabs before committing capital.</span></button><button class="grail-action-card" id="grailRefreshAction" type="button"><span class="grail-action-icon">↻</span><b>Refresh Plan State</b><span>Reload liquidity, stage, protection and target inputs from the Profit Engine.</span></button></div></section>
    <section class="grail-hub-section"><div class="grail-hub-section-title">PLAN INPUTS</div><div class="grail-state-strip"><div class="grail-state-cell"><small>PROFIT STAGE</small><b>Stage ${Number(g.currentProfitStage||1)} · ${esc(stage.label||'Build Capital')}</b></div><div class="grail-state-cell"><small>30-DAY AVG / DAY</small><b>${money(g.trends?.avg30)}</b></div><div class="grail-state-cell"><small>CAPITAL IN INVENTORY</small><b>${money(g.capitalCommittedToInventory)}</b></div><div class="grail-state-cell"><small>SELF-FUNDED</small><b>${Number(g.selfFundedPercentage||0).toFixed(1)}%</b></div></div></section>`;
  root.querySelector('#grailHubBack').onclick=close;
  root.querySelector('#grailRefreshAction').onclick=render;
  root.querySelector('#grailPricingAction').onclick=()=>{if(!openExisting([/PRICING CALCULATOR/i,/WORK OUT TRUE VALUE/i]))alert('Pricing Calculator navigation is not available from this build yet.')};
  root.querySelector('#grailOpportunityAction').onclick=renderStream;
  root.querySelector('#grailPlanAction').onclick=showPlan;
}
function open(){let root=document.getElementById('grailHubOverlay');if(!root){root=document.createElement('div');root.id='grailHubOverlay';root.className='grail-hub-overlay';root.innerHTML='<div class="grail-hub-shell"></div>';document.body.appendChild(root)}lockLayout();setTimeout(()=>{const root=document.getElementById('grailHubOverlay');if(root)ensureMiniRefresh(root)},0);root.hidden=false;root.scrollLeft=0;root.scrollTop=0;render()}
function close(){const root=document.getElementById('grailHubOverlay');if(root){root.hidden=true;root.scrollLeft=0}restoreLayout()}
function bindBuying(){const buttons=[...document.querySelectorAll('button')];const buying=buttons.find(b=>/^BUYING$/i.test((b.querySelector('.home-label')?.textContent||b.textContent||'').trim()));if(!buying||buying.dataset.grailHubBound)return;buying.dataset.grailHubBound='1';buying.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open()},true)}
window.GengrailGrailHub={open,close,render,renderStream,scanStream,buildDailySheet,getOpportunityState:()=>JSON.parse(JSON.stringify(streamState)),getDailySheet:()=>loadDailySheet()};
window.addEventListener('gengrail:main-updated',()=>{if(!document.getElementById('grailHubOverlay')?.hidden)render()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bindBuying,0));else setTimeout(bindBuying,0);
})();
