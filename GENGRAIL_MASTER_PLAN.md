# GENGRAIL TCG
## Product Architecture & Master Build Plan

**Version 1.0 | 11 August 2026**

> Living master architecture. Status labels distinguish working capabilities from future intent.


## 1. Product Vision

**North Star:** Build a seller operating system for trading cards that connects acquisition, identification, inventory, storage, market intelligence, pricing, marketplace publishing, marketing, offers, sales, fulfilment and profit in one continuous data model.

**Ultimate workflow:** Point camera at card -> identify -> retrieve metadata -> create SKU -> assign storage -> estimate market value -> calculate economics -> prepare/publish eBay listing -> promote -> manage offers -> sell -> pick -> dispatch -> calculate actual profit -> learn from the transaction.

**Product families:** Gengrail Commerce runs the business. Gengrail Intelligence improves decisions. Gengrail Growth measures and improves demand. All three are connected by the same SKU and transaction history.


## 2. Architecture Principle: The SKU Is the Thread

**Core chain:** Purchase -> Inventory -> Location -> Market Value -> Listing -> Social/Campaign -> Offer -> Sale -> Pick -> Dispatch -> Profit.

**Why it matters:** Every important event should attach to a stable internal SKU. Marketplace IDs, storage locations, card metadata, content IDs, offers, orders and financial results become related records rather than disconnected notes.

**Design rule:** External services may change. Gengrail's internal SKU, transaction and event model should remain stable.


## 3. Current Foundation

**Status: LIVE / IN DEVELOPMENT:** The current product is a mobile-first PWA with branded navigation, local inventory/business records, SKU generation, JSON backup/restore protection and an eBay publishing configuration workflow.

**eBay foundation:** Production eBay connectivity is the immediate foundation: marketplace, merchant location, payment, fulfilment and return policies are synchronised and publishing details can be attached to an inventory item.

**Important distinction:** This document separates capabilities already working from planned architecture. A feature appearing here does not imply that it is already live.


## 4. Gengrail Commerce

**Inventory:** Structured card records, acquisition cost, source, dates, SKU, status, quantity, images, card metadata and audit history.

**Storage & fulfilment:** SKU-linked physical locations, printable labels/dividers, pick tasks, pack/dispatch workflow and order completion.

**Marketplace publishing:** Prepare listing data, validate required eBay metadata, publish, retain listing IDs, update inventory state and surface failures.

**Offers:** Retrieve incoming offers where supported; show Accept / Decline / Counter actions; calculate profit and target-floor context before action.

**Orders:** Sale -> confirm order/payment -> mark stock sold/reserved -> create pick task -> show location -> dispatch -> update marketplace fulfilment.

**Operational cockpit:** Home-screen badges should surface outstanding work such as Offers, Pick/Pack, Inventory exceptions and failed marketplace actions.


## 5. Gengrail Intelligence

**Smart Scan:** Camera-assisted card identification using visual recognition plus deterministic verification against card name, set, number, variant, language and grading attributes.

**Metadata enrichment:** Once identified, retrieve canonical card metadata, appropriate marketplace category and required item specifics.

**Pricing engine:** Gather legitimate comparable-market data, normalise candidates, reject poor matches/outliers and calculate a weighted market estimate with a confidence score.

**Economics engine:** Combine acquisition cost, marketplace fees, postage, packaging and target margin to calculate break-even, minimum viable sale price and estimated net profit.

**Three-price model:** Quick Sale = liquidity-oriented. Market = fair-value estimate. Gengrail Target = optimised around margin, likelihood of sale and current market.

**Offer intelligence:** Evaluate buyer offers against market value, cost and target floor; recommend accept, counter or decline. Any future automation should use explicit seller rules and safeguards.

**Buying intelligence:** Later, use historical sell-through, margins, market movement and inventory ageing to identify attractive acquisitions and warn against poor buys.


## 6. Gengrail Growth

**Campaign/SKU linkage:** Content ID -> Campaign -> SKU(s) -> marketplace listing -> click/engagement -> order -> sale -> actual profit.

**Tracking links:** Generate Gengrail redirect/tracking links for campaigns so traffic can be connected to specific listings and SKUs before redirecting to the marketplace.

**Attribution levels:** Confirmed: reliable tracked journey. Assisted: relevant interaction preceded a sale but causality is uncertain. Organic/Unknown: no traceable Gengrail social journey.

**Platform analytics:** Subject to each platform's APIs and permissions, ingest reach, impressions/views, engagement, link clicks, watch metrics and audience growth.

**Content ROI:** Optimise for attributed profit rather than vanity metrics or revenue alone. Track content production/advertising cost and calculate profit-based ROI.

**AI content recommendations:** When enough first-party history exists, recommend what to promote next based on inventory, margin, sell-through and previous content-to-profit conversion.


## 7. Automation & Notifications

**Event model:** Treat marketplace events, offers, orders, publishing failures, inventory changes and fulfilment steps as events that can create tasks and notifications.

**Seller notifications:** Surface incoming offers, sales, failed actions, stock/pricing issues and fulfilment tasks in-app; later add push notifications.

**Smart badges:** Colour/status-coded counts on the existing home-screen tiles should make Gengrail an operational cockpit rather than a passive database.

**Safety principle:** Automated commercial actions should be rule-based, auditable and reversible where possible. High-impact actions should start as recommendations before becoming optional automation.


## 8. Business Intelligence

**Profit first:** Track true net profit after cost of goods, marketplace fees, postage, packaging, content/advertising cost and other attributable costs.

