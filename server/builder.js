/**
 * Gerador de Snapshot e Hooks de Build
 * Responsabilidade: Apagar o snapshot anterior, gerar projeto_completo.txt e arvore_de_arquivos.txt limpos na raiz do projeto e executar hooks opcionais.
 */
const fs = require("fs");
const path = require("path");

let isGenerating = false;

function executarHooksOpcionais(rootDir) {
  const painelDir = path.join(rootDir, "painel");
  const modulosPath = path.join(rootDir, "modulos.json");

  if (!fs.existsSync(painelDir) || !fs.existsSync(modulosPath)) return;

  const estrutura = {};
  const itens = fs.readdirSync(painelDir, { withFileTypes: true });

  itens.filter((i) => i.isDirectory()).forEach((pasta) => {
    const nomePasta = pasta.name;
    const caminhoPasta = path.join(painelDir, nomePasta);
    const arquivos = fs.readdirSync(caminhoPasta);

    estrutura[nomePasta] = {
      temCustomJS: arquivos.includes("module.js"),
      registros: []
    };

    arquivos.filter((f) => f.endsWith(".json")).forEach((arq) => {
      try {
        const conteudo = JSON.parse(fs.readFileSync(path.join(caminhoPasta, arq), "utf-8"));
        
        if (Array.isArray(conteudo)) {
          conteudo.forEach((item, idx) => {
            if (!item.id) item.id = `${nomePasta}-${arq.replace(".json", "")}-${idx}`;
            estrutura[nomePasta].registros.push(item);
          });
        } else if (typeof conteudo === "object" && conteudo !== null) {
          conteudo.id = conteudo.id || `${nomePasta}-${arq.replace(".json", "")}`;
          estrutura[nomePasta].registros.push(conteudo);
        }
      } catch (_) {}
    });
  });

  fs.writeFileSync(modulosPath, JSON.stringify(estrutura, null, 2), { encoding: "utf-8", flag: "w" });
}

function gerarStringArvore(dir, prefixo = "", ignorarNomes = new Set()) {
  let output = "";
  let itens;
  try {
    itens = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return output;
  }

  const itensValidos = itens.filter(item => {
    try {
      const nomeLower = item.name.toLowerCase();
      if (ignorarNomes.has(nomeLower) || nomeLower.startsWith("projeto_completo") || nomeLower.startsWith("arvore_de_arquivos")) {
        return false;
      }
      
      if (item.isFile() || item.isDirectory()) {
         return true;
      }
      return false;
    } catch(e) {
      return false;
    }
  }).sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  itensValidos.forEach((item, index) => {
    const isUltimo = index === itensValidos.length - 1;
    const conector = isUltimo ? "└── " : "├── ";
    output += `${prefixo}${conector}${item.name}\n`;

    if (item.isDirectory()) {
      const novoPrefixo = prefixo + (isUltimo ? "    " : "│   ");
      output += gerarStringArvore(path.join(dir, item.name), novoPrefixo, ignorarNomes);
    }
  });
  return output;
}

function gerarProjetoCompleto(rootDir, extensoesValidas = [".js", ".html", ".css", ".json"]) {
  if (isGenerating) return;
  isGenerating = true;

  try {
    const destino = path.join(rootDir, "projeto_completo.txt");
    const destinoArvore = path.join(rootDir, "arvore_de_arquivos.txt");

    let output = "";

    const ignorarNomes = new Set([
      ".git",
      "node_modules",
      "dist",
      "build",
      ".next",
      ".vscode",
      ".devserver",
      "devserver.js",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      ".devserver.json",
      "server.config.json",
      "arvore_de_arquivos.txt",
      "projeto_completo.txt"
    ]);

    // Geração da Árvore isolada em seu próprio try/catch
    try {
      const nomePastaProjeto = path.basename(rootDir);
      let conteudoArvore = `/${nomePastaProjeto}\n`;
      conteudoArvore += gerarStringArvore(rootDir, "", ignorarNomes);
      fs.writeFileSync(destinoArvore, conteudoArvore, { encoding: "utf-8", flag: "w" });
    } catch (e) {
      console.error("❌ [Builder] Falha ao escrever arvore_de_arquivos.txt:", e.message);
    }

    // Geração do projeto_completo.txt
    function varrerDiretorio(dir) {
      const itens = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of itens) {
        const nomeLower = item.name.toLowerCase();

        if (ignorarNomes.has(nomeLower) || nomeLower.startsWith("projeto_completo") || nomeLower.startsWith("arvore_de_arquivos")) {
          continue;
        }

        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          varrerDiretorio(fullPath);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (extensoesValidas.includes(ext)) {
            const relPath = "\\" + path.relative(rootDir, fullPath);
            const content = fs.readFileSync(fullPath, "utf-8");
            output += `=== ARQUIVO: ${relPath} ===\n${content}\n\n`;
          }
        }
      }
    }

    varrerDiretorio(rootDir);
    fs.writeFileSync(destino, output, { encoding: "utf-8", flag: "w" });
  } catch (err) {
    console.error("❌ [Builder] Erro crítico ao gerar snapshots:", err.message);
  } finally {
    isGenerating = false;
  }
}

module.exports = {
  executarHooksOpcionais,
  gerarProjetoCompleto
};