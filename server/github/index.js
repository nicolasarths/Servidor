/**
 * Orquestrador do Assistente GitHub
 * Responsabilidade: Conduzir o menu interativo de criação/vinculação de repositório e persistir o token globalmente no Windows.
 */
const path = require("path");
const { execSync } = require("child_process");
const { salvarConfig, detectarGitRemote } = require("../config");
const { perguntar } = require("./prompts");
const { garantirIdentidadeGit } = require("./git-identity");
const { garantirGitIgnore, garantirGitLocal, configurarOrigin } = require("./git-local");
const { criarRepositorioRemotoGitHub, ativarGitHubPages } = require("./github-api");

function lerTokenGlobalWindows() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const out = execSync('reg query "HKCU\\Environment" /v GITHUB_TOKEN', {
      stdio: ["ignore", "pipe", "ignore"]
    }).toString();
    const match = out.match(/GITHUB_TOKEN\s+REG_SZ\s+(\S+)/);
    if (match) {
      process.env.GITHUB_TOKEN = match[1];
      return match[1];
    }
  } catch (_) {}
  return "";
}

function salvarTokenGlobalWindows(token) {
  process.env.GITHUB_TOKEN = token;
  try {
    execSync(`setx GITHUB_TOKEN "${token}"`, { stdio: "ignore" });
    console.log("✅ Token salvo globalmente no Windows (nunca mais será pedido em nenhum projeto!).");
  } catch (err) {
    console.log(`⚠️ Não foi possível gravar no registro do Windows: ${err.message}`);
  }
}

async function executarAssistenteGitHub(rl, rootDir, config) {
  console.log(`\n==================================================`);
  console.log(`🐙 ASSISTENTE DE CONFIGURAÇÃO GITHUB`);
  console.log(`==================================================`);

  const existente = detectarGitRemote(rootDir);
  if (existente) {
    console.log(`ℹ️ Remote atual detectado: ${existente.remoteUrl}`);
  }

  console.log(`\nEscolha uma opção:`);
  console.log(`  [1] Criar um NOVO repositório no GitHub agora`);
  console.log(`  [2] Vincular um repositório JÁ EXISTENTE (via URL)`);
  console.log(`  [3] Atualizar nome/usuário/branch na configuração local`);
  console.log(`  [0] Cancelar\n`);

  const opcao = await perguntar(rl, "👉 Opção: ");

  if (opcao === "0" || !opcao) {
    console.log("Operação cancelada.\n");
    return config;
  }

  garantirGitIgnore(rootDir);
  garantirGitLocal(rootDir, config.branch || "main");
  await garantirIdentidadeGit(rl, rootDir);

  if (opcao === "1") {
    const nomeSugerido = config.repoName || path.basename(rootDir);
    const repoInput = await perguntar(rl, `📦 Nome do repositório [${nomeSugerido}]: `);
    const repoName = repoInput || nomeSugerido;

    const desc = await perguntar(rl, `📝 Descrição (opcional): `);
    const privInput = await perguntar(rl, `🔒 Repositório privado? (s/N): `);
    const privado = privInput.toLowerCase() === "s";

    const pagesInput = await perguntar(rl, `🌐 Ativar GitHub Pages automaticamente? (S/n): `);
    const ativarPages = pagesInput.toLowerCase() !== "n";

    let token = lerTokenGlobalWindows() || config.githubToken || "";
    let tokenNovo = false;

    if (!token) {
      token = await perguntar(rl, `🔑 Cole seu GitHub Personal Access Token (scope 'repo'): `);
      tokenNovo = Boolean(token);
    }

    if (!token) {
      console.log("❌ Token não informado. Abortando criação.\n");
      return config;
    }

    try {
      console.log(`⏳ Criando repositório '${repoName}' no GitHub...`);
      const criado = await criarRepositorioRemotoGitHub({
        token,
        repoName,
        descricao: desc,
        privado
      });

      if (tokenNovo) {
        salvarTokenGlobalWindows(token);
      }

      configurarOrigin(rootDir, criado.cloneUrl);

      const novaConfig = {
        ...config,
        githubUser: criado.githubUser,
        repoName: criado.repoName
      };
      salvarConfig(rootDir, novaConfig);

      const fazerPrimeiroPush = await perguntar(rl, `🚀 Deseja fazer o primeiro commit e push agora? (S/n): `);
      if (fazerPrimeiroPush.toLowerCase() !== "n") {
        execSync("git add .", { cwd: rootDir, stdio: "inherit" });
        execSync(`git commit -m "chore: initial commit"`, { cwd: rootDir, stdio: "inherit" });
        execSync(`git push -u origin ${novaConfig.branch || "main"}`, { cwd: rootDir, stdio: "inherit" });
        console.log(`✅ Primeiro push concluído!`);

        if (ativarPages) {
          await ativarGitHubPages({
            token,
            githubUser: criado.githubUser,
            repoName: criado.repoName,
            branch: novaConfig.branch || "main"
          });
        }
      }

      console.log(`\n✨ Tudo pronto! A partir de agora, digite qualquer mensagem no terminal para publicar.\n`);
      return novaConfig;
    } catch (err) {
      console.error(`\n❌ ${err.message}\n`);
      return config;
    }
  }

  if (opcao === "2") {
    const url = await perguntar(rl, `🔗 Cole a URL do repositório (HTTPS ou SSH): `);
    if (!url) {
      console.log("❌ URL inválida.\n");
      return config;
    }

    configurarOrigin(rootDir, url);
    const info = detectarGitRemote(rootDir);

    const novaConfig = {
      ...config,
      githubUser: info?.githubUser || config.githubUser,
      repoName: info?.repoName || config.repoName
    };
    salvarConfig(rootDir, novaConfig);
    console.log(`✅ Repositório vinculado! User: ${novaConfig.githubUser} | Repo: ${novaConfig.repoName}\n`);
    return novaConfig;
  }

  if (opcao === "3") {
    const user = await perguntar(rl, `👤 Usuário GitHub [${config.githubUser}]: `);
    const repo = await perguntar(rl, `📦 Nome do Repo [${config.repoName}]: `);
    const branch = await perguntar(rl, `🌿 Branch principal [${config.branch || "main"}]: `);
    const port = await perguntar(rl, `🔌 Porta HTTP [${config.port || 8081}]: `);

    const novaConfig = {
      ...config,
      githubUser: user || config.githubUser,
      repoName: repo || config.repoName,
      branch: branch || config.branch || "main",
      port: Number(port) || config.port || 8081
    };
    salvarConfig(rootDir, novaConfig);
    console.log(`✅ Configurações salvas em .devserver.json!\n`);
    return novaConfig;
  }

  return config;
}

module.exports = {
  executarAssistenteGitHub,
  garantirIdentidadeGit
};