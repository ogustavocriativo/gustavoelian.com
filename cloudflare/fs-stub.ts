// O Worker não tem sistema de arquivos: as funções que procuram fontes no disco caem no caminho das fontes em memória.
export const existsSync = () => false;
export const readFileSync = () => { throw new Error("fs indisponível no Worker"); };
export default { existsSync, readFileSync };
