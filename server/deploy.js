/**
 * Motor de Deploy, NPM Auto-Publish e Monitoramento do GitHub Pages
 * Responsabilidade: Garantir configuração GitHub automaticamente se ausente, versionar, publicar no Git/NPM e monitorar Pages.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
const { executarAssistenteGitHub, garantirIdentidadeGit } = require("./github");
const { detectarGitRemote, localizarPastaPacoteNpm } = require("./config");

async function aguardarDeployGitHubPages(versaoAlvo, config) {
  if (!config.githubUser || !config.repoName || config.autoNpmPublish) return;

  const checkFile = config.pagesCheckFile || "index.html";
  const urlBase = `https://${config.githubUser}.github.io/${config.repoName}`;
  const targetUrl = `${urlBase}/${checkFile}`;

  console.log(`\n==================================================`);
  console.log(`📡 [Monitor Pages] Acompanhando build no GitHub...`);
  console.log(`🌐 URL: ${urlBase}/`);
  if (checkFile === "manifest.json") {
    console.log(`🎯 Aguardando versão remota: v${versaoAlvo}`);
  }
  console.log(`==================================================\n`);

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
            console.log(`\n🎉 [GITHUB PAGES NO AR!] v${versaoAlvo} publicada em ${decorridoSegundos}s!\n`);
            return;
          }
        } else {
          const html = await res.text();
          if (html.includes(versaoAlvo) || tentativas >= 4) {
            clearInterval(timer);
            try { process.stdout.write("\x07"); } catch (_) {}
            console.log(`\n🎉 [GITHUB PAGES NO AR!] Atualização publicada em ${decorridoSegundos}s!\n`);
            return;
          }
        }
      }
    } catch (_) {}

    console.log(`⏳ [${decorridoSegundos}s] GitHub Actions compilando...`);

    if (tentativas >= maxTentativas) {
      clearInterval(timer);
      console.log(`\n⚠️ Tempo limite de monitorização excedido (4 min).`);
      console.log(`Verifique em: https://github.com/${config.githubUser}/${config.repoName}/actions\n`);
    }
  }, intervaloMs);
}

function incrementarVersaoPacoteNpm(pkgDir) {
  const pkgPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;

  try {
    execSync("npm version patch --no-git-tag-version", { cwd: pkgDir, stdio: "ignore" });
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    console.log(`📦 [NPM] Versão do pacote incrementada para: ${pkg.version}`);
    return pkg.version;
  } catch (err) {
    console.error(`⚠️ Não foi possível incrementar versão no package.json:`, err.message);
    return null;
  }
}

function publicarNoNpm(pkgDir, versao) {
  try {
    console.log(`🚀 [NPM] Publicando v${versao} no registro do npm...`);
    execSync("npm publish --access public", { cwd: pkgDir, stdio: "inherit" });
    console.log(`🎉 [NPM PUBLICADO!] v${versao} já está disponível via npx!\n`);
  } catch (err) {
    console.error(`❌ Falha ao publicar no npm:`, err.message);
  }
}

async function publicarAtualizacao(rl, mensagemCommit, rootDir, config) {
  let configAtual = config;
  let remote = detectarGitRemote(rootDir);

  // Se ainda não há repositório vinculado, abre o assistente imediatamente e continua o deploy depois!
  if (!remote) {
    console.log(`\n⚠️ Nenhum repositório remoto configurado neste projeto ainda!`);
    console.log(`🔧 Iniciando configuração automática do GitHub antes de publicar "${mensagemCommit}"...\n`);
    configAtual = await executarAssistenteGitHub(rl, rootDir, configAtual);
    remote = detectarGitRemote(rootDir);

    if (!remote) {
      console.log(`❌ Publicação interrompida porque nenhum repositório foi vinculado.\n`);
      return configAtual;
    }
  }

  await garantirIdentidadeGit(rl, rootDir);

  const agora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestampVersao = `${agora.getFullYear()}.${agora.getMonth() + 1}.${agora.getDate()}-${pad(agora.getHours())}${pad(agora.getMinutes())}`;

  console.log(`\n📦 [Deploy ${configAtual.projectName}] Publicando: "${mensagemCommit}"`);
  console.log(`🏷️ Versão gerada: v${timestampVersao}`);

  let versaoNpm = null;
  const pkgDir = configAtual.npmPackageDir || localizarPastaPacoteNpm(rootDir) || rootDir;
  if (configAtual.autoNpmPublish) {
    versaoNpm = incrementarVersaoPacoteNpm(pkgDir);
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
      console.log(`✅ Scripts locais do index.html versionados com ?v=${timestampVersao}`);
    }
  }

  const manifestPath = path.join(rootDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      manifest.version = timestampVersao;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      console.log(`✅ manifest.json atualizado para ${timestampVersao}`);
    } catch (_) {}
  }

  executarHooksOpcionais(rootDir);
  gerarProjetoCompleto(rootDir, configAtual.snapshotExtensions);

  try {
    const branch = configAtual.branch || "main";
    execSync("git add .", { stdio: "inherit", cwd: rootDir });

    // Verifica se há alterações pendentes para commitar (caso o assistente já tenha feito o initial commit)
    const statusPorcelain = execSync("git status --porcelain", { cwd: rootDir }).toString().trim();
    if (!statusPorcelain) {
      console.log(`ℹ️ Nenhuma alteração nova pendente após o setup inicial.`);
      if (configAtual.autoNpmPublish && versaoNpm) {
        publicarNoNpm(pkgDir, versaoNpm);
      }
      return configAtual;
    }

    const tagMsg = versaoNpm ? `v${versaoNpm}` : `v${timestampVersao}`;
    const commitMsgFormatada = `${tagMsg}: ${mensagemCommit}`;
    execSync(`git commit -m "${commitMsgFormatada.replace(/"/g, '\\"')}"`, { stdio: "inherit", cwd: rootDir });

    console.log(`🚀 Enviando para origin/${branch}...`);
    execSync(`git push -u origin ${branch}`, { stdio: "inherit", cwd: rootDir });

    console.log(`✅ Push no GitHub concluído com sucesso!`);

    if (configAtual.autoNpmPublish && versaoNpm) {
      publicarNoNpm(pkgDir, versaoNpm);
    } else {
      aguardarDeployGitHubPages(timestampVersao, configAtual);
    }
  } catch (err) {
    console.error(`\n❌ Falha durante o deploy:`, err.message);
  }

  return configAtual;
}

module.exports = { publicarAtualizacao };