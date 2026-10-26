// Metatags da prévia de link por proposta: troca título, descrição e imagem genéricos
// pelos da proposta (ex.: "Júlia, sua proposta está pronta"). Só atua nos links de proposta.
const RESERVED = new Set(["acompanhar", "certificado", "projeto", "proposta", "index", "app", "api", "img", "fonts", "video", "data"]);

export default async (req: Request, context: any) => {
  const url = new URL(req.url);
  const slug = url.pathname.replace(/^\/|\/$/g, "").toLowerCase();
  if (!/^[a-z0-9-]{3,60}$/.test(slug) || RESERVED.has(slug)) return;
  const [res, meta] = await Promise.all([
    context.next(),
    fetch(`${url.origin}/api/og/${slug}${url.search}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  if (!meta || !(res.headers.get("content-type") || "").includes("text/html")) return res;
  const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  let html = await res.text();
  html = html
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(meta.title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(meta.description)}`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(meta.description)}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${esc(meta.image)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${esc(url.origin + url.pathname)}`);
  const headers = new Headers(res.headers); headers.delete("content-length");
  return new Response(html, { status: res.status, headers });
};

export const config = { path: "/*", excludedPath: ["/api/*", "/app/*", "/img/*", "/fonts/*", "/video/*", "/data/*", "/projetos/*", "/*.*"] };
