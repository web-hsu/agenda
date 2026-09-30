/* ============================================================
 * gas-shim.js
 * Menggantikan google.script.run (hanya ada di Apps Script) dengan
 * fetch() ke Web App Apps Script. Kode di halaman HTML tidak perlu
 * diubah: .withSuccessHandler(...).withFailureHandler(...).namaFungsi(args)
 * tetap berjalan seperti biasa.
 * ============================================================ */
(function () {
  function makeRunner(ok, fail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return makeRunner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return makeRunner(ok, f); };
        if (name === 'withUserObject')     return function () { return makeRunner(ok, fail); };
        if (typeof name !== 'string' || name === 'then') return undefined;
        return function () {
          call(name, Array.prototype.slice.call(arguments), ok, fail);
        };
      }
    });
  }

  function reportError(err, fail) {
    if (typeof fail === 'function') { try { fail(err); } catch (e) { console.error(e); } }
    else console.error('[API]', err && err.message ? err.message : err);
  }

  function call(fn, args, ok, fail) {
    var url = String(window.GAS_API_URL || '').trim();
    if (!url || url.indexOf('PASTE_') === 0) {
      return reportError(new Error('GAS_API_URL belum diisi di config.js'), fail);
    }
    fetch(url, {
      method: 'POST',
      // text/plain = "simple request" -> tidak memicu preflight CORS (Apps Script tidak mendukung OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args, token: window.sessionToken || '' }),
      redirect: 'follow'
    })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j;
        try { j = JSON.parse(t); }
        catch (e) { throw new Error('Respons server bukan JSON. Cek deployment Web App (akses harus "Anyone").'); }
        if (j && j.ok) { if (typeof ok === 'function') ok(j.data); }
        else reportError(new Error((j && j.error) || 'Terjadi kesalahan di server.'), fail);
      })
      .catch(function (e) { reportError(e, fail); });
  }

  window.google = window.google || {};
  window.google.script = { run: makeRunner(null, null) };
})();
