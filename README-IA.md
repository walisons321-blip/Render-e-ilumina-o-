# Marcenaria 3D — Render com IA

Esta versão adiciona **Renderizar com IA**, prévia e **Salvar imagem**.

## 1. Site
Publique `index.html` no GitHub Pages como antes.

## 2. Cloudflare Worker
1. Crie um Worker no painel da Cloudflare.
2. Cole o conteúdo de `cloudflare-worker.js`.
3. Nas configurações do Worker, adicione o binding **Workers AI** com o nome `AI`.
4. Faça o deploy e copie a URL `https://...workers.dev`.
5. No programa, toque em **Renderizar com IA** e cole essa URL no campo **URL do Worker**.

O frontend captura a cena sem grade/controles e envia a imagem para o Worker. O Worker usa img2img com força baixa para tentar preservar o projeto e melhorar o realismo.

Observação: modelos e disponibilidade da Cloudflare podem mudar. Se o modelo indicado deixar de estar disponível, troque o ID no Worker por um modelo de edição/img2img compatível no catálogo atual.
