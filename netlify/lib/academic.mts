// Currículo acadêmico do site (/academico): perfil, formação e produção (projetos, apresentações com slides,
// minicursos, publicações, docência, vídeos). Editado no Studio; DEFAULT é o ponto de partida, montado a partir
// da apresentação da arguição do doutorado (PPGCom/UERJ) e do que o Gustavo informou.

export const ACAD_TYPES = {
  projeto: "Projetos e eventos",
  apresentacao: "Apresentações em eventos",
  minicurso: "Minicursos e oficinas",
  publicacao: "Publicações",
  docencia: "Docência e bancas",
  video: "Vídeos e lives",
} as const;
export type AcadType = keyof typeof ACAD_TYPES;
export const LOGOS = ["unimontes", "ppgh", "uerj", "fcs", "ppgcom", "alcar"] as const;

const str = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const list = (v: any, n: number, m: number) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((x: any) => str(x, m)).filter(Boolean).slice(0, n);
const url = (v: any) => { const u = str(v, 500); return /^(https?:\/\/|\/)[^\s]+$/i.test(u) ? u : ""; };
const media = (v: any) => (v && /^[a-z0-9-]{2,80}-page-[a-z0-9]{6,24}$/.test(String(v.key || "")) ? { key: String(v.key), type: str(v.type, 60), name: str(v.name, 140) } : null);
const logos = (v: any) => (Array.isArray(v) ? v : []).filter((x: any) => (LOGOS as readonly string[]).includes(x)).slice(0, 4);

export function cleanAcademic(b: any) {
  const p = b?.profile || {};
  return {
    profile: {
      name: str(p.name, 120), photo: media(p.photo),
      status: (Array.isArray(p.status) ? p.status : []).slice(0, 6).map((s: any) => ({ label: str(s.label, 60), org: str(s.org, 160), logo: logos([s.logo])[0] || "" })).filter((s: any) => s.label || s.org),
      lattesId: str(p.lattesId, 20).replace(/\D/g, ""), orcid: str(p.orcid, 25), email: str(p.email, 120),
      bio: str(p.bio, 2000), citation: str(p.citation, 300), lines: list(p.lines, 10, 60),
    },
    formacao: (Array.isArray(b?.formacao) ? b.formacao : []).slice(0, 12).map((f: any) => ({
      level: str(f.level, 140), org: str(f.org, 160), years: str(f.years, 40), note: str(f.note, 300), thesis: str(f.thesis, 300), logos: logos(f.logos),
    })).filter((f: any) => f.level),
    items: (Array.isArray(b?.items) ? b.items : []).slice(0, 300).map((i: any) => ({
      id: str(i.id, 40) || Math.random().toString(36).slice(2, 10),
      type: (Object.keys(ACAD_TYPES) as string[]).includes(i.type) ? i.type : "projeto",
      title: str(i.title, 240), event: str(i.event, 200), role: str(i.role, 200), date: str(i.date, 40), year: str(i.year, 4).replace(/\D/g, ""),
      status: str(i.status, 40), summary: str(i.summary, 1200), ref: str(i.ref, 600),
      chips: list(i.chips, 8, 60), stats: (Array.isArray(i.stats) ? i.stats : []).slice(0, 4).map((s: any) => ({ n: str(s.n, 12), l: str(s.l, 60) })).filter((s: any) => s.n),
      link: url(i.link), linkLabel: str(i.linkLabel, 40), project: str(i.project, 60),
      cover: url(i.cover) || "", coverMedia: media(i.coverMedia),
      slides: media(i.slides), slidesUrl: url(i.slidesUrl), video: url(i.video),
      featured: !!i.featured, hidden: !!i.hidden,
    })).filter((i: any) => i.title),
  };
}

