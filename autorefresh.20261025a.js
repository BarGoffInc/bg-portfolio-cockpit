// Auto-refresh: every 3 min and whenever the tab comes back into view,
// check book.json (bypassing cache). If a newer book was published, re-render.
(function () {
  var known = null;
  var busy = false;
  function url() { return "book.json?_=" + Date.now(); }
  async function check() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      var res = await fetch(url(), { cache: "no-store" });
      if (!res.ok) return;
      var b = await res.json();
      var stamp = b.as_of || "";
      if (known === null) { known = (window.__BOOK__ && window.__BOOK__.as_of) || stamp; }
      if (stamp && stamp !== known) {
        known = stamp;
        if (typeof window.hardRefresh === "function") await window.hardRefresh();
        else location.reload();
      }
    } catch (e) { console.warn("autorefresh", e); }
    finally { busy = false; }
  }
  setTimeout(check, 15000);
  setInterval(check, 180000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
})();
