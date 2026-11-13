/**
 * Gerenciador de Configuração por Projeto
 * Responsabilidade: Detectar automaticamente se o projeto atual é um pacote NPM ou um projeto Web/GitHub
 * e persistir apenas metadados básicos em .devserver.json.
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

function detectarModoPacoteNpm(rootDir) {
  const candidatos = [rootDir, path.join(rootDir, "server")];
  for (const dir of candidatos) {
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const isPacotePublico =
        pkg.name === "@nicolasarths/devserver" ||
        Boolean(pkg.bin && pkg.publishConfig?.access === "public");

      if (isPacotePublico) {
        return {
          isNpmPackage: true,
          npmPackageDir: dir,
          packageName: pkg.name
        };
      }
    } catch (_) {}
  }
  return {
    isNpmPackage: false,
    npmPackageDir: "",
    packageName: ""
  };
}

function carregarConfig(rootDir) {
  const configPath = path.join(rootDir, CONFIG_FILENAME);
  const nomePastaRaiz = path.basename(rootDir);
  const gitInfo = detectarGitRemote(rootDir);
  const modoNpm = detectarModoPacoteNpm(rootDir);

  let salvo = {};
  if (fs.existsSync(configPath)) {
    try {
      salvo = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      // Remove eventual resquício antigo de autoNpmPublish manual
      delete salvo.autoNpmPublish;
      delete salvo.npmPackageDir;
    } catch (_) {}
  }

  const configFinal = {
    projectName: salvo.projectName || nomePastaRaiz,
    port: salvo.port || 8081,
    githubUser: salvo.githubUser || gitInfo?.githubUser || "",
    repoName: salvo.repoName || gitInfo?.repoName || nomePastaRaiz,
    branch: salvo.branch || "main",
    pagesCheckFile: salvo.pagesCheckFile || (fs.existsSync(path.join(rootDir, "manifest.json")) ? "manifest.json" : "index.html"),
    snapshotExtensions: salvo.snapshotExtensions || [".js", ".html", ".css", ".json", ".ts", ".jsx", ".tsx", ".md"],
    // Propriedades dinâmicas inferidas automaticamente (não dependem de configuração manual)
    isNpmPackage: modoNpm.isNpmPackage,
    npmPackageDir: modoNpm.npmPackageDir,
    packageName: modoNpm.packageName
  };

  salvarConfig(rootDir, configFinal);
  return configFinal;
}

function salvarConfig(rootDir, novaConfig) {
  const configPath = path.join(rootDir, CONFIG_FILENAME);
  const { isNpmPackage, npmPackageDir, packageName, ...persistir } = novaConfig;
  fs.writeFileSync(configPath, JSON.stringify(persistir, null, 2), "utf-8");
}

module.exports = {
  CONFIG_FILENAME,
  carregarConfig,
  salvarConfig,
  detectarGitRemote,
  detectarModoPacoteNpm
};