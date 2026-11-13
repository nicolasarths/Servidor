/**
 * Gerenciador de Identidade Global do Git
 * Responsabilidade: Verificar se user.name e user.email existem no sistema e configurá-los automaticamente,
 * garantindo que o diretório HOME exista no Windows antes de gravar o .gitconfig.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { perguntar } = require("./prompts");

function prepararAmbienteGit() {
  const homeAtual = process.env.HOME || os.homedir();
  if (homeAtual && !fs.existsSync(homeAtual)) {
    try {
      fs.mkdirSync(homeAtual, { recursive: true });
    } catch (_) {
      // Se o OneDrive bloquear criação da pasta HOME customizada, usa o perfil real do Windows
      process.env.HOME = os.homedir();
    }
  }
}

function lerConfigGit(chave, cwd) {
  prepararAmbienteGit();
  try {
    return execSync(`git config --global ${chave}`, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
  } catch (_) {
    return "";
  }
}

function gravarConfigGit(chave, valor, cwd) {
  prepararAmbienteGit();
  const seguro = valor.replace(/"/g, '\\"');
  try {
    execSync(`git config --global ${chave} "${seguro}"`, { cwd, stdio: "ignore" });
  } catch (_) {
    // Fallback direto para o perfil real do usuário no Windows caso HOME esteja corrompido
    const realHome = os.homedir();
    execSync(`git config --file "${path.join(realHome, ".gitconfig")}" ${chave} "${seguro}"`, {
      cwd,
      stdio: "ignore"
    });
  }
}

async function garantirIdentidadeGit(rl, rootDir) {
  const nomeAtual = lerConfigGit("user.name", rootDir);
  const emailAtual = lerConfigGit("user.email", rootDir);

  if (nomeAtual && emailAtual) {
    return { nome: nomeAtual, email: emailAtual };
  }

  console.log(`\n⚠️ Identidade do Git não configurada neste computador.`);
  console.log(`   Vamos configurar agora (ficará salvo globalmente para todos os seus projetos):\n`);

  let nomeFinal = nomeAtual;
  if (!nomeFinal) {
    const respNome = await perguntar(rl, `👤 Seu Nome para commits [Nicolas Arths]: `);
    nomeFinal = respNome || "Nicolas Arths";
    gravarConfigGit("user.name", nomeFinal, rootDir);
  }

  let emailFinal = emailAtual;
  if (!emailFinal) {
    const respEmail = await perguntar(rl, `📧 Seu E-mail do GitHub [nicolasarths@hotmail.com]: `);
    emailFinal = respEmail || "nicolasarths@hotmail.com";
    gravarConfigGit("user.email", emailFinal, rootDir);
  }

  console.log(`✅ Identidade salva globalmente: ${nomeFinal} <${emailFinal}>\n`);
  return { nome: nomeFinal, email: emailFinal };
}

module.exports = {
  lerConfigGit,
  garantirIdentidadeGit
};