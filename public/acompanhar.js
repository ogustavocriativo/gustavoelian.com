/* Painel "Acompanhar": login por e-mail (link mágico) e visão do projeto para o cliente. */
(() => {
  const box = document.getElementById("ac");
  const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (v == null || v === false) continue; if (x.startsWith("on")) e.addEventListener(x.slice(2), v); else if (x === "class") e.className = v; else e.setAttribute(x, v); } k.flat().forEach((c) => c != null && c !== false && e.append(c.nodeType ? c : String(c))); return e; };
  const brl = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = (d) => (d ? new Date(d.length === 10 ? d + "T12:00" : d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : "");
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const token = new URLSearchParams(location.search).get("t");
  // atalho vindo do contrato (#acervo): lembra o destino mesmo se o login passar pelo e-mail
  try { if (location.hash) sessionStorage.setItem("ge_ac_go", location.hash.slice(1)); } catch {}

  function login(msg) {
    const inp = h("input", { class: "ac-in", type: "email", id: "acEmail", autocomplete: "email", required: "", placeholder: "seu@email.com", "aria-describedby": "acMsg" });
    const out = h("p", { class: "ac-msg" + (msg ? " err" : ""), id: "acMsg", role: "status" }, msg || "Use o e-mail que você cadastrou na proposta ou no contrato.");
    const btn = h("button", { class: "btn dark", type: "submit" }, "Receber link de acesso");
    box.replaceChildren(h("section", { class: "ac-login" },
      h("span", { class: "eyebrow" }, "Área do cliente"),
      h("h1", {}, "Acompanhe o seu projeto"),
      h("p", { class: "muted" }, "Veja a etapa atual, os prazos, os pagamentos e os arquivos entregues. Enviamos um link de acesso para o seu e-mail."),
      h("form", { onsubmit: async (e) => {
        e.preventDefault(); btn.disabled = true; btn.textContent = "Enviando…"; out.className = "ac-msg";
        try {
          const r = await fetch("/api/acompanhar/entrar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: inp.value }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || "Não foi possível enviar agora.");
          out.textContent = `Se ${inp.value} estiver cadastrado, o link chega em instantes. Confira também o spam.`;
        } catch (x) { out.textContent = x.message; out.className = "ac-msg err"; }
        btn.disabled = false; btn.textContent = "Receber link de acesso";
      } }, h("label", { class: "sr", for: "acEmail" }, "E-mail"), inp, btn, out)));
  }

  function project(p) {
    const ix = p.stages.findIndex((s) => s.id === p.status);
    const at = Object.fromEntries((p.history || []).map((x) => [x.stage, x.at]));
    const pct = p.total ? Math.min(100, Math.round((p.paid / p.total) * 100)) : 0;
    return h("article", { class: "ac-proj" },
      h("div", { class: "ac-top" }, h("div", {}, h("span", { class: "eyebrow" }, p.company || "Projeto"), h("h2", {}, p.title)), h("span", { class: "ac-badge" }, p.statusLabel)),
      p.status !== "proposta" ? h("ol", { class: "ac-steps", "aria-label": "Etapas do projeto" }, ...p.stages.map((s, i) => h("li", { class: i < ix ? "done" : i === ix ? "now" : "", "aria-current": i === ix ? "step" : null }, h("span", {}, s.label, at[s.id] || (i === 0 && p.approvedAt) ? h("small", {}, dt(at[s.id] || p.approvedAt)) : null)))) : null,
      h("div", { class: "ac-grid" },
        p.dueDate ? h("div", { class: "ac-k" }, h("small", {}, "Previsão de entrega"), h("b", {}, dt(p.dueDate))) : null,
        p.total ? h("div", { class: "ac-k" }, h("small", {}, "Pago"), h("b", {}, brl(p.paid)), h("small", {}, `de ${brl(p.total)}`), h("div", { class: "ac-bar", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Pagamento" }, h("i", { style: `width:${pct}%` }))) : null,
        p.approvedAt ? h("div", { class: "ac-k" }, h("small", {}, "Contrato assinado"), h("b", {}, dt(p.approvedAt))) : null),
      p.delivery ? delivery(p.delivery) : null,
      p.files.length ? h("div", { class: "ac-files", id: "acervo" }, h("p", { class: "ac-h3" }, "Acervo de materiais"), ...p.files.map((f) => h("a", { href: f.url }, f.name, h("span", {}, kb(f.size))))) : h("p", { class: "muted" }, "Os arquivos aparecem aqui assim que forem entregues."),
      h("div", { class: "ac-act" },
        h("a", { class: "btn dark", href: p.page }, p.status === "proposta" ? "Ver e aprovar a proposta" : "Abrir a proposta e pagamentos"),
        p.contractPdf ? h("a", { class: "btn", href: p.contractPdf }, "Baixar contrato") : null,
        h("a", { class: "btn", href: "https://wa.me/5538984120719", target: "_blank", rel: "noopener" }, "Falar no WhatsApp")));
  }

  function delivery(d) {
    const byName = Object.fromEntries((d.files || []).map((f) => [f.name, f.hash]));
    return h("section", { class: "ac-del", "aria-label": "Entrega final" },
      h("span", { class: "eyebrow" }, `Entrega final · ${dt(d.at)}`),
      h("h3", {}, "Seu projeto foi entregue"),
      d.certificate
        ? h("div", { class: "ac-cert" }, h("div", {}, h("small", {}, "Certificado de autoria e cessão de direitos"), h("br"), h("b", {}, d.certificate.code)), h("a", { class: "btn dark", href: d.certificate.url, target: "_blank", rel: "noopener" }, "Ver e baixar certificado"))
        : h("p", { class: "muted" }, "O certificado de cessão de direitos é emitido assim que o pagamento for quitado."),
      d.licenses?.length ? h("div", {}, h("p", { class: "ac-h3" }, "Licenças de terceiros"), h("ul", { class: "ac-list" }, ...d.licenses.map((x) => h("li", {}, x)))) : null,
      d.accesses?.length ? h("div", {}, h("p", { class: "ac-h3" }, "Acessos transferidos para você"), h("ul", { class: "ac-list" }, ...d.accesses.map((x) => h("li", {}, x)))) : null,
      d.support ? h("p", { class: "muted" }, h("b", {}, "Suporte pós-entrega: "), d.support) : null,
      h("div", {}, h("p", { class: "ac-h3" }, "Recomendações de segurança e conformidade"),
        h("ol", { class: "ac-recs" }, ...d.recommendations.map((r) => h("li", {}, h("b", {}, r.t), h("small", {}, r.d))))),
      d.files?.length ? h("details", {}, h("summary", { class: "muted" }, "Códigos de integridade dos arquivos (SHA-256)"), ...d.files.map((f) => h("p", { class: "ac-hash" }, `${f.name}: ${f.hash || "—"}`))) : null);
  }

  async function panel() {
    box.replaceChildren(h("p", { class: "muted" }, "Carregando seu painel…"));
    try {
      const r = await fetch(`/api/acompanhar?t=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok) return login(d.error || "Link expirado. Peça um novo acesso.");
      history.replaceState(null, "", "/acompanhar");
      try { sessionStorage.setItem("ge_ac", token); } catch {}
      box.replaceChildren(
        h("div", { class: "ac-head" }, h("div", {}, h("span", { class: "eyebrow" }, "Área do cliente"), h("h1", {}, d.name ? `Olá, ${d.name.split(" ")[0]}.` : "Seus projetos")), h("span", { class: "muted" }, d.email)),
        ...(d.projects.length ? d.projects.map(project) : [h("p", { class: "muted" }, "Nenhum projeto ligado a este e-mail ainda.")]),
        h("section", { class: "sec", style: "padding-bottom:0" }, h("div", { class: "sec-head" }, h("span", { class: "eyebrow" }, "Acervo"), h("h2", {}, "Trabalhos realizados"), h("p", {}, "Conheça outros projetos que já saíram do papel.")), h("a", { class: "btn dark", href: "/#projetos" }, "Ver o portfólio")));
      try { const go = sessionStorage.getItem("ge_ac_go"); if (go) { sessionStorage.removeItem("ge_ac_go"); document.getElementById(go)?.scrollIntoView({ behavior: "smooth", block: "start" }); } } catch {}
    } catch { login("Não foi possível carregar agora. Tente de novo."); }
  }

  let saved = null; try { saved = sessionStorage.getItem("ge_ac"); } catch {}
  if (token) panel(); else if (saved) { history.replaceState(null, "", "/acompanhar?t=" + saved); location.reload(); } else login();
})();
