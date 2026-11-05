// Substituto do @resvg/resvg-js (nativo) pela versão WebAssembly; as fontes vêm dos arquivos estáticos do site.
import { initWasm, Resvg as R } from "@resvg/resvg-wasm";
// @ts-ignore: módulo wasm empacotado pelo wrangler
import wasm from "@resvg/resvg-wasm/index_bg.wasm";
import { RT } from "./rt";
let ready: Promise<void> | null = null;
let fonts: Uint8Array[] = [];
export async function prepareResvg(origin: string) {
  ready ||= (async () => {
    await initWasm(wasm);
    fonts = await Promise.all(["LTWave-Light.otf", "LTWave-Medium.otf"].map(async (f) => new Uint8Array(await (await RT.env.ASSETS.fetch(new Request(`${origin}/fonts/${f}`))).arrayBuffer())));
  })();
  await ready;
}
export class Resvg {
  r: any;
  constructor(svg: string, opts: any = {}) {
    this.r = new R(svg, { ...opts, font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: opts?.font?.defaultFontFamily || "LT Wave" } });
  }
  render() { return this.r.render(); }
}
