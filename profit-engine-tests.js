const assert=require('assert');
const PE=require('./gengrail-profit-engine.js');

function db(){return {schemaVersion:4,purchases:[],sales:[],expenses:[],funding:[],dividends:[],opportunities:[],locations:[],orders:[],settings:{},profitEngine:null}}
function purchase(d,{id='P1',cost=80,q=1,origin='PURCHASED_FOR_RESALE'}={}){d.purchases.push({id,cost,q,capitalOrigin:origin,date:'2026-08-16'});return id}
function sale(d,{id='S1',pid='P1',price=110,buyerPost=0,fee=0,post=0,pack=0,other=0,date='2026-08-16',q=1,status='COMPLETED'}={}){const s={id,pid,price,buyerPost,fee,post,pack,other,date,q,status,source:'MANUAL'};d.sales.push(s);return s}
function context(cash=1000){return {totalBusinessCash:cash,taxReserveTarget:0,protectedLiquidityTarget:0,fixedMonthlyOperatingCosts:0,committedInventoryCapital:0}}
function eq(a,b,msg){assert.strictEqual(Number(a),Number(b),msg)}

(function profitMath(){
 const d=db();purchase(d,{cost:80});const s=sale(d,{price:120,buyerPost:2,fee:10,post:3,pack:1,other:1});
 const e=PE.economics(d,s);eq(e.realisedNetProfit,27,'realised net profit');eq(e.acquisitionCapitalReturned,80,'capital returned');
})();

(function stage1SplitAndDuplicateProtection(){
 const d=db();purchase(d,{cost:80});sale(d,{price:110});PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});PE.reconcile(d,{context:context(),now:'2026-08-16T12:00:00Z'});
 const a=d.profitEngine.allocations.find(x=>x.saleId==='S1');eq(a.realisedNetProfit,30);eq(a.actualAmounts.STOCK_LIQUIDITY,15);eq(a.actualAmounts.TAX_RESERVE,6);eq(a.actualAmounts.BUSINESS_RESERVE,4.5);eq(a.actualAmounts.GROWTH_FUND,3);eq(a.actualAmounts.OWNER_POT,1.5);
 const ledgerCount=d.profitEngine.ledger.length;PE.reconcile(d,{context:context(),now:'2026-08-16T13:00:00Z'});eq(d.profitEngine.ledger.length,ledgerCount,'duplicate reconcile must not allocate twice');
})();

(function bootstrapDoesNotTrade(){
 const d=db();purchase(d,{cost:0,origin:'OWNER_CONTRIBUTED_INVENTORY'});sale(d,{price:100});PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});PE.reconcile(d,{context:context(),now:'2026-08-16T12:00:00Z'});
 const a=d.profitEngine.allocations.find(x=>x.saleId==='S1');assert.strictEqual(a.classification,'BOOTSTRAP');eq(a.tradingProfit,0);eq(a.bootstrapProceeds,100);eq(PE.trendMetrics(d).avg30,0);eq(d.profitEngine.ledger.length,0);
})();

(function breakEvenAndLossDoNotSplit(){
 for(const price of [80,70]){const d=db();purchase(d,{cost:80});sale(d,{price});PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});PE.reconcile(d,{context:context(),now:'2026-08-16T12:00:00Z'});eq(d.profitEngine.ledger.length,0)}
})();

(function editedSaleReversesAndReallocates(){
 const d=db();purchase(d,{cost:80});const s=sale(d,{price:110});PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});PE.reconcile(d,{context:context(),now:'2026-08-16T12:00:00Z'});s.price=120;PE.reconcile(d,{context:context(),now:'2026-08-16T13:00:00Z'});
 assert.strictEqual(d.profitEngine.allocations.filter(x=>x.saleId==='S1'&&x.status==='REVERSED').length,1);assert.strictEqual(d.profitEngine.allocations.filter(x=>x.saleId==='S1'&&x.status==='ACTIVE').length,1);eq(PE.ledgerBalances(d).STOCK_LIQUIDITY,20);
})();

(function deletedSaleReverses(){
 const d=db();purchase(d,{cost:80});sale(d,{price:110});PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});PE.reconcile(d,{context:context(),now:'2026-08-16T12:00:00Z'});d.sales=[];PE.reconcile(d,{context:context(),now:'2026-08-16T13:00:00Z'});eq(Object.values(PE.ledgerBalances(d)).reduce((a,x)=>a+x,0),0);
})();

(function operatingModesAndTargets(){
 const d=db();PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});
 let g=PE.getGrailPlanState(d,context(50));assert.strictEqual(g.mode,'SEED');assert.deepStrictEqual(g.targetRange,{min:10,max:20});
 g=PE.getGrailPlanState(d,context(300));assert.strictEqual(g.mode,'SEED');assert.deepStrictEqual(g.targetRange,{min:40,max:75});
 g=PE.getGrailPlanState(d,context(750));assert.strictEqual(g.mode,'BUILD');assert.deepStrictEqual(g.targetRange,{min:75,max:125});
 g=PE.getGrailPlanState(d,context(1500));assert.strictEqual(g.mode,'BUILD');assert.deepStrictEqual(g.targetRange,{min:175,max:200});
 g=PE.getGrailPlanState(d,context(2500));assert.strictEqual(g.mode,'SCALE');assert.deepStrictEqual(g.targetRange,{min:200,max:250});
})();

(function protectedCashExcluded(){
 const d=db();PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});d.profitEngine.config.protection.protectedLiquidityMinimum=200;
 const g=PE.getGrailPlanState(d,{totalBusinessCash:1000,taxReserveTarget:0,fixedMonthlyOperatingCosts:0,committedInventoryCapital:0});eq(g.availableGrailPlanLiquidity,800);
})();

(function ownerCashAndSelfFundingMetrics(){
 const d=db();d.funding.push({id:'F1',date:'2026-08-16',amount:500,contributionType:'OWNER_CASH'});PE.ensureState(d,{now:'2026-08-16T10:00:00Z'});eq(PE.totalOwnerCashInjected(d),500);
})();

(function capitalVelocityScore(){
 const score=PE.scoreCapitalVelocity({projectedNetProfit:20,roi:50,expectedDaysToSale:14,confidence:.95,capitalRequired:40});assert(score>0&&score<=100);
})();

console.log('Profit Engine tests passed');
