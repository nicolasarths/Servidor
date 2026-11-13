# ⚡ @nicolasarths/devserver

> ⚠️ **Aviso de Transparência:** Este projeto foi criado inteiramente por meio de desenvolvimento assistido por IA. Recomenda-se cautela na utilização em ambientes críticos e a revisão prévia do código-fonte antes do uso.

Servidor de desenvolvimento **zero-config** e **zero-dependências** com Live Reload via SSE, snapshots automáticos e deploy em 1 tecla para **GitHub**, **GitHub Pages** e **NPM** — sem despejar arquivos de configuração dentro dos seus projetos.

## 🚀 Instalação (1x no computador)

```bash
npm i -g @nicolasarths/devserver
```

## 💻 Como usar

Abra o terminal na pasta de qualquer projeto e rode o comando exclusivo:

```bash
nic-dev
```

*(Também funciona como `nicolas-devserver` ou sem instalação prévia via `npx -y @nicolasarths/devserver@latest`.)*

## ⚙️ Como funciona na prática

* **Zero conflito com o projeto:** Roda globalmente sem criar pastas de servidor nem alterar o `package.json` do projeto — não colide com `server.js`, `server/` ou `npm run dev` existentes.
* **Live Reload instantâneo:** Sobe um servidor estático local (porta `8081` com incremento automático se ocupada), libera CORS e recarrega o navegador automaticamente ao salvar qualquer arquivo (`Ctrl + S`).
* **Auto-detecção de projeto:**
  * **Projeto Web / GitHub:** Faz commit, push e acompanha o build do **GitHub Pages** até a atualização entrar no ar.
  * **Pacote NPM:** Incrementa a versão patch, faz push no GitHub e executa `npm publish` automaticamente.
* **Snapshot contínuo:** Mantém um `projeto_completo.txt` limpo e atualizado na raiz a cada alteração salva.
* **Auto-Update silencioso:** Ao salvar arquivos, verifica (com trava de 60 segundos) se há versão mais nova no NPM e atualiza o servidor automaticamente.

## 📋 Comandos no terminal

* **`ENTER` vazio** — executa `git add .`, `commit` (`"Update sem descrição"`) e `push` (e publica no NPM se for pacote).
* **`<mensagem> + ENTER`** — publica usando a sua mensagem de commit.
* **`[2]`** — abre o assistente para criar um repositório no GitHub, ativar GitHub Pages e salvar suas credenciais globalmente no sistema.
* **`[3]`** — ajusta porta HTTP, branch principal ou nome do repositório.
* **`[0]`** — encerra o servidor.

## 🔍 Arquitetura e Auditoria do Código

Para quem deseja inspecionar o código-fonte e verificar que não há dependências ocultas ou código malicioso, todo o servidor utiliza **apenas APIs nativas do Node.js** (`fs`, `http`, `path`, `os`, `child_process`, `readline` e `fetch` nativo) e está dividido em módulos pequenos de responsabilidade única:

* **`index.js`** — Ponto de entrada; inicializa o servidor HTTP, watcher e menu.
* **`config.js`** — Lê `process.cwd()` para detectar se a pasta atual é um pacote NPM ou projeto Web/GitHub e salva preferências básicas em `.devserver.json`.
* **`http.js` e `livereload.js`** — Servem arquivos estáticos localmente e injetam um `<script>` de `EventSource` (`/livereload`) nos HTMLs para recarregar a página ao salvar.
* **`watcher.js` e `builder.js`** — Monitoram alterações em tempo real e concatenam os arquivos de texto válidos em `projeto_completo.txt`.
* **`auto-updater.js`** — Consulta a API pública do registro NPM (`registry.npmjs.org`) com trava de 60s e extrai o tarball oficial caso exista versão superior.
* **`deploy.js` e `github/`** — Automação local de comandos `git` e chamadas REST diretas para `api.github.com` (usando apenas o token informado pelo próprio usuário).

## 📄 Licença

MIT © [Nicolas Arths](https://github.com/nicolasarths)