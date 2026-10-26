/* gustavoelian.com — dados do portfólio + página inicial.
   Fonte: data/projects.json (base) + /api/portfolio (o que é editado no Studio). Sem dependências. */
(() => {
  document.documentElement.classList.add("js");
  const WA = "5538984120719";
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  };
  const src = (p) => (/^(https?:)?\//.test(p) ? p : "/" + p);
  const media = (m) => (m?.key ? `/api/media/${m.key}` : "");
  const isVid = (m) => /^video\//.test(m?.type || "");

  /* vídeos só tocam quando aparecem na tela (economia de bateria e dados) */
  const vidIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting && !RM) v.play().catch(() => {}); else v.pause(); }), { rootMargin: "120px" }) : null;
  const watchVideo = (v) => { v.muted = true; v.playsInline = true; if (vidIO) vidIO.observe(v); return v; };
  const focusStyle = (m) => (m?.fx != null ? `object-position:${m.fx}% ${m.fy}%` + (m.z > 1 ? `;transform:scale(${m.z});transform-origin:${m.ox}% ${m.oy}%` : "") : null);
  const mediaEl = (m, alt, cls) => isVid(m)
    ? watchVideo(h("video", { class: cls, style: focusStyle(m), src: media(m), muted: true, loop: true, playsinline: true, preload: "metadata", "aria-label": alt || null }))
    : h("img", { class: cls, style: focusStyle(m), src: media(m), alt: alt || "", loading: "lazy", decoding: "async", width: m.w || null, height: m.h || null });
  const framed = (m, frame, alt) => h("figure", { class: `mk mk-${frame || "none"}` }, h("div", { class: "mk-screen" }, mediaEl(m, alt)));

  async function loadData() {
    const base = await fetch("/data/projects.json").then((r) => r.json());
    const ctl = "AbortController" in window ? new AbortController() : null;
    const t = setTimeout(() => ctl?.abort(), 3500);
    let srv = { order: [], items: {} };
    try { const r = await fetch("/api/portfolio", { signal: ctl?.signal }); if (r.ok) { const j = await r.json(); if (j && j.items) srv = j; } } catch {}
    clearTimeout(t);
    const mood = await fetch("/data/moodboard.json").then((r) => r.json()).catch(() => ({ tiles: [], covers: {} }));
    const pick = (e) => Object.fromEntries(["title", "kind", "client", "year", "summary", "url", "fronts", "section", "needs"].filter((k) => e?.[k] != null && e[k] !== "" && !(Array.isArray(e[k]) && !e[k].length)).map((k) => [k, e[k]]));
    const list = [];
    for (const p of base.projects) {
      if (p.draft) continue;
      const e = srv.items[p.id];
      if (e?.hidden) continue;
      list.push({ ...p, ...pick(e), pf: e || null });
    }
    for (const [id, e] of Object.entries(srv.items)) if (e?.custom && !e.hidden) list.push({ id, custom: true, fronts: ["web"], ...pick(e), pf: e });
    const pos = (id) => { const i = srv.order.indexOf(id); return i < 0 ? 1e4 : i; };
    const idx = new Map(list.map((p, i) => [p.id, i]));
    list.sort((a, b) => pos(a.id) - pos(b.id) || (srv.order.length ? 0 : (b.featured ? 1 : 0) - (a.featured ? 1 : 0)) || idx.get(a.id) - idx.get(b.id));
    for (const p of list) {
      const pf = p.pf;
      p.section = p.section === "list" ? "list" : "creative";
      p.topicOnly = p.section === "list" && pf?.topicOnly === true;
      p.hasPage = !p.topicOnly && !!(p.case || p.custom || (pf && (pf.banner || pf.gallery?.length || pf.metrics?.length || pf.feedback?.length)));
      p.href = p.hasPage ? `/projetos/${p.id}` : p.url || null;
      p.external = !p.hasPage && !!p.url;
      p.coverThumb = mood.covers?.[p.id] ? `/img/thumbs/${p.id}.webp` : p.cover ? src(p.cover) : null;
    }
    return { base, srv, list, mood };
  }
  window.GE = { h, src, media, mediaEl, framed, isVid, loadData, watchVideo, WA };

  /* ================= página inicial ================= */
  if (!document.getElementById("works")) return;
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const frontLabel = (data, id) => data.base.fronts.find((f) => f.id === id)?.label || id;
  const firstMetric = (p) => p.pf?.metrics?.[0]?.items?.[0] || null;

  function card(p, data) {
    let m;
    if (p.pf?.thumb) m = mediaEl(p.pf.thumb, `${p.title}: animação de capa`);
    else if (p.coverVideo) m = watchVideo(h("video", { src: src(p.coverVideo), poster: p.coverPoster ? src(p.coverPoster) : null, muted: true, loop: true, playsinline: true, preload: "none", "aria-label": `${p.title}: vinheta` }));
    else if (p.coverThumb) m = h("img", { src: p.coverThumb, alt: `${p.title}: ${p.kind || ""}`, loading: "lazy", decoding: "async", width: 960, height: 600 });
    else m = h("span", { class: "tcov", style: "display:grid;place-items:center;height:100%;font-size:2rem;font-weight:300;color:#9A9CA3" }, p.title);
    const met = firstMetric(p);
    const stat = met ? h("span", { class: "stat" }, h("b", {}, `${met.value}${met.unit ? " " + met.unit : ""}`), met.label)
      : p.external ? h("span", { class: "stat live" }, "No ar") : p.year ? h("span", { class: "stat" }, p.year) : h("span");
    return h("a", { class: "work rv", "data-id": p.id, href: p.href, ...(p.external ? { target: "_blank", rel: "noopener" } : {}), "data-fronts": (p.fronts || []).join(" "), "aria-label": `${p.title}${p.external ? " (abre o site do projeto)" : ""}` },
      h("div", { class: "media" }, m, p.hasPage ? h("span", { class: "tag" }, "Case completo") : null),
      h("div", { class: "body" },
        h("div", { class: "meta" }, h("span", {}, frontLabel(data, (p.fronts || [])[0])), (p.fronts || []).length > 1 ? h("i", {}, `+${p.fronts.length - 1}`) : null),
        h("h3", {}, p.title),
        h("p", {}, [p.kind, p.client].filter(Boolean).join(" · ") || p.summary || ""),
        h("div", { class: "foot" }, stat, h("span", { class: "arrow", "aria-hidden": "true", html: arrow }))));
  }
  const lockedCard = () => h("div", { class: "work locked rv", "data-fronts": "social" },
    h("div", { class: "media" }, h("span", { style: "font-size:.8125rem;letter-spacing:.12em;text-transform:uppercase;color:#9EA2AB" }, "Comunicação política · semiótica")),
    h("div", { class: "body" }, h("div", { class: "meta" }, h("span", {}, "Restrito no período eleitoral")), h("h3", {}, "Manifestos e narrativa política"),
      h("p", {}, "Peças e estratégia visual construídas a partir de análise semiótica, a mesma linha da pesquisa sobre projetos de país nas eleições de 2022."),
      h("div", { class: "foot" }, h("span", { class: "stat" }, "Sob consulta"), h("span", { class: "arrow", "aria-hidden": "true", html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' }))));

  /* moodboard: montado do zero no Studio (imagens, GIFs e vídeos curtos); tamanho fixo ou sorteado a cada visita */
  async function moodboard(data) {
    const box = document.getElementById("mood"), sec = document.getElementById("moodboard");
    const mb = await fetch("/api/moodboard").then((r) => (r.ok ? r.json() : { tiles: [] })).catch(() => ({ tiles: [] }));
    const tiles = (mb.tiles || []).slice(0, 60);
    sec.hidden = !tiles.length;
    document.querySelectorAll('a[href="#moodboard"]').forEach((a) => { (a.closest("li") || a).hidden = !tiles.length; });
    if (!tiles.length) { box.replaceChildren(); return; }
    const byId = new Map(data.list.map((p) => [p.id, p]));
    const auto = (t) => {
      const r = t.media.w && t.media.h ? t.media.w / t.media.h : 1, x = Math.random();
      if (r > 1.5) return x < 0.6 ? "wide" : "s";
      if (r < 0.75) return x < 0.6 ? "tall" : "s";
      return x < 0.14 ? "l" : x < 0.24 ? "wide" : "s";
    };
    box.replaceChildren(...tiles.map((t) => {
      const p = t.link ? byId.get(t.link) : null, href = p && (p.href || p.hasPage) ? p.href : null;
      const alt = t.alt || p?.title || "Referência do moodboard";
      return h(href ? "a" : "figure", { class: `tile ${t.size && t.size !== "auto" ? t.size : auto(t)}`, href, title: p?.title || null, ...(href && p.external ? { target: "_blank", rel: "noopener" } : {}) },
        mediaEl(t.media, alt));
    }));
  }

  /* interesses do visitante → projetos que respondem a cada um */
  const NEEDS = [
    { id: "reposicionar", label: "Tenho uma marca e quero reposicioná-la", ic: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>' },
    { id: "criar-marca", label: "Preciso criar uma marca", ic: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>' },
    { id: "site", label: "Preciso de um site", ic: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M7 21h10"/>' },
    { id: "sistema", label: "Preciso de um sistema funcional", ic: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7M17.5 14v7"/>' },
    { id: "tudo", label: "Preciso de tudo!", ic: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.8 2.8M16.2 16.2 19 19M5 19l2.8-2.8M16.2 7.8 19 5"/>' },
  ];
  const needsOf = (p) => {
    if (Array.isArray(p.needs) && p.needs.length) return p.needs;
    const t = `${p.kind || ""} ${p.title || ""}`, f = p.fronts || [], out = [];
    if (/rebrand|reposicion/i.test(t)) out.push("reposicionar");
    else if (f.includes("branding") || /marca|identidade/i.test(t)) out.push("criar-marca");
    if (/site|landing|loja|ecossistema|portal/i.test(t)) out.push("site");
    if (/sistema|app|aplicativo|gest[aã]o|painel|plataforma/i.test(t)) out.push("sistema");
    return out;
  };
  let setNeed = () => {};

  function interestPop(data) {
    const sec = document.getElementById("projetos");
    let seen = false; try { seen = sessionStorage.getItem("ge_need") === "1"; } catch {}
    const prev = { el: null };
    const close = () => { dlg.classList.remove("show"); document.body.classList.remove("need-on"); document.documentElement.classList.remove("need-lock"); document.removeEventListener("keydown", esc); setTimeout(() => (dlg.hidden = true), 250); prev.el?.focus?.(); try { sessionStorage.setItem("ge_need", "1"); } catch {} };
    const esc = (e) => { if (e.key === "Escape") close(); };
    const dlg = h("div", { class: "need", role: "dialog", "aria-modal": "true", "aria-labelledby": "need-h", hidden: true },
      h("div", { class: "need-card", tabindex: "-1" },
        h("button", { class: "need-x", type: "button", "aria-label": "Fechar", onclick: close, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg>' }),
        h("p", { class: "eyebrow" }, "Antes de rolar"),
        h("h2", { id: "need-h" }, "O que você está buscando?"),
        h("p", { class: "muted" }, "Toque numa opção e eu mostro os projetos que respondem a isso."),
        h("div", { class: "need-g" }, ...NEEDS.map((n) => h("button", { type: "button", class: "need-o", onclick: () => { setNeed(n.id); close(); document.getElementById("works").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }); } },
          h("span", { class: "need-ic", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${n.ic}</svg>` }), h("span", {}, n.label))))));
    document.body.append(dlg);
    const open = () => { prev.el = document.activeElement; dlg.hidden = false; document.body.classList.add("need-on"); document.documentElement.classList.add("need-lock"); requestAnimationFrame(() => dlg.classList.add("show")); document.addEventListener("keydown", esc); setTimeout(() => dlg.querySelector(".need-card")?.focus({ preventScroll: true }), 300); };
    document.getElementById("needAgain")?.addEventListener("click", open);
    if (seen || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); open(); } }, { threshold: 0.12 });
    io.observe(sec);
  }

  function works(data) {
    const box = document.getElementById("works"), filters = document.getElementById("filters");
    const creative = data.list.filter((p) => p.section === "creative");
    box.replaceChildren(...creative.map((p) => card(p, data)));
    const tabs = [{ id: "", label: "Todos" }, ...data.base.fronts];
    const set = (id) => {
      filters.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.f === id)));
      const nb = document.getElementById("needBar"); if (nb) nb.hidden = true;
      box.querySelectorAll(".work").forEach((c) => (c.hidden = !!id && !c.dataset.fronts.split(" ").includes(id)));
    };
    // filtro por interesse (pop-up)
    const bar = document.getElementById("needBar");
    setNeed = (id) => {
      filters.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", "false"));
      const n = NEEDS.find((x) => x.id === id);
      const match = (p) => id === "tudo" || needsOf(p).includes(id);
      let shown = 0;
      box.querySelectorAll(".work").forEach((c) => { const p = creative.find((x) => x.id === c.dataset.id); c.hidden = !p || !match(p); if (!c.hidden) shown++; });
      if (!shown) box.querySelectorAll(".work").forEach((c) => (c.hidden = false));
      bar.replaceChildren(h("span", {}, h("span", { class: "need-ic sm", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${n.ic}</svg>` }), n.label, h("b", {}, ` · ${shown || creative.length} projetos`)),
        h("button", { type: "button", onclick: () => set(""), "aria-label": "Limpar filtro" }, "Ver todos ✕"));
      bar.hidden = false;
    };
    filters.replaceChildren(...tabs.map((t) => {
      const n = t.id ? creative.filter((p) => (p.fronts || []).includes(t.id)).length : creative.length;
      if (t.id && !n) return null;
      const b = h("button", { type: "button", role: "tab", "data-f": t.id, onclick: () => set(t.id) }, t.label, h("span", {}, String(n)));
      return b;
    }).filter(Boolean));
    set("");
  }


  /* lista de experiência: view reduzida em tópicos; com página, com link externo ou só tópico */
  function experience(data) {
    const items = data.list.filter((p) => p.section === "list");
    const sec = document.getElementById("experiencia");
    if (!items.length) { sec.hidden = true; return; }
    const arrowSm = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
    document.getElementById("xp").replaceChildren(...items.map((p) => {
      const tag = p.hasPage ? "Ver case" : p.external ? "Ver no ar" : null;
      return h("li", { class: "rv" }, h(p.href ? "a" : "div", { class: "xp" + (p.href ? " link" : ""), href: p.href, ...(p.external ? { target: "_blank", rel: "noopener" } : {}) },
        h("span", { class: "y" }, p.year || ""),
        h("span", { class: "t" }, h("strong", {}, p.title), h("span", {}, [p.kind, p.client].filter(Boolean).join(" · "))),
        h("span", { class: "f" }, frontLabel(data, (p.fronts || [])[0])),
        tag ? h("span", { class: "go" }, h("span", { class: "sr" }, tag), h("span", { html: arrowSm })) : h("span", { class: "go off", "aria-hidden": "true" })));
    }));
    sec.hidden = false;
  }

  function numbers(data) {
    const items = data.list.flatMap((p) => (p.pf?.metrics || []).slice(0, 1).flatMap((s) => s.items.slice(0, 2).map((it) => ({ ...it, p }))));
    if (!items.length) return;
    document.getElementById("numbers").replaceChildren(...items.slice(0, 8).map((it) => h(it.p.href ? "a" : "div", { class: "num rv", href: it.p.href },
      h("span", { class: "v" }, it.value, it.unit ? h("small", {}, it.unit) : null), h("span", { class: "l" }, it.label),
      it.progress != null ? h("span", { class: "dots", "aria-hidden": "true" }, ...Array.from({ length: 20 }, (_, k) => h("i", { class: k < Math.round(it.progress / 5) ? "on" : "" }))) : null,
      h("span", { class: "p" }, it.p.title))));
    document.getElementById("numeros").hidden = false;
  }

  const CH = { whatsapp: "WhatsApp", email: "E-mail", instagram: "Instagram", reuniao: "Reunião", outro: "Mensagem" };
  const dateBR = (d) => (d ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : "");
  function quoteCard(f, p) {
    const dlg = f.print ? h("dialog", { class: "print", "aria-label": `Print da conversa com ${f.name}` }, h("img", { src: media(f.print), alt: `Print da conversa original com ${f.name}`, loading: "lazy" }), h("form", { method: "dialog" }, h("button", { class: "btn dark", type: "submit" }, "Fechar"))) : null;
    const ini = f.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return h("article", { class: "quote" },
      f.highlight ? h("p", { class: "big" }, `“${f.highlight}”`) : null,
      f.message ? h("div", { class: `bubble ${f.channel}` }, f.message, h("span", { class: "t" }, dateBR(f.date))) : null,
      h("span", { class: "channel" }, `Mensagem original via ${CH[f.channel] || "mensagem"}`),
      dlg ? h("button", { class: "print-btn", type: "button", onclick: () => dlg.showModal?.() }, "Ver print da conversa") : null, dlg,
      h("div", { class: "who" }, h("span", { class: "av", "aria-hidden": "true" }, f.avatar ? h("img", { src: media(f.avatar), alt: "", loading: "lazy" }) : ini),
        h("div", {}, h("strong", {}, f.name), h("span", {}, [f.role, p ? p.title : null].filter(Boolean).join(" · ")))));
  }
  function quotes(data) {
    const all = data.list.flatMap((p) => (p.pf?.feedback || []).map((f) => quoteCard(f, p)));
    if (!all.length) return;
    document.getElementById("quotes").replaceChildren(...all);
    document.getElementById("depoimentos").hidden = false;
  }

  function reveal() {
    const els = document.querySelectorAll(".rv:not(.in)");
    if (RM || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    els.forEach((e) => io.observe(e));
  }

  /* menu, barra fixa e vídeo do topo */
  const top = document.getElementById("top"), mb = document.getElementById("menuBtn");
  mb.addEventListener("click", () => { const o = top.classList.toggle("open"); mb.setAttribute("aria-expanded", String(o)); mb.textContent = o ? "Fechar" : "Menu"; });
  document.querySelectorAll("#menu a").forEach((a) => a.addEventListener("click", () => { top.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); mb.textContent = "Menu"; }));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && top.classList.contains("open")) mb.click(); });
  const hv = document.getElementById("ctaVideo");
  if (!RM && !navigator.connection?.saveData) watchVideo(hv);
  const dock = document.getElementById("dock");
  if ("IntersectionObserver" in window) {
    let pastHero = false, atContact = false;
    const upd = () => dock.classList.toggle("show", pastHero && !atContact);
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; upd(); }).observe(document.querySelector(".hero"));
    new IntersectionObserver(([e]) => { atContact = e.isIntersecting; upd(); }).observe(document.getElementById("contato"));
  }
  document.getElementById("y").textContent = new Date().getFullYear();

  /* Sobre: fotos em rolagem automática (troca a cada 4 s, pausa ao passar o mouse; sem animação para quem pediu menos movimento) */
  function aboutSlides(photos) {
    const fig = document.querySelector("#sobre .photo"), cap = document.getElementById("aboutCap");
    if (!fig) return;
    const imgs = photos.map((p, i) => { const el = mediaEl(p.media, p.caption || "Gustavo Elian em apresentação"); el.classList.add("sl"); if (i === 0) el.classList.add("on"); if (el.tagName === "IMG") { el.loading = i ? "lazy" : "eager"; el.decoding = "async"; } return el; });
    let i = 0, t = null;
    const dots = photos.length > 1 ? h("div", { class: "sl-dots", role: "tablist", "aria-label": "Fotos" }, ...photos.map((p, k) => h("button", { type: "button", role: "tab", "aria-label": p.caption || `Foto ${k + 1}`, "aria-selected": String(k === 0), onclick: () => { go(k); stop(); } }))) : null;
    const go = (k) => { imgs[i].classList.remove("on"); i = (k + imgs.length) % imgs.length; imgs[i].classList.add("on"); if (cap) cap.textContent = photos[i].caption || ""; dots && [...dots.children].forEach((d, n) => d.setAttribute("aria-selected", String(n === i))); };
    const stop = () => { clearInterval(t); t = null; };
    const play = () => { if (!t && imgs.length > 1 && !RM) t = setInterval(() => go(i + 1), 4000); };
    fig.querySelector("img")?.remove();
    fig.prepend(...imgs); if (dots) fig.append(dots);
    if (cap) cap.textContent = photos[0].caption || "";
    fig.addEventListener("mouseenter", stop); fig.addEventListener("mouseleave", play);
    play();
  }

  /* Sobre e Trajetória editáveis no Studio (o HTML já traz a versão padrão) */
  fetch("/api/site-content").then((r) => (r.ok ? r.json() : null)).then((c) => {
    if (!c) return;
    const hh = c.hero || {};
    const setT = (id, v) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };
    setT("heroTitle", hh.title); setT("heroHand", hh.hand); setT("heroLead", hh.lead);
    if (hh.sub) document.getElementById("heroSub").replaceChildren(hh.sub);
    (hh.cards || []).forEach((cd, i) => {
      const el = document.querySelector(`.datum.d${i + 1}`); if (!el || !cd.title) return;
      const isNext = el.classList.contains("next");
      const k = isNext && /^doutorado$/i.test(cd.k || "") ? "Processo seletivo do Doutorado" : cd.k;
      const inner = [h("small", {}, k), h("b", {}, cd.title), cd.sub ? h("small", {}, cd.sub) : null];
      if (el.classList.contains("next")) { el.querySelector("span").replaceChildren(...inner.filter(Boolean)); el.setAttribute("aria-label", ["Aprovado", k, cd.title, cd.sub].filter(Boolean).join(", ")); }
      else el.replaceChildren(...inner.filter(Boolean));
    });
    const svc = document.querySelectorAll("#services .svc");
    (c.services || []).forEach((x, i) => { if (!svc[i]) return; svc[i].querySelector("h3").textContent = x.title; svc[i].querySelector("p").textContent = x.text; });
    if (!c.about) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };
    set("sobre-h", c.about.title); set("aboutYears", c.about.years); set("aboutYearsLabel", c.about.yearsLabel); set("aboutCap", c.about.caption);
    if (c.about.photos?.length) aboutSlides(c.about.photos);
    if (c.about.text?.length) document.getElementById("aboutText").replaceChildren(...c.about.text.map((t) => h("p", {}, t)));
    if (c.trail?.length) document.getElementById("trail").replaceChildren(...c.trail.map((t) => h("div", { class: "it rv in" }, t.k ? h("small", {}, t.k) : null, h("h3", {}, t.title), t.text ? h("p", {}, t.text) : null)));
  }).catch(() => {});
  loadData().then((data) => { works(data); interestPop(data); experience(data); moodboard(data); numbers(data); quotes(data); reveal(); })
    .catch(() => { document.getElementById("works").replaceChildren(h("p", { class: "muted" }, "Não foi possível carregar os projetos. Atualize a página.")); reveal(); });
  reveal();
})();
