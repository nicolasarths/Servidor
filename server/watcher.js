/**
 * Monitor de Sistema de Arquivos (File Watcher)
 * Responsabilidade: Detectar modificações no código-fonte (Ctrl+S), exibir status do snapshot e da verificação de atualização do pacote, e disparar Live Reload.
 */
const fs = require("fs");
const { verificarEAtualizarServidor } = require("./auto-updater");

const CINZA = "\x1b[90m";
const RESET = "\x1b[0m";

function iniciarWatcher(rootDir, config) {
  let watchTimeout = null;
  let ignorarEventosInternos = false;

  fs.watch(rootDir, { recursive: true }, (eventType, filename) => {
    if (!filename || ignorarEventosInternos) return;

    const norm = filename.replace(/\\/g, "/").toLowerCase();

    if (
      norm.includes(".git/") ||
      norm.includes("node_modules/") ||
      norm.includes(".devserver/") ||
      norm.includes("modulos.json") ||
      norm.includes("projeto_completo") ||
      norm.includes(".devserver.json") ||
      norm.includes("server.config.json")
    ) {
      return;
    }

    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(async () => {
      ignorarEventosInternos = true;
      try {
        const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
        const { notificarRecarregamento } = require("./livereload");

        executarHooksOpcionais(rootDir);
        gerarProjetoCompleto(rootDir, config.snapshotExtensions);
        console.log(`📝 projeto_completo.txt salvo com sucesso.`);

        const resUpdate = await verificarEAtualizarServidor(rootDir, config);
        if (resUpdate.status === "up-to-date") {
          console.log(`${CINZA}📦 Pacote @nicolasarths/devserver up to date (v${resUpdate.versaoLocal}).${RESET}`);
        } else if (resUpdate.status === "updated") {
          console.log(`🔄 Pacote @nicolasarths/devserver atualizado para v${resUpdate.versaoRemota} com sucesso!`);
        } else if (resUpdate.status === "cooldown") {
          console.log(`${CINZA}📦 Pacote @nicolasarths/devserver up to date (v${resUpdate.versaoLocal} • cache 60s).${RESET}`);
        } else if (resUpdate.status === "error") {
          console.log(`⚠️  Falha ao verificar atualização do pacote: ${resUpdate.erro}`);
        }

        notificarRecarregamento();
      } finally {
        setTimeout(() => {
          ignorarEventosInternos = false;
        }, 300);
      }
    }, 250);
  });
}

module.exports = { iniciarWatcher };