/* Acesso reservado: segurar o logo por 2 s abre o Studio. Nenhum sinal visível para visitantes. */
(function () {
  var HOLD = 2000;
  document.querySelectorAll("a.logo").forEach(function (el) {
    var t = null, fired = false, x = 0, y = 0, anim = null;
    el.style.webkitTouchCallout = "none"; el.style.webkitUserSelect = "none"; el.style.userSelect = "none";
    function stop() { clearTimeout(t); t = null; if (anim) { anim.cancel(); anim = null; } }
    el.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return; fired = false; x = e.clientX; y = e.clientY;
      if (el.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) anim = el.animate([{ opacity: 1 }, { opacity: 0.55 }], { duration: HOLD, easing: "ease-in", fill: "forwards" });
      t = setTimeout(function () { fired = true; stop(); try { navigator.vibrate && navigator.vibrate(12); } catch (_) {} location.href = "/app/"; }, HOLD);
    });
    el.addEventListener("pointermove", function (e) { if (t && (Math.abs(e.clientX - x) > 12 || Math.abs(e.clientY - y) > 12)) stop(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { el.addEventListener(n, stop); });
    el.addEventListener("contextmenu", function (e) { if (t || fired) e.preventDefault(); });
    el.addEventListener("click", function (e) { if (fired) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  });
})();
