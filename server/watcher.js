/**
 * Monitor de Sistema de Arquivos (File Watcher)
 * Responsabilidade: Detectar modificações no código-fonte, checar auto-update do servidor e disparar build + Live Reload.
 */
const fs = require("fs");
const { verificarEAtualizarServidor } = require("./auto-updater");

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
        await verificarEAtualizarServidor(rootDir, config);

        const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
        const { notificarRecarregamento } = require("./livereload");

        executarHooksOpcionais(rootDir);
        gerarProjetoCompleto(rootDir, config.snapshotExtensions);
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