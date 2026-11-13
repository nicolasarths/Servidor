#!/usr/bin/env node

/**
 * Ponto de Entrada do Universal Dev Server
 * Responsabilidade: Inicializar build, watcher, servidor HTTP com fallback de porta e menu interativo na pasta atual.
 */
const { carregarConfig } = require("./config");
const { criarServidorHttp } = require("./http");
const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
const { iniciarWatcher } = require("./watcher");
const { iniciarMenuInterativo } = require("./menu");

const ROOT_DIR = process.cwd();
const config = carregarConfig(ROOT_DIR);

// 1. Executa hooks e gera projeto_completo.txt na inicialização
executarHooksOpcionais(ROOT_DIR);
gerarProjetoCompleto(ROOT_DIR, config.snapshotExtensions);

// 2. Inicia o monitor de alterações em tempo real
iniciarWatcher(ROOT_DIR, config);

// 3. Sobe o servidor HTTP com incremento automático se a porta estiver ocupada
const server = criarServidorHttp({ rootDir: ROOT_DIR, config });

function iniciarEscuta(portaAtual) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Porta ${portaAtual} em uso, tentando ${portaAtual + 1}...`);
      iniciarEscuta(portaAtual + 1);
    } else {
      console.error("❌ Erro no servidor:", err);
    }
  });

  server.listen(portaAtual, () => {
    console.log(`\n==================================================`);
    console.log(`⚡ Dev Server [${config.projectName}] rodando em:`);
    console.log(`   👉 http://localhost:${portaAtual}`);
    console.log(`📝 projeto_completo.txt sincronizado.`);
    console.log(`==================================================`);

    iniciarMenuInterativo(ROOT_DIR, config);
  });
}

iniciarEscuta(config.port || 8081);