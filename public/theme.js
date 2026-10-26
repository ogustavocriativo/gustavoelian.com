// Alterna versão clara/escura e lembra a escolha neste navegador.
(function () {
  var root = document.documentElement;
  function sync(b) {
    var dark = root.classList.contains("dark");
    b.setAttribute("aria-pressed", String(dark));
    b.setAttribute("title", dark ? "Versão escura ativa" : "Versão clara ativa");
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = dark ? "#0A0A0B" : "#FFFFFF";
  }
  document.querySelectorAll(".theme-sw").forEach(function (b) {
    sync(b);
    b.addEventListener("click", function () {
      var dark = root.classList.toggle("dark");
      try { localStorage.setItem("ge_tema", dark ? "escuro" : "claro"); } catch (e) {}
      document.querySelectorAll(".theme-sw").forEach(sync);
    });
  });
})();
