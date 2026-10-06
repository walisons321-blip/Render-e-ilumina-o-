export default {
  async fetch(request, env) {
    // Permite que o GitHub Pages acesse este Worker
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    // Responde à verificação CORS do navegador
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    // O Worker recebe apenas requisições POST
    if (request.method !== "POST") {
      return new Response("Use POST", {
        status: 405,
        headers: cors
      });
    }

    try {
      // Verifica se o Workers AI está conectado
      if (!env.AI) {
        throw new Error(
          "Binding AI não encontrado. Verifique a configuração do Workers AI."
        );
      }

      // Recebe os dados enviados pelo Marcenaria 3D
      const body = await request.json();

      const image = body.image;
      const prompt = body.prompt;

      if (!image) {
        return new Response("Imagem da cena ausente", {
          status: 400,
          headers: cors
        });
      }

      // Remove o início do Data URL e mantém somente o Base64
      const image_b64 = image.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        ""
      );

      if (!image_b64) {
        return new Response("Imagem inválida", {
          status: 400,
          headers: cors
        });
      }

      // Instrução padrão para preservar o projeto
      const renderPrompt =
        prompt ||
        `
Photorealistic architectural interior visualization.

Preserve exactly:
- furniture geometry
- furniture dimensions and proportions
- furniture position
- doors
- drawers
- shelves
- modules
- colors
- materials
- camera angle
- room layout

Do not add furniture.
Do not remove furniture.
Do not change the design.

Improve only:
- realistic lighting
- shadows
- reflections
- MDF material appearance
- ambient illumination
- depth
- photographic realism

Professional interior design photography.
High quality architectural visualization.
        `.trim();

      // Renderização Image-to-Image
      const result = await env.AI.run(
        "@cf/runwayml/stable-diffusion-v1-5-img2img",
        {
          prompt: renderPrompt,
          image_b64: image_b64,

          // Quanto menor, mais próximo do projeto original
          strength: 0.30,

          // Intensidade com que a IA segue o prompt
          guidance: 8.0,

          // Qualidade / quantidade de etapas
          num_steps: 20
        }
      );

      // Devolve a imagem renderizada para o Marcenaria 3D
      return new Response(result, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        }
      });

    } catch (error) {
      console.error("Erro ao gerar render:", error);

      return new Response(
        "Erro no Worker: " +
          (error?.message || String(error)),
        {
          status: 500,
          headers: {
            ...cors,
            "Content-Type": "text/plain; charset=UTF-8"
          }
        }
      );
    }
  }
};
