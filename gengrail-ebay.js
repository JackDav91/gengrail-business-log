/*
  GENGRAIL TCG — eBay Channel Module (pre-API version)
  ----------------------------------------------------
  Add this file beside index.html and include before </body>:
      <script src="gengrail-ebay.js"></script>

  This version DOES NOT contain eBay credentials or call eBay APIs.
  It provides a sync-ready local data model and eBay management screen.
*/
(() => {
  'use strict';

  const STORAGE_KEY = 'gengrail_ebay_channel_v1';

  const money = n => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP'
  }).format(Number(n || 0));

  const uid = (prefix='GTC') =>
    `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

  const nowISO = () => new Date().toISOString();

  const defaultState = {
    version: 1,
    connection: {
      status: 'awaiting_authorisation',
      sellerName: '',
      lastSync: null
    },
    listings: [],
    orders: [],
    settings: {
      defaultPlatform: 'eBay',
      autoMarkSold: true
    }
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      return { ...structuredClone(defaultState), ...JSON.parse(raw) };
    } catch {
      return structuredClone(defaultState);
    }
  }

  let state = load();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('gengrail:ebay-updated', { detail: getSummary() }));
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function netProfit(order) {
    return num(order.salePrice)
      + num(order.postageIncome)
      - num(order.purchaseCost)
      - num(order.platformFees)
      - num(order.postageCost)
      - num(order.packagingCost)
      - num(order.otherCosts);
  }

  function getSummary() {
    const active = state.listings.filter(x => x.status === 'LISTED');
    const sold = state.orders.filter(x => x.status !== 'CANCELLED');
    return {
      activeListings: active.length,
      listedValue: active.reduce((s,x) => s + num(x.listPrice) * num(x.quantity || 1), 0),
      totalSales: sold.reduce((s,x) => s + num(x.salePrice) + num(x.postageIncome), 0),
      totalFees: sold.reduce((s,x) => s + num(x.platformFees), 0),
      netProfit: sold.reduce((s,x) => s + netProfit(x), 0),
      lastSync: state.connection.lastSync
    };
  }

  function addListing(data={}) {
    const listing = {
      id: uid('LST'),
      inventoryId: data.inventoryId || '',
      sku: data.sku || uid('SKU'),
      title: data.title || 'Untitled Gengrail item',
      category: data.category || 'Trading Card',
      condition: data.condition || 'Ungraded',
      purchaseCost: num(data.purchaseCost),
      listPrice: num(data.listPrice),
      quantity: Math.max(1, parseInt(data.quantity || 1, 10)),
      ebayItemId: data.ebayItemId || '',
      ebayUrl: data.ebayUrl || '',
      status: data.status || 'LISTED',
      source: data.source || 'manual',
      createdAt: data.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    state.listings.unshift(listing);
    save();
    render();
    return listing;
  }

  function recordSale(data={}) {
    let listing = null;
    if (data.listingId) listing = state.listings.find(x => x.id === data.listingId);
    if (!listing && data.sku) listing = state.listings.find(x => x.sku === data.sku);

    const order = {
      id: uid('ORD'),
      ebayOrderId: data.ebayOrderId || '',
      ebayItemId: data.ebayItemId || listing?.ebayItemId || '',
      listingId: listing?.id || data.listingId || '',
      inventoryId: data.inventoryId || listing?.inventoryId || '',
      sku: data.sku || listing?.sku || '',
      title: data.title || listing?.title || 'eBay sale',
      purchaseCost: num(data.purchaseCost ?? listing?.purchaseCost),
      salePrice: num(data.salePrice),
      postageIncome: num(data.postageIncome),
      platformFees: num(data.platformFees),
      postageCost: num(data.postageCost),
      packagingCost: num(data.packagingCost),
      otherCosts: num(data.otherCosts),
      buyerRef: data.buyerRef || '',
      status: data.status || 'PAID',
      soldAt: data.soldAt || nowISO(),
      source: data.source || 'manual'
    };
    order.netProfit = netProfit(order);
    state.orders.unshift(order);

    if (listing && state.settings.autoMarkSold) {
      listing.status = 'SOLD';
      listing.updatedAt = nowISO();
    }

    save();
    render();
    return order;
  }

  function setConnection(status, sellerName='') {
    state.connection.status = status;
    if (sellerName) state.connection.sellerName = sellerName;
    save();
    render();
  }

  function markSynced() {
    state.connection.lastSync = nowISO();
    save();
    render();
  }

  function exportData() {
    return {
      module: 'gengrail-ebay',
      exportedAt: nowISO(),
      data: structuredClone(state)
    };
  }

  function importData(payload) {
    if (!payload) return false;
    const incoming = payload.module === 'gengrail-ebay' ? payload.data : payload.ebay || payload;
    if (!incoming || typeof incoming !== 'object') return false;
    state = { ...structuredClone(defaultState), ...incoming };
    save();
    render();
    return true;
  }

  function esc(v='') {
    return String(v).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[c]));
  }

  function injectStyles() {
    if (document.getElementById('gengrail-ebay-styles')) return;
    const style = document.createElement('style');
    style.id = 'gengrail-ebay-styles';
    style.textContent = `
      #gengrail-ebay-channel{max-width:720px;margin:18px auto;font-family:system-ui,-apple-system,sans-serif;color:#f4f1ea}
      #gengrail-ebay-channel *{box-sizing:border-box}
      .ge-panel{background:#111;border:2px solid #2d2d2d;border-radius:14px;padding:15px;box-shadow:7px 7px 0 #000;margin:12px 0}
      .ge-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .ge-title{font-size:22px;font-weight:1000;letter-spacing:.04em;margin:0}
      .ge-title b{color:#ff7a00}
      .ge-badge{font-size:10px;font-weight:900;padding:6px 9px;border-radius:999px;background:#261607;color:#ffb04c;border:1px solid #5a3516;text-transform:uppercase}
      .ge-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:12px}
      .ge-stat{background:#090909;border:1px solid #292929;border-radius:10px;padding:11px}
      .ge-stat small{display:block;color:#8e8e8e;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .ge-stat strong{font-size:19px;display:block;margin-top:3px}
      .ge-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .ge-btn{appearance:none;border:0;border-radius:9px;padding:12px;font-weight:1000;background:#ff7a00;color:#080808;cursor:pointer}
      .ge-btn.secondary{background:#1c1c1c;color:#ffb04c;border:1px solid #3c2c1e}
      .ge-note{font-size:11px;line-height:1.45;color:#aaa;margin-top:10px;border-left:3px solid #ff7a00;padding:8px 10px;background:#0b0b0b}
      .ge-section-title{margin:15px 0 7px;font-size:12px;color:#ffb04c;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}
      .ge-card{background:#0a0a0a;border:1px solid #272727;border-radius:10px;padding:11px;margin:7px 0}
      .ge-card-top{display:flex;justify-content:space-between;gap:10px}
      .ge-card-title{font-weight:900;font-size:13px}
      .ge-card-sub{font-size:10px;color:#8e8e8e;margin-top:3px}
      .ge-status{font-size:9px;font-weight:1000;color:#82dda0}
      .ge-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px;font-size:10px}
      .ge-row span{color:#888;display:block}.ge-row b{font-size:12px}
      .ge-empty{font-size:11px;color:#777;padding:10px 0}
      .ge-modal{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:12px}
      .ge-sheet{width:min(720px,100%);max-height:90vh;overflow:auto;background:#111;border:2px solid #333;border-radius:18px 18px 8px 8px;padding:16px}
      .ge-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .ge-form .full{grid-column:1/-1}
      .ge-form label{display:block;font-size:9px;font-weight:900;color:#aaa;text-transform:uppercase;margin:0 0 4px}
      .ge-form input,.ge-form select{width:100%;background:#080808;color:#f4f1ea;border:1px solid #333;border-radius:8px;padding:11px;font:inherit}
      .ge-close{float:right;background:none;border:0;color:#aaa;font-size:22px}
      @media(max-width:520px){.ge-form{grid-template-columns:1fr}.ge-form .full{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function modal(inner) {
    const wrap = document.createElement('div');
    wrap.className = 'ge-modal';
    wrap.innerHTML = `<div class="ge-sheet"><button class="ge-close" aria-label="Close">×</button>${inner}</div>`;
    wrap.querySelector('.ge-close').onclick = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    document.body.appendChild(wrap);
    return wrap;
  }

  function listingForm() {
    const m = modal(`
      <h3>Add eBay listing</h3>
      <form id="ge-listing-form" class="ge-form">
        <div class="full"><label>Item / card title</label><input name="title" required></div>
        <div><label>SKU</label><input name="sku" placeholder="Auto if blank"></div>
        <div><label>eBay item ID</label><input name="ebayItemId" placeholder="Optional until synced"></div>
        <div><label>Purchase cost</label><input name="purchaseCost" type="number" min="0" step=".01"></div>
        <div><label>eBay list price</label><input name="listPrice" type="number" min="0" step=".01" required></div>
        <div><label>Category</label><select name="category"><option>Raw Single</option><option>Graded</option><option>Sealed</option><option>Accessory</option></select></div>
        <div><label>Condition</label><select name="condition"><option>Ungraded</option><option>Graded</option><option>New</option><option>Used</option></select></div>
        <div class="full"><label>eBay listing URL</label><input name="ebayUrl" type="url" placeholder="Optional"></div>
        <button class="ge-btn full" type="submit">SAVE LISTING</button>
      </form>
    `);
    m.querySelector('#ge-listing-form').onsubmit = e => {
      e.preventDefault();
      addListing(Object.fromEntries(new FormData(e.target).entries()));
      m.remove();
    };
  }

  function saleForm() {
    const listed = state.listings.filter(x => x.status === 'LISTED');
    const opts = listed.map(x =>
      `<option value="${esc(x.id)}">${esc(x.title)} — ${money(x.listPrice)}</option>`
    ).join('');
    const m = modal(`
      <h3>Record eBay sale</h3>
      <form id="ge-sale-form" class="ge-form">
        <div class="full"><label>Match listing</label><select name="listingId"><option value="">No linked listing</option>${opts}</select></div>
        <div><label>Sale price</label><input name="salePrice" type="number" min="0" step=".01" required></div>
        <div><label>eBay fees</label><input name="platformFees" type="number" min="0" step=".01" value="0"></div>
        <div><label>Postage income</label><input name="postageIncome" type="number" min="0" step=".01" value="0"></div>
        <div><label>Postage cost</label><input name="postageCost" type="number" min="0" step=".01" value="0"></div>
        <div><label>Packaging</label><input name="packagingCost" type="number" min="0" step=".01" value="0"></div>
        <div><label>Other costs</label><input name="otherCosts" type="number" min="0" step=".01" value="0"></div>
        <div><label>eBay order ID</label><input name="ebayOrderId"></div>
        <div><label>Buyer ref</label><input name="buyerRef"></div>
        <button class="ge-btn full" type="submit">RECORD SALE</button>
      </form>
    `);
    const select = m.querySelector('[name="listingId"]');
    const price = m.querySelector('[name="salePrice"]');
    select.onchange = () => {
      const x = state.listings.find(v => v.id === select.value);
      if (x && !price.value) price.value = x.listPrice;
    };
    m.querySelector('#ge-sale-form').onsubmit = e => {
      e.preventDefault();
      recordSale(Object.fromEntries(new FormData(e.target).entries()));
      m.remove();
    };
  }

  function render() {
    injectStyles();
    let root = document.getElementById('gengrail-ebay-channel');
    if (!root) {
      root = document.createElement('section');
      root.id = 'gengrail-ebay-channel';
      document.body.appendChild(root);
    }

    const s = getSummary();
    const statusText = state.connection.status === 'connected'
      ? 'Connected'
      : 'Awaiting eBay API';

    const listingsHtml = state.listings.slice(0,5).map(x => `
      <div class="ge-card">
        <div class="ge-card-top">
          <div><div class="ge-card-title">${esc(x.title)}</div><div class="ge-card-sub">${esc(x.sku)}${x.ebayItemId ? ' · eBay '+esc(x.ebayItemId) : ''}</div></div>
          <div class="ge-status">${esc(x.status)}</div>
        </div>
        <div class="ge-row">
          <div><span>COST</span><b>${money(x.purchaseCost)}</b></div>
          <div><span>LISTED</span><b>${money(x.listPrice)}</b></div>
          <div><span>CHANNEL</span><b>eBay</b></div>
        </div>
      </div>`).join('');

    const salesHtml = state.orders.slice(0,5).map(x => `
      <div class="ge-card">
        <div class="ge-card-top">
          <div><div class="ge-card-title">${esc(x.title)}</div><div class="ge-card-sub">${esc(x.ebayOrderId || x.sku || x.id)}</div></div>
          <div class="ge-status">SOLD</div>
        </div>
        <div class="ge-row">
          <div><span>SALE</span><b>${money(x.salePrice)}</b></div>
          <div><span>FEES</span><b>${money(x.platformFees)}</b></div>
          <div><span>NET PROFIT</span><b>${money(x.netProfit)}</b></div>
        </div>
      </div>`).join('');

    root.innerHTML = `
      <div class="ge-panel">
        <div class="ge-head">
          <h2 class="ge-title"><b>eBay</b> CHANNEL</h2>
          <div class="ge-badge">${statusText}</div>
        </div>
        <div class="ge-grid">
          <div class="ge-stat"><small>Active listings</small><strong>${s.activeListings}</strong></div>
          <div class="ge-stat"><small>Listed value</small><strong>${money(s.listedValue)}</strong></div>
          <div class="ge-stat"><small>eBay sales</small><strong>${money(s.totalSales)}</strong></div>
          <div class="ge-stat"><small>Net profit</small><strong>${money(s.netProfit)}</strong></div>
        </div>
        <div class="ge-actions">
          <button class="ge-btn" id="ge-add-listing">+ ADD LISTING</button>
          <button class="ge-btn secondary" id="ge-record-sale">RECORD SALE</button>
        </div>
        <div class="ge-note">
          eBay API connection is deliberately disabled while authorisation is pending.
          Listings and sales entered here are stored locally and are ready to be mapped to live eBay data later.
        </div>

        <div class="ge-section-title">Latest listings</div>
        ${listingsHtml || '<div class="ge-empty">No eBay listings logged yet.</div>'}

        <div class="ge-section-title">Latest eBay sales</div>
        ${salesHtml || '<div class="ge-empty">No eBay sales logged yet.</div>'}
      </div>
    `;

    root.querySelector('#ge-add-listing').onclick = listingForm;
    root.querySelector('#ge-record-sale').onclick = saleForm;
  }

  // Public hooks for the main Gengrail app and future eBay backend.
  window.GengrailEbay = {
    getState: () => structuredClone(state),
    getSummary,
    addListing,
    recordSale,
    exportData,
    importData,
    setConnection,
    markSynced,
    render,
    storageKey: STORAGE_KEY
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', render)
    : render();
})();
