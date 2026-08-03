/**
 * app.js — Logic utama Kasir Web
 * POS untuk Rumah Herbal dan Madu Murni Abdul Ghani
 * Data disimpan di localStorage (tidak ada server/backend).
 */

const STORAGE_KEYS = {
  products:     'pos_products',
  transactions: 'pos_transactions',
  settings:     'pos_settings',
};

const DEFAULT_SETTINGS = {
  storeName:   'Rumah Herbal dan Madu Murni Abdul Ghani',
  storeAddress: '',
  footerText:  'Terima kasih sudah berbelanja! Semoga sehat selalu 🍯',
  paperWidth:  32,
};

let state = {
  products:     [],
  transactions: [],
  settings:     { ...DEFAULT_SETTINGS },
  cart:         [],  // { productId, name, price, qty }
  searchQuery:  '',
};

// ============================================================
// STORAGE HELPERS
// ============================================================
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function formatMoney(n) {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

// ============================================================
// TOAST
// ============================================================
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

// ============================================================
// INIT
// ============================================================
function init() {
  state.products     = load(STORAGE_KEYS.products, sampleProducts());
  state.transactions = load(STORAGE_KEYS.transactions, []);
  state.settings     = { ...DEFAULT_SETTINGS, ...load(STORAGE_KEYS.settings, {}) };

  renderStoreName();
  fillSettingsForm();
  renderDashboard();
  setDashDate();
  renderProductGrid();
  renderProductList();
  renderHistory();

  bindNav();
  bindKasir();
  bindProduk();
  bindPengaturan();
  bindPrinterStatus();
  updateCartBar();
}

function sampleProducts() {
  return [
    { id: uid(), name: 'Madu Murni 250gr',    price: 75000  },
    { id: uid(), name: 'Madu Murni 500gr',    price: 140000 },
    { id: uid(), name: 'Habbatussauda Kapsul',price: 35000  },
    { id: uid(), name: 'Jahe Merah Instan',   price: 25000  },
    { id: uid(), name: 'Kurma Ajwa 500gr',    price: 85000  },
    { id: uid(), name: 'Jintan Hitam 100gr',  price: 30000  },
  ];
}

// ============================================================
// NAVIGATION
// ============================================================
function bindNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === name)
  );
  document.getElementById('cartBar').hidden = (name !== 'kasir') || state.cart.length === 0;
  if (name === 'dashboard') renderDashboard();
}

function renderStoreName() {
  const name = state.settings.storeName || DEFAULT_SETTINGS.storeName;
  const el = document.getElementById('storeNameLabel');
  el.textContent = name.length > 30 ? name.slice(0, 30) + '…' : name;
}

function setDashDate() {
  const el = document.getElementById('dashDate');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const now       = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekDay   = now.getDay(); // 0=Sun
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekDay).getTime();

  let todayRevenue = 0, todayCount = 0, weekRevenue = 0;
  const productQty = {};  // name -> total qty sold

  state.transactions.forEach(t => {
    if (t.date >= todayStart) { todayRevenue += t.total; todayCount++; }
    if (t.date >= weekStart)  weekRevenue += t.total;
    t.items.forEach(it => {
      productQty[it.name] = (productQty[it.name] || 0) + it.qty;
    });
  });

  document.getElementById('dashToday').textContent      = formatMoney(todayRevenue);
  document.getElementById('dashTodayCount').textContent = todayCount;
  document.getElementById('dashWeek').textContent       = formatMoney(weekRevenue);
  document.getElementById('dashProducts').textContent   = state.products.length;

  // Top products (top 5)
  const ranks   = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const sorted  = Object.entries(productQty).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topList = document.getElementById('topProductsList');
  topList.innerHTML = sorted.length === 0
    ? '<p class="muted small" style="text-align:center;padding:18px 0">Belum ada data penjualan</p>'
    : sorted.map(([name, qty], i) => `
        <div class="top-product-row">
          <span class="tp-rank">${ranks[i] || (i + 1) + '.'}</span>
          <span class="tp-name">${escapeHtml(name)}</span>
          <span class="tp-qty">${qty}× terjual</span>
        </div>`).join('');

  // Recent transactions (last 3)
  const recent     = state.transactions.slice(0, 3);
  const recentList = document.getElementById('dashRecentList');
  recentList.innerHTML = recent.length === 0
    ? '<p class="muted small" style="text-align:center;padding:18px 0">Belum ada transaksi</p>'
    : recent.map(t => {
        const d         = new Date(t.date);
        const itemCount = t.items.reduce((s, i) => s + i.qty, 0);
        return `<div class="history-row" data-id="${t.id}">
          <div class="h-info">
            <span class="h-date">${d.toLocaleString('id-ID')}</span>
            <span class="h-items">${itemCount} item</span>
          </div>
          <span class="h-total">${formatMoney(t.total)}</span>
        </div>`;
      }).join('');

  // Bind click on recent items
  recentList.querySelectorAll('.history-row').forEach(row => {
    const trx = state.transactions.find(t => t.id === row.dataset.id);
    if (trx) row.addEventListener('click', () => openHistoryDetail(trx));
  });
}

