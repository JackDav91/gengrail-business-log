# Gengrail Profit Engine + Grail Plan Foundation — Manual Test Plan

Status: IN DEVELOPMENT — temporary-test-repo only

Do not promote to `gengrail-business-log` until this checklist and the existing app regression checks pass.

## Profit calculation
- [ ] Profitable purchased raw card sale: realised net profit = revenue + buyer postage - acquisition cost - fees - postage - packaging - other direct costs.
- [ ] Profitable purchased graded slab sale: same formula and classification = TRADING.
- [ ] Break-even sale: no Profit Split ledger credits.
- [ ] Loss-making sale: no Profit Split ledger credits; loss remains visible in trading-performance history.
- [ ] Missing/unknown live eBay costs: sale state = PENDING_COSTS and no Profit Split allocation.
- [ ] Edited sale: prior allocation reverses and replacement allocation is created once.
- [ ] Deleted sale: prior allocation reverses; pot ledger returns to pre-sale balances.
- [ ] Refunded/cancelled sale (when status is supported): active allocation reverses.

## Profit Split allocation
- [ ] Stage 1: 50% Stock / 20% Tax / 15% Reserve / 10% Growth / 5% Owner.
- [ ] Stage 2: 45 / 20 / 15 / 10 / 10.
- [ ] Stage 3: 35 / 20 / 15 / 10 / 20.
- [ ] Stage 4: 25 / 20 / 15 / 10 / 30.
- [ ] Upgrade requires configured 14-day sustained threshold.
- [ ] Downgrade requires configured 14-day materially-below threshold.
- [ ] Tax underfunding redirects funds explicitly and records reason.
- [ ] Protected-liquidity shortfall redirects funds explicitly and records reason.
- [ ] Owner Pot balance is not double-counted and logged dividends reduce available Owner Pot.
- [ ] Re-saving/re-rendering the same sale never allocates twice.

## Bootstrap / provenance
- [ ] Owner cash contribution records `OWNER_CASH` and increases business cash.
- [ ] Owner-contributed raw card records `OWNER_CONTRIBUTED_INVENTORY`.
- [ ] Owner-contributed graded card records `OWNER_CONTRIBUTED_INVENTORY`.
- [ ] Owner-contributed inventory does not reduce company cash as an acquisition purchase.
- [ ] Sale of owner-contributed stock creates BOOTSTRAP proceeds, not trading profit.
- [ ] Bootstrap proceeds do not affect 7/30/90/180-day trading-profit averages.
- [ ] Purchased-for-resale stock sale creates TRADING profit.

## Grail Plan foundation
- [ ] £50 deployable liquidity => SEED; target £10–£20.
- [ ] £300 => SEED; target £40–£75.
- [ ] £750 => BUILD; target £75–£125.
- [ ] £1,500 => BUILD; target £175–£200.
- [ ] £2,500 => SCALE; target £200–£250.
- [ ] Tax Reserve, Business Reserve, Growth Fund and Owner Pot are excluded from deployable liquidity.
- [ ] General protected cash is excluded from deployable liquidity.
- [ ] Capital committed to inventory is exposed separately.
- [ ] Sale proceeds return acquisition capital to business cash naturally through the cash ledger.
- [ ] Retained Stock/Liquidity Profit Split is tracked as internally generated trading capital.
- [ ] Liquidity constraint example: £950 available / £1,370 required => £420 shortfall.
- [ ] Capital velocity score responds to projected profit, ROI, expected days-to-sale, confidence and capital required.

## Self-funding / owner readiness
- [ ] Total owner cash injected remains historically visible.
- [ ] Bootstrap proceeds are reported separately.
- [ ] Retained trading profit is reported separately.
- [ ] Self-funded percentage is derived, not manually entered.
- [ ] `100% SELF-FUNDED` is only true when the configured definition reaches its threshold.
- [ ] Owner Readiness exposes NOT READY / BUILDING / APPROACHING / READY neutrally.
- [ ] Owner Readiness exposes 30/90/180-day performance and protected-pot status without employment advice.

## Persistence
- [ ] Reload page: schema-4 engine state survives.
- [ ] Service worker/cache refresh: app still opens and Profit Engine asset is available offline after first load.
- [ ] New JSON backup includes `profitEngine`, allocations, ledger, configuration and stage history.
- [ ] Restore new schema-4 JSON reproduces balances/allocation history.
- [ ] Restore old schema-3 JSON succeeds and adds an empty/default Profit Engine state without inventing historical allocations.
- [ ] Safety Vault recovery preserves schema-4 state.

## Regression
- [ ] Raw recognition.
- [ ] Graded slab recognition after Workers AI quota resets.
- [ ] Raw smart pricing.
- [ ] Graded smart pricing.
- [ ] Stock intake, including normal purchased stock.
- [ ] Stock intake, owner-contributed raw card.
- [ ] Stock intake, owner-contributed graded slab.
- [ ] Sales manual flow.
- [ ] Orders / pick-pack-dispatch.
- [ ] eBay listing flow.
- [ ] eBay order sync does not fabricate fees/profit.
- [ ] Finance dashboard legacy totals remain intact.
- [ ] Expenses.
- [ ] Owner funding/dividends.
- [ ] Tax estimate.
- [ ] Backup/restore.
- [ ] PWA/offline behavior.

## Foundation interfaces
The future Grail Plan UI must consume the engine rather than recalculate finance logic:

- `window.getGrailPlanState()`
- `window.getProfitFinanceSnapshot()`
- `window.GengrailProfitEngine.scoreCapitalVelocity(...)`

The full Grail Plan UI is deliberately outside this patch.
