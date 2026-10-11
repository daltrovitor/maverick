// Hello World
/** Entrada da marca na página inicial: chaves compartilhadas entre o <head>, o controlador e a história 3D. */

export const INTRO_STORAGE_KEY = "maverick:intro";

/** Disparado quando a abertura começa a sair: a página por trás anima a chegada. */
export const INTRO_EXIT_EVENT = "maverick:intro-exit";

/**
 * Roda no <head>, antes da primeira pintura, e marca `<html data-intro="playing">` quando a
 * abertura deve tocar: só na página inicial, uma vez por aba (`?abertura` força de novo) e
 * nunca com movimento reduzido. Sem JavaScript o atributo não existe e a abertura não aparece.
 */
export const INTRO_GATE_SCRIPT = `(function(){try{if(location.pathname!=="/")return;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var k="${INTRO_STORAGE_KEY}";if(!/[?&]abertura(=|&|$)/.test(location.search)&&sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");document.documentElement.setAttribute("data-intro","playing")}catch(e){}})();`;
