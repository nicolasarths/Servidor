/**
 * Monitor de Sistema de Arquivos (File Watcher)
 * Responsabilidade: Detectar modificações no código-fonte e disparar hooks, snapshot e Live Reload.
 */
const fs = require("fs");
const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
const { notificarRecarregamento } = require("./livereload");

function iniciarWatcher(rootDir, config) {
  let watchTimeout = null;

  fs.watch(rootDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    const norm = filename.replace(/\\/g, "/").toLowerCase();

    if (
      norm.includes(".git/") ||
      norm.includes("node_modules/") ||
      norm.includes("modulos.json") ||
      norm.includes("projeto_completo") ||
      norm.includes(".devserver.json") ||
      norm.includes("server.config.json")
    ) {
      return;
    }

    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
      executarHooksOpcionais(rootDir);
      gerarProjetoCompleto(rootDir, config.snapshotExtensions);
      notificarRecarregamento();
    }, 250);
  });
}

module.exports = { iniciarWatcher };