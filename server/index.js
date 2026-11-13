#!/usr/bin/env node

/**
 * Ponto de Entrada do Universal Dev Server
 * Responsabilidade: Verificar conflitos de arquivos server/server.js pré-existentes, iniciar build, watcher, HTTP e menu.
 */
const fs = require("fs");
const path = require("path");
const { carregarConfig } = require("./config");
const { criarServidorHttp } = require("./http");
const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
const { iniciarWatcher } = require("./watcher");
const { iniciarMenuInterativo } = require("./menu");
const { isDiretorioDoDevServer } = require("./auto-updater");

const ROOT_DIR = process.cwd();
const config = carregarConfig(ROOT_DIR);

function verificarSalvaguardaServidorExistente(rootDir, isNpmPackage) {
  if (isNpmPackage) return;

  const serverJsRaiz = path.join(rootDir, "server.js");
  const pastaServer = path.join(rootDir, "server");
  const avisos = [];

  if (fs.existsSync(serverJsRaiz) && fs.statSync(serverJsRaiz).isFile()) {
    avisos.push(
      `• Encontrado "server.js" na raiz do projeto. Se for um servidor antigo/manual de live-reload, você já pode deletá-lo (ou manter se for sua API backend).`
    );
  }

  if (fs.existsSync(pastaServer) && fs.statSync(pastaServer).isDirectory()) {
    const ehNossoPacote = isDiretorioDoDevServer(pastaServer);
    const normAtual = __dirname.replace(/\\/g, "/").toLowerCase();

    if (!ehNossoPacote) {
      avisos.push(
        `• Encontrada pasta "server/" própria do projeto. Por segurança, o @nicolasarths/devserver NÃO vai modificar nem sobrescrever essa pasta.`
      );
      avisos.push(
        `  👉 Se essa pasta "server/" for uma versão antiga do nosso dev server sem package.json, delete-a e rode apenas: npx -y @nicolasarths/devserver@latest`
      );
    } else if (normAtual.includes("/_npx/")) {
      avisos.push(
        `• Você rodou via npx, mas ainda existe uma cópia local antiga em "server/". Você pode deletar a pasta "server/" do projeto para mantê-lo limpo!`
      );
    }
  }

  if (avisos.length > 0) {
    console.log(`\n🛡️  [SALVAGUARDA DE ARQUIVOS DETECTADA]`);
    avisos.forEach((msg) => console.log(msg));
    console.log(``);
  }
}

// 0. Verifica se já existe server.js ou pasta server/ no projeto antes de rodar
verificarSalvaguardaServidorExistente(ROOT_DIR, config.isNpmPackage);

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