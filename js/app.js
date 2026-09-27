/**
 * ============================================================
 * ImahKu — Frontend JavaScript (SPA, tanpa perubahan URL)
 * ============================================================
 */

// ── State Global ──
let APP_CONFIG = {};
let ALL_PRODUCTS = [];
let CART = []; // {id, nama, satuan, harga, hargaAsli, stok, fotoUrl, qty}
let ADMIN_TOKEN = null;
let ADMIN_INFO = null;
let CURRENT_ORDER_RESULT = null;
let PENDING_BUKTI = { base64: null, mime: null, nama: null };
let PENDING_LOGO = null;
let PENDING_BANNER = null;
let chartInstances = {};

const CATEGORY_ICONS = {
  'Bahan Pokok & Perkebunan': '🌾', 'Peternakan & Telur': '🥚', 'Hasil Perikanan': '🐟', 'Aksesoris': '🧺'
};
const PRODUCT_EMOJI = {
  'Bahan Pokok & Perkebunan': '🌾', 'Peternakan & Telur': '🥚', 'Hasil Perikanan': '🐟', 'Aksesoris': '🧺'
};

// ════════════════════════════════════════════════════════
// BAGIAN 1: INISIALISASI & TEMA
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  const savedTheme = localStorage.getItem('imahku_theme') || 'light';
  applyTheme(savedTheme);
  const savedCart = localStorage.getItem('imahku_cart');
  if (savedCart) { try { CART = JSON.parse(savedCart); } catch (e) { CART = []; } }
  updateCartBadge();

  google.script.run
    .withSuccessHandler(res => {
      if (res.success) {
        APP_CONFIG = res.data;
        applyBranding();
      }
      loadCatalog();
    })
    .withFailureHandler(err => { showToast('Error', 'Gagal memuat konfigurasi: ' + err.message, 'danger'); loadCatalog(); })
    .getAllConfig();

  // Jika ada sesi admin tersimpan (tab sebelumnya belum ditutup), coba validasi & masuk otomatis
  if (ADMIN_TOKEN) {
    google.script.run
      .withSuccessHandler(session => { if (session.valid) enterAdminApp(); else { ADMIN_TOKEN = null; sessionStorage.removeItem('imahku_admin_token'); } })
      .withFailureHandler(() => { ADMIN_TOKEN = null; })
      .validateSession(ADMIN_TOKEN);
  }
}

function applyBranding() {
  document.getElementById('waTopText').textContent = 'WA: ' + (APP_CONFIG.waNumber || 'Hubungi Kami');
  document.getElementById('footerDesc').textContent = APP_CONFIG.tagline ? `ImahKu — ${APP_CONFIG.tagline}. Digital marketplace terintegrasi untuk kebutuhan dapur, sembako harian, serta hasil peternakan dan perikanan segar.` : document.getElementById('footerDesc').textContent;
  document.getElementById('footerAlamat').textContent = '📍 ' + (APP_CONFIG.alamatToko || '-');
  document.getElementById('footerWA').textContent = '📞 ' + (APP_CONFIG.waNumber || '-');

  const logoEl = document.getElementById('headerLogoMark');
  if (logoEl) {
    logoEl.innerHTML = APP_CONFIG.logoUrl
      ? `<img src="${APP_CONFIG.logoUrl}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.parentElement.textContent='🏡'">`
      : '🏡';
  }
  const heroEl = document.getElementById('heroBannerBox');
  if (heroEl) {
    heroEl.innerHTML = APP_CONFIG.bannerUrl
      ? `<img src="${APP_CONFIG.bannerUrl}" alt="Banner" style="width:100%;height:100%;object-fit:cover;border-radius:1rem" onerror="this.parentElement.textContent='🥬🥚🐟'">`
      : '🥬🥚🐟';
  }
}

function hideLoadingOverlay() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none';
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('imahku_theme', theme);
  document.getElementById('themeIconMoon').classList.toggle('hidden', theme === 'dark');
  document.getElementById('themeIconSun').classList.toggle('hidden', theme !== 'dark');
  Object.values(chartInstances).forEach(c => { try { updateChartTheme(c); } catch (e) {} });
}

// ════════════════════════════════════════════════════════
// BAGIAN 2: NAVIGASI SPA (PUBLIK) — tidak pernah mengubah URL
// ════════════════════════════════════════════════════════
function navigateTo(sectionName) {
  document.querySelectorAll('#publicMain .content-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section-' + sectionName);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeCartPanel();

  if (sectionName === 'checkout') renderCheckoutSummary();
}

function scrollToProducts() {
  document.getElementById('productsAnchor').scrollIntoView({ behavior: 'smooth' });
}

function openWhatsApp() {
  const num = (APP_CONFIG.waNumber || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
  if (num) window.open('https://wa.me/' + num, '_blank');
}

// ════════════════════════════════════════════════════════
// BAGIAN 3: KATALOG PUBLIK (US-1)
// ════════════════════════════════════════════════════════
function loadCatalog() {
  renderSkeletons();
  google.script.run
    .withSuccessHandler(res => {
      hideLoadingOverlay();
      if (!res.success) { showToast('Error', res.message, 'danger'); return; }
      ALL_PRODUCTS = res.data.produk;
      renderCategorySelect(res.data.kategori);
      renderCategoryTiles(res.data.kategori);
      renderCategoryNav(res.data.kategori);
      renderProductGrid(ALL_PRODUCTS);
    })
    .withFailureHandler(err => { hideLoadingOverlay(); showToast('Error', err.message, 'danger'); })
    .getPublicCatalog('', 'Semua Kategori');
}

function renderSkeletons() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = Array(8).fill('<div class="ik-skeleton"></div>').join('');
}

function renderCategorySelect(categories) {
  const sel = document.getElementById('categorySelect');
  sel.innerHTML = '<option value="Semua Kategori">Semua Kategori</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderCategoryTiles(categories) {
  const wrap = document.getElementById('categoryTiles');
  wrap.innerHTML = categories.map(c => {
    const count = ALL_PRODUCTS.filter(p => p.kategori === c).length;
    return `<div class="ik-category-tile" onclick="filterByCategory('${escapeAttr(c)}')">
      <div class="icon">${CATEGORY_ICONS[c] || '🛒'}</div>
      <b>${c}</b><p>${count} Produk →</p>
    </div>`;
  }).join('');
}

function renderCategoryNav(categories) {
  const nav = document.getElementById('categoryNav');
  nav.innerHTML = '<a href="javascript:void(0)" onclick="navigateTo(\'beranda\')" class="ik-catnav-link active">🏠 Beranda</a>' +
    categories.map(c => `<a href="javascript:void(0)" class="ik-catnav-link" onclick="filterByCategory('${escapeAttr(c)}')">${CATEGORY_ICONS[c] || ''} ${c}</a>`).join('');
}

