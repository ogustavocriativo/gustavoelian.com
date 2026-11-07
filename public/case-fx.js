/* Seções ilustradas e animadas dos cases (usado pelo site e pela versão editável).
   CaseFX.extend(R, h, src, opts) adiciona os tipos de seção; CaseFX.run(root) liga as animações. */
window.CaseFX = (() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const STRIPE = ["#8A402D", "#D59C37", "#2C1E14", "#1F7A45", "#E6C66E", "#22385A"];

  function extend(R, h, src, opts = {}) {
    const back = opts.back || "/#projetos";
    const arr = (t) => (t == null ? [] : Array.isArray(t) ? t : [t]);
    // Cabeçalho padrão: eyebrow + título + parágrafos (proximidade: um bloco de leitura só)
    const head = (s) => h("div", { class: "fx-head" },
      s.eyebrow ? h("span", { class: "eyebrow" }, s.eyebrow) : null,
      s.title ? h("h2", {}, s.title) : null,
      ...arr(s.text).map((t) => h("p", { class: "soft" }, t)));
    const tileImg = (t) => (typeof t === "string" ? { img: t, alt: "" } : t);

    // Faixa de blocos de cor em movimento contínuo (assinatura visual do topo)
    const stripes = (colors = STRIPE) => {
      const set = () => colors.concat(colors).map((c) => h("span", { style: `background:${c}` }));
      return h("div", { class: "stripes", "aria-hidden": "true" }, h("div", { class: "run" }, ...set(), ...set()));
    };

    /* Painel: composição em grade de blocos de cor chapada (estilo prancha ilustrada).
       Cada bloco: area, bg, fg, img (+ fit "contain" | "bleed", w, x, y, anim), text, photo, pattern, stripes, tag */
    const quote = (rows) => arr(rows).map((r) => `"${r}"`).join(" ");
    const keyToggle = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.classList.toggle("on"); } };
    const block = (b, i) => {
      const st = [`grid-area:${b.area}`, `--bg:${b.bg || "transparent"}`, `--fg:${b.fg || "#fff"}`, `--i:${i}`];
      if (b.pattern) st.push(`--pat:url("${src(b.pattern)}")`, `--pat-size:${b.patSize || "160px"}`);
      const art = b.img ? h("div", {
        class: `bk-art ${b.fit || "contain"}${b.anim ? " a-" + b.anim : ""}${b.round ? " round" : ""}`,
        style: b.fit === "bleed" ? `left:${b.x ?? 0}%;top:${b.y ?? 0}%;width:${b.w ?? 100}%` : `--w:${b.w ?? 72}%`,
        ...(b.par ? { "data-par": String(b.par) } : {}),
      }, /\.(mp4|webm)$/i.test(b.img)
        ? h("video", { src: src(b.img), poster: b.poster ? src(b.poster) : null, muted: "", loop: "", autoplay: "", playsinline: "", preload: "metadata", "aria-label": b.alt || "Vídeo", style: b.pos ? `object-position:${b.pos}` : null })
        : h("img", { src: src(b.img), alt: b.alt || "", loading: b.eager ? null : "lazy", style: b.pos ? `object-position:${b.pos}` : null })) : null;
      const t = b.text;
      const txt = t ? h("div", { class: `bk-text ${t.size || "m"} ${t.align || "end"}` },
        t.back ? h("a", { class: "bk-back", href: back }, "← Todos os projetos") : null,
        t.eyebrow ? h("span", { class: "eyebrow" }, t.eyebrow) : null,
        t.title ? h(t.h1 ? "h1" : "h2", {}, t.title) : null,
        ...arr(t.body).map((p) => h("p", {}, p)),
        t.chips ? h("div", { class: "chips" }, ...t.chips.map((c) => h("span", { class: "chip" }, c))) : null,
        t.seal ? h("img", { class: "bk-seal", src: src(t.seal), alt: t.sealAlt || "" }) : null,
        t.link ? h("a", { class: "btn bk-btn", href: t.link.href, target: "_blank", rel: "noopener" }, t.link.label) : null) : null;
      const photoAttrs = b.photo ? { tabindex: "0", role: "button", "aria-label": `${b.alt || b.tag || "Bloco"}: alternar para a foto do produto`,
        onclick: (e) => e.currentTarget.classList.toggle("on"), onkeydown: keyToggle } : {};
      return h("div", { class: `bk${b.photo ? " has-photo" : ""}${b.pattern ? " pat" : ""}`, style: st.join(";"), "data-fx": "", ...photoAttrs },
        b.stripes ? stripes(b.stripes === true ? undefined : b.stripes) : null,
        art,
        b.photo ? h("img", { class: "bk-photo", src: src(b.photo), alt: "", loading: "lazy" }) : null,
        txt,
        b.tag ? h("span", { class: "bk-tag" }, b.tag) : null);
    };
    R.board = (s) => h("section", { class: "blk board" },
      s.title || s.eyebrow || s.text ? h("div", { class: "wrap bd-head" }, head(s)) : null,
      h("div", { class: "bd", style: [
        `--cols:${s.cols || "repeat(4,1fr)"}`, `--rows:${s.rows || "auto"}`, `--areas:${quote(s.areas)}`,
        `--m-cols:${s.mcols || (s.mareas ? `repeat(${String(s.mareas[0]).trim().split(/\s+/).length},1fr)` : s.cols || "1fr 1fr")}`, `--m-rows:${s.mrows || s.rows || "auto"}`, `--m-areas:${quote(s.mareas || s.areas)}`,
      ].join(";") }, ...s.blocks.map(block)));

    R.illHero = (s) => h("section", { class: "blk ihero" },
      stripes(s.stripe),
      h("div", { class: "wrap ih-grid" },
        h("div", { class: "ih-copy" },
          h("a", { class: "back", href: back }, "← Todos os projetos"),
          s.kicker ? h("span", { class: "eyebrow" }, s.kicker) : null,
          h("h1", {}, s.title),
          s.lead ? h("p", { class: "lead" }, s.lead) : null,
          s.chips ? h("div", { class: "chips" }, ...s.chips.map((c) => h("span", { class: "chip" }, c))) : null,
          s.seal ? h("img", { class: "ih-seal", src: src(s.seal), alt: s.sealAlt || "Selo da marca", fetchpriority: "high" }) : null),
        h("div", { class: "ih-art" },
          h("div", { class: "ih-tiles" }, ...arr(s.tiles).map(tileImg).map((t, i) =>
            h("figure", { class: "tile pop", style: `--i:${i}`, "data-fx": "" }, h("img", { src: src(t.img), alt: t.alt || "" })))),
          s.pack ? h("div", { class: "ih-packwrap", "data-par": "-0.07" }, h("img", { class: "ih-pack", src: src(s.pack), alt: s.packAlt || "Embalagens" })) : null)));

    R.marquee = (s) => {
      const g = s.glyph ? src(s.glyph) : null;
      const seq = (hidden) => h("div", { class: "mq-set", ...(hidden ? { "aria-hidden": "true" } : {}) },
        ...s.items.flatMap((t) => [h("span", { class: "mq-t" }, t), h("i", { class: g ? "mq-g" : "mq-dot", style: g ? `--g:url("${g}")` : null, "aria-hidden": "true" })]));
      const run = h("div", { class: "mq-run" }, seq(false), seq(true));
      // velocidade constante em px/s (s.pxs): faixas longas não disparam; mede a largura quando a faixa entra na página
      if (s.pxs) { const fit = () => { if (!run.isConnected) return requestAnimationFrame(fit); const w = run.firstChild.scrollWidth; if (w) run.style.animationDuration = `${Math.round(w / s.pxs)}s`; }; requestAnimationFrame(fit); }
      return h("section", { class: "blk marquee" }, run);
    };

    R.mosaic = (s) => h("section", { class: "blk mosaic" }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "mz-grid" }, ...s.tiles.map(tileImg).map((t, i) =>
        h("figure", { class: "tile", style: `--i:${i}`, "data-fx": "" }, h("img", { src: src(t.img), alt: t.alt || "", loading: "lazy" }))))));

    R.family = (s) => h("section", { class: "blk family" }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "fm-grid" }, ...s.items.map((c, i) => h("article", { class: "fm", style: `--i:${i}`, "data-fx": "" },
        h("button", { type: "button", class: `fm-fig${c.photo ? " has-photo" : ""}`, "aria-label": c.photo ? `${c.name}: alternar entre marca e foto do produto` : c.name,
          onclick: (e) => e.currentTarget.classList.toggle("on") },
          c.tile ? h("img", { class: "fm-tile", src: src(c.tile), alt: "", loading: "lazy" })
            : h("span", { class: "fm-type", style: `--c:${c.color || "#5B2A1C"}`, "aria-hidden": "true" }, h("em", {}, c.kind), h("b", {}, c.name)),
          c.photo ? h("img", { class: "fm-photo", src: src(c.photo), alt: "", loading: "lazy" }) : null),
        h("small", {}, c.kind), h("h3", {}, c.name), c.text ? h("p", {}, c.text) : null)))));

    R.packs = (s) => h("section", { class: "blk packs" }, h("div", { class: "wrap" }, head(s)),
      h("div", { class: "pk-row" }, ...s.items.map((k, i) => h("figure", { class: "pk", style: `--pk:${k.bg || "#D59C37"};--i:${i}`, "data-fx": "" },
        h("div", { class: "pk-stage" }, h("i", { class: "pk-shadow" }), h("img", { src: src(k.image), alt: k.alt || `Embalagem ${k.name}`, loading: "lazy" })),
        h("figcaption", {}, h("small", {}, k.kind), h("strong", {}, k.name))))));

    R.photos = (s) => {
      const cols = [[], [], []];
      s.images.forEach((im, i) => cols[i % 3].push(im));
      const speed = [0.05, -0.05, 0.09];
      const media = (im) => /\.(mp4|webm)$/i.test(im)
        ? h("video", { src: src(im), poster: src(im.replace(/\.(mp4|webm)$/i, ".jpg")), muted: "", loop: "", autoplay: "", playsinline: "", preload: "metadata", "aria-label": s.alt || "Vídeo" })
        : h("img", { src: src(im), alt: s.alt || "Fotografia de produto", loading: "lazy" });
      // compacto: grade de miniaturas (fotos e vídeos curtos, sem áudio)
      if (s.compact) return h("section", { class: "blk photos compact" }, h("div", { class: "wrap" }, head(s),
        h("div", { class: "ph-grid", style: s.cols ? `--cols:${s.cols};--ar:${s.ratio || "3/2"}` : null }, ...s.images.map((im, i) => h("figure", {}, media(im), s.captions?.[i] ? h("figcaption", {}, s.captions[i]) : null)))));
      return h("section", { class: "blk photos" }, h("div", { class: "wrap" }, head(s),
        h("div", { class: "ph-cols" }, ...cols.map((c, ci) => h("div", { class: "ph-col", "data-par": String(speed[ci]) },
          ...c.map((im) => h("figure", {}, media(im))))))));
    };

    R.swap = (s) => {
      let cur = 0;
      const imgs = s.items.map((it, i) => h("img", { src: src(it.image), alt: it.alt || it.label, class: i ? "" : "on", loading: i ? "lazy" : null }));
      const btns = s.items.map((it, i) => h("button", { type: "button", "aria-pressed": String(!i), onclick: () => {
        if (i === cur) return;
        imgs[cur].classList.remove("on"); btns[cur].setAttribute("aria-pressed", "false");
        cur = i; imgs[i].classList.add("on"); btns[i].setAttribute("aria-pressed", "true");
      } }, it.label));
      return h("section", { class: "blk swap" }, h("div", { class: "wrap sw-grid" },
        h("div", {}, head(s), h("div", { class: "sw-tabs", role: "group", "aria-label": "Alternar imagem" }, ...btns)),
        h("div", { class: "sw-stage" }, ...imgs)));
    };

    // Vinhetas: vídeos mudos em loop, tocam só quando estão na tela
    R.reels = (s) => h("section", { class: `blk reels${s.stack ? " stack" : ""}` }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "rl-grid" }, ...s.items.map((v, i) => h("figure", { class: `rl${v.wide ? " wide" : ""}${v.narrow ? " narrow" : ""}`, style: `--i:${i};--ar:${v.ratio || "16/9"}`, "data-fx": "" },
        h("div", { class: "rl-box" }, h("video", { src: src(v.src), poster: v.poster ? src(v.poster) : null, muted: "", loop: "", playsinline: "", preload: "metadata", "aria-label": v.label || "Vinheta" })),
        v.label ? h("figcaption", {}, v.label) : null)))));

    // Calendário: linha do tempo de 12 meses com as campanhas posicionadas por mês
    R.calendar = (s) => {
      const M = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const K = Object.fromEntries((s.legend || []).map((l) => [l.k, l]));
      const cols = M.map((m, i) => h("div", { class: "cal-col" },
        h("span", { class: "cal-m" }, m),
        ...s.items.filter((it) => it.m === i + 1).map((it, j) => h("button", { type: "button", class: "cal-it", "data-fx": "", style: `--i:${i + j};--k:${K[it.kind]?.color || "#fff"}`, "aria-label": `Ver campanha ${it.label}`, onclick: () => openCamp(it) },
          h("img", { src: src(it.img), alt: it.alt || it.label, loading: "lazy", class: it.bg ? "fit" : null, style: it.bg ? `background:${it.bg}` : null }),
          h("span", { class: "cal-cap" }, h("b", {}, it.label), h("small", {}, K[it.kind]?.label || ""), h("em", { "aria-hidden": "true" }, "Ver campanha →"))))));
      // conteúdo da campanha em janela: peça principal, texto e galeria (quando houver)
      const openCamp = (it) => {
        const imgs = [it.img, ...(it.gallery || [])];
        const dlg = h("dialog", { class: "cal-dlg", "aria-label": it.label },
          h("form", { method: "dialog", class: "cal-dlg-x" }, h("button", { type: "submit", "aria-label": "Fechar" }, "×")),
          h("div", { class: "cal-dlg-b" },
            h("small", { style: `--k:${K[it.kind]?.color || "#fff"}` }, `${M[it.m - 1]} · ${K[it.kind]?.label || ""}`),
            h("h3", {}, it.label), it.text ? h("p", {}, it.text) : null,
            h("div", { class: `cal-dlg-g n${Math.min(imgs.length, 3)}` }, ...imgs.map((im, k) => /\.(mp4|webm)$/i.test(im)
              ? h("video", { src: src(im), controls: "", playsinline: "", preload: "metadata" })
              : h("img", { src: src(im), alt: k ? `${it.label}, peça ${k + 1}` : it.label, loading: "lazy", style: !k && it.bg ? `background:${it.bg}` : null })))));
        dlg.addEventListener("close", () => dlg.remove());
        dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
        document.body.append(dlg); dlg.showModal();
      };
      return h("section", { class: "blk cal" }, h("div", { class: "wrap" }, head(s),
        s.legend ? h("div", { class: "cal-legend" }, ...s.legend.map((l) => h("span", { style: `--k:${l.color}` }, l.label))) : null,
        s.note ? h("p", { class: "cal-note soft" }, s.note) : null),
        h("div", { class: "cal-scroll", tabindex: "0", "aria-label": "Calendário de campanhas, role para o lado" },
          h("div", { class: "cal-track", "data-fx": "" }, h("i", { class: "cal-line", "aria-hidden": "true" }), ...cols)));
    };

    // Faixa de vídeo em largura total (testeira de palco, motion), muda e em loop
    R.band = (s) => h("section", { class: "blk vband", "aria-label": s.label || "Vídeo" },
      h("div", { class: "vb-box", style: `--ar:${s.ratio || "21/6"}` },
        h("video", { src: src(s.video), poster: s.poster ? src(s.poster) : null, muted: "", loop: "", autoplay: "", playsinline: "", preload: "metadata", "aria-label": s.label || "Vídeo", style: s.pos ? `object-position:${s.pos}` : null })),
      s.label ? h("p", { class: "vb-cap" }, s.label) : null);

    // Símbolo da marca trocando de cor no ritmo das linhas de campanha
    R.logoMotion = (s) => {
      const P = s.palettes || [];
      const word = h("b", {}, P[0]?.name || "");
      const sec = h("section", { class: "blk lmo", style: P[0] ? `--lb:${P[0].bg};--lf:${P[0].fg}` : null, "aria-label": s.label || "Símbolo da marca nas cores das campanhas" },
        h("div", { class: "lmo-in" },
          h("i", { class: "lmo-g", style: `--g:url("${src(s.glyph)}")`, "aria-hidden": "true" }),
          h("p", { class: "lmo-w", "aria-live": "off" }, h("span", {}, s.prefix || "celebre"), word)));
      if (P.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        let i = 0;
        setInterval(() => { if (document.hidden) return; i = (i + 1) % P.length; sec.style.setProperty("--lb", P[i].bg); sec.style.setProperty("--lf", P[i].fg); word.textContent = P[i].name; word.animate?.([{ opacity: 0, transform: "translateY(30%)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }); }, s.every || 1600);
      }
      return sec;
    };

    // Qualquer seção aceita "bg"/"fg" (bloco de cor) e "fx" (variação de movimento)
    for (const k of Object.keys(R)) {
      const f = R[k];
      if (f.__fx) continue;
      const g = (s, ...a) => {
        const e = f(s, ...a);
        if (e && s.bg) { e.classList.add("tone"); e.style.setProperty("--sbg", s.bg); e.style.setProperty("--sfg", s.fg || "#fff"); }
        if (e && s.fx) e.classList.add("fx-" + s.fx);
        return e;
      };
      g.__fx = true; R[k] = g;
    }

    /* ===== Apresentação de marca (deck) =====
       Padrão para as páginas de logos e marcas: sequência de pranchas 16:9 em tela cheia,
       no ritmo das apresentações de estúdio (capa chapada, foto com assinatura, paleta,
       grade de versões, tipografia, manifesto, sistema por produto, aplicações).
       Cada prancha é dado (k = tipo); a marca define cores e fontes no próprio JSON. */
    const fontsDone = new Set();
    const deckFonts = (fonts = []) => {
      const css = fonts.filter((f) => !fontsDone.has(f.family)).map((f) => { fontsDone.add(f.family); return `@font-face{font-family:"${f.family}";src:url("${src(f.src)}");font-display:swap}`; }).join("");
      if (css) document.head.append(h("style", {}, css));
    };
    const im = (p, cls, alt = "", pos) => h("img", { class: cls || null, src: src(p), alt, loading: "lazy", decoding: "async", style: pos ? `object-position:${pos}` : null });
    const lines = (t) => arr(t).flatMap((x, i) => (i ? [h("br"), x] : [x]));
    // tipografia cinética: cada palavra sobe de dentro de uma máscara (referência: stories de evento)
    const kin = (t) => { let n = 0; return arr(t).flatMap((x, i) => [i ? h("br") : null, ...String(x).split(" ").flatMap((w, j) => [j ? " " : null, h("span", { class: "kw" }, h("span", { style: `--i:${n++}` }, w))])]).filter((x) => x != null); };
    const SL = {
      cover: (d) => [d.pattern ? im(d.pattern.img, "dk-pat", "", null) : null,
        h("div", { class: "dk-center" + (d.pattern ? " left" : "") }, d.logo ? im(d.logo, "dk-logo", d.alt || "") : null, d.title ? h("p", { class: "dk-sub" }, d.title) : null),
        d.caption ? h("p", { class: "dk-cap" }, d.caption) : null],
      photo: (d) => [im(d.img, "dk-bg", d.alt || "", d.pos), h("div", { class: "dk-shade", style: `--shade:${d.shade ?? 0.45}` }),
        h("div", { class: `dk-over ${d.align || "bl"}` },
          d.kicker ? h("p", { class: "dk-kick" }, d.kicker) : null,
          d.title ? h("h3", { class: "dk-h" }, kin(d.title), d.tail ? h("span", { class: "dk-tail" }, d.tail) : null) : null,
          d.sub ? h("p", { class: "dk-sub" }, d.sub) : null),
        d.logo ? im(d.logo, `dk-mark ${d.logoAt || "br"}`, "") : null],
      palette: (d) => [h("div", { class: "dk-pal-img" }, im(d.img, "dk-bg", d.alt || "", d.pos), d.logo ? im(d.logo, "dk-mark bl", "") : null),
        h("div", { class: "dk-pal" }, ...d.colors.map((c) => h("div", { style: `background:${c.hex};color:${c.ink || "#fff"}` },
          h("b", {}, c.name || ""), h("span", {}, c.hex.toUpperCase()), c.role ? h("span", {}, c.role) : null)))],
      logos: (d) => [h("div", { class: "dk-grid g" + (d.cols || 3) }, ...d.cells.map((c) => h("figure", { style: `background:${c.bg};color:${c.fg || "inherit"}` },
        c.photo ? im(c.photo, "dk-bg", "") : null, im(c.img, "dk-cell", c.alt || c.label || "", null), c.label ? h("figcaption", {}, c.label) : null)))],
      symbol: (d) => [h("div", { class: "dk-sym" },
        h("div", { class: "dk-sym-main" }, im(d.img, "", d.alt || "")),
        h("div", { class: "dk-sym-parts" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
          ...arr(d.parts).map((p) => h("div", { class: "dk-part" }, p.img ? im(p.img, "", "") : null, h("div", {}, h("b", {}, p.label), h("p", {}, p.text))))))],
      type: (d) => [h("div", { class: "dk-type" }, ...d.fonts.map((f) => h("div", { class: "dk-font" },
        h("p", { class: "dk-kick" }, f.label), h("p", { class: "dk-aa", style: `font-family:"${f.family}"` }, f.sample || "Aa"),
        h("p", { class: "dk-abc", style: `font-family:"${f.family}"` }, f.alphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789"),
        h("p", { class: "dk-use" }, f.use || ""))))],
      manifesto: (d) => [d.pattern ? im(d.pattern, "dk-pat r", "") : null, h("div", { class: "dk-man" },
        d.kicker ? h("p", { class: "dk-kick" }, d.kicker) : null, h("p", { class: "dk-big" }, d.text), d.sign ? h("p", { class: "dk-sub" }, d.sign) : null)],
      swatches: (d) => [h("div", { class: "dk-sw" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-sw-g" }, ...d.groups.map((g) => h("div", { class: "dk-sw-i" },
          h("div", { class: "dk-sw-c" }, ...g.colors.map((c) => h("i", { style: `background:${c}`, title: c }))), h("b", {}, g.name), g.sub ? h("span", {}, g.sub) : null))))],
      icons: (d) => [h("div", { class: "dk-icons" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-ic-g" }, ...d.items.map((it) => h("figure", {}, im(it.img, "", it.label || ""), h("figcaption", {}, it.label)))))],
      products: (d) => [h("div", { class: "dk-prod" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-prod-g", style: `--n:${d.items.length}` }, ...d.items.map((it) => h("figure", {}, im(it.img, "", it.label || ""), it.label ? h("figcaption", {}, it.label) : null))))],
      image: (d) => [im(d.img, "dk-bg", d.alt || "", d.pos), d.caption ? h("p", { class: "dk-tagc" }, d.caption) : null],
      // galeria: imagens inteiras, sem recorte (rótulos planificados, thumbs de produto)
      gallery: (d) => [h("div", { class: "dk-gal", style: `--c:${d.cols || 2};--mc:${d.mcols || 1}` }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-gal-g" }, ...d.items.map((it) => h("figure", {}, im(it.img || it, "", it.label || ""), it.label ? h("figcaption", {}, it.label) : null))))],
      duo: (d) => [h("div", { class: "dk-duo" }, ...[d.a, d.b].map((p) => h("div", { style: p.bg ? `background:${p.bg};color:${p.fg || "#fff"}` : "" },
        p.img ? im(p.img, p.fit === "contain" ? "dk-ct" : "dk-bg", p.alt || "", p.pos) : null,
        p.logo ? im(p.logo, "dk-logo s", "") : null,
        p.title || p.text ? h("div", { class: "dk-over bl" }, p.kicker ? h("p", { class: "dk-kick" }, p.kicker) : null, p.title ? h("h3", { class: "dk-h s" }, lines(p.title)) : null, p.text ? h("p", { class: "dk-sub" }, p.text) : null) : null,
        p.caption ? h("p", { class: "dk-tagc" }, p.caption) : null)))],
    };
    SL.end = SL.cover;
    R.deck = (s) => {
      deckFonts(s.fonts);
      const vars = Object.entries(s.vars || {}).map(([k, v]) => `--${k}:${v}`).join(";");
      return h("section", { class: "blk deck", style: vars },
        s.title || s.eyebrow || s.text ? h("div", { class: "wrap" }, head(s)) : null,
        h("div", { class: "dk-list" }, ...s.slides.map((d, i) => h("article", {
          class: `sl k-${d.k}${d.tall ? " tall" : ""}`, "data-fx": "", "aria-label": d.label || d.title || d.kicker || `Prancha ${i + 1}`,
          style: [`--bg:${d.bg || "var(--dk-paper,#F2EFE6)"}`, `--fg:${d.fg || "var(--dk-ink,#222)"}`, d.font ? `--dk-font:"${d.font}"` : ""].join(";"),
        }, ...(SL[d.k] || SL.image)(d).filter(Boolean)))));
    };

    /* Lâminas: visualizador do deck (16:9), com lâminas em vídeo que tocam só quando estão em cena.
       s.slides: [{ img } | { video, poster }], s.label opcional por lâmina */
    R.slides = (s) => {
      const list = s.slides || [];
      let cur = 0;
      const stage = h("div", { class: "dv-stage", tabindex: "0", role: "group", "aria-roledescription": "apresentação", "aria-label": s.title || "Lâminas" });
      const count = h("span", { class: "dv-count", "aria-live": "polite" });
      const thumbs = list.map((d, i) => h("button", { type: "button", class: "dv-th", "aria-label": `Lâmina ${i + 1}${d.video ? " (em movimento)" : ""}`, onclick: () => go(i) },
        h("img", { src: src(d.poster || d.img), alt: "", loading: "lazy" }), d.video ? h("i", { "aria-hidden": "true" }, "▶") : null));
      const rail = h("div", { class: "dv-rail" }, ...thumbs);
      const el = (d, i) => d.video
        ? h("video", { src: src(d.video), poster: d.poster ? src(d.poster) : null, muted: "", loop: "", playsinline: "", preload: "none", "aria-label": d.label || `Lâmina ${i + 1} em movimento` })
        : h("img", { src: src(d.img), alt: d.label || `Lâmina ${i + 1}`, loading: i < 2 ? "eager" : "lazy", decoding: "async" });
      const slides = list.map((d, i) => h("figure", { class: "dv-sl" + (i ? "" : " on"), "aria-hidden": i ? "true" : "false" }, el(d, i)));
      stage.append(...slides);
      const vis = { on: false };
      function sync() {
        slides.forEach((f, i) => {
          const on = i === cur; f.classList.toggle("on", on); f.setAttribute("aria-hidden", String(!on));
          const v = f.querySelector("video"); if (v) { if (on && vis.on) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause(); }
        });
        thumbs.forEach((t, i) => t.setAttribute("aria-current", String(i === cur)));
        count.textContent = `${String(cur + 1).padStart(2, "0")} / ${list.length}`;
        const t = thumbs[cur]; if (t && rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: t.offsetLeft - rail.clientWidth / 2 + t.clientWidth / 2, behavior: "smooth" });
        // pré-carrega a próxima
        const nx = slides[cur + 1]?.querySelector("img"); if (nx) nx.loading = "eager";
      }
      function go(i) { cur = (i + list.length) % list.length; sync(); }
      stage.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); } });
      let x0 = null;
      stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
      stage.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1)); else if (e.pointerType === "mouse") go(cur + (e.offsetX > stage.clientWidth / 2 ? 1 : -1)); });
      if ("IntersectionObserver" in window) new IntersectionObserver((es) => { vis.on = es[0].isIntersecting; sync(); }, { threshold: 0.35 }).observe(stage);
      sync();
      return h("section", { class: "blk deckv" + (s.panel ? " panel on-panel" : "") }, h("div", { class: "wrap" }, head(s),
        h("div", { class: "dv-frame" }, stage,
          h("div", { class: "dv-bar" },
            h("button", { type: "button", class: "dv-nav", "aria-label": "Lâmina anterior", onclick: () => go(cur - 1) }, "←"), count,
            h("button", { type: "button", class: "dv-nav", "aria-label": "Próxima lâmina", onclick: () => go(cur + 1) }, "→"))),
        rail));
    };

    /* Demonstração do sistema "Briefing relâmpago": tela do moderador (telão) + celular do aluno.
       Simulado no navegador: nada é enviado a servidor. */
    // Vídeo do YouTube sem carregar o player até o clique (capa leve, sem cookies)
    R.youtube = (s) => {
      const id = s.id;
      const box = h("div", { class: "yt-box" });
      const play = h("button", { type: "button", class: "yt-play", "aria-label": `Assistir: ${s.label || s.title || "vídeo"}`, onclick: () => {
        box.replaceChildren(h("iframe", { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, title: s.label || s.title || "Vídeo", allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "", loading: "lazy" }));
      } }, h("img", { src: s.poster ? src(s.poster) : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: "", loading: "lazy" }), h("i", { "aria-hidden": "true" }, "▶"));
      box.append(play);
      return h("section", { class: `blk yt${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s), box,
        s.label ? h("p", { class: "yt-cap soft" }, s.label) : null));
    };

    // Dupla: texto em cima; imagem e vídeo do YouTube lado a lado no desktop, empilhados no celular
    R.duo = (s) => {
      const id = s.youtube;
      const box = h("div", { class: "yt-box" });
      box.append(h("button", { type: "button", class: "yt-play", "aria-label": `Assistir: ${s.label || "vídeo"}`, onclick: () => {
        box.replaceChildren(h("iframe", { src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, title: s.label || "Vídeo", allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: "", loading: "lazy" }));
      } }, h("img", { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: "", loading: "lazy" }), h("i", { "aria-hidden": "true" }, "▶")));
      return h("section", { class: `blk duo${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s),
        h("div", { class: "duo-g" },
          h("figure", { class: "duo-img" }, h("img", { src: src(s.image), alt: s.alt || s.title || "", loading: "lazy" })),
          h("figure", { class: "duo-vid" }, box, s.label ? h("figcaption", { class: "soft" }, s.videoKicker ? h("b", {}, s.videoKicker + " · ") : null, s.label) : null))));
    };

    // Classificação final: uma coluna por série, destaque para a campeã
    R.ranking = (s) => h("section", { class: `blk ranking${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "rk-cols" }, ...s.series.map((se) => h("article", { class: "rk" },
        h("header", { class: "rk-head" + (se.logo ? " has-logo" : "") }, se.logo ? h("h3", {}, h("img", { src: src(se.logo), alt: `${se.label} ${se.name}`, loading: "lazy" })) : [h("small", {}, se.label), h("h3", {}, se.name)]),
        h("div", { class: "rk-champ" }, h("img", { src: src(se.champion.img), alt: "", loading: "lazy" }),
          h("div", {}, h("span", { class: "rk-title" }, se.champion.title), h("b", {}, se.champion.name), se.champion.sub ? h("small", {}, se.champion.sub) : null)),
        h("ol", { class: "rk-list", start: "2" }, ...se.rest.map((r, i) => h("li", {},
          h("span", { class: "rk-pos" }, `${i + 2}º`), h("img", { src: src(r.img), alt: "", loading: "lazy" }),
          h("span", { class: "rk-name" }, h("b", {}, r.name), r.sub ? h("small", {}, r.sub) : null)))))))));

    // Números da gestão: valor grande + rótulo + detalhe
    R.stats = (s) => h("section", { class: `blk stats${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s),
      h("ul", { class: `st-grid${s.items.length === 4 ? " st4" : ""}` }, ...s.items.map((it, i) => h("li", { class: "st", style: `--i:${i}`, "data-fx": "" },
        h("b", {}, it.medal ? h("span", { class: `og-md big m${it.medal}`, "aria-hidden": "true" }, h("i"), h("span", {}, `${it.medal}º`)) : null, it.value), h("span", {}, it.label), it.note ? h("small", {}, it.note) : null)))));

    // Barras horizontais: comparação simples de valores (ex.: visualizações por reel)
    R.bars = (s) => {
      const max = Math.max(...s.items.map((it) => it.value));
      return h("section", { class: `blk bars${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s),
        h("ul", { class: "br-list", role: "list" }, ...s.items.map((it) => h("li", { class: "br" },
          h("span", { class: "br-l" }, it.label),
          h("span", { class: "br-t", "aria-hidden": "true" }, h("i", { style: `--w:${Math.max(4, (it.value / max) * 100).toFixed(1)}%` })),
          h("b", { class: "br-v" }, it.display || String(it.value))))),
        s.note ? h("p", { class: "br-note" }, s.note) : null));
    };

    // Ícones de modalidade (traço 1.6, 24px) para listas de resultados
    // Pictogramas de modalidade (grade 64): figura em traço único, arredondado, com cabeça em ponto,
    // sobre uma mancha orgânica colorida — linguagem de pictograma "desenhado à mão".
    const PICT = {
      atletismo: '<circle class="f" cx="40" cy="11" r="5.5"/><path d="M35 21 Q31 29 28 36 M34 23 Q42 26 47 21 M34 23 Q26 24 21 19 M28 36 Q36 41 39 47 Q39 52 36 57 M28 36 Q23 44 12 46"/>',
      natacao: '<circle class="f" cx="14" cy="28" r="5.5"/><path d="M21 33 Q35 27 51 33 M25 30 Q30 17 42 21 M5 49 q5.5 -5 11 0 t11 0 t11 0 t11 0 t11 0"/>',
      futsal: '<circle class="f" cx="22" cy="10" r="5.5"/><circle class="f" cx="52" cy="44" r="5.5"/><path d="M24 19 Q26 28 30 35 M25 22 Q18 25 13 30 M25 22 Q32 20 38 15 M30 35 Q39 38 45 35 M30 35 Q28 46 21 56"/>',
      volei: '<circle class="f" cx="27" cy="15" r="5.5"/><circle class="f" cx="46" cy="8" r="5.5"/><path d="M28 23 Q35 16 40 13 M28 23 Q26 32 28 40 M28 25 Q20 28 16 33 M28 40 Q35 45 39 51 M28 40 Q22 48 17 57"/>',
      handebol: '<circle class="f" cx="29" cy="11" r="5.5"/><circle class="f" cx="48" cy="10" r="5.5"/><path d="M30 20 Q37 20 42 15 M30 20 Q28 31 26 40 M30 23 Q22 26 17 22 M26 40 Q33 46 37 55 M26 40 Q19 46 12 49"/>',
      basquete: '<circle class="f" cx="25" cy="16" r="5.5"/><circle class="f" cx="42" cy="8" r="5.5"/><path d="M26 24 Q32 16 37 12 M26 24 Q30 18 36 16 M26 24 Q25 34 26 43 M26 43 Q32 49 33 57 M26 43 Q19 50 17 57 M48 24 H60 M50 24 L53 31 L57 24"/>',
      xadrez: '<circle class="f" cx="32" cy="15" r="6.5"/><path class="f" d="M25 49 Q27 35 32 25 Q37 35 39 49 Z"/><path d="M20 53 H44 M26 25 H38"/>',
      festa: '<circle class="f" cx="32" cy="23" r="5.5"/><path d="M4 7 Q32 15 60 7 M32 31 Q22 27 18 21 M32 31 Q42 27 46 21 M32 31 Q32 38 32 43 M32 43 Q26 50 22 57 M32 43 Q38 50 42 57"/><path class="f" d="M10 9 l3 7 l3 -6 Z M22 12 l3 7 l3 -6 Z M36 12 l3 7 l3 -7 Z M48 10 l3 6 l3 -7 Z"/>',
      praia: '<circle class="f" cx="16" cy="33" r="5.5"/><circle class="f" cx="7" cy="17" r="5"/><path d="M22 37 Q35 41 47 35 M20 31 Q14 26 11 22 M47 35 Q53 30 58 24 M47 35 Q53 38 59 37 M4 55 H60"/>',
      bandeira: '<circle class="f" cx="22" cy="17" r="5.5"/><path d="M22 25 Q23 34 23 42 M23 42 Q19 49 16 57 M23 42 Q28 49 31 57 M22 28 Q30 25 37 20 M38 5 V44"/><path class="f" d="M38 5 L57 11 L38 18 Z"/>'
    };
    const PICT_BG = ["#7CC6A4", "#F2B84B", "#A27BC0", "#EE8A72", "#6FB1E0"];
    const PICT_COLOR = { atletismo: 3, natacao: 4, futsal: 0, volei: 1, handebol: 3, basquete: 1, xadrez: 2, festa: 1, praia: 4, bandeira: 0 };
    const BLOBS = ["M12 32C8 16 22 5 38 8 54 11 62 26 56 41 50 56 32 61 20 54 9 48 14 41 12 32Z", "M9 28C11 13 27 4 42 9 57 14 60 33 53 46 45 59 24 60 15 50 6 41 8 36 9 28Z", "M14 22C20 9 38 4 50 13 61 22 58 42 47 52 35 62 17 57 10 45 5 35 9 31 14 22Z"];
    const pict = (name) => {
      if (!PICT[name]) return "";
      const k = Object.keys(PICT).indexOf(name);
      return `<svg viewBox="0 0 64 64" class="pict" aria-hidden="true"><path d="${BLOBS[k % 3]}" fill="${PICT_BG[PICT_COLOR[name] ?? k % 5]}"/><g fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round">${PICT[name]}</g></svg>`;
    };


    // Programação: uma coluna por noite, com fotos do palco, data, local e atrações
    R.lineup = (s) => h("section", { class: `blk lineup${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "lu-grid" }, ...s.nights.map((n) => h("article", { class: "lu" },
        n.photos?.length ? h("div", { class: `lu-ph n${Math.min(n.photos.length, 2)}` }, ...n.photos.slice(0, 2).map((p) => h("figure", {}, h("img", { src: src(p.img || p), alt: p.alt || "", loading: "lazy" }), p.cap ? h("figcaption", {}, p.cap) : null))) : null,
        h("div", { class: "lu-b" },
          n.icon ? h("span", { class: "lu-ic", "aria-hidden": "true", html: pict(n.icon) }) : null,
          h("small", {}, n.label),
          h("h3", {}, n.date),
          h("p", { class: "lu-w" }, n.where),
          n.artists?.length ? h("ul", { class: "lu-a" }, ...n.artists.map((a) => h("li", {}, a))) : null))))));


    // Organograma: grupos de cargos com nomes
    R.org = (s) => h("section", { class: `blk org${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "og-grid" }, ...s.groups.map((g) => h("article", { class: "og" }, h("h3", { class: g.logo ? "og-lg" : null }, g.logo ? h("img", { src: src(g.logo), alt: "", loading: "lazy" }) : null, g.title),
        h("ul", {}, ...g.items.map((it) => h("li", { class: it.icon || it.medal ? "og-x" : null },
          it.icon ? h("span", { class: "og-ic", "aria-hidden": "true", html: pict(it.icon) }) : null,
          h("span", { class: "og-t" }, h("small", {}, it.role), h("b", {}, it.name)),
          it.medal ? h("span", { class: `og-md m${Math.min(it.medal, 4)}`, role: "img", "aria-label": `${it.medal}º lugar` }, h("i", { "aria-hidden": "true" }), h("span", {}, `${it.medal}º`)) : null))))))));

    // Parede de logos (ex.: atléticas participantes): logo + nome + vínculo, em grade
    R.logos = (s) => h("section", { class: `blk logos${s.panel ? " panel on-panel" : ""}` }, h("div", { class: "wrap" }, head(s),
      h("ul", { class: "lg-grid", style: s.cols ? `--cols:${s.cols}` : null }, ...s.items.map((it, i) => h("li", { class: "lg", style: `--i:${i % 6}`, "data-fx": "" },
        h("span", { class: "lg-fig" }, h("img", { src: src(it.img), alt: `${it.name}${it.sub ? " · " + it.sub : ""}`, loading: i < 12 ? "eager" : "lazy", decoding: "async", width: 120, height: 120 })),
        h("b", {}, it.name), it.sub ? h("small", {}, it.sub) : null)))));

    // Demonstração do sistema do II ENEHISP (arquivo próprio: /enehisp-demo.js)
    R.enehispDemo = (s) => (window.EnehispDemo ? window.EnehispDemo(s, h, src) : null);

    R.talkDemo = (s) => {
      const P = s.pedidos || [];
      const seed = s.seed || [];
      const answers = [];
      const logo = () => s.logo ? h("span", { class: "td-brand" }, h("img", { src: src(s.logo), alt: s.logoAlt || "Talks", class: "td-logo-img" }), s.logoSub ? h("small", {}, s.logoSub) : null) : h("span", { class: "td-logo" }, "TALKS");
      const ini = (n) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
      // ---------- telão ----------
      const num = h("b", { class: "td-num" }, "0");
      const chips = h("div", { class: "td-chips", "aria-label": "Quem já respondeu" });
      const drawn = h("div", { class: "td-drawn", "aria-live": "polite" });
      const clock = h("span", { class: "td-clock" });
      const tick = () => { clock.textContent = "Ao vivo · " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
      tick(); setInterval(tick, 30000);
      function add(a) {
        answers.push(a); num.textContent = String(answers.length); empty.hidden = true;
        const c = h("span", { class: "td-chip" + (a.me ? " me" : ""), title: a.name }, ini(a.name)); chips.append(c);
        requestAnimationFrame(() => c.classList.add("in"));
      }
      function sortear() {
        if (answers.length < 3) { drawn.replaceChildren(h("p", { class: "td-hint" }, "Espere chegar pelo menos 3 respostas.")); return; }
        const pool = [...answers]; const pick = [];
        while (pick.length < 3) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        [...chips.children].forEach((c) => c.classList.toggle("hit", pick.some((p) => ini(p.name) === c.textContent)));
        drawn.replaceChildren(...pick.map((a, i) => h("article", { class: "td-card", style: `--i:${i}` },
          h("small", {}, `${i + 1}º sorteado · 1 minuto`), h("strong", {}, a.name), h("em", {}, `“${a.pedido}”`), h("p", {}, a.text))));
      }
      function planilha() {
        const rows = [["Nome", "Pedido do cliente", "Problema real e estratégia"], ...answers.map((a) => [a.name, a.pedido, a.text])];
        const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const a = h("a", { href: url, download: "briefing-relampago-demo.csv" }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      function novaTurma() { answers.length = 0; num.textContent = "0"; empty.hidden = false; chips.replaceChildren(); drawn.replaceChildren(); started = false; startSeed(); phoneReset(); }
      const empty = h("p", { class: "td-empty" }, "As respostas aparecem aqui assim que os alunos enviarem.");
      const tv = h("div", { class: "td-tv", role: "group", "aria-label": "Tela do moderador (telão)" },
        h("div", { class: "td-tv-grid" },
          h("div", { class: "td-tv-left" },
            logo(),
            h("small", { class: "td-kick" }, "Agora é com vocês · aponte a câmera"),
            h("div", { class: "td-tv-id" },
              s.qr ? h("img", { class: "td-qr", src: src(s.qr), alt: "QR code que abre a tela do aluno", width: 132, height: 132 }) : null,
              h("div", { class: "td-tv-copy" }, h("h3", {}, "Briefing ", h("i", {}, "relâmpago")), h("span", { class: "td-url" }, s.url || "talkspp.gustavoelian.com")))),
          h("div", { class: "td-tv-right" },
            h("div", { class: "td-count" }, h("small", {}, "Respostas"), num),
            chips)),
        h("div", { class: "td-actions" },
          h("button", { type: "button", class: "td-btn pri", onclick: sortear }, "Sortear 3 respostas"),
          h("button", { type: "button", class: "td-btn", onclick: planilha }, "Baixar planilha"),
          h("button", { type: "button", class: "td-btn", onclick: novaTurma }, "Nova turma"),
          clock),
        drawn.childElementCount ? drawn : drawn, empty);
      // ---------- celular do aluno ----------
      const scr = h("div", { class: "td-scr" });
      let pedido = "";
      function phoneReset() {
        pedido = "";
        const name = h("input", { class: "td-in", placeholder: "Como você quer aparecer no telão", maxlength: 40, "aria-label": "Seu nome", autocomplete: "off" });
        const card = h("div", { class: "td-q", "aria-live": "polite" }, h("span", { class: "td-qm" }, "?"));
        const ans = h("textarea", { class: "td-in", rows: 4, maxlength: 400, placeholder: "Qual é o problema real? E a sua estratégia?", "aria-label": "Sua resposta", hidden: true });
        const err = h("p", { class: "td-err", role: "alert" });
        const btn = h("button", { type: "button", class: "td-go" }, "Sortear meu problema");
        btn.onclick = () => {
          err.textContent = "";
          if (!pedido) {
            if (name.value.trim().length < 2) { err.textContent = "Digite seu nome."; name.focus(); return; }
            const it = P[Math.floor(Math.random() * P.length)] || { pedido: "Faz um post aí", cliente: "Uma clínica" };
            pedido = it.pedido;
            card.classList.add("open");
            card.replaceChildren(h("small", {}, it.cliente || "O cliente pediu"), h("strong", {}, `“${it.pedido}”`), it.dica ? h("span", {}, it.dica) : null);
            ans.hidden = false; ans.focus(); btn.textContent = "Enviar para o telão";
            return;
          }
          if (ans.value.trim().length < 8) { err.textContent = "Escreva o problema real e a estratégia."; ans.focus(); return; }
          add({ name: name.value.trim(), pedido, text: ans.value.trim(), me: true });
          scr.replaceChildren(top(), h("div", { class: "td-ok" }, h("strong", {}, "Resposta enviada!"), h("p", {}, "Fique atento ao telão: três respostas serão sorteadas para apresentar em 1 minuto.")),
            h("button", { type: "button", class: "td-again", onclick: phoneReset }, "Responder de novo"), foot());
        };
        scr.replaceChildren(top(), h("p", { class: "td-lead" }, "Você recebe um pedido de cliente. Seu trabalho: chegar no problema real e propor uma estratégia."),
          h("label", { class: "td-lb" }, "Seu nome", name), card, ans, err, btn, foot());
      }
      const top = () => h("div", { class: "td-ph-top" }, logo(), h("h4", {}, "Briefing ", h("i", {}, "relâmpago")));
      const foot = () => h("div", { class: "td-ph-foot" }, ...(s.footer?.length ? s.footer.map((f) => h("img", { src: src(f.img), alt: f.alt || "", style: f.h ? `height:${f.h}px` : null })) : [h("span", {}, "@gustavoelian"), h("span", {}, s.brand || "")]));
      phoneReset();
      const phone = h("div", { class: "td-phone", id: "aluno", role: "group", "aria-label": "Tela do aluno (celular)" }, h("span", { class: "td-notch", "aria-hidden": "true" }), scr);
      // respostas simuladas chegam quando o bloco aparece
      let started = false, timer = null;
      function startSeed() {
        clearTimeout(timer);
        let i = 0;
        const next = () => { if (i >= seed.length) return; add(seed[i++]); timer = setTimeout(next, 900 + Math.random() * 1400); };
        if (started) return; started = true; timer = setTimeout(next, 600);
      }
      const sec = h("section", { class: "blk tdemo panel on-panel" }, h("div", { class: "wrap" }, head(s),
        h("div", { class: "td-grid" },
          h("figure", { class: "td-col" }, tv, h("figcaption", {}, "Moderador · telão")),
          h("figure", { class: "td-col ph" }, phone, h("figcaption", {}, "Aluno · celular"))),
        s.note ? h("p", { class: "td-note" }, s.note) : null));
      if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); startSeed(); } }, { threshold: 0.25 }); requestAnimationFrame(() => io.observe(sec)); } else startSeed();
      return sec;
    };
    return R;
  }

  let cleanup = null;
  function run(root) {
    cleanup?.();
    const all = (q) => [...root.querySelectorAll(q)];
    if (RM.matches || !("IntersectionObserver" in window)) { all("[data-fx]").forEach((e) => e.classList.add("in")); all(".reels video").forEach((v) => { v.controls = true; }); cleanup = null; return; }
    // Entrada escalonada: cada bloco aparece ao entrar na tela
    // blocos com clip-path têm área visível zero: observa-se o painel inteiro e abre os blocos juntos
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      if (e.target.classList.contains("bd")) e.target.querySelectorAll(":scope > [data-fx]").forEach((b) => b.classList.add("in"));
      else e.target.classList.add("in");
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    all("[data-fx]").forEach((e) => { if (!e.classList.contains("bk")) io.observe(e); });
    all(".bd").forEach((e) => io.observe(e));
    // Parallax leve (usa "translate" para não brigar com as animações de transform)
    const par = all("[data-par]");
    let tick = false;
    const onScroll = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        tick = false; const vh = innerHeight;
        for (const e of par) {
          const r = (e.parentElement || e).getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) continue;
          e.style.translate = `0 ${((r.top + r.height / 2 - vh / 2) * parseFloat(e.dataset.par)).toFixed(1)}px`;
        }
      });
    };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    // Mosaico vivo: de tempos em tempos um bloco visível gira
    const tiles = all(".mosaic .tile");
    const iv = tiles.length ? setInterval(() => {
      if (document.hidden) return;
      const vis = tiles.filter((t) => { const r = t.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
      if (!vis.length) return;
      const t = vis[(Math.random() * vis.length) | 0];
      t.classList.remove("flip"); void t.offsetWidth; t.classList.add("flip");
    }, 1400) : 0;
    // todos os vídeos da página (vinhetas, faixas, capas) passam pelo mesmo controle de reprodução do site
    all("video:not([controls])").forEach((v) => window.GE?.watchVideo ? window.GE.watchVideo(v) : (v.muted = true, v.play().catch(() => {})));
    cleanup = () => { io.disconnect(); removeEventListener("scroll", onScroll); clearInterval(iv); };
  }
  return { extend, run };
})();
