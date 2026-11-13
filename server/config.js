/**
 * Gerenciador de Configuração por Projeto
 * Responsabilidade: Detectar metadados do projeto via process.cwd() (incluindo auto-detecção de pacote NPM próprio)
 * e persistir ajustes em .devserver.json na raiz do projeto sem intervenção manual.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CONFIG_FILENAME = ".devserver.json";

function detectarGitRemote(rootDir) {
  try {
    const url = execSync("git remote get-url origin", {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();

    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/i);
    if (match) {
      return {
        githubUser: match[1],
        repoName: match[2],
        remoteUrl: url
      };
    }
  } catch (_) {}
  return null;
}

function localizarPastaPacoteNpm(rootDir) {
  const candidatos = [rootDir, path.join(rootDir, "server")];
  for (const dir of candidatos) {
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name === "@nicolasarths/devserver" || Boolean(pkg.bin && pkg.publishConfig?.access === "public")) {
        return dir;
      }
    } catch (_) {}
  }
  return null;
}

function carregarConfig(rootDir) {
  const configPath = path.join(rootDir, CONFIG_FILENAME);
  const nomePastaRaiz = path.basename(rootDir);
  const gitInfo = detectarGitRemote(rootDir);
  const npmPackageDir = localizarPastaPacoteNpm(rootDir);

  const padrao = {
    projectName: nomePastaRaiz,
    port: 8081,
    githubUser: gitInfo?.githubUser || "",
    repoName: gitInfo?.repoName || nomePastaRaiz,
    branch: "main",
    autoNpmPublish: Boolean(npmPackageDir),
    npmPackageDir: npmPackageDir || "",
    pagesCheckFile: fs.existsSync(path.join(rootDir, "manifest.json")) ? "manifest.json" : "index.html",
    snapshotExtensions: [".js", ".html", ".css", ".json", ".ts", ".jsx", ".tsx", ".md"]
  };

  if (fs.existsSync(configPath)) {
    try {
      const salvo = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return {
        ...padrao,
        ...salvo,
        // Sempre mantém o caminho real do pacote atualizado se detectado
        npmPackageDir: npmPackageDir || salvo.npmPackageDir || ""
      };
    } catch (_) {}
  }

  salvarConfig(rootDir, padrao);
  return padrao;
}

function salvarConfig(rootDir, novaConfig) {
  const configPath = path.join(rootDir, CONFIG_FILENAME);
  fs.writeFileSync(configPath, JSON.stringify(novaConfig, null, 2), "utf-8");
}

module.exports = {
  CONFIG_FILENAME,
  carregarConfig,
  salvarConfig,
  detectarGitRemote,
  localizarPastaPacoteNpm
};