**Core KPIs:** Gross profit margin, net profit, inventory turnover, sell-through, days-to-sale, cash tied in stock, ageing, listing conversion, offer conversion and return/refund impact.

**Learning loop:** Actual outcomes should feed future pricing, buying, offer and content recommendations. The objective is a compounding first-party data advantage.


## 9. Commercial SaaS Architecture

**Multi-user future:** Commercial Gengrail requires tenant/account isolation so one seller cannot see another seller's inventory, credentials, listings, financials or analytics.

**Authentication:** Move from a single-user PWA toward secure accounts, server-side persistence, role/permission controls and eventually native biometric convenience such as Face ID through the mobile platform.

**Marketplace credentials:** Each seller connects their own marketplace account through authorised OAuth flows; credentials/tokens remain server-side and scoped to that tenant.

**Platform path:** Stabilise the web/PWA product first, then consider a shared mobile codebase or native wrappers/apps for iOS and Android once product-market needs justify it.

**Commercial model:** Potential subscription tiers can eventually be based on inventory/listing volume, automation, intelligence features, users and marketplace integrations.


## 10. Build Sequence

**NOW - Production eBay foundation:** Complete and stabilise the first real production listing end-to-end. Confirm policy/category/condition/item-specific handling, error reporting, listing ID persistence and data survival through updates.

**NEXT - Operational commerce:** Harden inventory schema; storage locations and labels; listing status; order/sale ingestion; pick/pack/dispatch tasks; home-screen operational badges; server-side persistence plan.

**THEN - Pricing Intelligence V1:** Live-market comparable search where legitimately available; deterministic card matching; outlier handling; market estimate; confidence; fee/margin model; Quick Sale / Market / Gengrail Target.

**THEN - Offers & seller events:** Incoming-offer workflow, offer economics, accept/decline/counter where APIs permit, seller notifications and interested-buyer offers where supported.

**THEN - Smart Scan:** Camera capture -> candidate identification -> confidence/confirmation -> metadata -> SKU draft -> price intelligence -> listing draft. Start with human confirmation before one-tap automation.

**THEN - Growth Intelligence:** Tracking links, campaigns, SKU/content mapping, attribution, social API integrations, content ROI and recommendations.

**LATER - Commercial platform:** Database-backed multi-tenant SaaS, authentication/roles, billing, onboarding, marketplace account linking, mobile apps, scalable job/event infrastructure and broader TCG/marketplace support.


## 11. Feature Register

**LIVE:** Branded mobile PWA; home navigation; core business/inventory records; SKU creation; JSON backup/restore; eBay publishing setup/policy synchronisation components.

**IN DEVELOPMENT:** Production eBay publishing and required card/category/condition metadata workflow.

**PLANNED - High priority:** Storage/location system; fulfilment tasks; marketplace order sync; pricing/economics engine; offer management; notifications; smart badges.

**PLANNED - Strategic:** Smart Scan; buying intelligence; social tracking/attribution; Content ROI; AI content recommendations.

**LONG-TERM:** Multi-tenant SaaS, subscriptions, native iOS/Android experience, broader marketplace/TCG integrations and increasingly automated decision support.


## 12. Architecture Rules

**API first:** Prefer official/legitimate APIs and modular data-source adapters over brittle page scraping.

**Deterministic before AI:** Use exact IDs and structured matching wherever possible. AI should interpret ambiguity, images and messy text rather than replace reliable rules.

**Modular integrations:** eBay, pricing sources, social networks and future marketplaces should plug into adapters so one external dependency cannot dictate the whole architecture.

**Server-side secrets:** Marketplace credentials, AI keys and other secrets must not live in client-side JavaScript in a commercial product.

**Observability:** Every external action should have status, timestamp, request/result identifiers where appropriate, retry handling and a user-readable failure state.

**Data portability:** Continue backup/export capability even after server persistence is introduced.


## 13. Business Plan & Growth Formula

**Mission:** Build a trusted UK trading-card business driven by data, disciplined operations and relentless focus on profitable growth and brand.

**Growth formula:** Right stock x Data & intelligence x Smart operations x Brand & marketing = Profit & growth.

**Economic formula:** Profit = Revenue - COGS - marketplace fees - postage - packaging - attributable costs. Margin and cash velocity matter alongside absolute profit.

**Operating philosophy:** Source smart. Know the numbers. Build repeatable systems. Protect margin. Reinvest. Scale only what works.

**90-day bias:** Build inventory carefully, improve listings and operations, establish reliable data capture, publish consistent product-led content and use actual results to refine sourcing and pricing.


## 14. Definition of Success

**Seller experience:** A seller can move from card acquisition to profitable fulfilment with minimal duplicate data entry and clear next actions.

**Intelligence:** Recommendations explain their inputs and confidence rather than presenting opaque 'AI' answers.

**Operational quality:** No inventory item, marketplace action, order or fulfilment task is lost between systems.

**Commercial moat:** Over time, Gengrail's first-party history of acquisition, pricing, content, offers, conversion and profit becomes more useful than any single external data source.


## 15. Change Control

**Versioning:** Use semantic document versions such as v1.0, v1.1 and v2.0. Update the master Markdown alongside meaningful product/architecture changes.

**Status vocabulary:** LIVE = working in production use. IN DEVELOPMENT = actively being built/tested. PLANNED = agreed target. RESEARCH = feasibility/access still being validated. LONG-TERM = strategic direction.

**Repository recommendation:** Store GENGRAIL_MASTER_PLAN.md in the app repository as the living master. Keep this PDF as a published snapshot. Later surface selected roadmap/status information in a private Gengrail HQ screen.


## Changelog
- v1.0 - Initial consolidated architecture and build roadmap.
