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
      p.delivery ? delivery(p, p.delivery) : p.approvedAt ? certBox(p, null) : null,
      p.files.length ? h("div", { class: "ac-files", id: "acervo" }, h("p", { class: "ac-h3" }, "Acervo de materiais"), ...p.files.map((f) => h("a", { href: f.url }, f.name, h("span", {}, kb(f.size))))) : h("p", { class: "muted" }, "Os arquivos aparecem aqui assim que forem entregues."),
      h("div", { class: "ac-act" },
        h("a", { class: "btn dark", href: p.page }, p.status === "proposta" ? "Ver e aprovar a proposta" : "Abrir a proposta e pagamentos"),
        p.contractPdf ? h("a", { class: "btn", href: p.contractPdf }, "Baixar contrato") : null,
        h("a", { class: "btn", href: "https://wa.me/5538984120719", target: "_blank", rel: "noopener" }, "Falar no WhatsApp")));
  }

  const CERT_INFO = "Ao final do projeto você recebe o certificado de autoria e cessão de direitos: o documento que transfere para você, em definitivo, os direitos patrimoniais de uso das peças entregues (Lei nº 9.610/1998), com o código de integridade de cada arquivo. É ele que comprova que você pode usar, reproduzir e registrar o material.";
  const STATUS = { aguardando: "Aguardando sua aprovação", ajustes: "Alterações pedidas · em ajuste", aprovada: "Entrega aprovada" };

  function certBox(p, d) {
    const approved = d?.status === "aprovada", paid = p.total > 0 && p.paid >= p.total - 0.009;
    if (d?.certificate) return h("div", { class: "ac-cert" }, h("div", {}, h("small", {}, "Certificado de autoria e cessão de direitos"), h("br"), h("b", {}, d.certificate.code)), h("a", { class: "btn dark", href: d.certificate.url, target: "_blank", rel: "noopener" }, "Ver e baixar certificado"));
    return h("div", { class: "ac-certinfo" },
      h("p", { class: "ac-h3" }, "Certificado de cessão de direitos"),
      h("p", {}, CERT_INFO),
      h("ul", { class: "ac-check", "aria-label": "Para liberar o certificado" },
        h("li", { class: approved ? "ok" : "" }, approved ? "Entrega final aprovada" : "Aprovação da entrega final"),
        h("li", { class: paid ? "ok" : "" }, paid ? "Pagamento quitado" : `Quitação do pagamento${p.total ? ` · falta ${brl(Math.max(0, p.total - p.paid))}` : ""}`)),
      h("p", { class: "muted" }, "Com os dois itens concluídos, ele chega automaticamente no seu e-mail e fica disponível aqui."));
  }

  function respond(p, d, box) {
    const msg = h("p", { class: "ac-msg", role: "status" });
    const send = async (kind, message, btn) => {
      btn.disabled = true; const old = btn.textContent; btn.textContent = "Enviando…"; msg.className = "ac-msg";
      try {
        const r = await fetch("/api/acompanhar/entrega", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: token, slug: p.slug, kind, message }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Não foi possível enviar agora.");
        panel();
      } catch (x) { msg.textContent = x.message; msg.className = "ac-msg err"; btn.disabled = false; btn.textContent = old; }
    };
    const area = h("textarea", { class: "ac-in", id: `aj-${p.slug}`, rows: "4", placeholder: "Descreva o que precisa mudar: página, trecho, arquivo…" });
    const form = h("div", { class: "ac-resp-form", hidden: "" },
      h("label", { class: "ac-h3", for: `aj-${p.slug}` }, "O que precisa mudar?"), area,
      h("div", { class: "ac-act" }, h("button", { class: "btn dark", type: "button", onclick: (e) => { if (area.value.trim().length < 5) { msg.textContent = "Descreva o que precisa mudar."; msg.className = "ac-msg err"; area.focus(); return; } send("ajustes", area.value, e.currentTarget); } }, "Enviar pedido de alteração"),
        h("button", { class: "btn", type: "button", onclick: () => { form.hidden = true; choose.hidden = false; } }, "Voltar")));
    const confirm = h("div", { class: "ac-resp-form", hidden: "" },
      h("p", {}, `Confirmo que recebi e aprovo a entrega final${d.version > 1 ? ` (versão ${d.version})` : ""} de ${p.title}.`),
      h("div", { class: "ac-act" }, h("button", { class: "btn dark", type: "button", onclick: (e) => send("aprovar", "", e.currentTarget) }, "Sim, aprovar a entrega"),
        h("button", { class: "btn", type: "button", onclick: () => { confirm.hidden = true; choose.hidden = false; } }, "Voltar")));
    const choose = h("div", { class: "ac-act" },
      h("button", { class: "btn dark", type: "button", onclick: () => { choose.hidden = true; confirm.hidden = false; } }, "Aprovar entrega"),
      h("button", { class: "btn", type: "button", onclick: () => { choose.hidden = true; form.hidden = false; area.focus(); } }, "Pedir alterações"));
    box.append(h("div", { class: "ac-resp" }, h("p", { class: "ac-h3" }, "Sua resposta"), h("p", { class: "muted" }, "Confira tudo com calma. Se estiver tudo certo, aprove; se algo precisa mudar, descreva e eu envio uma nova versão."), choose, confirm, form, msg));
  }

  function delivery(p, d) {
    const last = (d.feedback || []).slice(-1)[0];
    const box = h("section", { class: "ac-del", id: "entrega", "aria-label": "Entrega final" },
      h("div", { class: "ac-top" }, h("div", {}, h("span", { class: "eyebrow" }, `Entrega final${d.version > 1 ? ` · versão ${d.version}` : ""} · ${dt(d.at)}`), h("h3", {}, "Seu projeto foi entregue")), h("span", { class: "ac-badge" + (d.status === "aprovada" ? " ok" : "") }, STATUS[d.status] || STATUS.aguardando)),
      d.note ? h("p", {}, d.note) : null,
      d.systemUrl || d.manual ? h("div", { class: "ac-links" },
        d.systemUrl ? h("a", { class: "ac-link", href: d.systemUrl, target: "_blank", rel: "noopener" }, h("b", {}, d.systemLabel || "Acessar o projeto"), h("small", {}, d.systemUrl.replace(/^https?:\/\//, ""))) : null,
        d.manual ? h("a", { class: "ac-link", href: d.manual.url }, h("b", {}, "Manual de uso"), h("small", {}, `${d.manual.name} · ${kb(d.manual.size)}`)) : null) : null,
      d.files?.length ? h("div", { class: "ac-files" }, h("p", { class: "ac-h3" }, "Arquivos da entrega"), ...d.files.map((f) => h("a", { href: f.url || "#" }, f.name, h("span", {}, kb(f.size))))) : null,
      d.status === "ajustes" && last?.message ? h("div", { class: "ac-k" }, h("small", {}, `Seu pedido de alteração · ${dt(last.at)}`), h("p", {}, last.message), h("small", {}, "Estou ajustando. A nova versão chega por e-mail para você aprovar.")) : null);
    if (d.status === "aguardando") respond(p, d, box);
    box.append(certBox(p, d),
      d.licenses?.length ? h("div", {}, h("p", { class: "ac-h3" }, "Licenças de terceiros"), h("ul", { class: "ac-list" }, ...d.licenses.map((x) => h("li", {}, x)))) : "",
      d.accesses?.length ? h("div", {}, h("p", { class: "ac-h3" }, "Acessos transferidos para você"), h("ul", { class: "ac-list" }, ...d.accesses.map((x) => h("li", {}, x)))) : "",
      d.support ? h("p", { class: "muted" }, h("b", {}, "Suporte pós-entrega: "), d.support) : "",
      h("div", {}, h("p", { class: "ac-h3" }, "Recomendações de segurança e conformidade"),
        h("ol", { class: "ac-recs" }, ...d.recommendations.map((r) => h("li", {}, h("b", {}, r.t), h("small", {}, r.d))))),
      d.files?.length ? h("details", {}, h("summary", { class: "muted" }, "Códigos de integridade dos arquivos (SHA-256)"), ...d.files.map((f) => h("p", { class: "ac-hash" }, `${f.name}: ${f.hash || "—"}`))) : "");
    return box;
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
