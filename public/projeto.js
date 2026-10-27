// Página de case: gustavoelian.com/projetos/<id>, montada a partir de data/projects.json
const root = document.getElementById("case");
const id = new URLSearchParams(location.search).get("id") || location.pathname.replace(/^\/projetos\/?/, "").replace(/\/$/, "");
const WA = "5538984120719";
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const src = (p) => "/" + p.replace(/^\//, "");
const paras = (t) => (Array.isArray(t) ? t : [t]).map((x) => h("p", { class: "soft" }, x));

// Perfil do Instagram incorporado (grade de posts + cabeçalho do perfil). Aceita @perfil ou o link.
function igProfile(v, title) {
  const user = String(v).trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9_.]{1,30}$/.test(user)) return null;
  return h("figure", { class: "img ig-prof", style: "margin:0" },
    h("iframe", { src: `https://www.instagram.com/${user}/embed/`, title: `Perfil @${user} no Instagram`, loading: "lazy", allowtransparency: "true", scrolling: "no" }),
    h("a", { class: "ig-prof-link", href: `https://www.instagram.com/${user}/`, target: "_blank", rel: "noopener" }, `Ver @${user} no Instagram ↗`));
}
const R = {
  // publicações do Instagram dentro do case (mesmo bloco do Studio, posicionado entre as seções)
  insta(s) { return PF.insta({ insta: s.items || [], instaTitle: s.title, instaCredit: s.credit, instaKicker: s.kicker, instaLead: s.lead }); },
  hero(s, p, data) {
    const front = data.fronts.find((f) => f.id === p.fronts[0]);
    return h("section", { class: "blk hero on-panel" }, h("div", { class: "blob" }),
      h("div", { class: "wrap" },
        h("div", { class: "copy" },
          h("a", { class: "back", href: "/#projetos" }, "← Todos os projetos"),
          h("span", { class: "eyebrow" }, s.kicker || front?.label),
          h("h1", {}, s.title || p.title),
          h("p", { class: "lead" }, s.lead || p.summary),
          s.chips ? h("div", { class: "chips" }, ...s.chips.map((c) => h("span", { class: "chip" }, c))) : null),
        // bloco único 4:5 (1200 × 1500 px): imagem, PNG transparente, GIF ou vídeo, com recorte e foco definidos no Studio
        h("div", { class: `media hb${s.blockFit === "contain" ? " contain" : ""}` }, (() => {
          const file = s.block || s.image || p.cover, alt = s.blockAlt || `${p.title}: imagem principal`;
          const zz = String(s.blockZoom || "").split(" "), style = [s.blockPos ? `object-position:${s.blockPos}` : "", zz[0] > 1 ? `transform:scale(${zz[0]});transform-origin:${zz[1]} ${zz[2]}` : ""].filter(Boolean).join(";") || null;
          return /\.(mp4|webm)$/i.test(file) || /video/.test(s.blockType || "")
            ? h("video", { src: src(file), muted: "", loop: "", autoplay: "", playsinline: "", "aria-label": alt, style })
            : h("img", { src: src(file), alt, fetchpriority: "high", style });
        })())));
  },
  split(s) {
    return h("section", { class: `blk split reveal${s.panel ? " panel on-panel" : ""}${s.reverse ? " reverse" : ""}${s.wide ? " wide" : ""}` },
      h("div", { class: "wrap" },
        h("div", { class: "text" }, h("span", { class: "eyebrow" }, s.eyebrow), h("h2", {}, s.title), ...paras(s.text)),
        s.profile ? igProfile(s.profile, s.title) : s.image ? h("figure", { class: "img", style: "margin:0" }, h("img", { src: src(s.image), alt: s.title })) : null));
  },
  cards(s) {
    return h("section", { class: "blk cards reveal" }, h("div", { class: "wrap" },
      h("div", { class: "head" }, h("span", { class: "eyebrow" }, s.eyebrow), h("h2", {}, s.title)),
      h("div", { class: "grid" }, ...s.items.map((c) => h(c.url ? "a" : "article", { class: `card${c.tall ? " tall" : ""}`, ...(c.url ? { href: c.url, target: "_blank", rel: "noopener" } : {}) },
        c.image ? h("div", { class: "ci" }, h("img", { src: src(c.image), alt: c.title, loading: "lazy" })) : null,
        h("div", { class: "cb" }, h("small", {}, c.kind), h("h3", {}, c.title), h("p", {}, c.text), c.url ? h("span", { class: "go" }, "Ver no ar ↗") : null))))));
  },
  steps(s) {
    const isPhone = /(\/m0|-m)\.jpg$/.test(s.image || "");
    return h("section", { class: `blk steps reveal${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" },
      s.insta ? h("figure", { class: "img ig", style: "margin:0" }, PF.insta({ insta: [{ url: s.insta }] }).querySelector(".pf-ig")) :
      s.image ? h("figure", { class: `img${isPhone ? " phone" : ""}`, style: "margin:0" }, h("img", { src: src(s.image), alt: s.title })) : h("div"),
      h("div", {}, h("span", { class: "eyebrow" }, s.eyebrow), h("h2", {}, s.title),
        h("ol", {}, ...s.items.map((it, i) => h("li", {}, h("b", {}, String(i + 1).padStart(2, "0")), h("strong", {}, it.t), h("span", { class: "soft" }, it.d)))))));
  },
  strip(s) {
    const rail = h("div", { class: "rail", tabindex: "0", "aria-label": s.title }, ...s.images.map((im, i) => h("figure", {}, h("img", { src: src(im), alt: `${s.title} ${i + 1}`, loading: "lazy" }))));
    // arrastar com o mouse
    let down = false, x0 = 0, s0 = 0;
    rail.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; x0 = e.clientX; s0 = rail.scrollLeft; rail.style.scrollSnapType = "none"; });
    addEventListener("pointerup", () => { if (down) { down = false; rail.style.scrollSnapType = ""; } });
    rail.addEventListener("pointermove", (e) => { if (down) rail.scrollLeft = s0 - (e.clientX - x0); });
    const step = (d) => rail.scrollBy({ left: d * rail.clientWidth * 0.7, behavior: "smooth" });
    return h("section", { class: "blk strip reveal" }, h("div", { class: "wrap" }, h("h2", {}, s.title)), rail,
      h("div", { class: "rail-nav" }, h("button", { type: "button", "aria-label": "Anterior", onclick: () => step(-1) }, "←"), h("button", { type: "button", "aria-label": "Próximo", onclick: () => step(1) }, "→")));
  },
  credits(s) {
    return h("section", { class: "credits" }, h("span", { class: "eyebrow" }, "Créditos"), ...s.items.map((c) => h("p", {}, c)));
  },
};

window.CaseFX?.extend(R, h, src, { back: "/#projetos" });

/* ===== blocos alimentados pelo Studio ===== */
const GE = window.GE;
const CH = { whatsapp: "WhatsApp", email: "E-mail", instagram: "Instagram", reuniao: "Reunião", outro: "Mensagem" };
const dateBR = (d) => (d ? new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : "");
const PF = {
  banner(pf, p) {
    if (!pf?.banner) return null;
    const fig = GE.framed(pf.banner, pf.bannerFrame || "laptop", pf.bannerAlt || `${p.title}: interface`);
    const stage = pf.bannerBg ? h("div", { class: "pf-stage" + (pf.bannerPad === false ? " flush" : ""), style: `background:${pf.bannerBg}` }, fig) : fig;
    return h("section", { class: "pf-blk pf-banner" }, h("div", { class: "wrap" }, stage));
  },
  metrics(pf) {
    if (!pf?.metrics?.length) return null;
    return h("section", { class: "pf-blk gray" }, h("div", { class: "wrap" },
      h("div", { class: "pf-head" }, h("span", { class: "eyebrow" }, "Números"), h("h2", {}, "O que o projeto entregou")),
      ...pf.metrics.map((s) => h("div", { class: "pf-sec" },
        h("div", { class: "pf-sec-t" }, h("h3", {}, s.title || "Resultados"), s.note ? h("p", {}, s.note) : null),
        h("div", { class: "pf-nums" }, ...s.items.map((it) => h("div", { class: "pf-num" },
          h("span", { class: "v" }, it.value, it.unit ? h("small", {}, it.unit) : null), h("span", { class: "l" }, it.label),
          it.progress != null ? h("span", { class: "pf-dots", "aria-hidden": "true" }, ...Array.from({ length: 20 }, (_, k) => h("i", { class: k < Math.round(it.progress / 5) ? "on" : "" }))) : null,
          it.note ? h("span", { class: "n" }, it.note) : null)))))));
  },
  gallery(pf, p) {
    if (!pf?.gallery?.length) return null;
    return h("section", { class: "pf-blk" }, h("div", { class: "wrap" },
      h("div", { class: "pf-head" }, h("span", { class: "eyebrow" }, "Galeria"), h("h2", {}, "Moodboard do projeto")),
      h("div", { class: "pf-mood" }, ...pf.gallery.map((g) => {
        const fr = g.frame && g.frame !== "none";
        return h("figure", { class: `pf-tile ${g.size || "s"}${fr ? " framed" : ""}`, style: g.bg ? `background:${g.bg}` : null }, fr ? GE.framed(g.media, g.frame, g.caption || p.title) : GE.mediaEl(g.media, g.caption || p.title), g.caption ? h("figcaption", {}, g.caption) : null);
      }))));
  },
  feedback(pf) {
    if (!pf?.feedback?.length) return null;
    return h("section", { class: "pf-blk" }, h("div", { class: "wrap" },
      h("div", { class: "pf-head" }, h("span", { class: "eyebrow" }, "Cliente"), h("h2", {}, "Nas palavras de quem contratou")),
      h("div", { class: "pf-quotes" }, ...pf.feedback.map((f) => {
        const dlg = f.print ? h("dialog", { class: "pf-dlg", "aria-label": `Print da conversa com ${f.name}` }, h("img", { src: GE.media(f.print), alt: `Print da conversa original com ${f.name}`, loading: "lazy" }), h("form", { method: "dialog" }, h("button", { class: "btn", type: "submit" }, "Fechar"))) : null;
        return h("article", { class: "pf-quote" },
          f.highlight ? h("p", { class: "big" }, `“${f.highlight}”`) : null,
          f.message ? h("div", { class: `pf-bubble ${f.channel}` }, f.message, h("span", { class: "t" }, dateBR(f.date))) : null,
          h("span", { class: "pf-ch" }, `Mensagem original via ${CH[f.channel] || "mensagem"}`),
          dlg ? h("button", { class: "pf-print", type: "button", onclick: () => dlg.showModal?.() }, "Ver print da conversa") : null, dlg,
          h("div", { class: "pf-who" }, h("span", { class: "pf-av", "aria-hidden": "true" }, f.avatar ? h("img", { src: GE.media(f.avatar), alt: "" }) : f.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()),
            h("div", {}, h("strong", {}, f.name), f.role ? h("span", {}, f.role) : null)));
      }))));
  },
  // publicações do Instagram com o embed oficial; o script do Instagram só carrega quando o bloco chega perto da tela
  insta(pf) {
    if (!pf?.insta?.length) return null;
    const list = h("div", { class: `pf-ig n${pf.insta.length === 4 ? 2 : Math.min(pf.insta.length, 3)}` }, ...pf.insta.map((it) => h("figure", { class: "pf-ig-it" },
      h("blockquote", { class: "instagram-media", "data-instgrm-permalink": `${it.url}?utm_source=ig_embed`, "data-instgrm-version": "14" },
        h("a", { class: "pf-ig-fb", href: it.url, target: "_blank", rel: "noopener" }, h("span", { class: "pf-ig-logo", "aria-hidden": "true" }), h("span", {}, /\/reel\//.test(it.url) ? "Ver reel no Instagram" : "Ver publicação no Instagram"))),
      it.caption ? h("figcaption", {}, it.caption) : null)));
    const sec = h("section", { class: "pf-blk" }, h("div", { class: "wrap" },
      h("div", { class: "pf-head" }, h("span", { class: "eyebrow" }, pf.instaKicker || "Instagram"), h("h2", {}, pf.instaTitle || "Publicado nas redes"), pf.instaLead ? h("p", { class: "soft", style: "max-width:40em;margin-top:8px" }, pf.instaLead) : null),
      list, h("p", { class: "pf-ig-note soft" }, "Toque no vídeo para assistir com som.", pf.instaCredit ? h("small", { class: "pf-ig-credit" }, pf.instaCredit) : null)));
    const load = () => {
      if (window.instgrm) return window.instgrm.Embeds.process();
      if (document.getElementById("ig-embed")) return;
      const sc = document.createElement("script"); sc.id = "ig-embed"; sc.async = true; sc.src = "https://www.instagram.com/embed.js";
      document.body.appendChild(sc);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "600px 0px" });
      requestAnimationFrame(() => io.observe(list));
    } else load();
    return sec;
  },
  simpleHero(p, data) {
    const fronts = (p.fronts || []).map((id) => data.base.fronts.find((f) => f.id === id)?.label).filter(Boolean);
    return h("section", { class: "pf-hero" }, h("div", { class: "wrap" },
      h("a", { class: "back", href: "/#projetos" }, "← Todos os projetos"),
      h("h1", {}, p.title),
      h("p", { class: "lead" }, p.summary || [p.kind, p.client].filter(Boolean).join(" · ")),
      h("div", { class: "row" }, ...fronts.map((f) => h("span", { class: "pf-chip" }, f)), p.year ? h("span", { class: "pf-chip" }, p.year) : null,
        p.url ? h("a", { class: "btn small", href: p.url, target: "_blank", rel: "noopener" }, "Ver no ar ↗") : null),
      !p.pf?.banner && p.pf?.thumb ? h("div", { class: "thumb" }, GE.mediaEl(p.pf.thumb, p.title)) : null));
  },
};

async function main() {
  const data = await GE.loadData();
  const p = data.list.find((x) => x.id === id);
  if (!p || !p.hasPage) {
    if (p?.url) { location.replace(p.url); return; }
    document.title = "Projeto não encontrado · Gustavo Elian";
    root.replaceChildren(h("section", { class: "blk" }, h("div", { class: "wrap", style: "text-align:center" }, h("h1", { style: "font-size:3rem" }, "Projeto não encontrado"), h("p", { class: "soft", style: "margin:16px 0 24px" }, "Veja todos os trabalhos no portfólio."), h("a", { class: "btn", href: "/#projetos" }, "Ver portfólio"))));
    return;
  }
  const t = p.theme || {};
  for (const [k, v] of Object.entries(t)) document.documentElement.style.setProperty("--" + k, v);
  document.documentElement.style.setProperty("--bg", "#FFFFFF");
  document.title = `${p.title} · Gustavo Elian`;
  document.querySelector('meta[name="description"]').content = p.summary || p.kind || "Case do portfólio de Gustavo Elian.";
  const msg = encodeURIComponent(`Olá, Gustavo! Vi o case ${p.title} e quero orçar um projeto parecido.`);
  document.getElementById("topCta").href = `https://wa.me/${WA}?text=${msg}`;

  const pf = p.pf;
  // página editada no Studio substitui a do arquivo base
  const EDIT = new URLSearchParams(location.search).has("editar");
  const edited = await fetch(`/api/portfolio/${encodeURIComponent(p.id)}/page${EDIT ? `?fresh=${Date.now()}` : ""}`, EDIT ? { cache: "no-store" } : {}).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // vale a versão mais recente: a editada no Studio ou a do arquivo base (quando o base foi atualizado depois)
  const baseNewer = p.updatedAt && edited?.updatedAt && p.updatedAt > edited.updatedAt;
  let src_ = edited?.sections?.length && !baseNewer ? edited.sections : p.sections || [];
  // editor visual: rascunho não salvo tem prioridade e todas as seções aparecem (as ocultas, esmaecidas)
  let draft = null;
  if (EDIT) { try { draft = JSON.parse(sessionStorage.getItem(`ge_draft_${p.id}`) || "null"); } catch {} if (draft?.sections) src_ = draft.sections; }
  const sections = src_.map((s, i) => ({ s, i })).filter(({ s }) => EDIT || !s.hidden).map(({ s, i }) => {
    let el = null; try { el = R[s.type]?.(s, p, data.base); } catch (x) { console.error(x); }
    if (EDIT) { el = el || h("section", { class: "blk", style: "padding:48px 0;text-align:center;opacity:.6" }, `Seção "${s.type}" sem visualização`); el.dataset.si = String(i); if (s.hidden) el.classList.add("ed-hidden"); }
    return el;
  }).filter(Boolean);
  const head = sections.length ? sections.shift() : PF.simpleHero(p, data);
  const blocks = [head, PF.banner(pf, p), PF.metrics(pf), ...sections, PF.gallery(pf, p), PF.insta(pf?.insta?.length ? pf : p), PF.feedback(pf)].filter(Boolean);
  blocks.push(
    h("section", { class: "blk cta on-panel" }, h("div", { class: "wrap" },
      h("span", { class: "eyebrow" }, "Vamos conversar"),
      h("h2", {}, "Quer um projeto como este?"),
      h("p", { class: "soft", style: "max-width:34em" }, "Conte o que você precisa. Eu monto a proposta com escopo, prazo e investimento."),
      h("div", { class: "row" }, h("a", { class: "btn accent", href: `https://wa.me/${WA}?text=${msg}`, target: "_blank", rel: "noopener" }, "Pedir orçamento no WhatsApp"), h("a", { class: "btn ghost", href: "/#projetos" }, "Ver outros projetos")))));
  root.replaceChildren(...blocks.filter(Boolean));
  window.CaseFX?.run(root);
  if (EDIT) {
    window.__GE_EDIT = { id: p.id, title: p.title, sections: JSON.parse(JSON.stringify(src_)), base: JSON.parse(JSON.stringify(p.sections || [])), saved: JSON.parse(JSON.stringify(edited?.sections?.length && !baseNewer ? edited.sections : p.sections || [])), fromBase: !edited?.sections?.length || !!baseNewer, dirty: !!draft };
    const sc = document.createElement("script"); sc.src = "/editor-canvas.js?v=1"; document.body.append(sc);
  }
}
main().catch((e) => { console.error(e); root.replaceChildren(h("p", { class: "loading" }, "Não foi possível carregar o projeto. Atualize a página.")); });
