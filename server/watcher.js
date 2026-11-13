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
        // 1. Verifica e atualiza a pasta server/ se houver versão nova no NPM (com trava de 60s)
        await verificarEAtualizarServidor(rootDir, config);

        // 2. Carrega dinamicamente builder e livereload (já pegando a versão nova se houve update)
        const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
        const { notificarRecarregamento } = require("./livereload");

        // 3. Executa os processos pós-save normalmente
        executarHooksOpcionais(rootDir);
        gerarProjetoCompleto(rootDir, config.snapshotExtensions);
        notificarRecarregamento();
      } finally {
        // Pequena janela para absorver eventos residualmente disparados pela cópia dos arquivos
        setTimeout(() => {
          ignorarEventosInternos = false;
        }, 300);
      }
    }, 250);
  });
}

module.exports = { iniciarWatcher };