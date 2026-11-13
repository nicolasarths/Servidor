#!/usr/bin/env node

/**
 * Ponto de Entrada do Universal Dev Server
 * Responsabilidade: Verificar conflitos de server/server.js pré-existentes, provisionar .devserver/ isolado se necessário,
 * iniciar build, watcher, HTTP sem duplicação de listeners e menu interativo.
 */
const fs = require("fs");
const path = require("path");
const { carregarConfig } = require("./config");
const { criarServidorHttp } = require("./http");
const { executarHooksOpcionais, gerarProjetoCompleto } = require("./builder");
const { iniciarWatcher } = require("./watcher");
const { iniciarMenuInterativo } = require("./menu");
const { isDiretorioDoDevServer, copiarArquivosAtualizados } = require("./auto-updater");

const ROOT_DIR = process.cwd();
const config = carregarConfig(ROOT_DIR);

function provisionarCopiaIsoladaDevServer(rootDir) {
  const destinoDevServer = path.join(rootDir, ".devserver");
  const launcherRaiz = path.join(rootDir, "devserver.js");

  // Copia os arquivos do pacote atual (__dirname) para .devserver/ se ainda não existir
  if (!fs.existsSync(destinoDevServer)) {
    fs.mkdirSync(destinoDevServer, { recursive: true });
    copiarArquivosAtualizados(__dirname, destinoDevServer);
  }

  // Cria o atalho devserver.js na raiz para permitir rodar `node devserver` sem conflitar com `node server`
  if (!fs.existsSync(launcherRaiz)) {
    const conteudoLauncher = [
      "#!/usr/bin/env node",
      "// Atalho gerado automaticamente pelo @nicolasarths/devserver para evitar conflito com server.js/server/",
      'require("./.devserver/index.js");',
      ""
    ].join("\n");
    fs.writeFileSync(launcherRaiz, conteudoLauncher, "utf-8");
  }
}

function verificarSalvaguardaServidorExistente(rootDir, isNpmPackage) {
  if (isNpmPackage) return [];

  const serverJsRaiz = path.join(rootDir, "server.js");
  const pastaServer = path.join(rootDir, "server");
  const temServerJs = fs.existsSync(serverJsRaiz) && fs.statSync(serverJsRaiz).isFile();
  const temPastaServer = fs.existsSync(pastaServer) && fs.statSync(pastaServer).isDirectory();
  const avisos = [];

  if (temPastaServer) {
    const ehNossoPacote = isDiretorioDoDevServer(pastaServer);
    const normAtual = __dirname.replace(/\\/g, "/").toLowerCase();

    if (!ehNossoPacote) {
      provisionarCopiaIsoladaDevServer(rootDir);
      avisos.push(`• Detectada pasta "server/" própria do projeto (não pertence ao @nicolasarths/devserver).`);
      avisos.push(`• Salvaguarda ativada: a pasta "server/" original foi preservada intacta.`);
      avisos.push(`• Instalado automaticamente em ".devserver/" + atalho "devserver.js" (rode com: node devserver).`);
      avisos.push(`  👉 Caso "server/" seja apenas uma versão antiga sem package.json do nosso dev server, você pode deletá-la.`);
    } else if (normAtual.includes("/_npx/")) {
      avisos.push(`• Você rodou via npx, mas já existe uma cópia local em "server/". Pode deletar "server/" se quiser usar apenas npx.`);
    }
  } else if (temServerJs) {
    provisionarCopiaIsoladaDevServer(rootDir);
    avisos.push(`• Detectado "server.js" próprio na raiz do projeto.`);
    avisos.push(`• Salvaguarda ativada: instalado em ".devserver/" + atalho "devserver.js" (rode com: node devserver).`);
  }

  return avisos;
}

const avisosSalvaguarda = verificarSalvaguardaServidorExistente(ROOT_DIR, config.isNpmPackage);

// 1. Executa hooks e gera projeto_completo.txt na inicialização
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
    console.log(`\n==================================================`);
    console.log(`⚡ Dev Server [${config.projectName}] rodando em:`);
    console.log(`   👉 http://localhost:${portaAtual}`);
    console.log(`📝 projeto_completo.txt sincronizado.`);

    if (avisosSalvaguarda.length > 0) {
      console.log(`--------------------------------------------------`);
      console.log(`🛡️  SALVAGUARDA DE ARQUIVOS ATIVADA:`);
      avisosSalvaguarda.forEach((msg) => console.log(msg));
    }

    console.log(`==================================================`);

    iniciarMenuInterativo(ROOT_DIR, config);
  };

  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(portaAtual);
}

iniciarEscuta(config.port || 8081);