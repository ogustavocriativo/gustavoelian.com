/* Currículo acadêmico (/academico): perfil fixo, abas, seções que abrem e fecham, projetos em destaque,
   apresentações com visualizador de slides, publicações e vídeos. Dados: /api/academico (editados no Studio). */
(() => {
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--")) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => c != null && c !== false && c !== "" && el.append(c.nodeType ? c : String(c)));
    return el;
  };
  const svg = (d, extra = "") => { const s = document.createElement("span"); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`; return s.firstChild; };
  const I = {
    chev: '<path d="m6 9 6 6 6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.9 7.6-4.4M8.2 13.1l7.6 4.4"/>',
    id: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M8.5 7v10"/>', orcid: '<circle cx="12" cy="12" r="9"/><path d="M9 8v8M12 8h1.5a4 4 0 0 1 0 8H12z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    dl: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>', expand: '<path d="m6 9 6 6 6-6"/>',
  };
  const logo = (name, h_ = 0) => h("span", { class: "lg", role: "img", "aria-label": { unimontes: "Unimontes", ppgh: "PPGH Unimontes", uerj: "UERJ", fcs: "FCS UERJ", ppgcom: "PPGCom UERJ", alcar: "Alcar" }[name] || name, style: { "--m": `url(/img/academico/logos/${name}.png)`, aspectRatio: { unimontes: "294/159", ppgh: "689/68", uerj: "360/412", fcs: "684/704", ppgcom: "704/570", alcar: "619/237" }[name] || "1", ...(h_ ? { height: h_ + "px" } : {}) } });
  const mediaUrl = (m) => (m?.key ? `/api/media/${m.key}` : "");
  const coverOf = (it) => mediaUrl(it.coverMedia) || it.cover || "";
  const SECS = [
    ["formacao", "Formação"], ["projeto", "Projetos e eventos"], ["apresentacao", "Apresentações"], ["minicurso", "Minicursos"],
    ["publicacao", "Publicações"], ["docencia", "Docência e bancas"], ["video", "Vídeos e lives"],
  ];
  const STAT = { publicacao: "publicações", apresentacao: "apresentações", projeto: "projetos e eventos", minicurso: "minicursos" };

  // menu do celular (o mesmo comportamento do site)
  const top = document.getElementById("top"), mb = document.getElementById("menuBtn");
  mb?.addEventListener("click", () => { const o = !top.classList.contains("open"); top.classList.toggle("open", o); mb.setAttribute("aria-expanded", String(o)); });
  document.getElementById("y") && (document.getElementById("y").textContent = new Date().getFullYear());

  let toastT;
  const toast = (msg) => { let t = document.getElementById("acvToast"); if (!t) { t = h("div", { id: "acvToast", role: "status", style: { position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)", zIndex: 120, padding: "12px 18px", borderRadius: "999px", background: "var(--ink)", color: "var(--bg)", fontSize: "var(--t-sm)", fontWeight: 500 } }); document.body.append(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400); };
  const copy = async (txt, ok) => { try { await navigator.clipboard.writeText(txt); toast(ok); } catch { toast(txt); } };

  /* ---------- perfil ---------- */
  function profile(d, heroPhoto) {
    const p = d.profile, items = d.items.filter((i) => !i.hidden);
    const count = (t) => items.filter((i) => i.type === t).length;
    const photo = mediaUrl(p.photo) || heroPhoto;
    const card = h("div", { class: "acv-card" },
      h("div", { class: "acv-av" }, h("div", { class: "idbg", "aria-hidden": "true" }, h("i", { class: "ib1" }), h("i", { class: "ib2" }), h("i", { class: "ib3" }), h("span", { class: "idmark" }), h("span", { class: "idgrain" })),
        photo ? h("img", { src: photo, alt: p.name, width: 176, height: 176, decoding: "async" }) : null),
      h("h1", { class: "acv-name" }, p.name, h("button", { class: "acv-share", type: "button", "aria-label": "Compartilhar o currículo", onclick: async () => { const url = location.origin + "/academico"; if (navigator.share) { try { await navigator.share({ title: `${p.name} · Currículo acadêmico`, url }); } catch {} } else copy(url, "Link copiado"); } }, svg(I.share))),
      h("ul", { class: "acv-status" }, ...p.status.map((s) => h("li", {}, s.logo ? logo(s.logo) : h("span"), h("div", {}, h("small", {}, s.label), h("span", {}, s.org))))),
      h("ul", { class: "acv-rows" },
        p.lattesId ? h("li", {}, svg(I.id), h("a", { class: "grow", href: `https://lattes.cnpq.br/${p.lattesId}`, target: "_blank", rel: "noopener" }, `LattesID ${p.lattesId}`), h("button", { class: "acv-copy", type: "button", "aria-label": "Copiar o LattesID", onclick: () => copy(p.lattesId, "LattesID copiado") }, svg(I.copy))) : null,
        p.orcid ? h("li", {}, svg(I.orcid), h("a", { class: "grow", href: `https://orcid.org/${p.orcid}`, target: "_blank", rel: "noopener" }, `ORCID ${p.orcid}`), h("button", { class: "acv-copy", type: "button", "aria-label": "Copiar o ORCID", onclick: () => copy(p.orcid, "ORCID copiado") }, svg(I.copy))) : null,
        p.email ? h("li", {}, svg(I.mail), h("a", { class: "grow", href: `mailto:${p.email}` }, p.email)) : null),
      h("div", { class: "acv-stats", "aria-label": "Indicadores da produção" },
        ...Object.entries(STAT).filter(([t]) => count(t)).map(([t, l]) => h("a", { href: `#sec-${t}`, onclick: (e) => { e.preventDefault(); go(t); } }, h("b", {}, String(count(t))), h("span", {}, l)))),
      d.updatedAt ? h("p", { class: "acv-upd" }, svg(I.clock), "Atualizado em ", h("b", {}, new Date(d.updatedAt).toLocaleDateString("pt-BR"))) : null);
    document.getElementById("perfil").replaceChildren(card);
  }

  /* ---------- peças ---------- */
  function projCard(it) {
    const c = coverOf(it);
    const inner = [
      h("div", { class: "cv" }, c ? h("img", { src: c, alt: "", loading: "lazy", decoding: "async" }) : null, it.year ? h("span", { class: "yr" }, it.year) : null),
      h("div", { class: "bd" },
        it.role ? h("span", { class: "role" }, it.role) : null,
        h("h3", {}, it.title), it.event ? h("span", { class: "ev" }, it.event) : null,
        it.stats?.length ? h("div", { class: "acv-nums" }, ...it.stats.map((s) => h("div", {}, h("b", {}, s.n), h("span", {}, s.l)))) : null,
        it.summary ? h("p", {}, it.summary) : null,
        it.chips?.length ? h("div", { class: "acv-chips" }, ...it.chips.map((c2) => h("span", {}, c2))) : null,
        it.link ? h("span", { class: "acv-more" }, it.linkLabel || "Saiba mais", svg(I.arrow)) : null),
    ];
    return it.link ? h("a", { class: "acv-proj", href: it.link, ...(/^https?:/.test(it.link) ? { target: "_blank", rel: "noopener" } : {}) }, ...inner) : h("article", { class: "acv-proj" }, ...inner);
  }
  function rowItem(it) {
    const c = coverOf(it);
    const hasSlides = it.slides || it.slidesUrl;
    const acts = [
      hasSlides ? h("button", { class: "acv-btn", type: "button", onclick: () => openSlides(it) }, svg(I.slides), "Ver slides") : null,
      !hasSlides && c && it.type === "apresentacao" ? h("button", { class: "acv-btn ghost", type: "button", onclick: () => openSlides(it, c) }, svg(I.slides), "Ver capa") : null,
      it.link ? h("a", { class: "acv-btn ghost", href: it.link, ...(/^https?:/.test(it.link) ? { target: "_blank", rel: "noopener" } : {}) }, it.linkLabel || (it.type === "publicacao" ? "Ler" : "Abrir"), svg(/^https?:/.test(it.link) ? I.ext : I.arrow)) : null,
      it.video ? h("a", { class: "acv-btn ghost", href: it.video, target: "_blank", rel: "noopener" }, "Assistir", svg(I.ext)) : null,
    ].filter(Boolean);
    return h("li", { class: "acv-it" },
      c ? h("div", { class: "th" }, h("img", { src: c, alt: "", loading: "lazy", decoding: "async" })) : h("div", { class: "th yrbox", "aria-hidden": "true" }, (it.year || "").slice(2) ? "’" + it.year.slice(2) : "•"),
      h("div", {},
        h("h3", {}, it.title),
        it.event ? h("div", { class: "ev" }, it.event) : null,
        it.summary ? h("p", {}, it.summary) : null,
        h("div", { class: "meta" },
          it.status ? h("span", { class: "acv-pill ok" }, it.status) : null,
          ...(it.chips || []).map((c2) => h("span", { class: "acv-pill" }, c2)),
          it.role ? h("span", { class: "acv-pill" }, it.role) : null,
          it.date ? h("span", { class: "acv-pill" }, it.date) : null)),
      acts.length ? h("div", { class: "act" }, ...acts) : null);
  }
  const ytId = (u) => (String(u).match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([\w-]{11})/) || [])[1];
  function videoCard(it) {
    const id = ytId(it.video);
    const box = h("article", { class: "acv-vid" });
    const play = id ? h("button", { class: "yt", type: "button", "aria-label": `Assistir: ${it.title}`, style: { backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }, onclick: () => play.replaceWith(h("iframe", { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, title: it.title, allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true })) }) : null;
    box.append(play || "", h("div", { class: "bd" }, h("h3", {}, it.title), h("div", { class: "ev" }, [it.event, it.date || it.year].filter(Boolean).join(" · "))));
    return box;
  }
  const byYear = (list) => { const g = {}; list.forEach((i) => (g[i.year || "Outros"] ||= []).push(i)); return Object.entries(g).sort((a, b) => (a[0] === "Outros") - (b[0] === "Outros") || (b[0] > a[0] ? 1 : -1)); };

  /* ---------- visualizador de slides ---------- */
  const viewer = document.getElementById("viewer");
  let lastFocus = null;
  function embedOf(u) {
    const g = String(u).match(/docs\.google\.com\/presentation\/d\/([\w-]+)/); if (g) return `https://docs.google.com/presentation/d/${g[1]}/embed?start=false&loop=false`;
    if (/canva\.com\/design\//.test(u)) return u.replace(/\/(edit|view)(\?.*)?$/, "/view?embed");
    return u;
  }
  function openSlides(it, img) {
    lastFocus = document.activeElement;
    const pdf = mediaUrl(it.slides);
    const src = img ? "" : it.slidesUrl ? embedOf(it.slidesUrl) : pdf;
    const close = () => { viewer.hidden = true; viewer.replaceChildren(); document.body.style.overflow = ""; lastFocus?.focus(); };
    const xbtn = h("button", { class: "x", type: "button", "aria-label": "Fechar", onclick: close }, svg(I.x));
    viewer.replaceChildren(
      h("div", { class: "bar" }, h("b", {}, it.title), pdf ? h("a", { class: "acv-btn", href: pdf, download: (it.slides?.name || "slides.pdf") }, svg(I.dl), "Baixar PDF") : null, xbtn),
      h("div", { class: "stage" }, img ? h("img", { src: img, alt: it.title }) : h("iframe", { src, title: `Slides: ${it.title}`, allow: "fullscreen", allowfullscreen: true })));
    viewer.hidden = false; document.body.style.overflow = "hidden"; xbtn.focus();
    viewer.onkeydown = (e) => { if (e.key === "Escape") close(); };
    viewer.onclick = (e) => { if (e.target === viewer) close(); };
  }

  /* ---------- currículo ---------- */
  let go = () => {};
  function cv(d) {
    const items = d.items.filter((i) => !i.hidden);
    const of = (t) => items.filter((i) => i.type === t).sort((a, b) => (b.featured - a.featured) || ((b.year || "") > (a.year || "") ? 1 : -1));
    const p = d.profile;
    const secs = SECS.filter(([t]) => (t === "formacao" ? d.formacao.length : of(t).length));
    const tabs = [["bio", "Biografia"], ...secs];
    const sc = h("div", { class: "sc", role: "tablist", "aria-label": "Seções do currículo" });
    const tabBtns = tabs.map(([t, l]) => h("button", { class: "acv-tab", type: "button", "data-t": t, onclick: () => go(t) }, l));
    sc.append(...tabBtns);
    const allBtn = h("button", { class: "acv-all", type: "button", "aria-pressed": "true", onclick: () => { const open = allBtn.getAttribute("aria-pressed") !== "true"; document.querySelectorAll(".acv-sec").forEach((x) => (x.open = open)); allBtn.setAttribute("aria-pressed", String(open)); allBtn.querySelector(".lbl").textContent = open ? "Recolher todas as seções" : "Expandir todas as seções"; } }, svg(I.expand), h("span", { class: "lbl" }, "Recolher todas as seções"));
    const bar = h("div", { class: "acv-tabs" },
      h("button", { class: "acv-arrow", type: "button", "aria-label": "Abas anteriores", onclick: () => sc.scrollBy({ left: -240 }) }, svg(I.left)), sc,
      h("button", { class: "acv-arrow", type: "button", "aria-label": "Próximas abas", onclick: () => sc.scrollBy({ left: 240 }) }, svg(I.right)), allBtn);

    const bio = h("section", { class: "acv-bio", id: "sec-bio", "aria-labelledby": "bio-h" },
      h("span", { class: "eyebrow" }, "Currículo acadêmico"), h("h2", { id: "bio-h", style: { marginTop: "10px" } }, "Biografia"),
      h("p", {}, p.bio),
      p.lines.length ? h("div", { class: "acv-lines", "aria-label": "Linhas de pesquisa" }, ...p.lines.map((l) => h("span", { class: "acv-pill" }, l))) : null,
      p.citation ? h("div", { class: "acv-cite" }, h("b", {}, "Nome em citações bibliográficas"), p.citation) : null);

    const sec = (t, title, body, n) => h("details", { class: "acv-sec", id: `sec-${t}`, open: true }, h("summary", {}, h("span", { class: "chev", "aria-hidden": "true" }, svg(I.chev)), h("h2", {}, title), n ? h("span", { class: "n" }, n) : null), h("div", { class: "acv-body" }, body));
    const blocks = secs.map(([t, l]) => {
      if (t === "formacao") return sec(t, "Formação acadêmica", h("ol", { class: "acv-tl" }, ...d.formacao.map((f) => h("li", {},
        h("span", { class: "yrs" }, f.years), h("h3", {}, f.level), h("div", { class: "org" }, f.org), f.note ? h("p", { class: "note" }, f.note) : null,
        f.thesis ? h("div", { class: "thesis" }, h("small", {}, /Doutorado/.test(f.level) ? "Projeto de tese" : /Mestrado/.test(f.level) ? "Dissertação" : "Trabalho de conclusão"), f.thesis) : null,
        f.logos.length ? h("div", { class: "logos" }, ...f.logos.map((x) => logo(x, 34))) : null))));
      const list = of(t);
      const n = `${list.length} ${list.length === 1 ? "item" : "itens"}`;
      if (t === "projeto") return sec(t, l, h("div", { class: "acv-feat" }, ...list.map(projCard)), n);
      if (t === "video") return sec(t, l, h("div", { class: "acv-vids" }, ...list.map(videoCard)), n);
      return sec(t, l, h("div", {}, ...byYear(list).flatMap(([y, g]) => [h("p", { class: "acv-year" }, y), h("ul", { class: "acv-list" }, ...g.map(rowItem))])), n);
    });
    document.getElementById("cv").replaceChildren(bar, bio, ...blocks);

    go = (t) => { const el = document.getElementById(`sec-${t}`); if (!el) return; if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); history.replaceState(null, "", `#${t}`); };
    // aba ativa conforme a rolagem
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const t = e.target.id.replace("sec-", ""); tabBtns.forEach((b) => b.setAttribute("aria-current", String(b.dataset.t === t))); tabBtns.find((b) => b.dataset.t === t)?.scrollIntoView({ block: "nearest", inline: "nearest" }); } }), { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll(".acv-bio,.acv-sec").forEach((x) => io.observe(x));
    const start = location.hash.slice(1); if (start && document.getElementById(`sec-${start}`)) setTimeout(() => go(start), 60);
  }

  Promise.all([fetch("/api/academico").then((r) => r.json()), fetch("/api/site-content").then((r) => r.json()).catch(() => null)])
    .then(([d, site]) => { const k = site?.hero?.photo?.key; profile(d, k ? `/api/media/${k}` : "/img/hero-recorte.webp"); cv(d); })
    .catch(() => { document.getElementById("cv").replaceChildren(h("p", { class: "acv-loading" }, "Não consegui carregar o currículo agora. Tente de novo em instantes.")); });
})();