function filterByCategory(cat) {
  navigateTo('beranda');
  document.getElementById('categorySelect').value = cat;
  onCategoryChange();
  setTimeout(scrollToProducts, 80);
}

let searchDebounce;
function onSearchInput() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(applyClientFilter, 200);
}
function onCategoryChange() { applyClientFilter(); }

function applyClientFilter() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('categorySelect').value;
  let filtered = ALL_PRODUCTS;
  if (cat !== 'Semua Kategori') filtered = filtered.filter(p => p.kategori === cat);
  if (q) filtered = filtered.filter(p => p.nama.toLowerCase().includes(q) || (p.deskripsi || '').toLowerCase().includes(q));
  renderProductGrid(filtered);
}

function renderProductGrid(products) {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  document.getElementById('productCount').textContent = products.length + ' produk';

  if (products.length === 0) {
    grid.innerHTML = ''; empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = products.map(p => `
    <div class="ik-product-card" onclick="openProductDetail('${p.id}')">
      <div class="ik-product-img">
        ${p.fotoUrl ? `<img src="${p.fotoUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : (PRODUCT_EMOJI[p.kategori] || '🛒')}
        ${p.diskonPersen > 0 ? `<span class="ik-badge-discount">-${p.diskonPersen}%</span>` : ''}
        ${p.badge ? `<span class="ik-badge-tag">${p.badge}</span>` : ''}
      </div>
      <div class="ik-product-body">
        <span class="ik-product-cat">${p.kategori} • ${p.satuan}</span>
        <span class="ik-product-name">${p.nama}</span>
        <div class="ik-price-row">
          <span class="ik-price-now">Rp ${fmtRp(p.harga)}</span>
          ${p.hargaAsli > p.harga ? `<span class="ik-price-old">Rp ${fmtRp(p.hargaAsli)}</span>` : ''}
        </div>
        <span class="ik-stok-label">Stok: ${p.stok}</span>
        <button class="ik-add-btn" ${p.stok <= 0 ? 'disabled' : ''} onclick="event.stopPropagation(); addToCart('${p.id}', 1)">
          ${p.stok <= 0 ? 'Stok Habis' : '🛒 + Tambah'}
        </button>
      </div>
    </div>
  `).join('');
}

function openProductDetail(id) {
  const p = ALL_PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const detail = document.getElementById('detailContent');
  detail.innerHTML = `
    <button class="ik-btn-outline text-sm mb-4" onclick="navigateTo('beranda')">← Kembali ke Katalog</button>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="ik-product-img" style="border-radius:1rem;font-size:5rem;aspect-ratio:1/1">
        ${p.fotoUrl ? `<img src="${p.fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:1rem" onerror="this.style.display='none'">` : (PRODUCT_EMOJI[p.kategori] || '🛒')}
      </div>
      <div>
        <span class="ik-product-cat">${p.kategori} • ${p.satuan}</span>
        <h1 class="text-2xl font-extrabold mt-1 mb-2">${p.nama}</h1>
        ${p.badge ? `<span class="ik-pill-badge mb-2 inline-block">${p.badge}</span>` : ''}
        <div class="ik-price-row mb-3"><span class="ik-price-now text-2xl">Rp ${fmtRp(p.harga)}</span>${p.hargaAsli > p.harga ? `<span class="ik-price-old">Rp ${fmtRp(p.hargaAsli)}</span>` : ''}</div>
        <p style="color:var(--text-muted)" class="mb-4">${p.deskripsi || ''}</p>
        <p class="text-sm mb-4">📦 Stok tersedia: <b>${p.stok} ${p.satuan}</b></p>
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center border rounded-lg" style="border-color:var(--border-subtle)">
            <button class="px-3 py-2" onclick="stepDetailQty(-1)">−</button>
            <span id="detailQty" class="px-3 font-bold">1</span>
            <button class="px-3 py-2" onclick="stepDetailQty(1)">+</button>
          </div>
          <button class="ik-btn-primary flex-1 justify-center" ${p.stok <= 0 ? 'disabled' : ''} onclick="addDetailToCart('${p.id}')">🛒 Tambah ke Keranjang</button>
        </div>
      </div>
    </div>`;
  detail.dataset.maxStok = p.stok;
  navigateTo('detail');
}
function stepDetailQty(delta) {
  const el = document.getElementById('detailQty');
  const max = Number(document.getElementById('detailContent').dataset.maxStok) || 99;
  let v = Number(el.textContent) + delta;
  v = Math.max(1, Math.min(v, max));
  el.textContent = v;
}
function addDetailToCart(id) {
  const qty = Number(document.getElementById('detailQty').textContent);
  addToCart(id, qty);
}

// ════════════════════════════════════════════════════════
// BAGIAN 4: KERANJANG BELANJA (in-memory + localStorage)
// ════════════════════════════════════════════════════════
function addToCart(productId, qty) {
  const p = ALL_PRODUCTS.find(x => x.id === productId);
  if (!p) return;
  const existing = CART.find(c => c.id === productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, p.stok);
  } else {
    CART.push({ id: p.id, nama: p.nama, satuan: p.satuan, harga: p.harga, hargaAsli: p.hargaAsli, stok: p.stok, fotoUrl: p.fotoUrl, qty: Math.min(qty, p.stok) });
  }
  persistCart();
  showToast('Ditambahkan', `${p.nama} masuk ke keranjang.`, 'success');
  openCartPanel();
}
function updateCartQty(productId, delta) {
  const item = CART.find(c => c.id === productId);
  if (!item) return;
  item.qty = Math.max(1, Math.min(item.qty + delta, item.stok));
  persistCart();
}
function removeFromCart(productId) {
  CART = CART.filter(c => c.id !== productId);
  persistCart();
}
function persistCart() {
  localStorage.setItem('imahku_cart', JSON.stringify(CART));
  updateCartBadge();
  renderCartPanel();
}
function updateCartBadge() {
  const totalQty = CART.reduce((s, c) => s + c.qty, 0);
  const badge = document.getElementById('cartBadge');
  badge.textContent = totalQty;
  badge.classList.toggle('hidden', totalQty === 0);
}
function cartSubtotal() { return CART.reduce((s, c) => s + c.harga * c.qty, 0); }

function openCartPanel() {
  renderCartPanel();
  document.getElementById('cartOverlay').classList.remove('hidden');
  document.getElementById('cartPanel').classList.add('open');
}
function closeCartPanel() {
  document.getElementById('cartOverlay').classList.add('hidden');
  document.getElementById('cartPanel').classList.remove('open');
}
function renderCartPanel() {
  const wrap = document.getElementById('cartPanelItems');
  if (CART.length === 0) {
    wrap.innerHTML = `<p class="text-center text-sm py-8" style="color:var(--text-muted)">Keranjang masih kosong.</p>`;
  } else {
    wrap.innerHTML = CART.map(c => `
      <div class="ik-cart-line">
        <div class="ik-product-img" style="width:52px;height:52px;border-radius:8px;font-size:1.3rem;flex-shrink:0">
          ${c.fotoUrl ? `<img src="${c.fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" onerror="this.style.display='none'">` : (PRODUCT_EMOJI[''] || '🛒')}
        </div>
        <div class="flex-1">
          <div class="text-sm font-semibold">${c.nama}</div>
          <div class="text-xs" style="color:var(--text-muted)">${c.satuan} • Rp ${fmtRp(c.harga)}</div>
          <div class="qty-box">
            <button onclick="updateCartQty('${c.id}',-1)">−</button>
            <span class="text-sm font-semibold">${c.qty}</span>
            <button onclick="updateCartQty('${c.id}',1)">+</button>
            <button class="ml-2 text-xs" style="color:var(--status-rejected)" onclick="removeFromCart('${c.id}')">Hapus</button>
          </div>
        </div>
        <div class="text-sm font-bold">Rp ${fmtRp(c.harga * c.qty)}</div>
      </div>`).join('');
  }
  document.getElementById('cartPanelTotal').textContent = 'Rp ' + fmtRp(cartSubtotal());
}
function goToCheckout() {
  if (CART.length === 0) { showToast('Peringatan', 'Keranjang masih kosong.', 'warning'); return; }
  closeCartPanel();
  navigateTo('checkout');
}

// ════════════════════════════════════════════════════════
// BAGIAN 5: CHECKOUT & PEMBAYARAN (US-2)
// ════════════════════════════════════════════════════════
function renderCheckoutSummary() {
  document.getElementById('cartItemCount').textContent = `(${CART.length} Item)`;
  document.getElementById('cartSummaryItems').innerHTML = CART.map(c => `
    <div class="flex justify-between text-sm">
      <span>${c.nama} <span style="color:var(--text-muted)">x${c.qty}</span></span>
      <span class="font-semibold">Rp ${fmtRp(c.harga * c.qty)}</span>
    </div>`).join('') || `<p class="text-sm text-center" style="color:var(--text-muted)">Keranjang kosong.</p>`;

  const subtotal = cartSubtotal();
  const ongkirMin = Number(APP_CONFIG.ongkirGratisMin) || 50000;
  const ongkir = subtotal >= ongkirMin ? 0 : 5000;
  document.getElementById('sumSubtotal').textContent = 'Rp ' + fmtRp(subtotal);
  document.getElementById('sumOngkir').textContent = ongkir === 0 ? 'Gratis' : 'Rp ' + fmtRp(ongkir);
  document.getElementById('sumKodeUnik').textContent = '+Rp — (dibuat saat submit)';
  document.getElementById('sumTotal').textContent = 'Rp ' + fmtRp(subtotal + ongkir) + ' + kode unik';

  renderPaymentMethods();
}

function renderPaymentMethods() {
  const box = document.getElementById('paymentMethodBox');
  const methods = [
    { key: 'BCA', label: 'Transfer BCA', rek: APP_CONFIG.rekBCA },
    { key: 'Mandiri', label: 'Transfer Mandiri', rek: APP_CONFIG.rekMandiri },
    { key: 'BRI', label: 'Transfer BRI', rek: APP_CONFIG.rekBRI }
  ].filter(m => m.rek && m.rek !== '-');
  if (methods.length === 0) methods.push({ key: 'BCA', label: 'Transfer BCA', rek: 'Nomor rekening menyusul' });

  box.innerHTML = methods.map((m, i) => `
    <label class="ik-radio-card">
      <input type="radio" name="metodeBayar" value="${m.key}" ${i === 0 ? 'checked' : ''}>
      <div><b>🏦 ${m.label}</b><p>${m.rek}</p></div>
    </label>`).join('');
}

function onBuktiFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Peringatan', 'Ukuran file maksimal 5MB.', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    PENDING_BUKTI = { base64: reader.result.split(',')[1], mime: file.type, nama: file.name };
    document.getElementById('dropzoneEmpty').classList.add('hidden');
    document.getElementById('dropzonePreview').classList.remove('hidden');
    document.getElementById('dropzoneFileName').textContent = file.name;
    if (file.type.startsWith('image/')) document.getElementById('dropzoneImg').src = reader.result;
  };
  reader.readAsDataURL(file);
}

function handleSubmitOrder() {
  const nama = document.getElementById('cf_nama').value.trim();
  const wa = document.getElementById('cf_wa').value.trim();
  const email = document.getElementById('cf_email').value.trim();
  const alamat = document.getElementById('cf_alamat').value.trim();

  if (!nama || !wa || !email || !alamat) { showToast('Peringatan', 'Lengkapi data identitas pembeli.', 'warning'); return; }
  if (CART.length === 0) { showToast('Peringatan', 'Keranjang belanja kosong.', 'warning'); return; }
  if (!PENDING_BUKTI.base64) { showToast('Peringatan', 'Unggah bukti transfer terlebih dahulu.', 'warning'); return; }

  const kurirEl = document.querySelector('input[name="kurir"]:checked');
  const metodeEl = document.querySelector('input[name="metodeBayar"]:checked');

  const payload = {
    nama, whatsapp: wa, email, alamat,
    catatan: document.getElementById('cf_catatan').value.trim(),
    kurir: kurirEl ? kurirEl.value : '',
    metodeBayar: metodeEl ? metodeEl.value : '',
    items: CART.map(c => ({ id: c.id, qty: c.qty })),
    buktiBayarBase64: PENDING_BUKTI.base64, buktiBayarMime: PENDING_BUKTI.mime, buktiBayarNama: PENDING_BUKTI.nama
  };

  const btn = document.getElementById('submitOrderBtn');
  btn.disabled = true; btn.textContent = '⏳ Mengirim pesanan...';

  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.textContent = '✅ Kirim Pemesanan & Unggah Bukti Bayar';
      if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
      CURRENT_ORDER_RESULT = res.data;
      CART = []; persistCart(); PENDING_BUKTI = { base64: null, mime: null, nama: null };
      document.getElementById('checkoutForm').reset();
      document.getElementById('successOrderId').textContent = res.data.orderId;
      navigateTo('sukses');
      showToast('Berhasil', res.message, 'success');
    })
    .withFailureHandler(err => {
      btn.disabled = false; btn.textContent = '✅ Kirim Pemesanan & Unggah Bukti Bayar';
      showToast('Error', err.message, 'danger');
    })
    .submitOrder(payload);
}

// ════════════════════════════════════════════════════════
// BAGIAN 6: LACAK PESANAN (US-3 pendukung)
// ════════════════════════════════════════════════════════
function handleTrackOrder() {
  const orderId = document.getElementById('trackOrderId').value.trim();
  const contact = document.getElementById('trackContact').value.trim();
  if (!orderId || !contact) { showToast('Peringatan', 'Isi ID pesanan dan kontak Anda.', 'warning'); return; }

  document.getElementById('trackResult').innerHTML = `<p class="text-center text-sm" style="color:var(--text-muted)">Mencari...</p>`;
  google.script.run
    .withSuccessHandler(res => {
      const wrap = document.getElementById('trackResult');
      if (!res.success) { wrap.innerHTML = `<p class="text-center text-sm" style="color:var(--status-rejected)">${res.message}</p>`; return; }
      const o = res.data;
      wrap.innerHTML = `
        <div class="ik-card p-4">
          <div class="flex justify-between items-center mb-2">
            <b>${o.ID}</b><span class="ik-status-badge status-${o.Status}">${o.Status}</span>
          </div>
          <p class="text-sm" style="color:var(--text-muted)">${new Date(o.Tanggal).toLocaleString('id-ID')}</p>
          <div class="mt-3 space-y-1 text-sm">
            ${o.ItemsJSON.map(i => `<div class="flex justify-between"><span>${i.nama} x${i.qty}</span><span>Rp ${fmtRp(i.subtotal)}</span></div>`).join('')}
          </div>
          <div class="flex justify-between font-bold mt-3 pt-2" style="border-top:1px dashed var(--border-subtle)"><span>Total</span><span>Rp ${fmtRp(o.TotalBayar)}</span></div>
        </div>`;
    })
    .withFailureHandler(err => { document.getElementById('trackResult').innerHTML = `<p class="text-center text-sm" style="color:var(--status-rejected)">${err.message}</p>`; })
    .trackOrder(orderId, contact);
}

// ════════════════════════════════════════════════════════
// BAGIAN 7: AUTENTIKASI ADMIN
// ════════════════════════════════════════════════════════
function showAdminLogin() {
  document.getElementById('adminLoginOverlay').classList.remove('hidden');
  document.getElementById('adminLoginModal').classList.remove('hidden');
}
function hideAdminLogin() {
  document.getElementById('adminLoginOverlay').classList.add('hidden');
  document.getElementById('adminLoginModal').classList.add('hidden');
  document.getElementById('adminLoginError').classList.add('hidden');
}
function handleAdminLogin() {
  const username = document.getElementById('admin_username').value.trim();
  const password = document.getElementById('admin_password').value;
  const btn = document.getElementById('adminLoginBtn');
  btn.disabled = true; btn.textContent = 'Memeriksa...';

  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.textContent = 'Masuk';
      if (!res.success) {
        const err = document.getElementById('adminLoginError');
        err.textContent = res.message; err.classList.remove('hidden');
        return;
      }
      ADMIN_TOKEN = res.data.token;
      ADMIN_INFO = { nama: res.data.nama, role: res.data.role };
      sessionStorage.setItem('imahku_admin_token', ADMIN_TOKEN);
      sessionStorage.setItem('imahku_admin_info', JSON.stringify(ADMIN_INFO));
      hideAdminLogin();
      enterAdminApp();
    })
    .withFailureHandler(err => { btn.disabled = false; btn.textContent = 'Masuk'; showToast('Error', err.message, 'danger'); })
    .doLoginAdmin(username, password);
}
function handleAdminLogout() {
  google.script.run.doLogoutAdmin(ADMIN_TOKEN);
  ADMIN_TOKEN = null; ADMIN_INFO = null;
  sessionStorage.removeItem('imahku_admin_token'); sessionStorage.removeItem('imahku_admin_info');
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('publicHeader').classList.remove('hidden');
  document.getElementById('publicFooter').classList.remove('hidden');
  navigateTo('beranda');
}
function exitAdminToStore() {
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('publicHeader').classList.remove('hidden');
  document.getElementById('publicFooter').classList.remove('hidden');
  loadCatalog(); // pastikan produk terbaru (termasuk yang baru ditambah/diubah) langsung tampil
  navigateTo('beranda');
}
function enterAdminApp() {
  document.getElementById('publicHeader').classList.add('hidden');
  document.getElementById('publicFooter').classList.add('hidden');
  document.querySelectorAll('#publicMain .content-section').forEach(s => s.classList.remove('active'));
  document.getElementById('adminApp').classList.remove('hidden');
  document.getElementById('adminUserBadge').textContent = `👤 ${ADMIN_INFO.nama} (${ADMIN_INFO.role})`;
  navigateAdmin('dashboard');
}

// ════════════════════════════════════════════════════════
// BAGIAN 8: NAVIGASI ADMIN (SPA, tanpa URL)
// ════════════════════════════════════════════════════════
const ADMIN_TITLES = { dashboard: 'Dashboard Ikhtisar', pesanan: 'Kelola Pesanan', produk: 'Katalog & Stok Produk', pelanggan: 'Data Pelanggan', laporan: 'Rekap & Laporan', pengaturan: 'Pengaturan Toko' };
function navigateAdmin(section) {
  document.querySelectorAll('.admin-content-section').forEach(s => s.classList.remove('active'));
  document.getElementById('admin-section-' + section).classList.add('active');
  document.querySelectorAll('.ik-admin-link').forEach(a => a.classList.toggle('active', a.dataset.adminSection === section));
  document.getElementById('adminPageTitle').textContent = ADMIN_TITLES[section];
  document.getElementById('adminSidebar').classList.remove('show');

  if (section === 'dashboard') loadAdminDashboard();
  if (section === 'pesanan') loadAdminOrders();
  if (section === 'produk') loadAdminProducts();
  if (section === 'pelanggan') loadAdminCustomers();
  if (section === 'laporan') loadAdminReport();
  if (section === 'pengaturan') loadAdminSettings();
}
function toggleAdminSidebar() { document.getElementById('adminSidebar').classList.toggle('show'); }

// ════════════════════════════════════════════════════════
// BAGIAN 9: ADMIN — DASHBOARD
// ════════════════════════════════════════════════════════
function loadAdminDashboard() {
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { showToast('Error', res.message, 'danger'); return; }
      const d = res.data;
      document.getElementById('adminKpiGrid').innerHTML = `
        <div class="ik-kpi-card"><div class="val">${d.statusCounts.Menunggu}</div><div class="lbl">⏳ Menunggu Verifikasi</div></div>
        <div class="ik-kpi-card"><div class="val">${d.statusCounts.Disetujui}</div><div class="lbl">📦 Disetujui/Diproses</div></div>
        <div class="ik-kpi-card"><div class="val">${d.statusCounts.Selesai}</div><div class="lbl">✅ Pesanan Selesai</div></div>
        <div class="ik-kpi-card"><div class="val">${d.statusCounts.Ditolak}</div><div class="lbl">❌ Ditolak/Batal</div></div>`;
      document.getElementById('dashboardInsights').innerHTML = d.insights.map(i => `<li>${i}</li>`).join('');
      document.getElementById('stokMenipisList').innerHTML = d.stokMenipis.length
        ? d.stokMenipis.map(p => `<div class="flex justify-between"><span>${p.nama}</span><b style="color:var(--accent-dark)">${p.stok} tersisa</b></div>`).join('')
        : `<p style="color:var(--text-muted)">Semua stok produk aman.</p>`;
      renderCategoryChart(d.kategoriCounts);
    })
    .withFailureHandler(handleAdminError)
    .getAdminDashboard(ADMIN_TOKEN);
}
function renderCategoryChart(kategoriCounts) {
  const ctx = document.getElementById('chartKategori');
  if (!ctx) return;
  if (chartInstances.kategori) chartInstances.kategori.destroy();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  chartInstances.kategori = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(kategoriCounts), datasets: [{ data: Object.values(kategoriCounts), backgroundColor: ['#1E6B37', '#4CAF50', '#FF9800', '#8bd898'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#e9f3ec' : '#1A202C', padding: 12 } } } }
  });
}
function updateChartTheme(chart) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (chart.options.plugins && chart.options.plugins.legend) chart.options.plugins.legend.labels.color = isDark ? '#e9f3ec' : '#1A202C';
  chart.update();
}

// ════════════════════════════════════════════════════════
// BAGIAN 10: ADMIN — KELOLA PESANAN (US-5)
// ════════════════════════════════════════════════════════
function loadOrdersDebugInfo() {
  const bar = document.getElementById('orderDebugBar');
  if (!bar) return;
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { bar.innerHTML = `⚠️ Diagnostik gagal: ${res.message}`; return; }
      const d = res.data;
      bar.innerHTML = `📊 <b>Diagnostik Spreadsheet:</b> Total baris pesanan tersimpan: <b>${d.totalRows}</b>` +
        (d.lastOrderSummary ? ` | Pesanan terakhir: <b>${d.lastOrderSummary.ID}</b> (${d.lastOrderSummary.NamaPembeli || '-'}, status: ${d.lastOrderSummary.Status || '-'})` : ' | Belum ada baris pesanan sama sekali.') +
        ` | <a href="${d.spreadsheetUrl}" target="_blank" class="underline">Buka Spreadsheet ↗</a>`;
    })
    .withFailureHandler(err => { bar.innerHTML = `⚠️ Diagnostik gagal: ${err.message}`; })
    .getOrdersDebugInfo(ADMIN_TOKEN);
}

function loadAdminOrders() {
  loadOrdersDebugInfo();
  const filters = { searchTerm: document.getElementById('orderSearchInput').value, status: document.getElementById('orderStatusFilter').value };
  document.getElementById('orderTableBody').innerHTML = `<tr><td colspan="7" class="text-center py-6">Memuat...</td></tr>`;
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) {
        document.getElementById('orderTableBody').innerHTML = `<tr><td colspan="7" class="text-center py-6" style="color:var(--status-rejected)">⚠️ ${res.message}</td></tr>`;
        showToast('Error', res.message, 'danger');
        return;
      }
      try {
        renderOrderTable(res.data);
      } catch (renderErr) {
        console.error('[ImahKu] Render error (Kelola Pesanan):', renderErr);
        document.getElementById('orderTableBody').innerHTML = `<tr><td colspan="7" class="text-center py-6" style="color:var(--status-rejected)">⚠️ Gagal menampilkan data: ${renderErr.message}</td></tr>`;
        showToast('Error Tampilan', renderErr.message, 'danger');
      }
    })
    .withFailureHandler(err => {
      document.getElementById('orderTableBody').innerHTML = `<tr><td colspan="7" class="text-center py-6" style="color:var(--status-rejected)">⚠️ ${err.message}</td></tr>`;
      handleAdminError(err);
    })
    .getAdminOrders(ADMIN_TOKEN, filters);
}
function renderOrderTable(orders) {
  const body = document.getElementById('orderTableBody');
  if (!orders || orders.length === 0) { body.innerHTML = `<tr><td colspan="7" class="text-center py-6" style="color:var(--text-muted)">Belum ada pesanan.</td></tr>`; return; }
  body.innerHTML = orders.map(o => {
    const items = Array.isArray(o.ItemsJSON) ? o.ItemsJSON : [];
    const statusSafe = ['Menunggu', 'Disetujui', 'Ditolak', 'Selesai'].includes(o.Status) ? o.Status : 'Menunggu';
    const tanggalDisplay = o.Tanggal ? new Date(o.Tanggal).toLocaleString('id-ID') : '-';
    return `
    <tr>
      <td><b>${o.ID || '-'}</b><br><span style="color:var(--text-muted)">${tanggalDisplay}</span></td>
      <td>${o.NamaPembeli || '-'}<br><span style="color:var(--text-muted)">${o.WhatsApp || '-'}</span></td>
      <td>${items.length ? items.map(i => `${i.nama} (${i.qty}x)`).join('<br>') : '<span style="color:var(--text-muted)">-</span>'}</td>
      <td><b>Rp ${fmtRp(o.TotalBayar)}</b></td>
      <td>${o.BuktiBayarURL ? `<button class="ik-table-action-btn" onclick="previewBukti('${o.BuktiBayarURL}','${o.BuktiBayarFileId || ''}','${escapeAttr(o.ID)}')">🖼️ Lihat</button>` : '<span style="color:var(--text-muted)">-</span>'}</td>
      <td><span class="ik-status-badge status-${statusSafe}">${statusSafe}</span></td>
      <td>
        <button class="ik-table-action-btn" style="border-color:#25D366;color:#128C7E" onclick="openWhatsAppInvoiceModal('${o.ID}')">📱 WA</button>
        ${statusSafe === 'Menunggu' ? `
          <button class="ik-table-action-btn primary" onclick="openStatusModal('${o.ID}','Disetujui')">✔ Setujui</button>
          <button class="ik-table-action-btn danger" onclick="openStatusModal('${o.ID}','Ditolak')">✕ Tolak</button>` : ''}
        ${statusSafe === 'Disetujui' ? `<button class="ik-table-action-btn primary" onclick="openStatusModal('${o.ID}','Selesai')">✅ Selesaikan</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}
function openWhatsAppInvoiceModal(orderId) {
  document.getElementById('waInvoiceText').value = 'Memuat teks...';
  document.getElementById('waInvoiceOverlay').classList.remove('hidden');
  document.getElementById('waInvoiceModal').classList.remove('hidden');

  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) {
        document.getElementById('waInvoiceText').value = '⚠️ Gagal memuat: ' + res.message;
        return;
      }
      document.getElementById('waInvoiceNama').textContent = res.data.nama || '-';
      document.getElementById('waInvoiceNumber').textContent = res.data.whatsapp || '-';
      document.getElementById('waInvoiceText').value = res.data.message;

      let target = String(res.data.whatsapp || '').replace(/[^0-9]/g, '');
      if (target.startsWith('0')) target = '62' + target.substring(1);
      else if (target && !target.startsWith('62')) target = '62' + target;

      document.getElementById('waInvoiceOpenLink').href = target
        ? `https://wa.me/${target}?text=${encodeURIComponent(res.data.message)}`
        : '#';
    })
    .withFailureHandler(err => {
      document.getElementById('waInvoiceText').value = '⚠️ Error: ' + err.message;
    })
    .getWhatsAppInvoiceText(ADMIN_TOKEN, orderId);
}
function closeWaInvoiceModal() {
  document.getElementById('waInvoiceOverlay').classList.add('hidden');
  document.getElementById('waInvoiceModal').classList.add('hidden');
}
function copyWaInvoiceText() {
  const textarea = document.getElementById('waInvoiceText');
  textarea.select();
  textarea.setSelectionRange(0, 999999);
  try {
    navigator.clipboard.writeText(textarea.value)
      .then(() => showToast('Disalin', 'Teks invoice disalin ke clipboard.', 'success'))
      .catch(() => { document.execCommand('copy'); showToast('Disalin', 'Teks invoice disalin ke clipboard.', 'success'); });
  } catch (e) {
    document.execCommand('copy');
    showToast('Disalin', 'Teks invoice disalin ke clipboard.', 'success');
  }
}

function previewBukti(thumbUrl, fileId, orderId) {
  document.getElementById('previewModalContent').innerHTML = `<img src="${thumbUrl}" class="mx-auto rounded-lg max-h-96" alt="Bukti bayar ${orderId}" onerror="this.outerHTML='<p style=\\'color:var(--text-muted)\\'>Pratinjau tidak tersedia. Gunakan tombol Unduh untuk membuka berkas asli.</p>'">`;
  document.getElementById('previewDownloadBtn').href = fileId ? `https://drive.google.com/file/d/${fileId}/view` : thumbUrl;
  document.getElementById('previewOverlay').classList.remove('hidden');
  document.getElementById('previewModal').classList.remove('hidden');
}
function closePreviewModal() {
  document.getElementById('previewOverlay').classList.add('hidden');
  document.getElementById('previewModal').classList.add('hidden');
}

let PENDING_STATUS_ACTION = null;
function openStatusModal(orderId, newStatus) {
  PENDING_STATUS_ACTION = { orderId, newStatus };
  document.getElementById('statusModalTitle').textContent = `${newStatus} Pesanan ${orderId}`;
  document.getElementById('statusModalDesc').textContent = `Email notifikasi akan dikirim otomatis ke pembeli setelah dikonfirmasi.`;
  document.getElementById('statusModalNote').value = '';
  document.getElementById('statusOverlay').classList.remove('hidden');
  document.getElementById('statusModal').classList.remove('hidden');
  document.getElementById('statusModalConfirmBtn').onclick = confirmStatusChange;
}
function closeStatusModal() {
  document.getElementById('statusOverlay').classList.add('hidden');
  document.getElementById('statusModal').classList.add('hidden');
}
function confirmStatusChange() {
  if (!PENDING_STATUS_ACTION) return;
  const note = document.getElementById('statusModalNote').value.trim();
  const btn = document.getElementById('statusModalConfirmBtn');
  btn.disabled = true; btn.textContent = 'Memproses...';
  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.textContent = 'Konfirmasi';
      closeStatusModal();
      if (res.success) { showToast('Berhasil', res.message, 'success'); loadAdminOrders(); loadAdminDashboard(); }
      else showToast('Gagal', res.message, 'danger');
    })
    .withFailureHandler(err => { btn.disabled = false; btn.textContent = 'Konfirmasi'; showToast('Error', err.message, 'danger'); })
    .updateOrderStatus(ADMIN_TOKEN, PENDING_STATUS_ACTION.orderId, PENDING_STATUS_ACTION.newStatus, note);
}

