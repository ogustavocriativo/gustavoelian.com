// Página de case: gustavoelian.com/projetos/<id>, montada a partir de data/projects.json
const root = document.getElementById("case");
const id = location.pathname.replace(/^\/projetos\/?/, "").replace(/\/$/, "");
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

const R = {
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
        h("div", { class: "media" },
          h("div", { class: "shot" }, h("img", { src: src(s.image || p.cover), alt: `${p.title}: imagem principal`, fetchpriority: "high" })),
          s.phone ? h("div", { class: "phone" }, h("img", { src: src(s.phone), alt: `${p.title} no celular` })) : null)));
  },
  split(s) {
    return h("section", { class: `blk split reveal${s.panel ? " panel on-panel" : ""}${s.reverse ? " reverse" : ""}${s.wide ? " wide" : ""}` },
      h("div", { class: "wrap" },
        h("div", { class: "text" }, h("span", { class: "eyebrow" }, s.eyebrow), h("h2", {}, s.title), ...paras(s.text)),
        s.image ? h("figure", { class: "img", style: "margin:0" }, h("img", { src: src(s.image), alt: s.title })) : null));
  },
  cards(s) {
    return h("section", { class: "blk cards reveal" }, h("div", { class: "wrap" },
      h("div", { class: "head" }, h("span", { class: "eyebrow" }, s.eyebrow), h("h2", {}, s.title)),
      h("div", { class: "grid" }, ...s.items.map((c) => h(c.url ? "a" : "article", { class: `card${c.tall ? " tall" : ""}`, ...(c.url ? { href: c.url, target: "_blank", rel: "noopener" } : {}) },
        c.image ? h("div", { class: "ci" }, h("img", { src: src(c.image), alt: c.title, loading: "lazy" })) : null,
        h("div", { class: "cb" }, h("small", {}, c.kind), h("h3", {}, c.title), h("p", {}, c.text), c.url ? h("span", { class: "go" }, "Ver no ar ↗") : null))))));
  },
  steps(s) {
    const isPhone = /\/m0\.jpg$/.test(s.image || "");
    return h("section", { class: `blk steps reveal${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" },
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

async function main() {
  const data = await fetch("/data/projects.json").then((r) => r.json());
  const cases = data.projects.filter((p) => p.case);
  const p = cases.find((x) => x.id === id);
  if (!p) {
    document.title = "Projeto não encontrado · Gustavo Elian";
    root.replaceChildren(h("section", { class: "blk" }, h("div", { class: "wrap", style: "text-align:center" }, h("h1", { style: "font-size:3rem" }, "Projeto não encontrado"), h("p", { class: "soft", style: "margin:16px 0 24px" }, "Veja todos os trabalhos no portfólio."), h("a", { class: "btn", href: "/#projetos" }, "Ver portfólio"))));
    return;
  }
  const t = p.theme || {};
  for (const [k, v] of Object.entries(t)) document.documentElement.style.setProperty("--" + k, v);
  document.title = `${p.title} · Gustavo Elian`;
  document.querySelector('meta[name="description"]').content = p.summary;
  const msg = encodeURIComponent(`Olá, Gustavo! Vi o case ${p.title} e quero orçar um projeto parecido.`);
  document.getElementById("topCta").href = `https://wa.me/${WA}?text=${msg}`;

  const blocks = (p.sections || []).map((s) => R[s.type]?.(s, p, data)).filter(Boolean);
  const i = cases.indexOf(p), nx = cases[(i + 1) % cases.length];
  blocks.push(
    h("section", { class: "blk cta on-panel" }, h("div", { class: "wrap" },
      h("span", { class: "eyebrow" }, "Vamos conversar"),
      h("h2", {}, "Quer um projeto como este?"),
      h("p", { class: "soft", style: "max-width:34em" }, "Conte o que você precisa. Eu monto a proposta com escopo, prazo e investimento."),
      h("div", { class: "row" }, h("a", { class: "btn accent", href: `https://wa.me/${WA}?text=${msg}`, target: "_blank", rel: "noopener" }, "Pedir orçamento no WhatsApp"), h("a", { class: "btn ghost", href: "/#projetos" }, "Ver outros projetos")))),
    h("div", { class: "wrap next" }, h("span", { class: "eyebrow" }, "Próximo case"), h("a", { href: `/projetos/${nx.id}` }, h("strong", {}, `${nx.title} →`))));
  root.replaceChildren(...blocks);
}
main().catch(() => root.replaceChildren(h("p", { class: "loading" }, "Não foi possível carregar o projeto. Atualize a página.")));
