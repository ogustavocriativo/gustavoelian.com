// Ambiente por requisição (variáveis e bindings do Worker), usado pelos shims do Netlify.
export const RT: { env: any; ctx: any } = { env: {}, ctx: null };
(globalThis as any).Netlify = { env: { get: (k: string) => { const v = RT.env?.[k]; return typeof v === "string" ? v : undefined; } } };
