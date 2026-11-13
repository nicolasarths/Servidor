/**
 * Servidor HTTP Estático Genérico com Live Reload e CORS Aberto
 * Responsabilidade: Servir arquivos do projeto, injetar script SSE em HTMLs e remover prefixo de sub-rota do GitHub Pages.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { adicionarCliente, removerCliente, SCRIPT_LIVE_RELOAD } = require("./livereload");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function criarServidorHttp({ rootDir, config }) {
  return http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, POST, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    const urlPath = req.url.split("?")[0];

    // Endpoint de Live Reload
    if (urlPath === "/livereload") {
      adicionarCliente(res);
      req.on("close", () => removerCliente(res));
      return;
    }

    // Remove dinamicamente o prefixo do repositório (ex: /meu-projeto/index.html -> /index.html)
    const repoPrefix = config.repoName ? `/${config.repoName}` : "";
    let cleanPath = repoPrefix && urlPath.startsWith(repoPrefix)
      ? urlPath.slice(repoPrefix.length)
      : urlPath;

    if (!cleanPath || cleanPath === "/") cleanPath = "/index.html";

    // Se o projeto tiver manifest.json (ex: extensões), adiciona sufixo (DEV Local)
    if (cleanPath === "/manifest.json") {
      const manifestPath = path.join(rootDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          manifest.name = `${manifest.name || config.projectName} (DEV Local)`;
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify(manifest, null, 2));
        } catch (_) {}
      }
    }

    const filePath = path.join(rootDir, cleanPath);

    // Previne Path Traversal fora da pasta raiz
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("403 Forbidden");
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      if (ext === ".html") {
        let html = fs.readFileSync(filePath, "utf-8");
        if (html.includes("</body>")) {
          html = html.replace("</body>", SCRIPT_LIVE_RELOAD);
        } else {
          html += SCRIPT_LIVE_RELOAD;
        }
        res.writeHead(200, { "Content-Type": contentType });
        return res.end(html);
      }

      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
    }
  });
}

module.exports = { criarServidorHttp };