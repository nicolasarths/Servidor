/**
 * Motor de Deploy, NPM Auto-Publish e Monitoramento do GitHub Pages
 * Responsabilidade: Garantir configuração GitHub automaticamente se ausente, versionar, publicar no Git/NPM com resumo limpo e monitorar Pages.
 */
const fs = require("fs");
const path = require("path");
const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
const { executarAssistenteGitHub, garantirIdentidadeGit } = require("./github");
const { detectarGitRemote, detectarModoPacoteNpm } = require("./config");
const {
  executarSilencioso,
  resumirAlteracoesGit,
  exibirCaixaErro,
  exibirCaixaAlerta
} = require("./logger");

async function aguardarDeployGitHubPages(versaoAlvo, config) {
  if (!config.githubUser || !config.repoName || config.isNpmPackage) return;

  const checkFile = config.pagesCheckFile || "index.html";
  const urlBase = `https://${config.githubUser}.github.io/${config.repoName}`;
  const targetUrl = `${urlBase}/${checkFile}`;

  console.log(`📡 [Pages] Monitorando build em ${urlBase}/ ...`);

  const intervaloMs = 5000;
  const maxTentativas = 48;
  let tentativas = 0;
  const inicio = Date.now();

  const timer = setInterval(async () => {
    tentativas++;
    const decorridoSegundos = Math.round((Date.now() - inicio) / 1000);

    try {
      const url = `${targetUrl}?_nocache=${Date.now()}`;
      const res = await fetch(url, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });

      if (res.ok) {
        if (checkFile === "manifest.json") {
          const json = await res.json().catch(() => ({}));
          if (json.version === versaoAlvo) {
            clearInterval(timer);
            try { process.stdout.write("\x07"); } catch (_) {}
            console.log(`🎉 [Pages NO AR] v${versaoAlvo} publicada em ${decorridoSegundos}s!`);
            return;
          }
        } else {
          const html = await res.text();
          if (html.includes(versaoAlvo) || tentativas >= 4) {
            clearInterval(timer);
            try { process.stdout.write("\x07"); } catch (_) {}
            console.log(`🎉 [Pages NO AR] Atualização publicada em ${decorridoSegundos}s!`);
            return;
          }
        }
      }
    } catch (_) {}

    if (tentativas >= maxTentativas) {
      clearInterval(timer);
      exibirCaixaAlerta(
        "Tempo limite do monitor do GitHub Pages excedido (4 min).",
        `Verifique o status em: https://github.com/${config.githubUser}/${config.repoName}/actions`
      );
    }
  }, intervaloMs);
}

function incrementarVersaoPacoteNpm(pkgDir) {
  const pkgPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;

  const res = executarSilencioso("npm version patch --no-git-tag-version", pkgDir);
  if (!res.ok) {
    exibirCaixaAlerta("Não foi possível incrementar a versão do package.json", res.stderr);
    return null;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version;
  } catch (_) {
    return null;
  }
}

function publicarNoNpm(pkgDir, versao) {
  process.stdout.write(`⏳ Publicando v${versao} no NPM... `);
  const res = executarSilencioso("npm publish --access public", pkgDir);

  if (res.ok) {
    console.log(`✅ Concluído! (@nicolasarths/devserver@${versao})`);
  } else {
    console.log(`❌ Falhou!`);
    exibirCaixaErro(`Falha ao publicar v${versao} no NPM`, res.stderr || res.stdout);
  }
}