// ============================================================
// KASIR / CART
// ============================================================
function bindKasir() {
  document.getElementById('cartSummaryBtn').addEventListener('click', openCartModal);
  document.getElementById('openCheckoutBtn').addEventListener('click', openCartModal);

  // Search
  const searchInput = document.getElementById('productSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.searchQuery = searchInput.value.trim().toLowerCase();
      renderProductGrid();
    });
  }

  // Dashboard "Lihat semua" button
  document.getElementById('dashViewAllBtn')?.addEventListener('click', () => switchView('riwayat'));
}

function renderProductGrid() {
  const grid        = document.getElementById('productGrid');
  const emptyHint   = document.getElementById('productEmptyHint');
  const searchEmpty = document.getElementById('productSearchEmpty');
  grid.innerHTML = '';

  if (state.products.length === 0) {
    emptyHint.hidden   = false;
    if (searchEmpty) searchEmpty.hidden = true;
    return;
  }
  emptyHint.hidden = true;

  const filtered = state.searchQuery
    ? state.products.filter(p => p.name.toLowerCase().includes(state.searchQuery))
    : state.products;

  if (searchEmpty) searchEmpty.hidden = (filtered.length > 0) || !state.searchQuery;

  filtered.forEach(p => {
    const tile = document.createElement('button');
    tile.className = 'product-tile';
    tile.innerHTML  = `<span class="name">${escapeHtml(p.name)}</span><span class="price">${formatMoney(p.price)}</span>`;
    tile.addEventListener('click', () => addToCart(p));
    grid.appendChild(tile);
  });
}

function addToCart(product) {
  const existing = state.cart.find(c => c.productId === product.id);
  if (existing) existing.qty += 1;
  else state.cart.push({ productId: product.id, name: product.name, price: product.price, qty: 1 });
  updateCartBar();
  showToast(`${product.name} ditambahkan ✓`);
}

function cartTotal() {
  return state.cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}
function cartCount() {
  return state.cart.reduce((sum, c) => sum + c.qty, 0);
}

function updateCartBar() {
  const bar         = document.getElementById('cartBar');
  const count       = cartCount();
  document.getElementById('cartCount').textContent = `${count} item`;
  document.getElementById('cartTotal').textContent = formatMoney(cartTotal());
  const kasirActive = document.getElementById('view-kasir').classList.contains('active');
  bar.hidden = count === 0 || !kasirActive;
}

function openCartModal() {
  if (state.cart.length === 0) { showToast('Keranjang masih kosong'); return; }

  const lines = state.cart.map(c => `
    <div class="cart-line" data-id="${c.productId}">
      <div>
        <div class="cl-name">${escapeHtml(c.name)}</div>
        <div class="cl-price">${formatMoney(c.price)} / item</div>
      </div>
      <div class="qty-ctrl">
        <button data-act="dec">−</button>
        <span>${c.qty}</span>
        <button data-act="inc">+</button>
      </div>
    </div>`).join('');

  renderModal(`
    <button class="modal-close" id="closeModal">&times;</button>
    <h3>Keranjang 🛒</h3>
    <div id="cartLines">${lines}</div>
    <div class="total-row grand">
      <span>Total</span>
      <span class="val">${formatMoney(cartTotal())}</span>
    </div>
    <button class="btn btn-primary" style="width:100%; margin-top:14px" id="proceedCheckout">Lanjut Bayar →</button>
  `);

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cartLines').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id   = btn.closest('.cart-line').dataset.id;
    const item = state.cart.find(c => c.productId === id);
    if (btn.dataset.act === 'inc') item.qty += 1;
    else item.qty -= 1;
    state.cart = state.cart.filter(c => c.qty > 0);
    updateCartBar();
    if (state.cart.length === 0) { closeModal(); return; }
    openCartModal();
  });
  document.getElementById('proceedCheckout').addEventListener('click', openCheckoutModal);
}

