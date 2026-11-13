/**
 * Menu Interativo do Terminal
 * Responsabilidade: Exibir dica formatada em linha única no boot, renderizar o menu com descrições em cinza médio sob demanda (/menu) e rotear ações.
 */
const readline = require("readline");
const { salvarConfig, detectarGitRemote } = require("./config");
const { executarAssistenteGitHub, garantirIdentidadeGit } = require("./github");
const { perguntar } = require("./github/prompts");
const { publicarAtualizacao } = require("./deploy");

const MENSAGEM_PADRAO = "Update sem descrição";

// Códigos ANSI para formatação visual no terminal
const NEGRITO = "\x1b[1m";
const ITALICO = "\x1b[3m";
const CINZA = "\x1b[90m";
const CIANO = "\x1b[36m";
const RESET = "\x1b[0m";

function exibirDicaMenu() {
  console.log(
    `💡 ${NEGRITO}${CIANO}/menu${RESET} para opções | ` +
    `${NEGRITO}${CIANO}Mensagem de Commit + Enter${RESET} para salvar no Github | ` +
    `${NEGRITO}${CIANO}Somente Enter${RESET} commitar ${ITALICO}${CINZA}"${MENSAGEM_PADRAO}"${RESET}.\n`
  );
}

function exibirMenu(rootDir, config) {
  const remote = detectarGitRemote(rootDir);
  const statusGit = remote
    ? `${remote.githubUser}/${remote.repoName} (${config.branch || "main"})`
    : "Não vinculado (digite 2 para configurar)";

  const modoDetectado = config.isNpmPackage
    ? `NPM (${config.packageName}) ➔ GitHub + NPM`
    : `Web ➔ GitHub + Pages`;

  console.log(`\n--------------------------------------------------`);
  console.log(`🔍 ${modoDetectado}`);
  console.log(`🐙 ${statusGit}`);
  console.log(`--------------------------------------------------`);
  console.log(`  [1] 🚀 Novo commit          ${CINZA}(faz add, commit e push/publish agora)${RESET}`);
  console.log(`  [2] 🐙 Repositório GitHub   ${CINZA}(cria novo repo ou vincula URL existente)${RESET}`);
  console.log(`  [3] ⚙️  Configurar projeto   ${CINZA}(altera porta HTTP, branch ou nome do repo)${RESET}`);
  console.log(`  [4] 📊 Ver status           ${CINZA}(mostra pasta raiz, modo, porta e remote)${RESET}`);
  console.log(`  [5] 🧹 Limpar tela          ${CINZA}(limpa o histórico visual do terminal)${RESET}`);
  console.log(`  [0] ❌ Sair                 ${CINZA}(encerra o servidor e o monitoramento)${RESET}`);
  console.log(`--------------------------------------------------`);
}

async function configurarOpcoesProjeto(rl, rootDir, config) {
  console.log(`\n⚙️ CONFIGURAÇÕES (${config.projectName})`);
  const porta = await perguntar(rl, `🔌 Porta [${config.port || 8081}]: `);
  const branch = await perguntar(rl, `🌿 Branch [${config.branch || "main"}]: `);
  const user = await perguntar(rl, `👤 Usuário GitHub [${config.githubUser}]: `);
  const repo = await perguntar(rl, `📦 Repositório [${config.repoName}]: `);

  const novaConfig = {
    ...config,
    port: Number(porta) || config.port || 8081,
    branch: branch || config.branch || "main",
    githubUser: user || config.githubUser,
    repoName: repo || config.repoName
  };

  salvarConfig(rootDir, novaConfig);
  console.log(`✅ Salvo em .devserver.json! (Reinicie se alterou a porta).`);
  return novaConfig;
}

async function iniciarMenuInterativo(rootDir, configInicial) {
  let configAtual = configInicial;
  let ocupado = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  ocupado = true;
  try {
    await garantirIdentidadeGit(rl, rootDir);
  } finally {
    ocupado = false;
  }

  exibirDicaMenu();

  rl.on("line", async (linha) => {
    if (ocupado) return;

    const entrada = linha.trim();

    ocupado = true;
    try {
      if (entrada === "/menu" || entrada.toLowerCase() === "menu") {
        exibirMenu(rootDir, configAtual);
        return;
      }

      if (entrada === "0") {
        console.log("\n👋 Servidor encerrado.");
        process.exit(0);
      }

      if (entrada === "1") {
        const msg = await perguntar(rl, `\n📝 Mensagem [${MENSAGEM_PADRAO}]: `);
        configAtual = await publicarAtualizacao(rl, msg || MENSAGEM_PADRAO, rootDir, configAtual);
        exibirDicaMenu();
        return;
      }

      if (entrada === "2") {
        configAtual = await executarAssistenteGitHub(rl, rootDir, configAtual);
        exibirDicaMenu();
        return;
      }

      if (entrada === "3") {
        configAtual = await configurarOpcoesProjeto(rl, rootDir, configAtual);
        exibirDicaMenu();
        return;
      }

      if (entrada === "4") {
        const remote = detectarGitRemote(rootDir);
        console.log(`\n📊 STATUS:`);
        console.log(`   • Raiz:   ${rootDir}`);
        console.log(`   • Modo:   ${configAtual.isNpmPackage ? `Pacote NPM (${configAtual.packageName})` : "Projeto Web / GitHub"}`);
        console.log(`   • Porta:  ${configAtual.port}`);
        console.log(`   • Remote: ${remote ? remote.remoteUrl : "(não vinculado)"}`);
        console.log(`   • Branch: ${configAtual.branch || "main"}`);
        exibirDicaMenu();
        return;
      }

      if (entrada === "5") {
        console.clear();
        exibirDicaMenu();
        return;
      }

      const mensagemFinal = entrada || MENSAGEM_PADRAO;
      configAtual = await publicarAtualizacao(rl, mensagemFinal, rootDir, configAtual);
      exibirDicaMenu();
    } finally {
      ocupado = false;
    }
  });
}

module.exports = { iniciarMenuInterativo };