async function publicarAtualizacao(rl, mensagemCommit, rootDir, config) {
  let configAtual = config;
  let remote = detectarGitRemote(rootDir);

  if (!remote) {
    exibirCaixaAlerta(
      "Nenhum repositório remoto configurado neste projeto.",
      `Iniciando assistente do GitHub antes de publicar "${mensagemCommit}"...`
    );
    configAtual = await executarAssistenteGitHub(rl, rootDir, configAtual);
    remote = detectarGitRemote(rootDir);

    if (!remote) {
      exibirCaixaAlerta("Publicação cancelada porque nenhum repositório foi vinculado.");
      return configAtual;
    }
  }

  await garantirIdentidadeGit(rl, rootDir);

  const agora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestampVersao = `${agora.getFullYear()}.${agora.getMonth() + 1}.${agora.getDate()}-${pad(agora.getHours())}${pad(agora.getMinutes())}`;

  const modoNpm = configAtual.isNpmPackage
    ? { isNpmPackage: true, npmPackageDir: configAtual.npmPackageDir }
    : detectarModoPacoteNpm(rootDir);

  let versaoNpm = null;
  if (modoNpm.isNpmPackage && modoNpm.npmPackageDir) {
    versaoNpm = incrementarVersaoPacoteNpm(modoNpm.npmPackageDir);
  }

  const indexPath = path.join(rootDir, "index.html");
  if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, "utf-8");
    const atualizado = indexHtml.replace(
      /(src=["']\.\/[^"']+\.js)(\?v=[^"'\s>]+)?(["'])/g,
      `$1?v=${timestampVersao}$3`
    );
    if (atualizado !== indexHtml) {
      fs.writeFileSync(indexPath, atualizado, "utf-8");
    }
  }

  const manifestPath = path.join(rootDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      manifest.version = timestampVersao;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    } catch (_) {}
  }

  executarHooksOpcionais(rootDir);
  gerarProjetoCompleto(rootDir, configAtual.snapshotExtensions);

  const branch = configAtual.branch || "main";
  const addRes = executarSilencioso("git add .", rootDir);
  if (!addRes.ok) {
    exibirCaixaErro("Erro ao preparar arquivos (git add)", addRes.stderr);
    return configAtual;
  }

  const statusRes = executarSilencioso("git status --porcelain", rootDir);
  if (!statusRes.stdout) {
    console.log(`\nℹ️  Nenhuma alteração pendente para publicar.`);
    if (modoNpm.isNpmPackage && versaoNpm) {
      publicarNoNpm(modoNpm.npmPackageDir, versaoNpm);
    }
    return configAtual;
  }

  const resumoArquivos = resumirAlteracoesGit(statusRes.stdout);
  const tagMsg = versaoNpm ? `v${versaoNpm}` : `v${timestampVersao}`;
  const commitMsgFormatada = `${tagMsg}: ${mensagemCommit}`;

  console.log(`\n==================================================`);
  console.log(`🚀 DEPLOY [${configAtual.projectName}] • ${tagMsg}`);
  console.log(`📝 Mensagem: "${mensagemCommit}"`);
  console.log(`📂 Escopo:   ${resumoArquivos}`);
  console.log(`--------------------------------------------------`);

  const commitRes = executarSilencioso(
    `git commit -m "${commitMsgFormatada.replace(/"/g, '\\"')}"`,
    rootDir
  );
  if (!commitRes.ok) {
    exibirCaixaErro("Falha ao criar commit local", commitRes.stderr || commitRes.stdout);
    return configAtual;
  }

  const hashMatch = commitRes.stdout.match(/\[[^\s]+\s+([a-f0-9]+)\]/i);
  const hashCurto = hashMatch ? ` (${hashMatch[1]})` : "";
  console.log(`✅ Commit criado${hashCurto}`);

  process.stdout.write(`⏳ Enviando para GitHub (${remote.githubUser}/${remote.repoName}:${branch})... `);
  const pushRes = executarSilencioso(`git push -u origin ${branch}`, rootDir);
  if (!pushRes.ok) {
    console.log(`❌ Falhou!`);
    exibirCaixaErro(`Falha ao enviar para origin/${branch}`, pushRes.stderr || pushRes.stdout);
    return configAtual;
  }
  console.log(`✅ Concluído!`);

  if (modoNpm.isNpmPackage && versaoNpm) {
    publicarNoNpm(modoNpm.npmPackageDir, versaoNpm);
  } else {
    aguardarDeployGitHubPages(timestampVersao, configAtual);
  }

  console.log(`==================================================`);
  return configAtual;
}

module.exports = { publicarAtualizacao };