function openCheckoutModal() {
  const total    = cartTotal();
  const nominals = generateNominals(total);
  const nomBtns  = nominals.map(n => `
    <button class="nominal-btn${n === total ? ' exact' : ''}" data-val="${n}">
      ${n === total ? 'Uang Pas' : formatMoney(n)}
    </button>`).join('');

  renderModal(`
    <button class="modal-close" id="closeModal">&times;</button>
    <h3>Pembayaran 💳</h3>
    <div class="total-row grand" style="margin-top:0; margin-bottom:12px">
      <span>Total</span>
      <span class="val">${formatMoney(total)}</span>
    </div>
    <label>Uang tunai diterima
      <input type="number" id="cashInput" inputmode="numeric" placeholder="0">
    </label>
    <div class="nominal-grid" id="nominalGrid">${nomBtns}</div>
    <div class="total-row">
      <span>Kembalian</span>
      <span id="changeVal" class="val" style="color:var(--gold)">Rp0</span>
    </div>
    <button class="btn btn-primary" style="width:100%; margin-top:14px" id="confirmPayBtn">✓ Selesaikan &amp; Simpan PDF Struk</button>
    <button class="btn" style="width:100%; margin-top:8px" id="confirmNoPrintBtn">Selesaikan Tanpa Struk</button>
  `);

  const cashInput = document.getElementById('cashInput');
  const changeVal = document.getElementById('changeVal');

  cashInput.addEventListener('input', () => {
    const cash = Number(cashInput.value) || 0;
    changeVal.textContent = formatMoney(Math.max(0, cash - total));
  });

  document.getElementById('nominalGrid').addEventListener('click', e => {
    const btn = e.target.closest('.nominal-btn');
    if (!btn) return;
    cashInput.value = btn.dataset.val;
    changeVal.textContent = formatMoney(Math.max(0, Number(btn.dataset.val) - total));
  });

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('confirmPayBtn').addEventListener('click', () =>
    finalizeSale(true, Number(cashInput.value) || total)
  );
  document.getElementById('confirmNoPrintBtn').addEventListener('click', () =>
    finalizeSale(false, Number(cashInput.value) || total)
  );
}

/**
 * Menghasilkan nominal uang yang cerdas berdasarkan total tagihan.
 * Selalu sertakan "uang pas" (total itu sendiri) + nilai bulat ke atas.
 */
function generateNominals(total) {
  const round = (n, to) => Math.ceil(n / to) * to;
  const set   = new Set([total]); // "Uang Pas" always first

  const bases = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  for (const b of bases) {
    const r = round(total, b);
    if (r >= total) set.add(r);
    if (set.size >= 6) break;
  }

  return [...set].sort((a, b) => a - b).slice(0, 6);
}

async function finalizeSale(shouldPrint, cash) {
  const total = cartTotal();
  const trx   = {
    id:     uid(),
    date:   Date.now(),
    items:  state.cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
    total,
    cash,
    change: Math.max(0, cash - total),
  };
  state.transactions.unshift(trx);
  save(STORAGE_KEYS.transactions, state.transactions);

  if (shouldPrint) {
    try {
      await ReceiptPrinter.printReceipt({
        storeName: state.settings.storeName,
        address:   state.settings.storeAddress,
        footer:    state.settings.footerText,
        items:     trx.items,
        total:     trx.total,
        cash:      trx.cash,
        change:    trx.change,
        date:      trx.date,
      });
      showToast('Transaksi tersimpan & struk PDF dibuka 📄');
    } catch (e) {
      console.error(e);
      showToast('Tersimpan, gagal buka PDF: ' + e.message);
    }
  } else {
    showToast('Transaksi tersimpan ✓');
  }

  state.cart = [];
  updateCartBar();
  renderHistory();
  closeModal();
}

// ============================================================
// PRODUK (manage)
// ============================================================
function bindProduk() {
  document.getElementById('addProductBtn').addEventListener('click', () => openProductForm(null));
}

