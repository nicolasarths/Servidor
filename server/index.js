#!/usr/bin/env node

/**
 * Ponto de Entrada do Universal Dev Server
 * Responsabilidade: Iniciar build inicial silencioso, watcher, servidor HTTP em HUD compacto de linha única e menu interativo.
 */
const { carregarConfig } = require("./config");
const { criarServidorHttp } = require("./http");
const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
const { iniciarWatcher } = require("./watcher");
const { iniciarMenuInterativo } = require("./menu");

const ROOT_DIR = process.cwd();
const config = carregarConfig(ROOT_DIR);

// 1. Executa hooks e gera projeto_completo.txt silenciosamente na inicialização
executarHooksOpcionais(ROOT_DIR);
gerarProjetoCompleto(ROOT_DIR, config.snapshotExtensions);

// 2. Inicia o monitor de alterações em tempo real
iniciarWatcher(ROOT_DIR, config);

// 3. Sobe o servidor HTTP com incremento automático sem acumular listeners
const server = criarServidorHttp({ rootDir: ROOT_DIR, config });

function iniciarEscuta(portaAtual) {
  const onError = (err) => {
    server.removeListener("listening", onListening);
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Porta ${portaAtual} em uso, tentando ${portaAtual + 1}...`);
      iniciarEscuta(portaAtual + 1);
    } else {
      console.error("❌ Erro no servidor:", err);
    }
  };

  const onListening = () => {
    server.removeListener("error", onError);
    console.log(`\n⚡ Dev Server [${config.projectName}] rodando em: 👉 http://localhost:${portaAtual}`);

    iniciarMenuInterativo(ROOT_DIR, config);
  };

  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(portaAtual);
}

iniciarEscuta(config.port || 8081);