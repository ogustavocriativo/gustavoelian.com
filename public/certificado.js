/* Verificação pública do certificado de autoria e cessão de direitos. */
(() => {
  const box = document.getElementById("cert");
  const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (v == null || v === false) continue; if (x.startsWith("on")) e.addEventListener(x.slice(2), v); else if (x === "class") e.className = v; else e.setAttribute(x, v); } k.flat().forEach((c) => c != null && c !== false && e.append(c.nodeType ? c : String(c))); return e; };
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const code = (new URLSearchParams(location.search).get("c") || "").trim().toUpperCase();

  function ask(msg) {
    const inp = h("input", { class: "ac-in", id: "cc", placeholder: "XXXX-XXXX", value: code, autocomplete: "off", style: "text-transform:uppercase" });
    box.replaceChildren(h("section", { class: "cert-doc" },
      h("span", { class: "eyebrow" }, "Verificação"), h("h1", {}, "Verificar certificado"),
      msg ? h("p", { class: "cert-ok bad", role: "alert" }, msg) : h("p", { class: "muted" }, "Digite o código impresso no certificado."),
      h("form", { class: "cert-act", onsubmit: (e) => { e.preventDefault(); location.search = "?c=" + encodeURIComponent(inp.value.trim()); } },
        h("label", { class: "sr", for: "cc" }, "Código"), inp, h("button", { class: "btn dark", type: "submit" }, "Verificar"))));
  }

  async function load() {
    try {
      const r = await fetch(`/api/certificado/${encodeURIComponent(code)}`);
      const d = await r.json();
      if (!r.ok) return ask(d.error || "Certificado não encontrado.");
      const when = new Date(d.at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" });
      document.title = `Certificado ${d.code} · Gustavo Elian`;
      box.replaceChildren(h("article", { class: "cert-doc" },
        h("p", { class: "cert-ok" + (d.valid ? "" : " bad"), role: "status" }, d.valid ? "✓ Certificado autêntico e íntegro" : "Atenção: os dados deste certificado não conferem"),
        h("span", { class: "eyebrow" }, `Certificado nº ${d.code}`),
        h("h1", {}, "Certificado de autoria e cessão de direitos patrimoniais"),
        h("p", {}, d.text),
        h("dl", { class: "cert-kv" },
          h("dt", {}, "Autor"), h("dd", {}, `${d.issuer.name} · ${d.issuer.doc}`),
          h("dt", {}, "Cessionário"), h("dd", {}, [d.holder.name, d.holder.company, d.holder.doc].filter(Boolean).join(" · ")),
          h("dt", {}, "Projeto"), h("dd", {}, d.project),
          d.items.length ? [h("dt", {}, "Obras"), h("dd", {}, d.items.join("; "))] : null,
          h("dt", {}, "Emitido em"), h("dd", {}, when)),
        d.files.length ? h("div", { class: "cert-files" }, h("p", { class: "ac-h3" }, "Arquivos entregues e códigos de integridade (SHA-256)"),
          ...d.files.map((f) => h("div", {}, h("b", {}, f.name), " ", h("small", { class: "muted" }, kb(f.size)), h("p", { class: "cert-mono" }, f.hash || "—")))) : null,
        h("p", { class: "cert-mono" }, `Código de integridade do certificado: ${d.hash}`),
        h("div", { class: "cert-sign" }, h("span", {}, d.issuer.name, h("br"), h("small", { class: "muted" }, "Autor e cedente")), h("span", {}, `Verificável em ${location.origin}/certificado?c=${d.code}`)),
        h("div", { class: "cert-act" }, h("button", { class: "btn dark", type: "button", onclick: () => print() }, "Salvar em PDF ou imprimir"))));
    } catch { ask("Não foi possível verificar agora. Tente de novo."); }
  }
  code ? load() : ask();
})();