function renderProductList() {
  const list = document.getElementById('productList');
  list.innerHTML = '';
  if (state.products.length === 0) {
    list.innerHTML = '<p class="muted small" style="text-align:center;padding:24px 0">Belum ada produk.</p>';
    return;
  }
  state.products.forEach(p => {
    const row = document.createElement('div');
    row.className = 'product-row';
    row.innerHTML = `
      <div class="info">
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="price">${formatMoney(p.price)}</span>
      </div>
      <div class="actions">
        <button class="icon-btn" data-act="edit" title="Ubah">✏️</button>
        <button class="icon-btn" data-act="del"  title="Hapus">🗑️</button>
      </div>`;
    row.querySelector('[data-act="edit"]').addEventListener('click', () => openProductForm(p));
    row.querySelector('[data-act="del"]').addEventListener('click',  () => confirmDeleteProduct(p));
    list.appendChild(row);
  });
}

function openProductForm(product) {
  const isEdit = !!product;
  renderModal(`
    <button class="modal-close" id="closeModal">&times;</button>
    <h3>${isEdit ? '✏️ Ubah Produk' : '➕ Produk Baru'}</h3>
    <label>Nama produk
      <input type="text" id="pfName" value="${isEdit ? escapeAttr(product.name) : ''}" placeholder="mis. Madu Murni 500gr">
    </label>
    <label>Harga (Rp)
      <input type="number" id="pfPrice" value="${isEdit ? product.price : ''}" placeholder="0" inputmode="numeric">
    </label>
    <button class="btn btn-primary" style="width:100%; margin-top:8px" id="pfSave">💾 Simpan Produk</button>
  `);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('pfName').focus();
  document.getElementById('pfSave').addEventListener('click', () => {
    const name  = document.getElementById('pfName').value.trim();
    const price = Number(document.getElementById('pfPrice').value);
    if (!name || !price || price <= 0) { showToast('Isi nama dan harga dengan benar'); return; }
    if (isEdit) {
      product.name  = name;
      product.price = price;
    } else {
      state.products.push({ id: uid(), name, price });
    }
    save(STORAGE_KEYS.products, state.products);
    renderProductGrid();
    renderProductList();
    closeModal();
    showToast('Produk disimpan ✓');
  });
}

function confirmDeleteProduct(product) {
  renderModal(`
    <button class="modal-close" id="closeModal">&times;</button>
    <h3>⚠️ Hapus Produk?</h3>
    <p class="muted" style="margin-bottom:18px;line-height:1.6">
      Yakin ingin menghapus <b style="color:var(--text)">${escapeHtml(product.name)}</b>?<br>
      Tindakan ini tidak bisa dibatalkan.
    </p>
    <div style="display:flex; gap:8px">
      <button class="btn" style="flex:1" id="cancelDelete">Batal</button>
      <button class="btn btn-danger-outline" style="flex:1" id="confirmDelete">Hapus</button>
    </div>
  `);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelDelete').addEventListener('click', closeModal);
  document.getElementById('confirmDelete').addEventListener('click', () => {
    deleteProduct(product.id);
    closeModal();
    showToast('Produk dihapus');
  });
}

function deleteProduct(id) {
  state.products = state.products.filter(p => p.id !== id);
  save(STORAGE_KEYS.products, state.products);
  renderProductGrid();
  renderProductList();
}

// ============================================================
// RIWAYAT
// ============================================================
function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  if (state.transactions.length === 0) {
    list.innerHTML = '<p class="muted small" style="text-align:center;padding:24px 0">Belum ada transaksi.</p>';
    return;
  }
  state.transactions.forEach(t => {
    const row       = document.createElement('div');
    row.className   = 'history-row';
    const d         = new Date(t.date);
    const itemCount = t.items.reduce((s, i) => s + i.qty, 0);
    const preview   = t.items.slice(0, 2).map(i => i.name).join(', ') + (t.items.length > 2 ? '…' : '');
    row.innerHTML = `
      <div class="h-info">
        <span class="h-date">${d.toLocaleString('id-ID')}</span>
        <span class="h-items">${itemCount} item · ${preview}</span>
      </div>
      <span class="h-total">${formatMoney(t.total)}</span>`;
    row.addEventListener('click', () => openHistoryDetail(t));
    list.appendChild(row);
  });
}

