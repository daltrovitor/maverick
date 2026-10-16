// Hello World
/** Entrada da marca na página inicial: chaves compartilhadas entre o <head>, o controlador e a história 3D. */

/** Disparado quando a abertura começa a sair: a página por trás anima a chegada. */
export const INTRO_EXIT_EVENT = "maverick:intro-exit";

/**
 * Roda no <head>, antes da primeira pintura, e marca `<html data-intro="playing">` quando a
 * abertura deve tocar: em todo carregamento da página inicial (inclusive no reload), nunca com
 * movimento reduzido. Sem JavaScript o atributo não existe e a abertura não aparece.
 */
export const INTRO_GATE_SCRIPT = `(function(){try{if(location.pathname!=="/")return;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;document.documentElement.setAttribute("data-intro","playing")}catch(e){}})();`;

type HoldTask = () => Promise<unknown>;

let holdTask: HoldTask | null = null;

/**
 * A cena 3D se registra enquanto a abertura toca. Ela só usa a GPU (contexto, shaders,
 * texturas) quando o logo já está montado e parado: a abertura segura essa pose até a cena
 * ficar pronta (com teto), então nada engasga as animações.
 */
export function setIntroHold(task: HoldTask | null): void {
  holdTask = task;
}

/** Chamado pela abertura quando o logo termina de montar; resolve quando a cena está pronta. */
export function runIntroHold(): Promise<unknown> {
  return holdTask ? holdTask().catch(() => undefined) : Promise.resolve();
}
