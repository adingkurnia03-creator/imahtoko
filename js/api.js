/**
 * ============================================================
 * API BRIDGE — google.script.run  →  fetch() ke REST API GAS
 * ============================================================
 * File ini membuat pemanggilan gaya lama:
 *
 *   google.script.run
 *     .withSuccessHandler(fn)
 *     .withFailureHandler(fn)
 *     .namaFungsi(arg1, arg2)
 *
 * tetap berfungsi persis sama walau backend sekarang REST API
 * terpisah (GitHub Pages ↔ Google Apps Script via fetch/JSON).
 * Berkat ini, app.js TIDAK PERLU diubah sama sekali.
 *
 * Kalau nanti menambah fungsi baru di backend, cukup daftarkan
 * di GAS_FUNCTIONS di bawah — tidak perlu sentuh app.js.
 * ============================================================
 */

// ── Pengaman: pastikan GAS_URL sudah diisi dengan benar di index.html ──
// Ini mencegah error samar "GAS_URL is not defined" di Console yang
// membingungkan — sebagai gantinya, tampilkan pesan jelas di layar.
(function checkGasUrlConfigured() {
  const isMissing = typeof GAS_URL === 'undefined';
  const isPlaceholder = !isMissing && GAS_URL.includes('PASTE_URL_APPS_SCRIPT_ANDA_DISINI');
  if (isMissing || isPlaceholder) {
    document.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#c62828;color:#fff;padding:14px 20px;font-family:sans-serif;font-size:14px;text-align:center;';
      banner.innerHTML = '⚠️ <b>Konfigurasi belum lengkap:</b> URL backend (GAS_URL) belum diisi di <code>index.html</code>. Buka index.html, cari baris <code>const GAS_URL = ...</code>, ganti dengan URL Apps Script Anda yang diakhiri <code>/exec</code>.';
      document.body.prepend(banner);
    });
  }
})();

// Peta setiap fungsi backend: method HTTP & urutan nama argumennya
// (urutan harus SAMA PERSIS dengan urutan argumen saat fungsi itu
// dipanggil di app.js, karena google.script.run memakai argumen posisional).
const GAS_FUNCTIONS = {
  // ── GET (baca data) ──
  getAppVersion:          { method: 'GET' },
  getPublicCatalog:       { method: 'GET', argNames: ['search', 'category'] },
  getProductDetail:       { method: 'GET', argNames: ['id'] },
  trackOrder:             { method: 'GET', argNames: ['orderId', 'contact'] },
  getAllConfig:           { method: 'GET' },
  validateSession:        { method: 'GET', argNames: ['token'] },
  getAdminDashboard:      { method: 'GET', argNames: ['token'] },
  getAdminOrders:         { method: 'GET', argNames: ['token', 'filters'] },
  getOrdersDebugInfo:     { method: 'GET', argNames: ['token'] },
  getAdminProducts:       { method: 'GET', argNames: ['token'] },
  getAdminCustomers:      { method: 'GET', argNames: ['token'] },
  getAdminReport:         { method: 'GET', argNames: ['token', 'filters'] },
  getAdminSettings:       { method: 'GET', argNames: ['token'] },
  getWhatsAppInvoiceText: { method: 'GET', argNames: ['token', 'orderId'] },

  // ── POST (kirim/ubah data) ──
  submitOrder:            { method: 'POST', argNames: ['orderPayload'] },
  doLoginAdmin:           { method: 'POST', argNames: ['username', 'password'] },
  doLogoutAdmin:          { method: 'POST', argNames: ['token'] },
  updateOrderStatus:      { method: 'POST', argNames: ['token', 'orderId', 'newStatus', 'catatanAdmin'] },
  saveProduct:            { method: 'POST', argNames: ['token', 'productObj', 'fotoBase64', 'fotoMime', 'fotoNama'] },
  deleteProduct:          { method: 'POST', argNames: ['token', 'id'] },
  saveAdminSettings:      { method: 'POST', argNames: ['token', 'configObj', 'logoBase64', 'logoMime', 'logoNama', 'bannerBase64', 'bannerMime', 'bannerNama'] }
};

