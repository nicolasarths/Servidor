/**
 * Gerenciador de Live Reload via Server-Sent Events (SSE)
 * Responsabilidade: Manter conexões abertas com os navegadores e disparar reload ao salvar arquivos.
 */
let sseClients = [];

function adicionarCliente(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  sseClients.push(res);
}

function removerCliente(res) {
  sseClients = sseClients.filter((c) => c !== res);
}

function notificarRecarregamento() {
  sseClients.forEach((client) => {
    try {
      client.write("data: reload\n\n");
    } catch (_) {}
  });
}

const SCRIPT_LIVE_RELOAD = `
<script>
  (function() {
    const sse = new EventSource('/livereload');
    sse.onmessage = () => {
      console.log('⚡ [Dev Server] Alteração detectada. Recarregando...');
      location.reload();
    };
  })();
</script>
</body>`;

module.exports = {
  adicionarCliente,
  removerCliente,
  notificarRecarregamento,
  SCRIPT_LIVE_RELOAD
};