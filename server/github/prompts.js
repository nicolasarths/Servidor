/**
 * Utilitário de Entrada Interativa no Terminal
 * Responsabilidade: Encapsular readline.question em Promises limpas.
 */
function perguntar(rl, texto) {
  return new Promise((resolve) => {
    rl.question(texto, (resposta) => resolve(resposta.trim()));
  });
}

module.exports = { perguntar };