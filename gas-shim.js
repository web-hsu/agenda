/* ============================================================
 * gas-shim.js  (versi cepat)
 * Menggantikan google.script.run (hanya ada di Apps Script) dengan
 * fetch() ke Web App Apps Script. Kode di halaman HTML tidak perlu
 * diubah: .withSuccessHandler(...).withFailureHandler(...).namaFungsi(args)
 * tetap berjalan seperti biasa.
 *
 * Percepatan:
 *  1. Stale-while-revalidate untuk fungsi BACA: data terakhir langsung
 *     ditampilkan dari cache browser, lalu diperbarui diam-diam dari server.
 *  2. Permintaan baca yang identik dan sedang berjalan digabung jadi satu.
 *  3. Prefetch (window.gasPrefetch) agar menu berikutnya sudah siap.
 *  4. Timeout + 1x ulang otomatis untuk fungsi baca (cold start / jaringan putus).
 *  5. Cache dibuang otomatis setiap ada perubahan data (tulis/login/logout).
 * ============================================================ */
(function () {
  var READ = { getAgenda:1, getPengajuan:1, getDashboardData:1, getAkunList:1, getEmailKalender:1,
               getMyCalendars:1, getCalendarSettings:1, getPimpinanList:1, getModulList:1 };
  var WRITE = { addAgenda:1, editAgenda:1, deleteAgenda:1, updateStatusPengajuan:1, saveAkun:1, deleteAkun:1,
                addEmailKalender:1, deleteEmailKalender:1, setCalendarId:1, syncAllToCalendar:1,
                submitPengajuan:1, submitBukuTamu:1, login:1, logout:1 };
  var RETRY = { login:1, resumeSesi:1, warm:1, cekStatusPengajuan:1, getCalendarId:1 };
  for (var k in READ) RETRY[k] = 1;

  var PFX = 'gasc1:', MAX_AGE = 10 * 60 * 1000;      // data cache > 10 menit tidak ditampilkan
  var T_FAST = 25000, T_SLOW = 120000;                // timeout baca / tulis (ms)
  var mem = {}, inflight = {}, gen = 0;

  // ── cache ──
  function authTag() { var t = window.sessionToken || ''; return t ? 'T' + String(t).slice(0, 10) : 'P'; }
  function keyOf(fn, args) { return authTag() + '|' + fn + '|' + JSON.stringify(args); }
  function getCached(key) {
    var e = mem[key];
    if (!e) {
      try { var raw = sessionStorage.getItem(PFX + key); if (raw) { e = JSON.parse(raw); mem[key] = e; } } catch (x) {}
    }
    return (e && Date.now() - e.t < MAX_AGE) ? e : null;
  }
  function putCached(key, s) {
    var e = { t: Date.now(), s: s }; mem[key] = e;
    try { sessionStorage.setItem(PFX + key, JSON.stringify(e)); }
    catch (x) { try { clearStore(); } catch (y) {} }
  }
  function clearStore() {
    try {
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf(PFX) === 0) sessionStorage.removeItem(k); });
    } catch (x) {}
  }
  function clearAll() { gen++; mem = {}; clearStore(); }
  window.gasClearCache = clearAll;
  window.gasHasCache = function (fn, args) { return !!getCached(keyOf(fn, args || [])); };

  // ── util ──
  function reportError(err, fail) {
    if (typeof fail === 'function') { try { fail(err); } catch (e) { console.error(e); } }
    else console.error('[API]', err && err.message ? err.message : err);
  }
  function safe(f, v) { if (typeof f === 'function') { try { f(v); } catch (e) { console.error(e); } } }

  function net(fn, args, retries, done, failed) {
    var url = String(window.GAS_API_URL || '').trim();
    if (!url || url.indexOf('PASTE_') === 0) return failed(new Error('GAS_API_URL belum diisi di config.js'));
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, RETRY[fn] ? T_FAST : T_SLOW);
    fetch(url, {
      method: 'POST',
      // text/plain = "simple request" -> tidak memicu preflight CORS (Apps Script tidak mendukung OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args, token: window.sessionToken || '' }),
      redirect: 'follow',
      signal: ctl ? ctl.signal : undefined
    })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        clearTimeout(timer);
        var j;
        try { j = JSON.parse(t); }
        catch (e) { throw new Error('Respons server bukan JSON. Cek deployment Web App (akses harus "Anyone").'); }
        if (j && j.ok) return done(j.data);
        var se = new Error((j && j.error) || 'Terjadi kesalahan di server.');
        se.server = true;                                  // galat dari server: jangan diulang
        throw se;
      })
      .catch(function (e) {
        clearTimeout(timer);
        if (e && e.server) return failed(e);
        if (e && e.name === 'AbortError') e = new Error('Server tidak merespons (timeout). Coba lagi.');
        if (retries > 0 && RETRY[fn]) return setTimeout(function () { net(fn, args, retries - 1, done, failed); }, 500);
        failed(e);
      });
  }

  function callRead(fn, args, ok, fail) {
    var key = keyOf(fn, args), g0 = gen, hit = getCached(key);
    var w = { ok: ok, fail: fail, hit: hit ? hit.s : null };
    if (hit) setTimeout(function () { try { safe(ok, JSON.parse(hit.s)); } catch (e) { w.hit = null; } }, 0);
    if (inflight[key]) { inflight[key].push(w); return; }
    inflight[key] = [w];
    net(fn, args, 1, function (data) {
      var s = JSON.stringify(data); if (s === undefined) s = 'null';
      if (gen === g0) putCached(key, s);
      var ws = inflight[key] || []; delete inflight[key];
      ws.forEach(function (x) { if (x.hit !== null && x.hit === s) return; safe(x.ok, JSON.parse(s)); });
    }, function (err) {
      var ws = inflight[key] || []; delete inflight[key];
      ws.forEach(function (x) {
        if (x.hit !== null) console.warn('[API] refresh gagal, memakai data tersimpan:', err && err.message);
        else reportError(err, x.fail);
      });
    });
  }

  function call(fn, args, ok, fail) {
    if (READ[fn]) return callRead(fn, args, ok, fail);
    if (fn === 'login') clearAll();                        // akun baru: jangan pakai cache akun lama
    net(fn, args, RETRY[fn] ? 1 : 0,
      function (d) { if (WRITE[fn]) clearAll(); safe(ok, d); },
      function (e) { if (WRITE[fn]) clearAll(); reportError(e, fail); });
  }

  // Muat data di latar belakang agar menu berikutnya terbuka seketika
  window.gasPrefetch = function (fn, args) {
    if (!READ[fn]) return;
    args = args || [];
    var hit = getCached(keyOf(fn, args));
    if (hit && Date.now() - hit.t < 60000) return;
    callRead(fn, args, function () {}, function () {});
  };

  function makeRunner(ok, fail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return makeRunner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return makeRunner(ok, f); };
        if (name === 'withUserObject')     return function () { return makeRunner(ok, fail); };
        if (typeof name !== 'string' || name === 'then') return undefined;
        return function () { call(name, Array.prototype.slice.call(arguments), ok, fail); };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = { run: makeRunner(null, null) };
})();
