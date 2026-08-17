Gengrail TCG v20.1.0 Consolidation Build

Gengrail TCG v20.0.1 — Unified Stock Intake

Gengrail Business Log v19.18.0 — Adaptive Buy Engine + Calculator UX Fixes

- Pricing Calculator now uses an adaptive value-tier buying model by default: lower percentage hurdles on premium cards, higher absolute cash-profit hurdles, and risk-adjusted safety buffers.
- Market spread / confidence can increase the safety buffer without changing the underlying verified market value.
- Buy cost and manual market value are card-specific and no longer persist between scans/sessions.
- Blank buy cost no longer produces fake profit, ROI or BUY decisions; the calculator waits for a seller asking price.
- BUY / CONSIDER / PASS now maps to recommended buy / maximum acceptable buy / over-ceiling.
- Added break-even acquisition ceiling and clearer target-failure explanations for low-value cards.
- Manual fixed margin/ROI/profit targets remain available under Buying & fulfilment assumptions.
- Existing postage profiles, eBay fulfilment-policy mapping, AI recognition, verified market pricing and Opportunity Finder separation are preserved.


v19.18.1: Pricing Calculator postage-accounting clarity. Guided price is explicitly item-only; buyer postage is credited as revenue, marketplace fees use buyer total where applicable, actual postage and packaging are deducted, and the UI shows the net delivery/packaging burden before marketplace fees. No economic formula change was required because v19.18.0 already used full transaction accounting.

v20 UI consolidation (13 Aug 2026)
- AI Stock intake now presents recognition + editable purchase details as one integrated workspace.
- Verified AI purchase can be saved directly; save action approves reviewed identity metadata.
- eBay Channel moved from Sales into Channels; Sales remains ledger/manual-sale focused.
- Duplicate Pricing Calculator shortcut removed from Tools (Buying remains its home).
- Pricing copy streamlined and recalculation is reactive while retaining a manual refresh control.
- Existing local database schema, permanent SKU/purchase ledgers, AI recognition, pricing and eBay data logic preserved.


v20.1.1 final consolidation patch: fixed Channels → eBay navigation, styled mobile record actions, collapsed location-creation tools, cache bumped.


v20.2.0 raw foundation: safer two-pass raw-card identity handling, review-required conflict state, dynamic pricing-source labels, and pricing-confidence separation.
