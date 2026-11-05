// Substituto do @netlify/blobs sobre o R2 do Cloudflare. Cada "store" vira um prefixo no bucket: <store>/<chave>.
import { RT } from "./rt";
type GetType = "json" | "text" | "arrayBuffer" | "blob" | "stream";
const bucket = () => { const b = RT.env.BLOBS; if (!b) throw new Error("R2 BLOBS não configurado"); return b; };

async function body(obj: any, type?: GetType) {
  if (!obj) return null;
  switch (type) {
    case "json": return JSON.parse(await obj.text());
    case "arrayBuffer": return await obj.arrayBuffer();
    case "blob": return new Blob([await obj.arrayBuffer()], { type: obj.httpMetadata?.contentType || "" });
    case "stream": return obj.body;
    default: return await obj.text();
  }
}
const metaOf = (obj: any) => { try { return obj?.customMetadata?.__m ? JSON.parse(obj.customMetadata.__m) : {}; } catch { return {}; } };

export function getStore(opts: { name: string } | string) {
  const name = typeof opts === "string" ? opts : opts.name;
  const k = (key: string) => `${name}/${key}`;
  return {
    async get(key: string, o: { type?: GetType } = {}) { return body(await bucket().get(k(key)), o.type); },
    async getWithMetadata(key: string, o: { type?: GetType } = {}) {
      const obj = await bucket().get(k(key)); if (!obj) return null;
      return { data: await body(obj, o.type), metadata: metaOf(obj), etag: obj.etag };
    },
    async getMetadata(key: string) { const h = await bucket().head(k(key)); return h ? { metadata: metaOf(h), etag: h.etag } : null; },
    async set(key: string, data: any, o: { metadata?: Record<string, unknown> } = {}) {
      const put: any = data instanceof Blob ? await data.arrayBuffer() : data;
      await bucket().put(k(key), put, { customMetadata: o.metadata ? { __m: JSON.stringify(o.metadata) } : undefined });
      return { modified: true };
    },
    async setJSON(key: string, data: unknown, o: { metadata?: Record<string, unknown> } = {}) {
      await bucket().put(k(key), JSON.stringify(data), { httpMetadata: { contentType: "application/json" }, customMetadata: o.metadata ? { __m: JSON.stringify(o.metadata) } : undefined });
      return { modified: true };
    },
    async delete(key: string) { await bucket().delete(k(key)); },
    async list(o: { prefix?: string; directories?: boolean } = {}) {
      const pre = `${name}/${o.prefix || ""}`;
      const blobs: { key: string; etag: string }[] = []; const dirs = new Set<string>();
      let cursor: string | undefined;
      do {
        const r: any = await bucket().list({ prefix: pre, cursor, limit: 1000 });
        for (const ob of r.objects) {
          const key = ob.key.slice(name.length + 1);
          if (o.directories) { const rest = key.slice((o.prefix || "").length); const i = rest.indexOf("/"); if (i >= 0) { dirs.add((o.prefix || "") + rest.slice(0, i)); continue; } }
          blobs.push({ key, etag: ob.etag });
        }
        cursor = r.truncated ? r.cursor : undefined;
      } while (cursor);
      return { blobs, directories: [...dirs] };
    },
  };
}