function openHistoryDetail(trx) {
  const width = state.settings.paperWidth || 32;
  const lines = trx.items
    .map(it => `${it.qty}× ${escapeHtml(it.name)} — ${formatMoney(it.qty * it.price)}`)
    .join('<br>');
  renderModal(`
    <button class="modal-close" id="closeModal">&times;</button>
    <h3>Detail Transaksi</h3>
    <p class="muted small">${new Date(trx.date).toLocaleString('id-ID')}</p>
    <div class="receipt-preview">
${lines}
────────────────
<b>TOTAL  ${formatMoney(trx.total)}</b>
Tunai   ${formatMoney(trx.cash)}
Kembali ${formatMoney(trx.change)}
    </div>
    <button class="btn btn-primary" style="width:100%; margin-top:4px" id="reprintBtn">📄 Cetak PDF Struk</button>
  `);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('reprintBtn').addEventListener('click', async () => {
    try {
      await ReceiptPrinter.printReceipt({
        storeName: state.settings.storeName,
        address:   state.settings.storeAddress,
        footer:    state.settings.footerText,
        items:  trx.items,
        total:  trx.total,
        cash:   trx.cash,
        change: trx.change,
        date:   trx.date,
      });
      showToast('PDF struk dibuka 📄');
    } catch (e) {
      showToast('Gagal buka PDF: ' + e.message);
    }
  });
}

// ============================================================
// PENGATURAN
// ============================================================
function fillSettingsForm() {
  document.getElementById('setStoreName').value    = state.settings.storeName;
  document.getElementById('setStoreAddress').value = state.settings.storeAddress;
  document.getElementById('setFooterText').value   = state.settings.footerText;
  document.getElementById('setPaperWidth').value   = state.settings.paperWidth;
}

function bindPengaturan() {
  document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    state.settings.storeName    = document.getElementById('setStoreName').value.trim()  || DEFAULT_SETTINGS.storeName;
    state.settings.storeAddress = document.getElementById('setStoreAddress').value.trim();
    state.settings.footerText   = document.getElementById('setFooterText').value.trim() || DEFAULT_SETTINGS.footerText;
    state.settings.paperWidth   = Number(document.getElementById('setPaperWidth').value);
    save(STORAGE_KEYS.settings, state.settings);
    renderStoreName();
    showToast('Pengaturan disimpan ✓');
  });

  document.getElementById('testPrintBtn').addEventListener('click', async () => {
    try {
      await ReceiptPrinter.printTest();
      showToast('PDF tes struk dibuka 📄');
    } catch (e) {
      showToast(e.message || 'Gagal buka PDF');
    }
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const data = {
      products:     state.products,
      transactions: state.transactions,
      settings:     state.settings,
      exportedAt:   new Date().toISOString(),
      appVersion:   '2.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `kasir-ag-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.products)     state.products     = data.products;
        if (data.transactions) state.transactions = data.transactions;
        if (data.settings)     state.settings     = { ...DEFAULT_SETTINGS, ...data.settings };
        save(STORAGE_KEYS.products,     state.products);
        save(STORAGE_KEYS.transactions, state.transactions);
        save(STORAGE_KEYS.settings,     state.settings);
        renderStoreName();
        fillSettingsForm();
        renderProductGrid();
        renderProductList();
        renderHistory();
        showToast('Data berhasil diimpor ✓');
      } catch (err) {
        showToast('File tidak valid');
      }
    };
    reader.readAsText(file);
    e.target.value = '';  // reset so same file can be re-imported
  });
}

// ============================================================
// PRINTER STATUS UI  (PDF mode — selalu siap)
// ============================================================
function bindPrinterStatus() {
  // Tampilkan status PDF siap di topbar
  const dot   = document.getElementById('btDot');
  const label = document.getElementById('btLabel');
  if (dot)   { dot.classList.add('on'); }
  if (label) { label.textContent = 'PDF'; }

  document.getElementById('btStatusBtn').addEventListener('click', () => switchView('pengaturan'));
}

// ============================================================
// MODAL HELPERS
// ============================================================
function renderModal(html) {
  document.getElementById('modalRoot').innerHTML = html;
  document.getElementById('modalOverlay').hidden = false;
}
function closeModal() {
  document.getElementById('modalOverlay').hidden = true;
  document.getElementById('modalRoot').innerHTML = '';
}
document.getElementById('modalOverlay')?.addEventListener('click', e => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// ============================================================
// UTIL
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}
function escapeAttr(str) { return escapeHtml(str); }

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', init);
