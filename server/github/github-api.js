/**
 * Cliente da API REST do GitHub
 * Responsabilidade: Criar repositórios remotos e ativar GitHub Pages via fetch nativo.
 */

async function criarRepositorioRemotoGitHub({ token, repoName, descricao, privado }) {
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "Universal-Dev-Server"
    }
  });

  if (!userRes.ok) {
    const err = await userRes.json().catch(() => ({}));
    throw new Error(`Token inválido ou sem permissão: ${err.message || userRes.status}`);
  }

  const userData = await userRes.json();
  const githubUser = userData.login;

  const createRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "Universal-Dev-Server"
    },
    body: JSON.stringify({
      name: repoName,
      description: descricao || `Projeto ${repoName}`,
      private: privado,
      auto_init: false
    })
  });

  const repoData = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    throw new Error(`Erro ao criar repositório: ${repoData.message || createRes.status}`);
  }

  console.log(`🎉 Repositório criado com sucesso: ${repoData.html_url}`);

  return {
    githubUser,
    repoName: repoData.name,
    cloneUrl: repoData.clone_url,
    htmlUrl: repoData.html_url
  };
}

async function ativarGitHubPages({ token, githubUser, repoName, branch = "main" }) {
  try {
    const res = await fetch(`https://api.github.com/repos/${githubUser}/${repoName}/pages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "Universal-Dev-Server"
      },
      body: JSON.stringify({
        source: {
          branch,
          path: "/"
        }
      })
    });

    if (res.ok || res.status === 201 || res.status === 409) {
      console.log(`🌐 GitHub Pages ativado em: https://${githubUser}.github.io/${repoName}/`);
    } else {
      const err = await res.json().catch(() => ({}));
      console.log(`⚠️ Pages não ativado automaticamente (${err.message || res.status}). Ative nas configurações do repo após o push.`);
    }
  } catch (err) {
    console.log(`⚠️ Erro ao configurar GitHub Pages: ${err.message}`);
  }
}

module.exports = {
  criarRepositorioRemotoGitHub,
  ativarGitHubPages
};