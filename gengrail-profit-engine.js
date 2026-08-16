/* GENGRAIL PROFIT ENGINE v1.1
   Schema-4 financial foundation for realised trading profit, Profit Split,
   bootstrap capital, liquidity, Grail Plan operating mode and owner readiness.
   Pure/additive: Sales remains the factual transaction ledger.
*/
(function(root){
'use strict';

const ENGINE_VERSION=2;
const SCHEMA_VERSION=4;
const POTS=['STOCK_LIQUIDITY','TAX_RESERVE','BUSINESS_RESERVE','GROWTH_FUND','OWNER_POT'];
const DAY=86400000;
const clone=x=>JSON.parse(JSON.stringify(x));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round2=v=>Math.round((num(v)+Number.EPSILON)*100)/100;
const isoNow=()=>new Date().toISOString();
const dayKey=v=>{const d=new Date(v||Date.now());return Number.isNaN(d.getTime())?new Date().toISOString().slice(0,10):d.toISOString().slice(0,10)};
const addDays=(date,days)=>{const d=new Date(dayKey(date)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};

const DEFAULT_CONFIG={
  version:1,
  stages:[
    {id:1,key:'BUILD_CAPITAL',label:'Build Capital',minDaily:0,alloc:{STOCK_LIQUIDITY:50,TAX_RESERVE:20,BUSINESS_RESERVE:15,GROWTH_FUND:10,OWNER_POT:5}},
    {id:2,key:'PROVING_MODEL',label:'Proving the Model',minDaily:100,alloc:{STOCK_LIQUIDITY:45,TAX_RESERVE:20,BUSINESS_RESERVE:15,GROWTH_FUND:10,OWNER_POT:10}},
    {id:3,key:'ESTABLISHED_SIDE_BUSINESS',label:'Established Side Business',minDaily:300,alloc:{STOCK_LIQUIDITY:35,TAX_RESERVE:20,BUSINESS_RESERVE:15,GROWTH_FUND:10,OWNER_POT:20}},
    {id:4,key:'OWNER_READINESS',label:'Owner Readiness',minDaily:600,alloc:{STOCK_LIQUIDITY:25,TAX_RESERVE:20,BUSINESS_RESERVE:15,GROWTH_FUND:10,OWNER_POT:30}}
  ],
  hysteresis:{upgradeDays:14,downgradeDays:14,downgradeMaterialityPct:10},
  protection:{
    protectedLiquidityMinimum:0,
    businessReserveMonths:1,
    fixedMonthlyOperatingCostOverride:0,
    redirectPriority:['OWNER_POT','GROWTH_FUND']
  },
  grailPlan:{
    modes:[
      {key:'SEED',min:0,max:499.99,purpose:'Build the bankroll',minimumROI:30,minimumNetMargin:15,minimumConfidence:0.80},
      {key:'BUILD',min:500,max:1999.99,purpose:'Compound the bankroll',minimumROI:25,minimumNetMargin:15,minimumConfidence:0.80},
      {key:'SCALE',min:2000,max:null,purpose:'Hit the daily profit target',minimumROI:20,minimumNetMargin:12,minimumConfidence:0.80}
    ],
    targetBands:[
      {min:0,max:99.99,targetMin:10,targetMax:20},
      {min:100,max:249.99,targetMin:20,targetMax:40},
      {min:250,max:499.99,targetMin:40,targetMax:75},
      {min:500,max:999.99,targetMin:75,targetMax:125},
      {min:1000,max:1499.99,targetMin:125,targetMax:175},
      {min:1500,max:1999.99,targetMin:175,targetMax:200},
      {min:2000,max:null,targetMin:200,targetMax:250}
    ],
    capitalVelocityWeights:{projectedNetProfit:0.30,roi:0.25,sellThrough:0.20,confidence:0.15,capitalEfficiency:0.10},
    concentration:{maxSingleOpportunitySharePct:50},
    constrainedStatuses:['TARGET_CONSTRAINED_BY_LIQUIDITY','TARGET_CONSTRAINED_BY_MARKET_QUALITY','NO_HIGH_CONFIDENCE_ROUTE_FOUND']
  },
  selfFunding:{definition:'RETAINED_TRADING_PROFIT_COVERS_CURRENT_TRADING_CAPITAL',readyPct:100},
  ownerReadiness:{workingDaysPerMonth:21.67,dailyTargetMin:200,dailyTargetMax:250}
};

function deepMerge(base,extra){
  if(Array.isArray(base))return Array.isArray(extra)?clone(extra):clone(base);
  if(!base||typeof base!=='object')return extra===undefined?base:extra;
  const out={...base};
  Object.keys(extra||{}).forEach(k=>{
    if(base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k])&&extra[k]&&typeof extra[k]==='object'&&!Array.isArray(extra[k])) out[k]=deepMerge(base[k],extra[k]);
    else out[k]=clone(extra[k]);
  });
  return out;
}

function defaultState(now=isoNow()){
  return {
    engineVersion:ENGINE_VERSION,
    schemaVersion:SCHEMA_VERSION,
    initializedAt:now,
    config:clone(DEFAULT_CONFIG),
    allocations:[],
    ledger:[],
    stageHistory:[{from:null,to:1,reason:'ENGINE_INITIALISED',at:now}],
    currentStage:1,
    stageSince:now,
    migration:{version:1,legacySalesUnallocated:0,lastRunAt:now}
  };
}

function ensureState(db,{now=isoNow()}={}){
  if(!db||typeof db!=='object')throw new Error('Profit Engine requires a database object.');
  const existing=(db.profitEngine&&typeof db.profitEngine==='object')?db.profitEngine:{};
  const fresh=defaultState(now);
  db.profitEngine={
    ...fresh,...existing,
    engineVersion:ENGINE_VERSION,
    schemaVersion:SCHEMA_VERSION,
    config:deepMerge(DEFAULT_CONFIG,existing.config||{}),
    allocations:Array.isArray(existing.allocations)?existing.allocations:[],
    ledger:Array.isArray(existing.ledger)?existing.ledger:[],
    stageHistory:Array.isArray(existing.stageHistory)&&existing.stageHistory.length?existing.stageHistory:fresh.stageHistory,
    migration:{...fresh.migration,...(existing.migration||{})}
  };
  if(!db.profitEngine.currentStage)db.profitEngine.currentStage=1;
  if(!db.profitEngine.stageSince)db.profitEngine.stageSince=db.profitEngine.initializedAt||now;
  (db.funding||[]).forEach(f=>{if(!f.contributionType)f.contributionType='OWNER_CASH'});
  return db.profitEngine;
}

function purchaseForSale(db,sale){return (db.purchases||[]).find(p=>String(p.id)===String(sale?.pid))||null}
function unitCost(p){return p&&num(p.q)>0?num(p.cost)/num(p.q):0}
function purchaseOrigin(p){
  const v=String(p?.capitalOrigin||'').toUpperCase();
  if(v==='OWNER_CONTRIBUTED_INVENTORY')return v;
  if(v==='PURCHASED_FOR_RESALE')return v;
  return 'LEGACY_UNCLASSIFIED';
}
function classifySale(db,sale){
  const p=purchaseForSale(db,sale),origin=purchaseOrigin(p);
  if(origin==='OWNER_CONTRIBUTED_INVENTORY')return 'BOOTSTRAP';
  if(origin==='PURCHASED_FOR_RESALE')return 'TRADING';
  return 'LEGACY_UNALLOCATED';
}
function economics(db,sale){
  const p=purchaseForSale(db,sale),q=Math.max(0,num(sale?.q));
  const acquisitionCost=round2(unitCost(p)*q);
  const saleRevenue=round2(num(sale?.price));
  const buyerPostage=round2(num(sale?.buyerPost));
  const marketplaceFees=round2(num(sale?.fee));
  const postageCost=round2(num(sale?.post));
  const packagingCost=round2(num(sale?.pack));
  const otherDirectCosts=round2(num(sale?.other));
  const grossCashReceived=round2(saleRevenue+buyerPostage);
  const directSellingCosts=round2(marketplaceFees+postageCost+packagingCost+otherDirectCosts);
  const netCashBeforeAcquisition=round2(grossCashReceived-directSellingCosts);
  const realisedNetProfit=round2(netCashBeforeAcquisition-acquisitionCost);
  const acquisitionCapitalReturned=round2(Math.max(0,Math.min(acquisitionCost,netCashBeforeAcquisition)));
  return {saleRevenue,buyerPostage,grossCashReceived,acquisitionCost,marketplaceFees,postageCost,packagingCost,otherDirectCosts,directSellingCosts,netCashBeforeAcquisition,realisedNetProfit,acquisitionCapitalReturned};
}
function saleFingerprint(db,sale){
  const p=purchaseForSale(db,sale),e=economics(db,sale);
  return JSON.stringify([sale?.id,sale?.pid,dayKey(sale?.date),num(sale?.q),e.saleRevenue,e.buyerPostage,e.acquisitionCost,e.marketplaceFees,e.postageCost,e.packagingCost,e.otherDirectCosts,purchaseOrigin(p),String(sale?.status||''),String(sale?.profitDataStatus||'')]);
}
function saleIsRefunded(s){return ['REFUNDED','CANCELLED','VOID'].includes(String(s?.status||'').toUpperCase())||s?.refunded===true}
function saleProfitDataPending(s){return ['PENDING_COSTS','INCOMPLETE','AWAITING_COSTS'].includes(String(s?.profitDataStatus||'').toUpperCase())}

function activeAllocations(db){return ensureState(db).allocations.filter(a=>a.status==='ACTIVE')}
function tradingProfitRows(db,{upTo=null}={}){
  const cutoff=upTo?dayKey(upTo):null;
  return activeAllocations(db).filter(a=>a.classification==='TRADING'&&(!cutoff||a.saleDate<=cutoff)).map(a=>({date:a.saleDate,profit:num(a.realisedNetProfit)}));
}
function dailyAverage(db,days,{asOf=dayKey(Date.now())}={}){
  const end=dayKey(asOf),start=addDays(end,-(days-1));
  const total=tradingProfitRows(db,{upTo:end}).filter(x=>x.date>=start).reduce((a,x)=>a+x.profit,0);
  return round2(total/days);
}
function trendMetrics(db,{asOf=dayKey(Date.now())}={}){return {avg7:dailyAverage(db,7,{asOf}),avg30:dailyAverage(db,30,{asOf}),avg90:dailyAverage(db,90,{asOf}),avg180:dailyAverage(db,180,{asOf})}}
function rawStageForAverage(config,avg){return [...config.stages].sort((a,b)=>a.minDaily-b.minDaily).reduce((stage,x)=>avg>=x.minDaily?x.id:stage,1)}
function stageConfig(state,id){return state.config.stages.find(x=>x.id===id)||state.config.stages[0]}
function thresholdHeld(db,threshold,days,{asOf=dayKey(Date.now()),direction='gte'}={}){
  for(let i=0;i<days;i++){
    const d=addDays(asOf,-i),a=dailyAverage(db,30,{asOf:d});
    if(direction==='gte'&&a<threshold)return false;
    if(direction==='lte'&&a>threshold)return false;
  }
  return true;
}
function reconcileStage(db,{now=isoNow()}={}){
  const state=ensureState(db,{now}),asOf=dayKey(now),metrics=trendMetrics(db,{asOf});
  let current=num(state.currentStage)||1,changed=false,reason='NO_CHANGE';
  const h=state.config.hysteresis;
  while(current<state.config.stages.length){
    const next=stageConfig(state,current+1);
    if(!thresholdHeld(db,next.minDaily,h.upgradeDays,{asOf,direction:'gte'}))break;
    const from=current;current++;changed=true;reason=`UPGRADE_${h.upgradeDays}_DAY_THRESHOLD`;
    state.stageHistory.push({from,to:current,reason,signal30:metrics.avg30,at:now});
  }
  while(current>1){
    const cur=stageConfig(state,current),materialFloor=cur.minDaily*(1-num(h.downgradeMaterialityPct)/100);
    if(!thresholdHeld(db,materialFloor,h.downgradeDays,{asOf,direction:'lte'}))break;
    const from=current;current--;changed=true;reason=`DOWNGRADE_${h.downgradeDays}_DAY_MATERIAL_BELOW`;
    state.stageHistory.push({from,to:current,reason,signal30:metrics.avg30,at:now});
  }
  if(changed){state.currentStage=current;state.stageSince=now}
  return {stage:current,rawStage:rawStageForAverage(state.config,metrics.avg30),changed,reason,...metrics};
}

function ledgerBalances(db){
  const state=ensureState(db),out=Object.fromEntries(POTS.map(p=>[p,0]));
  state.ledger.forEach(x=>{if(out[x.pot]!==undefined)out[x.pot]=round2(out[x.pot]+num(x.amount))});
  const dividends=(db.dividends||[]).reduce((a,x)=>a+num(x.amount),0);
  out.OWNER_POT=round2(Math.max(0,out.OWNER_POT-dividends));
  return out;
}
function redirectFrom(actual,redirects,from,to,needed,reason){
  let remain=Math.max(0,num(needed));
  if(remain<=0)return 0;
  const take=Math.min(num(actual[from]),remain);
  if(take<=0)return 0;
  actual[from]=round2(actual[from]-take);actual[to]=round2(num(actual[to])+take);
  redirects.push({from,to,amount:round2(take),reason});return round2(take);
}
function protectAllocation(db,nominal,{context={}}={}){
  const state=ensureState(db),actual={...nominal},redirects=[],balances=ledgerBalances(db),cfg=state.config.protection;
  const priority=cfg.redirectPriority||['OWNER_POT','GROWTH_FUND'];
  const taxTarget=Math.max(0,num(context.taxReserveTarget));
  let need=Math.max(0,taxTarget-num(balances.TAX_RESERVE)-num(actual.TAX_RESERVE));
  priority.forEach(from=>{if(need>0)need=round2(need-redirectFrom(actual,redirects,from,'TAX_RESERVE',need,'TAX_RESERVE_UNDERFUNDED'))});
  const fixedMonthly=Math.max(0,num(context.fixedMonthlyOperatingCosts||cfg.fixedMonthlyOperatingCostOverride));
  const reserveTarget=round2(fixedMonthly*num(cfg.businessReserveMonths));
  need=Math.max(0,reserveTarget-num(balances.BUSINESS_RESERVE)-num(actual.BUSINESS_RESERVE));
  priority.forEach(from=>{if(need>0)need=round2(need-redirectFrom(actual,redirects,from,'BUSINESS_RESERVE',need,'BUSINESS_RESERVE_UNDERFUNDED'))});
  const protectedTarget=Math.max(0,num(context.protectedLiquidityTarget??cfg.protectedLiquidityMinimum));
  const businessCash=Math.max(0,num(context.totalBusinessCash));
  const ringBefore=num(balances.TAX_RESERVE)+num(balances.BUSINESS_RESERVE)+num(balances.GROWTH_FUND)+num(balances.OWNER_POT);
  const projectedFree=businessCash-ringBefore-num(actual.TAX_RESERVE)-num(actual.BUSINESS_RESERVE)-num(actual.GROWTH_FUND)-num(actual.OWNER_POT);
  need=Math.max(0,protectedTarget-projectedFree);
  priority.forEach(from=>{if(need>0)need=round2(need-redirectFrom(actual,redirects,from,'STOCK_LIQUIDITY',need,'PROTECTED_LIQUIDITY_BELOW_TARGET'))});
  return {actual,redirects,targets:{taxReserve:taxTarget,businessReserve:reserveTarget,protectedLiquidity:protectedTarget}};
}
function nominalSplit(profit,stage){
  const out={};POTS.forEach(p=>out[p]=round2(Math.max(0,num(profit))*num(stage.alloc[p])/100));
  const sum=Object.values(out).reduce((a,x)=>a+x,0),delta=round2(Math.max(0,num(profit))-sum);
  out.STOCK_LIQUIDITY=round2(out.STOCK_LIQUIDITY+delta);return out;
}
function pushLedger(state,allocation,amounts,{kind='ALLOCATION_CREDIT',sign=1,now=isoNow()}={}){
  POTS.forEach(p=>{const amount=round2(num(amounts[p])*sign);if(amount!==0)state.ledger.push({id:`LE-${allocation.id}-${p}-${state.ledger.length+1}`,allocationId:allocation.id,saleId:allocation.saleId,pot:p,amount,kind,at:now})});
}
function reverseAllocation(db,a,{now=isoNow(),reason='SALE_CHANGED_OR_REMOVED'}={}){
  if(!a||a.status!=='ACTIVE')return false;const state=ensureState(db,{now});
  pushLedger(state,a,a.actualAmounts||{}, {kind:'ALLOCATION_REVERSAL',sign:-1,now});
  a.status='REVERSED';a.reversedAt=now;a.reversalReason=reason;return true;
}
function makeAllocation(db,sale,{context={},now=isoNow()}={}){
  const state=ensureState(db,{now}),e=economics(db,sale),classification=classifySale(db,sale),stage=stageConfig(state,state.currentStage);
  const base={id:`PA-${String(sale.id)}-${Date.now().toString(36)}`,saleId:String(sale.id),saleDate:dayKey(sale.date),saleFingerprint:saleFingerprint(db,sale),source:sale.source||'MANUAL',allocationVersion:ENGINE_VERSION,classification,activeStage:stage.id,stageKey:stage.key,stageLabel:stage.label,nominalPercentages:{...stage.alloc},saleRevenue:e.saleRevenue,buyerPostage:e.buyerPostage,acquisitionCapitalReturned:e.acquisitionCapitalReturned,marketplaceFees:e.marketplaceFees,postageCost:e.postageCost,packagingCost:e.packagingCost,otherDirectCosts:e.otherDirectCosts,realisedNetProfit:e.realisedNetProfit,tradingProfit:classification==='TRADING'?e.realisedNetProfit:0,bootstrapProceeds:classification==='BOOTSTRAP'?Math.max(0,e.netCashBeforeAcquisition):0,createdAt:now,updatedAt:now,status:'ACTIVE',nominalAmounts:Object.fromEntries(POTS.map(p=>[p,0])),actualAmounts:Object.fromEntries(POTS.map(p=>[p,0])),redirects:[]};
  if(classification==='LEGACY_UNALLOCATED'){base.status='LEGACY_UNALLOCATED';base.unallocatedReason='INVENTORY_PROVENANCE_UNKNOWN';return base}
  if(classification==='BOOTSTRAP'){base.unallocatedReason='BOOTSTRAP_PROCEEDS_NOT_TRADING_PROFIT';return base}
  if(e.realisedNetProfit<=0){base.unallocatedReason=e.realisedNetProfit===0?'BREAK_EVEN_NO_PROFIT_TO_SPLIT':'LOSS_NO_PROFIT_TO_SPLIT';return base}
  base.nominalAmounts=nominalSplit(e.realisedNetProfit,stage);
  const protectedResult=protectAllocation(db,base.nominalAmounts,{context});
  base.actualAmounts=protectedResult.actual;base.redirects=protectedResult.redirects;base.protectionTargets=protectedResult.targets;
  pushLedger(state,base,base.actualAmounts,{now});
  return base;
}

function reconcile(db,{context={},now=isoNow()}={}){
  const state=ensureState(db,{now});
  const initDate=dayKey(state.initializedAt||now),sales=db.sales||[],saleIds=new Set(sales.map(s=>String(s.id)));
  state.allocations.filter(a=>a.status==='ACTIVE'&&!saleIds.has(String(a.saleId))).forEach(a=>reverseAllocation(db,a,{now,reason:'SALE_DELETED'}));
  sales.forEach(sale=>{
    const sid=String(sale.id),fingerprint=saleFingerprint(db,sale),active=[...state.allocations].reverse().find(a=>String(a.saleId)===sid&&a.status==='ACTIVE');
    if(saleIsRefunded(sale)){if(active)reverseAllocation(db,active,{now,reason:'SALE_REFUNDED_OR_CANCELLED'});return}
    if(saleProfitDataPending(sale)){
      if(active)reverseAllocation(db,active,{now,reason:'SALE_COSTS_PENDING'});
      const prior=[...state.allocations].reverse().find(a=>String(a.saleId)===sid&&a.status==='PENDING_COSTS'&&a.saleFingerprint===fingerprint);
      if(!prior)state.allocations.push({id:`PA-PENDING-${sid}-${Date.now().toString(36)}`,saleId:sid,saleDate:dayKey(sale.date),saleFingerprint:fingerprint,classification:classifySale(db,sale),status:'PENDING_COSTS',unallocatedReason:'DIRECT_SALE_COSTS_NOT_CONFIRMED',createdAt:now,updatedAt:now,allocationVersion:ENGINE_VERSION});
      return
    }
    if(active&&active.saleFingerprint===fingerprint)return;
    if(active)reverseAllocation(db,active,{now,reason:'SALE_EDITED_OR_RESYNCED'});
    if(dayKey(sale.date)<initDate){
      state.allocations.push({id:`PA-LEGACY-${sid}`,saleId:sid,saleDate:dayKey(sale.date),saleFingerprint:fingerprint,classification:'LEGACY_UNALLOCATED',status:'LEGACY_UNALLOCATED',unallocatedReason:'PRE_ENGINE_HISTORICAL_SALE',createdAt:now,updatedAt:now,allocationVersion:ENGINE_VERSION});
      return;
    }
    state.allocations.push(makeAllocation(db,sale,{context,now}));
  });
  state.migration.legacySalesUnallocated=state.allocations.filter(a=>a.status==='LEGACY_UNALLOCATED').length;state.migration.lastRunAt=now;
  const stage=reconcileStage(db,{now});
  return {stage,balances:ledgerBalances(db),allocations:state.allocations.length};
}

function totalOwnerCashInjected(db){return round2((db.funding||[]).filter(x=>!x.contributionType||x.contributionType==='OWNER_CASH').reduce((a,x)=>a+num(x.amount),0))}
function bootstrapGenerated(db){return round2(ensureState(db).allocations.filter(a=>a.classification==='BOOTSTRAP'&&a.status==='ACTIVE').reduce((a,x)=>a+num(x.bootstrapProceeds),0))}
function retainedTradingProfit(db){return round2(ensureState(db).allocations.filter(a=>a.classification==='TRADING'&&a.status==='ACTIVE').reduce((a,x)=>a+num(x.actualAmounts?.STOCK_LIQUIDITY),0))}
function ownerAllocated(db,days,{asOf=dayKey(Date.now())}={}){
  const start=addDays(asOf,-(days-1));return round2(ensureState(db).allocations.filter(a=>a.status==='ACTIVE'&&a.saleDate>=start&&a.saleDate<=asOf).reduce((sum,a)=>sum+num(a.actualAmounts?.OWNER_POT),0));
}
function modeForLiquidity(config,liq){return config.grailPlan.modes.find(x=>liq>=x.min&&(x.max==null||liq<=x.max))||config.grailPlan.modes[config.grailPlan.modes.length-1]}
function targetBand(config,liq){return config.grailPlan.targetBands.find(x=>liq>=x.min&&(x.max==null||liq<=x.max))||config.grailPlan.targetBands[config.grailPlan.targetBands.length-1]}
function getGrailPlanState(db,context={}){
  const state=ensureState(db),metrics=trendMetrics(db),balances=ledgerBalances(db),cfg=state.config;
  const totalCash=Math.max(0,num(context.totalBusinessCash));
  const fixedMonthly=Math.max(0,num(context.fixedMonthlyOperatingCosts||cfg.protection.fixedMonthlyOperatingCostOverride));
  const reserveTarget=round2(fixedMonthly*num(cfg.protection.businessReserveMonths));
  const taxTarget=Math.max(0,num(context.taxReserveTarget));
  const generalProtected=Math.max(0,num(context.protectedLiquidityTarget??cfg.protection.protectedLiquidityMinimum));
  const protectedTax=Math.max(taxTarget,num(balances.TAX_RESERVE));
  const protectedReserve=Math.max(reserveTarget,num(balances.BUSINESS_RESERVE));
  const ringFenced=round2(protectedTax+protectedReserve+num(balances.GROWTH_FUND)+num(balances.OWNER_POT));
  const deployable=round2(Math.max(0,totalCash-generalProtected-ringFenced));
  const committed=round2(Math.max(0,num(context.committedInventoryCapital)));
  const mode=modeForLiquidity(cfg,deployable),band=targetBand(cfg,deployable);
  const shortfall=Math.max(0,round2(num(context.opportunityBasketRequired)-deployable));
  const retained=retainedTradingProfit(db),currentTradingCapital=round2(deployable+committed);
  const selfPct=currentTradingCapital>0?Math.min(100,round2(retained/currentTradingCapital*100)):(retained>0?100:0);
  const owner30=ownerAllocated(db,30),ownerAvg=round2(owner30/30),ownerMonthly=round2(ownerAvg*num(cfg.ownerReadiness.workingDaysPerMonth));
  const protectionsOk=protectedTax<=num(balances.TAX_RESERVE)+0.009&&protectedReserve<=num(balances.BUSINESS_RESERVE)+0.009&&totalCash>=generalProtected;
  let readiness='NOT_READY';
  if(ownerAvg>=cfg.ownerReadiness.dailyTargetMin&&metrics.avg90>=cfg.ownerReadiness.dailyTargetMin&&metrics.avg180>=cfg.ownerReadiness.dailyTargetMin&&protectionsOk)readiness='READY';
  else if(ownerAvg>=cfg.ownerReadiness.dailyTargetMin*.75&&metrics.avg90>=cfg.ownerReadiness.dailyTargetMin*.75)readiness='APPROACHING';
  else if(metrics.avg30>0||retained>0)readiness='BUILDING';
  return {
    engineVersion:ENGINE_VERSION,mode:mode.key,modePurpose:mode.purpose,availableLiquidity:deployable,availableGrailPlanLiquidity:deployable,protectedLiquidity:round2(generalProtected+ringFenced),totalBusinessCash:totalCash,capitalCommittedToInventory:committed,currentDailyTarget:round2((band.targetMin+band.targetMax)/2),targetRange:{min:band.targetMin,max:band.targetMax},minimumROI:mode.minimumROI,minimumNetMargin:mode.minimumNetMargin,minimumConfidence:mode.minimumConfidence,liquidityConstrained:shortfall>0,liquidityShortfall:shortfall,additionalProfitUnlocked:shortfall>0?round2(num(context.opportunityBasketProjectedProfit)):0,currentProfitStage:state.currentStage,profitStage:stageConfig(state,state.currentStage),trends:metrics,potBalances:balances,bootstrapCapital:bootstrapGenerated(db),ownerCashContributions:totalOwnerCashInjected(db),retainedTradingProfit:retained,selfFundedPercentage:selfPct,selfFundingDefinition:cfg.selfFunding.definition,selfFunded:selfPct>=num(cfg.selfFunding.readyPct),ownerReadiness:{status:readiness,averageOwnerPotPerDay30:ownerAvg,projectedMonthlyOwnerCapacity:ownerMonthly,dailyTargetMin:cfg.ownerReadiness.dailyTargetMin,dailyTargetMax:cfg.ownerReadiness.dailyTargetMax,protectedLiquidityOk:protectionsOk,taxReserveOk:num(balances.TAX_RESERVE)>=taxTarget,businessReserveOk:num(balances.BUSINESS_RESERVE)>=reserveTarget,relianceOnOwnerContributions:totalOwnerCashInjected(db)>0&&selfPct<100},capitalVelocityWeights:{...cfg.grailPlan.capitalVelocityWeights},constrainedStatuses:[...cfg.grailPlan.constrainedStatuses]
  };
}
function getFinanceSnapshot(db,context={}){
  const g=getGrailPlanState(db,context),today=dayKey(Date.now());
  const realisedToday=round2(activeAllocations(db).filter(a=>a.classification==='TRADING'&&a.saleDate===today).reduce((s,a)=>s+num(a.realisedNetProfit),0));
  return {realisedNetTradingProfitToday:realisedToday,currentProfitStage:g.currentProfitStage,allocationPercentages:{...g.profitStage.alloc},potBalances:g.potBalances,avg7:g.trends.avg7,avg30:g.trends.avg30,avg90:g.trends.avg90,avg180:g.trends.avg180,ownerPot:g.potBalances.OWNER_POT,deployableLiquidity:g.availableGrailPlanLiquidity,grailPlanMode:g.mode,selfFundedPercentage:g.selfFundedPercentage,ownerReadiness:g.ownerReadiness};
}
function scoreCapitalVelocity({projectedNetProfit=0,roi=0,expectedDaysToSale=90,confidence=0,capitalRequired=0}={},config=DEFAULT_CONFIG){
  const w=config.grailPlan.capitalVelocityWeights,profitScore=Math.min(1,Math.max(0,num(projectedNetProfit)/100)),roiScore=Math.min(1,Math.max(0,num(roi)/100)),sellScore=Math.min(1,Math.max(0,1-num(expectedDaysToSale)/180)),confScore=Math.min(1,Math.max(0,num(confidence))),capitalScore=Math.min(1,Math.max(0,num(projectedNetProfit)/(Math.max(.01,num(capitalRequired)))));
  return round2((profitScore*w.projectedNetProfit+roiScore*w.roi+sellScore*w.sellThrough+confScore*w.confidence+capitalScore*w.capitalEfficiency)*100);
}

const api={ENGINE_VERSION,SCHEMA_VERSION,DEFAULT_CONFIG,POTS,ensureState,economics,classifySale,saleFingerprint,saleProfitDataPending,reconcile,reconcileStage,trendMetrics,ledgerBalances,getGrailPlanState,getFinanceSnapshot,scoreCapitalVelocity,totalOwnerCashInjected,bootstrapGenerated,retainedTradingProfit};
root.GengrailProfitEngine=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
