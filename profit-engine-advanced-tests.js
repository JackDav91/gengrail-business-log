const assert=require('assert');
const PE=require('./gengrail-profit-engine.js');
const eq=(a,b,msg)=>assert.strictEqual(Number(a),Number(b),msg);
function db(){return {schemaVersion:4,purchases:[],sales:[],expenses:[],funding:[],dividends:[],opportunities:[],locations:[],orders:[],settings:{},profitEngine:null}}
function purchase(d,{id='P1',cost=0,q=1,origin='PURCHASED_FOR_RESALE',cat='Raw Single'}={}){d.purchases.push({id,cost,q,capitalOrigin:origin,cat,date:'2026-08-16'});return id}
function sale(d,{id='S1',pid='P1',price=100,date='2026-08-16',status='COMPLETED',profitDataStatus='CONFIRMED',source='MANUAL'}={}){const s={id,pid,price,buyerPost:0,fee:0,post:0,pack:0,other:0,date,q:1,status,source,profitDataStatus};d.sales.push(s);return s}
function ctx(cash=10000,extra={}){return {totalBusinessCash:cash,taxReserveTarget:0,protectedLiquidityTarget:0,fixedMonthlyOperatingCosts:0,committedInventoryCapital:0,...extra}}

(function stageSplits(){
 const expected={2:[45,20,15,10,10],3:[35,20,15,10,20],4:[25,20,15,10,30]};
 for(const stage of [2,3,4]){
   const d=db();purchase(d);PE.ensureState(d,{now:'2026-08-16T09:00:00Z'});d.profitEngine.currentStage=stage;sale(d);PE.reconcile(d,{context:ctx(),now:'2026-08-16T10:00:00Z'});
   const a=d.profitEngine.allocations.find(x=>x.status==='ACTIVE');
   const got=['STOCK_LIQUIDITY','TAX_RESERVE','BUSINESS_RESERVE','GROWTH_FUND','OWNER_POT'].map(k=>a.actualAmounts[k]);
   assert.deepStrictEqual(got,expected[stage],`stage ${stage} split`);
 }
})();

(function sustainedPerformanceUpgrades(){
 const d=db();PE.ensureState(d,{now:'2026-06-01T00:00:00Z'});d.profitEngine.currentStage=1;
 const asOf='2026-08-16';
 for(let i=0;i<70;i++)d.profitEngine.allocations.push({id:'A'+i,saleId:'S'+i,saleDate:new Date(Date.parse(asOf+'T12:00:00Z')-i*86400000).toISOString().slice(0,10),classification:'TRADING',status:'ACTIVE',realisedNetProfit:650,actualAmounts:{}});
 const r=PE.reconcileStage(d,{now:asOf+'T18:00:00Z'});assert.strictEqual(r.stage,4,'sustained 650/day should reach stage 4');assert(d.profitEngine.stageHistory.some(x=>x.to===4));
})();

(function sustainedUnderperformanceDowngrades(){
 const d=db();PE.ensureState(d,{now:'2026-01-01T00:00:00Z'});d.profitEngine.currentStage=4;d.profitEngine.stageSince='2026-05-01T00:00:00Z';
 const r=PE.reconcileStage(d,{now:'2026-08-16T18:00:00Z'});assert.strictEqual(r.stage,1,'sustained underperformance should downgrade');assert(d.profitEngine.stageHistory.some(x=>String(x.reason).startsWith('DOWNGRADE_')));
})();

(function taxProtectionRedirectIsExplicit(){
 const d=db();purchase(d);PE.ensureState(d,{now:'2026-08-16T09:00:00Z'});d.profitEngine.currentStage=4;sale(d);
 PE.reconcile(d,{context:ctx(10000,{taxReserveTarget:40}),now:'2026-08-16T10:00:00Z'});
 const a=d.profitEngine.allocations.find(x=>x.status==='ACTIVE');eq(a.actualAmounts.TAX_RESERVE,40);eq(a.actualAmounts.OWNER_POT,10);assert(a.redirects.some(x=>x.reason==='TAX_RESERVE_UNDERFUNDED'&&x.from==='OWNER_POT'));
})();

(function protectedLiquidityRedirectIsExplicit(){
 const d=db();purchase(d);PE.ensureState(d,{now:'2026-08-16T09:00:00Z'});d.profitEngine.currentStage=4;sale(d);
 PE.reconcile(d,{context:ctx(160,{protectedLiquidityTarget:100}),now:'2026-08-16T10:00:00Z'});
 const a=d.profitEngine.allocations.find(x=>x.status==='ACTIVE');assert(a.redirects.some(x=>x.reason==='PROTECTED_LIQUIDITY_BELOW_TARGET'));assert(a.actualAmounts.OWNER_POT<30);
})();

(function liquidityConstraintMetric(){
 const d=db();PE.ensureState(d,{now:'2026-08-16T09:00:00Z'});
 const g=PE.getGrailPlanState(d,ctx(950,{opportunityBasketRequired:1370,opportunityBasketProjectedProfit:118}));eq(g.availableGrailPlanLiquidity,950);assert.strictEqual(g.liquidityConstrained,true);eq(g.liquidityShortfall,420);eq(g.additionalProfitUnlocked,118);
})();

(function ownerContributedGradedIsBootstrap(){
 const d=db();purchase(d,{origin:'OWNER_CONTRIBUTED_INVENTORY',cat:'Graded'});sale(d,{price:100});PE.ensureState(d,{now:'2026-08-16T09:00:00Z'});PE.reconcile(d,{context:ctx(),now:'2026-08-16T10:00:00Z'});
 const a=d.profitEngine.allocations.find(x=>x.saleId==='S1');assert.strictEqual(a.classification,'BOOTSTRAP');eq(a.tradingProfit,0);eq(a.bootstrapProceeds,100);
})();

(function pendingCostsNeverAllocate(){
 const d=db();purchase(d,{cost:40});sale(d,{price:100,profitDataStatus:'PENDING_COSTS',source:'EBAY'});PE.ensureState(d,{now:'2026-08-16T09:00:00Z'});PE.reconcile(d,{context:ctx(),now:'2026-08-16T10:00:00Z'});
 assert.strictEqual(d.profitEngine.allocations.some(x=>x.status==='ACTIVE'),false,'pending-cost sale must not allocate');assert.strictEqual(d.profitEngine.allocations.some(x=>x.status==='PENDING_COSTS'),true,'pending-cost audit record required');eq(Object.values(PE.ledgerBalances(d)).reduce((a,x)=>a+x,0),0);
})();

console.log('Advanced Profit Engine tests passed');