// validateSession mengembalikan bentuk {valid:...} APA ADANYA dari server
// (tidak dibungkus {success,data,message}) — daftarkan di sini supaya
// shim tahu untuk tidak memperlakukannya seperti respons standar.
const GAS_RAW_RESPONSE_FUNCTIONS = new Set(['validateSession']);

async function invokeGasFunction(name, args, onSuccess, onFailure) {
  if (typeof GAS_URL === 'undefined' || GAS_URL.includes('PASTE_URL_APPS_SCRIPT_ANDA_DISINI')) {
    const msg = 'URL backend (GAS_URL) belum diisi di index.html.';
    console.error('[api.js] ' + msg);
    if (onFailure) onFailure({ message: msg });
    return;
  }

  const spec = GAS_FUNCTIONS[name];
  if (!spec) {
    console.error('[api.js] Fungsi backend tidak terdaftar:', name);
    if (onFailure) onFailure({ message: 'Fungsi "' + name + '" belum didaftarkan di js/api.js (GAS_FUNCTIONS).' });
    return;
  }

  try {
    let response;

    if (spec.method === 'GET') {
      const params = new URLSearchParams();
      params.set('action', name);
      (spec.argNames || []).forEach((argName, i) => {
        const val = args[i];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Objek seperti { status, searchTerm } diratakan jadi query param terpisah
          Object.keys(val).forEach(k => {
            if (val[k] !== undefined && val[k] !== null) params.set(k, val[k]);
          });
        } else if (val !== undefined && val !== null) {
          params.set(argName, val);
        }
      });
      const res = await fetch(`${GAS_URL}?${params.toString()}`);
      response = await res.json();

    } else {
      // POST — kalau argumen tunggal berupa objek (mis. submitOrder(orderPayload)),
      // kirim objek itu langsung sebagai "data". Kalau bukan, bungkus per nama argumen.
      let data;
      if (spec.argNames.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
        data = args[0];
      } else {
        data = {};
        spec.argNames.forEach((argName, i) => { data[argName] = args[i]; });
      }
      const res = await fetch(GAS_URL, {
        method: 'POST',
        // WAJIB text/plain — Content-Type application/json memicu CORS
        // preflight (OPTIONS) yang tidak didukung Google Apps Script.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: name, data: data })
      });
      response = await res.json();
    }

    if (onSuccess) onSuccess(response);
  } catch (error) {
    console.error('[api.js] Gagal memanggil ' + name + ':', error);
    if (onFailure) onFailure({ message: error.message || 'Tidak bisa terhubung ke server.' });
  }
}

/**
 * Shim `google.script.run` — setiap kali diakses sebagai ekspresi baru
 * (mis. `google.script.run.withSuccessHandler(...)`), dibuatkan objek
 * chainable dengan `state` (success/failure handler) miliknya sendiri.
 * `withSuccessHandler`/`withFailureHandler` mengembalikan proxy baru
 * yang berbagi `state` yang SAMA lewat closure, sehingga rantai
 * `.withSuccessHandler(fn).withFailureHandler(fn2).namaFungsi(args)`
 * tetap memakai satu state yang konsisten sampai akhir.
 */
function createGasRunProxy(state) {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'withSuccessHandler') {
        return (fn) => { state.success = fn; return createGasRunProxy(state); };
      }
      if (prop === 'withFailureHandler') {
        return (fn) => { state.failure = fn; return createGasRunProxy(state); };
      }
      // prop adalah nama fungsi backend, mis. "getAdminOrders"
      return (...args) => invokeGasFunction(String(prop), args, state.success, state.failure);
    }
  });
}

window.google = window.google || {};
window.google.script = window.google.script || {};
Object.defineProperty(window.google.script, 'run', {
  get() {
    return createGasRunProxy({ success: null, failure: null });
  }
});
