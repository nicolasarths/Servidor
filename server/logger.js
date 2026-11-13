/**
 * Executor Silencioso e Formatador de Logs de Deploy
 * Responsabilidade: Executar comandos git/npm sem poluir o terminal, resumir resultados em linhas limpas
 * e destacar alertas ou erros completos apenas quando necessário.
 */
const { execSync } = require("child_process");

function executarSilencioso(comando, cwd) {
  try {
    const stdout = execSync(comando, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8"
    });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout ? err.stdout.toString().trim() : "",
      stderr: err.stderr ? err.stderr.toString().trim() : err.message
    };
  }
}

function resumirAlteracoesGit(statusPorcelain) {
  const linhas = statusPorcelain.split("\n").filter(Boolean);
  let criados = 0;
  let modificados = 0;
  let removidos = 0;

  for (const linha of linhas) {
    const code = linha.slice(0, 2);
    if (code.includes("?") || code.includes("A")) criados++;
    else if (code.includes("D")) removidos++;
    else modificados++;
  }

  const partes = [];
  if (modificados > 0) partes.push(`${modificados} modificado(s)`);
  if (criados > 0) partes.push(`${criados} novo(s)`);
  if (removidos > 0) partes.push(`${removidos} removido(s)`);

  return `${linhas.length} arquivo(s) (${partes.join(", ")})`;
}

function exibirCaixaErro(titulo, detalhes) {
  console.log(`\n🚨 ================================================`);
  console.log(`❌ FALHA: ${titulo}`);
  console.log(`--------------------------------------------------`);
  console.log(detalhes || "Erro desconhecido durante a execução.");
  console.log(`==================================================\n`);
}

function exibirCaixaAlerta(titulo, mensagem) {
  console.log(`\n⚠️  [ALERTA] ${titulo}`);
  if (mensagem) console.log(`   👉 ${mensagem}`);
}

module.exports = {
  executarSilencioso,
  resumirAlteracoesGit,
  exibirCaixaErro,
  exibirCaixaAlerta
};