// ════════════════════════════════════════════════════════
// BAGIAN 11: ADMIN — KELOLA PRODUK (US-4)
// ════════════════════════════════════════════════════════
let PENDING_PRODUCT_FOTO = null;
function loadAdminProducts() {
  document.getElementById('productTableBody').innerHTML = `<tr><td colspan="7" class="text-center py-6">Memuat...</td></tr>`;
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { showToast('Error', res.message, 'danger'); return; }
      renderProductTable(res.data);
    })
    .withFailureHandler(handleAdminError)
    .getAdminProducts(ADMIN_TOKEN);
}
function renderProductTable(products) {
  const body = document.getElementById('productTableBody');
  if (products.length === 0) { body.innerHTML = `<tr><td colspan="7" class="text-center py-6" style="color:var(--text-muted)">Belum ada produk.</td></tr>`; return; }
  body.innerHTML = products.map(p => `
    <tr>
      <td>${p.FotoURL ? `<img src="${p.FotoURL}" class="ik-table-thumb" onerror="this.style.display='none'">` : '📦'}</td>
      <td><b>${p.Nama}</b><br><span style="color:var(--text-muted)">${p.Satuan}</span></td>
      <td>${p.Kategori}</td>
      <td>Rp ${fmtRp(p.Harga)}</td>
      <td>${p.Stok}</td>
      <td><span class="ik-status-badge status-${p.Status === 'Aktif' ? 'Disetujui' : 'Ditolak'}">${p.Status}</span></td>
      <td>
        <button class="ik-table-action-btn" onclick='openProductForm(${JSON.stringify(p).replace(/'/g, "&#39;")})'>✏️ Edit</button>
        <button class="ik-table-action-btn danger" onclick="handleDeleteProduct('${p.ID}')">🗑️</button>
      </td>
    </tr>`).join('');
}
function openProductForm(product) {
  PENDING_PRODUCT_FOTO = null;
  document.getElementById('productFormTitle').textContent = product && product.ID ? 'Edit Produk' : 'Tambah Produk';
  document.getElementById('pf_id').value = product ? product.ID : '';
  document.getElementById('pf_nama').value = product ? product.Nama : '';
  document.getElementById('pf_kategori').value = product ? product.Kategori : 'Bahan Pokok & Perkebunan';
  document.getElementById('pf_satuan').value = product ? product.Satuan : '';
  document.getElementById('pf_status').value = product ? product.Status : 'Aktif';
  document.getElementById('pf_harga').value = product ? product.Harga : '';
  document.getElementById('pf_hargaAsli').value = product ? product.HargaAsli : '';
  document.getElementById('pf_stok').value = product ? product.Stok : '';
  document.getElementById('pf_badge').value = product ? product.Badge : '';
  document.getElementById('pf_deskripsi').value = product ? product.Deskripsi : '';
  const preview = document.getElementById('pf_fotoPreview');
  if (product && product.FotoURL) { preview.src = product.FotoURL; preview.classList.remove('hidden'); } else { preview.classList.add('hidden'); }
  document.getElementById('pf_foto').value = '';
  document.getElementById('productFormOverlay').classList.remove('hidden');
  document.getElementById('productFormModal').classList.remove('hidden');
}
function closeProductForm() {
  document.getElementById('productFormOverlay').classList.add('hidden');
  document.getElementById('productFormModal').classList.add('hidden');
}
document.addEventListener('change', e => {
  if (!e.target || !e.target.files || !e.target.files[0]) return;
  const file = e.target.files[0];

  if (file.size > 5 * 1024 * 1024) { showToast('Peringatan', 'Ukuran file maksimal 5MB.', 'warning'); e.target.value = ''; return; }

  if (e.target.id === 'pf_foto') {
    const reader = new FileReader();
    reader.onload = () => {
      PENDING_PRODUCT_FOTO = { base64: reader.result.split(',')[1], mime: file.type, nama: file.name };
      const preview = document.getElementById('pf_fotoPreview');
      preview.src = reader.result; preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  if (e.target.id === 'set_logoFile') {
    const reader = new FileReader();
    reader.onload = () => {
      PENDING_LOGO = { base64: reader.result.split(',')[1], mime: file.type, nama: file.name };
      const preview = document.getElementById('set_logoPreview');
      preview.src = reader.result; preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  if (e.target.id === 'set_bannerFile') {
    const reader = new FileReader();
    reader.onload = () => {
      PENDING_BANNER = { base64: reader.result.split(',')[1], mime: file.type, nama: file.name };
      const preview = document.getElementById('set_bannerPreview');
      preview.src = reader.result; preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
});
function handleSaveProduct() {
  const productObj = {
    ID: document.getElementById('pf_id').value || undefined,
    Nama: document.getElementById('pf_nama').value.trim(),
    Kategori: document.getElementById('pf_kategori').value,
    Satuan: document.getElementById('pf_satuan').value.trim(),
    Status: document.getElementById('pf_status').value,
    Harga: Number(document.getElementById('pf_harga').value) || 0,
    HargaAsli: Number(document.getElementById('pf_hargaAsli').value) || 0,
    Stok: Number(document.getElementById('pf_stok').value) || 0,
    Badge: document.getElementById('pf_badge').value.trim(),
    Deskripsi: document.getElementById('pf_deskripsi').value.trim()
  };
  if (!productObj.Nama || !productObj.Satuan || !productObj.Harga) { showToast('Peringatan', 'Lengkapi nama, satuan, dan harga produk.', 'warning'); return; }

  const btn = document.getElementById('saveProductBtn');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.textContent = '💾 Simpan Produk';
      if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
      showToast('Berhasil', res.message, 'success');
      closeProductForm(); loadAdminProducts();
    })
    .withFailureHandler(err => { btn.disabled = false; btn.textContent = '💾 Simpan Produk'; showToast('Error', err.message, 'danger'); })
    .saveProduct(ADMIN_TOKEN, productObj,
      PENDING_PRODUCT_FOTO ? PENDING_PRODUCT_FOTO.base64 : null,
      PENDING_PRODUCT_FOTO ? PENDING_PRODUCT_FOTO.mime : null,
      PENDING_PRODUCT_FOTO ? PENDING_PRODUCT_FOTO.nama : null);
}
function handleDeleteProduct(id) {
  if (!confirm('Hapus produk ini secara permanen?')) return;
  google.script.run
    .withSuccessHandler(res => {
      if (res.success) { showToast('Berhasil', res.message, 'success'); loadAdminProducts(); }
      else showToast('Gagal', res.message, 'danger');
    })
    .withFailureHandler(handleAdminError)
    .deleteProduct(ADMIN_TOKEN, id);
}

// ════════════════════════════════════════════════════════
// BAGIAN 12: ADMIN — DATA PELANGGAN
// ════════════════════════════════════════════════════════
function loadAdminCustomers() {
  document.getElementById('customerTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-6">Memuat...</td></tr>`;
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { showToast('Error', res.message, 'danger'); return; }
      const body = document.getElementById('customerTableBody');
      body.innerHTML = res.data.length ? res.data.map(c => `
        <tr><td>${c.Nama}</td><td>${c.WhatsApp}</td><td>${c.Email}</td><td>${c.Alamat}</td><td><b>${c.TotalPesanan}</b></td></tr>`).join('')
        : `<tr><td colspan="5" class="text-center py-6" style="color:var(--text-muted)">Belum ada pelanggan.</td></tr>`;
    })
    .withFailureHandler(handleAdminError)
    .getAdminCustomers(ADMIN_TOKEN);
}

// ════════════════════════════════════════════════════════
// BAGIAN 13: ADMIN — LAPORAN (US-6)
// ════════════════════════════════════════════════════════
function loadAdminReport() {
  const filters = {
    status: document.getElementById('reportStatusFilter').value,
    dateFrom: document.getElementById('reportDateFrom').value,
    dateTo: document.getElementById('reportDateTo').value,
    searchTerm: document.getElementById('reportSearchInput').value
  };
  document.getElementById('reportTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-6">Memuat...</td></tr>`;
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) {
        document.getElementById('reportTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-6" style="color:var(--status-rejected)">⚠️ ${res.message}</td></tr>`;
        showToast('Error', res.message, 'danger');
        return;
      }
      try {
        document.getElementById('reportSummary').innerHTML = `
          <div class="ik-kpi-card"><div class="val">${res.data.totalRows}</div><div class="lbl">Total Transaksi (Filter Aktif)</div></div>
          <div class="ik-kpi-card"><div class="val">Rp ${fmtRp(res.data.totalOmzet)}</div><div class="lbl">Omzet dari Pesanan Selesai</div></div>`;
        const rows = res.data.rows || [];
        const body = document.getElementById('reportTableBody');
        body.innerHTML = rows.length ? rows.map(r => {
          const statusSafe = ['Menunggu', 'Disetujui', 'Ditolak', 'Selesai'].includes(r.Status) ? r.Status : 'Menunggu';
          const tanggalDisplay = r.Tanggal ? new Date(r.Tanggal).toLocaleDateString('id-ID') : '-';
          return `<tr><td>${r.ID || '-'}</td><td>${tanggalDisplay}</td><td>${r.NamaPembeli || '-'}</td>
            <td>Rp ${fmtRp(r.TotalBayar)}</td><td><span class="ik-status-badge status-${statusSafe}">${statusSafe}</span></td></tr>`;
        }).join('') : `<tr><td colspan="5" class="text-center py-6" style="color:var(--text-muted)">Tidak ada data sesuai filter.</td></tr>`;
      } catch (renderErr) {
        console.error('[ImahKu] Render error (Laporan):', renderErr);
        document.getElementById('reportTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-6" style="color:var(--status-rejected)">⚠️ Gagal menampilkan data: ${renderErr.message}</td></tr>`;
        showToast('Error Tampilan', renderErr.message, 'danger');
      }
    })
    .withFailureHandler(err => {
      document.getElementById('reportTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-6" style="color:var(--status-rejected)">⚠️ ${err.message}</td></tr>`;
      handleAdminError(err);
    })
    .getAdminReport(ADMIN_TOKEN, filters);
}

// ════════════════════════════════════════════════════════
// BAGIAN 14: ADMIN — PENGATURAN TOKO
// ════════════════════════════════════════════════════════
function loadAdminSettings() {
  PENDING_LOGO = null; PENDING_BANNER = null;
  document.getElementById('set_logoFile').value = '';
  document.getElementById('set_bannerFile').value = '';
  google.script.run
    .withSuccessHandler(res => {
      if (!res.success) { showToast('Error', res.message, 'danger'); return; }
      const c = res.data;
      document.getElementById('set_appName').value = c.appName || '';
      document.getElementById('set_tagline').value = c.tagline || '';
      document.getElementById('set_waNumber').value = c.waNumber || '';
      document.getElementById('set_alamatToko').value = c.alamatToko || '';
      document.getElementById('set_rekBCA').value = c.rekBCA || '';
      document.getElementById('set_rekMandiri').value = c.rekMandiri || '';
      document.getElementById('set_rekBRI').value = c.rekBRI || '';
      document.getElementById('set_ongkirGratisMin').value = c.ongkirGratisMin || 50000;
      document.getElementById('set_waApiToken').value = c.waApiToken || '';

      const logoPrev = document.getElementById('set_logoPreview');
      if (c.logoUrl) { logoPrev.src = c.logoUrl; logoPrev.classList.remove('hidden'); } else { logoPrev.classList.add('hidden'); }
      const bannerPrev = document.getElementById('set_bannerPreview');
      if (c.bannerUrl) { bannerPrev.src = c.bannerUrl; bannerPrev.classList.remove('hidden'); } else { bannerPrev.classList.add('hidden'); }
    })
    .withFailureHandler(handleAdminError)
    .getAdminSettings(ADMIN_TOKEN);
}
function handleSaveSettings() {
  const configObj = {
    appName: document.getElementById('set_appName').value.trim(),
    tagline: document.getElementById('set_tagline').value.trim(),
    waNumber: document.getElementById('set_waNumber').value.trim(),
    alamatToko: document.getElementById('set_alamatToko').value.trim(),
    rekBCA: document.getElementById('set_rekBCA').value.trim(),
    rekMandiri: document.getElementById('set_rekMandiri').value.trim(),
    rekBRI: document.getElementById('set_rekBRI').value.trim(),
    ongkirGratisMin: Number(document.getElementById('set_ongkirGratisMin').value) || 50000,
    waApiToken: document.getElementById('set_waApiToken').value.trim()
  };

  const btn = document.getElementById('saveSettingsBtn');
  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  google.script.run
    .withSuccessHandler(res => {
      btn.disabled = false; btn.textContent = '💾 Simpan Pengaturan';
      if (!res.success) { showToast('Gagal', res.message, 'danger'); return; }
      showToast('Berhasil', res.message, 'success');
      Object.assign(APP_CONFIG, res.data);
      applyBranding();
      PENDING_LOGO = null; PENDING_BANNER = null;
    })
    .withFailureHandler(err => { btn.disabled = false; btn.textContent = '💾 Simpan Pengaturan'; handleAdminError(err); })
    .saveAdminSettings(
      ADMIN_TOKEN, configObj,
      PENDING_LOGO ? PENDING_LOGO.base64 : null, PENDING_LOGO ? PENDING_LOGO.mime : null, PENDING_LOGO ? PENDING_LOGO.nama : null,
      PENDING_BANNER ? PENDING_BANNER.base64 : null, PENDING_BANNER ? PENDING_BANNER.mime : null, PENDING_BANNER ? PENDING_BANNER.nama : null
    );
}

// ════════════════════════════════════════════════════════
// BAGIAN 15: UTILITAS UMUM
// ════════════════════════════════════════════════════════
function handleAdminError(err) {
  showToast('Sesi Berakhir', err.message, 'danger');
  if (String(err.message).includes('Sesi admin')) handleAdminLogout();
}
function fmtRp(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
function escapeAttr(str) { return String(str).replace(/'/g, "\\'"); }
function showToast(title, message, type) {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'ik-toast ' + (type || '');
  el.innerHTML = `<b>${title}</b><p class="mt-0.5" style="margin:0">${message}</p>`;
  wrap.appendChild(el);
  if (type === 'danger' || type === 'warning') console.warn('[ImahKu]', title, '-', message);
  const duration = (type === 'danger' || type === 'warning') ? 7000 : 4000;
  setTimeout(() => el.remove(), duration);
}

// Cek sesi admin yang tersimpan (refresh halaman tidak mengulang login selama sesi cache valid)
(function restoreAdminSession() {
  const t = sessionStorage.getItem('imahku_admin_token');
  const info = sessionStorage.getItem('imahku_admin_info');
  if (t && info) { ADMIN_TOKEN = t; ADMIN_INFO = JSON.parse(info); }
})();
