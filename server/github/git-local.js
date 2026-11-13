/**
 * Operações Locais do Git
 * Responsabilidade: Inicializar repositório local, gerenciar .gitignore, branch e remote origin.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function garantirGitIgnore(rootDir) {
  const gitignorePath = path.join(rootDir, ".gitignore");
  const regrasEssenciais = [
    "node_modules/",
    ".DS_Store",
    "Thumbs.db",
    ".devserver.json",
    ".devserver/",
    "devserver.js"
  ];

  let conteudoAtual = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf-8")
    : "";

  let alterado = false;
  for (const regra of regrasEssenciais) {
    if (!conteudoAtual.includes(regra)) {
      conteudoAtual += (conteudoAtual.endsWith("\n") || conteudoAtual === "" ? "" : "\n") + regra + "\n";
      alterado = true;
    }
  }

  if (alterado) {
    fs.writeFileSync(gitignorePath, conteudoAtual, "utf-8");
    console.log("✅ .gitignore verificado/atualizado.");
  }
}

function garantirGitLocal(rootDir, branch = "main") {
  if (!fs.existsSync(path.join(rootDir, ".git"))) {
    execSync("git init", { cwd: rootDir, stdio: "inherit" });
    console.log("✅ Repositório Git local inicializado.");
  }
  try {
    execSync(`git branch -M ${branch}`, { cwd: rootDir, stdio: "ignore" });
  } catch (_) {}
}

function configurarOrigin(rootDir, remoteUrl) {
  try {
    execSync("git remote get-url origin", { cwd: rootDir, stdio: "ignore" });
    execSync(`git remote set-url origin "${remoteUrl}"`, { cwd: rootDir, stdio: "inherit" });
  } catch (_) {
    execSync(`git remote add origin "${remoteUrl}"`, { cwd: rootDir, stdio: "inherit" });
  }
  console.log(`✅ Remote 'origin' configurado para: ${remoteUrl}`);
}

module.exports = {
  garantirGitIgnore,
  garantirGitLocal,
  configurarOrigin
};