/**
 * Menu Interativo do Terminal
 * Responsabilidade: Exibir opções numeradas, rotear escolhas do usuário e disparar deploys (usando "Update sem descrição" se der Enter vazio).
 */
const readline = require("readline");
const { salvarConfig, detectarGitRemote } = require("./config");
const { executarAssistenteGitHub, garantirIdentidadeGit } = require("./github");
const { perguntar } = require("./github/prompts");
const { publicarAtualizacao } = require("./deploy");

const MENSAGEM_PADRAO = "Update sem descrição";

function exibirMenu(rootDir, config) {
  const remote = detectarGitRemote(rootDir);
  const statusGit = remote
    ? `${remote.githubUser}/${remote.repoName} (branch: ${config.branch || "main"})`
    : "Não vinculado (escolha [2] para configurar)";

  console.log(`\n--------------------------------------------------`);
  console.log(`🐙 GitHub: ${statusGit}`);
  console.log(`📦 Auto-Publish NPM: ${config.autoNpmPublish ? "ATIVADO" : "Desativado"}`);
  console.log(`--------------------------------------------------`);
  console.log(`📋 O QUE VOCÊ DESEJA FAZER?`);
  console.log(`  [1] 🚀 Publicar alteração (pedir mensagem de commit)`);
  console.log(`  [2] 🐙 Configurar / Criar repositório no GitHub`);
  console.log(`  [3] 📦 Alternar Auto-Publish no NPM (${config.autoNpmPublish ? "Desativar" : "Ativar"})`);
  console.log(`  [4] ⚙️  Configurar porta, branch ou projeto`);
  console.log(`  [5] 📊 Ver status detalhado`);
  console.log(`  [6] 🧹 Limpar tela`);
  console.log(`  [0] ❌ Sair e encerrar servidor`);
  console.log(`  💡 Atalho: digite a mensagem e dê ENTER (ou só ENTER para "${MENSAGEM_PADRAO}")`);
  console.log(`--------------------------------------------------`);
}

async function configurarOpcoesProjeto(rl, rootDir, config) {
  console.log(`\n⚙️ CONFIGURAÇÕES DO PROJETO (${config.projectName})`);
  const porta = await perguntar(rl, `🔌 Porta HTTP [${config.port || 8081}]: `);
  const branch = await perguntar(rl, `🌿 Branch principal [${config.branch || "main"}]: `);
  const user = await perguntar(rl, `👤 Usuário GitHub [${config.githubUser}]: `);
  const repo = await perguntar(rl, `📦 Nome do repositório [${config.repoName}]: `);

  const novaConfig = {
    ...config,
    port: Number(porta) || config.port || 8081,
    branch: branch || config.branch || "main",
    githubUser: user || config.githubUser,
    repoName: repo || config.repoName
  };

  salvarConfig(rootDir, novaConfig);
  console.log(`✅ Configurações salvas em .devserver.json! (Se mudou a porta, reinicie o servidor).`);
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

  exibirMenu(rootDir, configAtual);

  rl.on("line", async (linha) => {
    if (ocupado) return;

    const entrada = linha.trim();

    ocupado = true;
    try {
      if (entrada === "0") {
        console.log("\n👋 Encerrando servidor...");
        process.exit(0);
      }

      if (entrada === "1") {
        const msg = await perguntar(rl, `\n📝 Digite a mensagem do commit [${MENSAGEM_PADRAO}]: `);
        configAtual = await publicarAtualizacao(rl, msg || MENSAGEM_PADRAO, rootDir, configAtual);
        exibirMenu(rootDir, configAtual);
        return;
      }

      if (entrada === "2") {
        configAtual = await executarAssistenteGitHub(rl, rootDir, configAtual);
        exibirMenu(rootDir, configAtual);
        return;
      }

      if (entrada === "3") {
        configAtual = {
          ...configAtual,
          autoNpmPublish: !configAtual.autoNpmPublish
        };
        salvarConfig(rootDir, configAtual);
        console.log(`\n✅ Auto-Publish NPM agora está: ${configAtual.autoNpmPublish ? "ATIVADO" : "DESATIVADO"}`);
        exibirMenu(rootDir, configAtual);
        return;
      }

      if (entrada === "4") {
        configAtual = await configurarOpcoesProjeto(rl, rootDir, configAtual);
        exibirMenu(rootDir, configAtual);
        return;
      }

      if (entrada === "5") {
        const remote = detectarGitRemote(rootDir);
        console.log(`\n📊 STATUS DETALHADO:`);
        console.log(`   • Pasta Raiz:       ${rootDir}`);
        console.log(`   • Projeto:          ${configAtual.projectName}`);
        console.log(`   • Porta Config:     ${configAtual.port}`);
        console.log(`   • Usuário GitHub:   ${configAtual.githubUser || "(não definido)"}`);
        console.log(`   • Repositório:      ${configAtual.repoName || "(não definido)"}`);
        console.log(`   • Remote Origin:    ${remote ? remote.remoteUrl : "(não vinculado)"}`);
        console.log(`   • Branch:           ${configAtual.branch || "main"}`);
        console.log(`   • Auto NPM Publish: ${configAtual.autoNpmPublish ? "ATIVADO" : "Desativado"}`);
        exibirMenu(rootDir, configAtual);
        return;
      }

      if (entrada === "6") {
        console.clear();
        exibirMenu(rootDir, configAtual);
        return;
      }

      // Se apertar apenas ENTER (vazio) ou digitar texto livre, publica direto!
      const mensagemFinal = entrada || MENSAGEM_PADRAO;
      configAtual = await publicarAtualizacao(rl, mensagemFinal, rootDir, configAtual);
      exibirMenu(rootDir, configAtual);
    } finally {
      ocupado = false;
    }
  });
}

module.exports = { iniciarMenuInterativo };