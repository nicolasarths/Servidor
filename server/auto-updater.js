/**
 * Auto-Updater do Pacote @nicolasarths/devserver
 * Responsabilidade: Verificar no registro NPM (com trava de 60s) se há versão mais recente e atualizar
 * a instalação ativa do pacote, retornando o status claro para o watcher exibir ao salvar arquivos.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const PACKAGE_NAME = "@nicolasarths/devserver";
const REGISTRY_URL = "https://registry.npmjs.org/@nicolasarths%2Fdevserver/latest";
const COOLDOWN_MS = 60 * 1000;

let ultimaVerificacaoTimestamp = 0;
let atualizacaoEmAndamento = false;

function isDiretorioDoDevServer(dir) {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.name === PACKAGE_NAME;
  } catch (_) {
    return false;
  }
}

function localizarInstalacaoAtiva() {
  const norm = __dirname.replace(/\\/g, "/").toLowerCase();
  if (norm.includes("/_npx/")) {
    return null;
  }

  if (isDiretorioDoDevServer(__dirname)) {
    return __dirname;
  }

  return null;
}

function obterVersaoLocal(destinoDir) {
  const pkgPath = path.join(destinoDir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.name === PACKAGE_NAME ? pkg.version : null;
  } catch (_) {
    return null;
  }
}

function compararSemver(remota, local) {
  const r = String(remota).split(".").map((n) => parseInt(n, 10) || 0);
  const l = String(local).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return 1;
    if ((r[i] || 0) < (l[i] || 0)) return -1;
  }
  return 0;
}

function copiarArquivosAtualizados(origemDir, destinoDir) {
  const itens = fs.readdirSync(origemDir, { withFileTypes: true });
  for (const item of itens) {
    const srcPath = path.join(origemDir, item.name);
    const destPath = path.join(destinoDir, item.name);

    if (item.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copiarArquivosAtualizados(srcPath, destPath);
    } else if (item.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function limparCacheModulosServer(serverDir) {
  Object.keys(require.cache).forEach((chave) => {
    if (chave.startsWith(serverDir) && !chave.endsWith("auto-updater.js")) {
      delete require.cache[chave];
    }
  });
}

async function baixarEAplicarAtualizacao(tarballUrl, destinoDir, novaVersao) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nic-devserver-"));
  const tgzPath = path.join(tempDir, "package.tgz");
  const extractDir = path.join(tempDir, "extracted");

  try {
    const res = await fetch(tarballUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar tarball`);

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tgzPath, buffer);
    fs.mkdirSync(extractDir, { recursive: true });

    execSync(`tar -xzf "${tgzPath}" -C "${extractDir}"`, { stdio: "ignore" });

    const packageRoot = path.join(extractDir, "package");
    if (!fs.existsSync(packageRoot)) {
      throw new Error("Estrutura do pacote extraído inválida.");
    }

    copiarArquivosAtualizados(packageRoot, destinoDir);
    limparCacheModulosServer(destinoDir);
    return true;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

async function verificarEAtualizarServidor(rootDir, config) {
  if (config?.isNpmPackage) {
    return { status: "skipped" };
  }

  const instalacaoDir = localizarInstalacaoAtiva();
  if (!instalacaoDir) {
    return { status: "npx-ephemeral" };
  }

  const versaoLocal = obterVersaoLocal(instalacaoDir);
  if (!versaoLocal) {
    return { status: "skipped" };
  }

  const agora = Date.now();
  if (atualizacaoEmAndamento || agora - ultimaVerificacaoTimestamp < COOLDOWN_MS) {
    return { status: "cooldown", versaoLocal };
  }

  ultimaVerificacaoTimestamp = agora;
  atualizacaoEmAndamento = true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(REGISTRY_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { status: "offline", versaoLocal };
    }

    const meta = await res.json();
    const versaoRemota = meta?.version;
    const tarballUrl = meta?.dist?.tarball;

    if (!versaoRemota || !tarballUrl) {
      return { status: "offline", versaoLocal };
    }

    if (compararSemver(versaoRemota, versaoLocal) > 0) {
      console.log(`⬆️  [DevServer] Nova versão encontrada no NPM: v${versaoRemota} (local: v${versaoLocal}) — baixando atualização...`);
      await baixarEAplicarAtualizacao(tarballUrl, instalacaoDir, versaoRemota);
      return { status: "updated", versaoLocal, versaoRemota };
    }

    return { status: "up-to-date", versaoLocal };
  } catch (err) {
    return { status: "error", versaoLocal, erro: err.message };
  } finally {
    atualizacaoEmAndamento = false;
  }
}

module.exports = {
  verificarEAtualizarServidor,
  isDiretorioDoDevServer
};