export const DEFAULT_ACADEMIC = cleanAcademic({
  profile: {
    name: "Gustavo Elian Siqueira Montes",
    status: [
      { label: "Mestrando em História Social", org: "PPGH · Universidade Estadual de Montes Claros", logo: "unimontes" },
      { label: "Aprovado no Doutorado em Comunicação", org: "PPGCom · FCS · Universidade do Estado do Rio de Janeiro", logo: "uerj" },
      { label: "Associado", org: "Alcar · Associação Brasileira de Pesquisadores de História da Mídia", logo: "alcar" },
    ],
    lattesId: "6725725752399564", orcid: "0009-0007-4985-5658", email: "contato@gustavoelian.com",
    bio: "Mestrando pelo Programa de Pós-graduação em História Social da Universidade Estadual de Montes Claros. Graduado em Comunicação Social com habilitação em Publicidade e Propaganda pelo Centro Universitário Afya Montes Claros. Pesquisador em história, comunicação e cultura, com ênfase em semiótica, imprensa e política.",
    citation: "MONTES, G. E. S.; ELIAN, Gustavo; SIQUEIRA MONTES, Gustavo Elian",
    lines: ["Semiótica", "Imprensa e política", "História da mídia", "Veridicção política", "Tecnologias de comunicação"],
  },
  formacao: [
    { level: "Doutorado em Comunicação", org: "PPGCom · Faculdade de Comunicação Social · UERJ", years: "Aprovado em 2026", note: "Linha Tecnologias de Comunicação e Cultura.", thesis: "O tempo profundo da veridicção: uma anarqueologia entre mídia oitocentista e a dadosfera eleitoral contemporânea", logos: ["uerj", "fcs", "ppgcom"] },
    { level: "Mestrado em História Social", org: "PPGH · Universidade Estadual de Montes Claros", years: "2025–2026", note: "Orientação: Prof. Dr. César Henrique de Queiroz Porto.", thesis: "Performances semióticas na imprensa: signos intencionados pela Gazeta de Notícias na transição do Império à República (1888-1890)", logos: ["unimontes", "ppgh"] },
    { level: "Comunicação Social · Publicidade e Propaganda", org: "Afya Montes Claros", years: "2020–2023", note: "Orientação: Prof. Dr. Gustavo Souza Santos.", thesis: "Projetos de país e identidade nacional em disputa: uma análise semiótica das eleições presidenciais de 2022", logos: [] },
  ],
  items: [
    { id: "enehisp-2", type: "projeto", title: "II ENEHISP · Encontro de Estudos em História Política", event: "Unimontes · 6 a 9 out. 2026", year: "2026", role: "Presidente da Comissão Científica", chips: ["Comissão científica e editorial", "Coordenação do ST 10", "Mediação do Pré-ENEHISP", "Apresentação da abertura", "Sistema do evento", "Identidade visual"], stats: [{ n: "257", l: "trabalhos submetidos" }, { n: "21", l: "simpósios temáticos e sessões livres" }], summary: "Avaliação às cegas e fluxo editorial das submissões, coordenação do Simpósio Imagem e Imprensa (o com mais submissões, em duas sessões), sistema próprio do evento (confirmação, cronômetro, mural de avaliação e tutoriais) e toda a comunicação: identidade, editais, cadernos de resumos e divulgação.", project: "enehisp", link: "/projetos/enehisp", linkLabel: "Ver o case", cover: "/video/enehisp/capa-abertura.jpg", featured: true },
    { id: "conahist-14", type: "projeto", title: "XIV CONAHIST · Congresso Nacional de História da Unimontes", event: "Montes Claros, São Francisco e Janaúba · 24 a 26 nov. 2026", year: "2026", role: "Comunicação e identidade do evento", chips: ["Identidade e redes", "Materiais oficiais", "Minicurso"], summary: "Identidade, feed, reels, camisa da comissão e materiais oficiais do congresso, que inaugura a nova marca do Departamento de História da Unimontes.", project: "conahist", link: "/projetos/conahist", linkLabel: "Ver o case", cover: "/img/cases/conahist/capa.jpg", featured: true },
    { id: "enehisp-1", type: "projeto", title: "I ENEHISP · Encontro de Estudos em História Política", event: "Unimontes", role: "Comissão organizadora", summary: "Integrou a comissão organizadora da primeira edição do encontro." },
    { id: "gazeta", type: "projeto", title: "Gazeta · Investigação 1888–1890", event: "Pesquisa de mestrado · PPGH/Unimontes", year: "2026", role: "Sistema de pesquisa", summary: "Acervo das capas da Gazeta de Notícias, com busca, notas e exportação em ABNT.", cover: "/img/proj/investiga-gazeta.jpg" },
    { id: "ap-alcar-2026", type: "apresentacao", title: "A invenção visual da República (1889): semiótica e disputas narrativas na Gazeta de Notícias", event: "IX ALCAR Sudeste de História da Mídia · GT História da Mídia Visual · ECO/UFRJ", year: "2026", status: "Inclusão nos anais confirmada", cover: "/img/academico/capas/alcar-sudeste-2026.webp" },
    { id: "ap-tetecult-2026", type: "apresentacao", title: "Das prensas rotativas às tecnologias algorítmicas: veridicção política nas eleições gerais de 1889 e presidenciais de 2022 no Brasil", event: "TETECULT 2026 · VI Congresso Discente do PPGCOM/UERJ · GT 2: Comunicação e Política", date: "24 set. 2026", year: "2026", cover: "/img/academico/capas/tetecult-2026.webp", featured: true },
    { id: "ap-pre-enehisp", type: "apresentacao", title: "A imagem como campo de disputa: experiências de pesquisa em História Política", event: "Pré-ENEHISP · Unimontes", year: "2026", role: "Mediação" },
    { id: "ap-seminario-2025", type: "apresentacao", title: "Entre o dito e o instituído: mídia, poder simbólico e a invenção da república", event: "VI Seminário Nacional de Pesquisa em História Social · Unimontes", year: "2025", role: "Com S. M. F. Cardoso" },
    { id: "ap-jornada-2025", type: "apresentacao", title: "O sonho da terra prometida: a publicização da identidade nacional por O Cortiço", event: "II Jornada de Estudos em História e Literatura · PUC Minas", year: "2025", cover: "/img/academico/capas/jornada-historia-literatura-2025.webp" },
    { id: "mc-conahist", type: "minicurso", title: "Acervos e IAs: a integridade da pesquisa historiográfica e o uso ético de recursos generativos", event: "XIV CONAHIST · Unimontes", year: "2026", role: "Ministrante, a convite do Prof. Dr. César Porto", summary: "Minicurso sobre pesquisa em acervos digitais e o uso ético de recursos generativos na historiografia." },
    { id: "pb-hp-2026", type: "publicacao", title: "Espólios canônicos da monarquia e o advento republicano: imagem e semiótica pela Gazeta (1889)", event: "Revista Histórias Públicas, v. 4, n. 8 · Dossiê História, imagens e política", year: "2026", status: "Aprovado para publicação", chips: ["Artigo em periódico"] },
    { id: "pb-rm-2026", type: "publicacao", title: "Semiótica e história social no branding: conversão de signos urbanos em ícones marcários", event: "Revista Multidisciplinar, v. 39, n. 1, p. 1–26", year: "2026", role: "Com G. S. Santos", chips: ["Artigo em periódico"] },
    { id: "pb-rm-2024", type: "publicacao", title: "Projetos de país e identidade nacional em disputa: análise semiótica das eleições de 2022", event: "Revista Multidisciplinar, v. 37, n. 1, p. 191–223", year: "2024", role: "Com G. S. Santos", chips: ["Artigo em periódico"], cover: "/img/academico/capas/revista-multidisciplinar-2024.webp" },
    { id: "pb-alcar-2026", type: "publicacao", title: "A invenção visual da República (1889): semiótica e disputas narrativas na Gazeta de Notícias", event: "Anais do IX ALCAR Sudeste de História da Mídia · ECO/UFRJ", year: "2026", status: "Aprovado", chips: ["Texto completo em anais"] },
    { id: "pb-jornada-2025", type: "publicacao", title: "O sonho da terra prometida: a publicização da identidade nacional por O Cortiço", event: "Anais da II Jornada de Estudos em História e Literatura · PUC Minas, v. 2, p. 117–127", year: "2025", chips: ["Texto completo em anais"], cover: "/img/academico/capas/jornada-historia-literatura-2025.webp" },
    { id: "pb-seminario-2025", type: "publicacao", title: "Entre Freyre e Bourdieu: racismo e discurso no governo Bolsonaro", event: "Anais do VI Seminário Nacional de Pesquisa em História Social · Unimontes, v. 1, p. 161–170", year: "2025", role: "Com S. M. F. Cardoso", chips: ["Texto completo em anais"] },
    { id: "pb-livro-2026", type: "publicacao", title: "Estudos em História Política: poder e relações sociais", event: "Organização: Gustavo Elian Siqueira Montes (Unimontes), Milene do Carmo Gomes (UFJF) e Samuel Davi Rocha Santos (Unimontes)", year: "2026", chips: ["Organização de livro"], summary: "Coletânea resultante dos trabalhos apresentados no II ENEHISP.", featured: true },
    { id: "dc-senai", type: "docencia", title: "Professor visitante · cursos técnicos em Design Gráfico", event: "SENAI CFP Luiz de Paula", year: "2026", date: "2025–2026" },
    { id: "dc-fadenorte", type: "docencia", title: "Professor visitante · cursos técnicos em Design Gráfico", event: "FADENORTE", year: "2025", date: "2024–2025" },
    { id: "dc-bancas", type: "docencia", title: "9 bancas de TCC em Comunicação Social", event: "Afya Montes Claros" },
    { id: "dc-talk-pp", type: "docencia", title: "Talk: o pedido não é o problema", event: "Atendimento e Planejamento Publicitários · PP · Afya Montes Claros", date: "19 out. 2026", year: "2026", role: "Convidado como egresso", project: "talks-pp", link: "/projetos/talks-pp", linkLabel: "Ver o case", cover: "/img/cases/talkpp/capa.jpg" },
  ],
});
