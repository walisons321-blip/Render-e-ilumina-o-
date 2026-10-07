export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Libera a comunicação com o GitHub Pages
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Este endereço funciona apenas como API
    if (request.method !== "POST") {
      return new Response("Use POST", {
        status: 405,
        headers: corsHeaders
      });
    }

    try {

      // Verifica se o binding Workers AI existe
      if (!env.AI) {
        throw new Error(
          "O binding AI não foi encontrado no Cloudflare Worker."
        );
      }

      // Recebe os dados enviados pelo Marcenaria 3D
      const body = await request.json();

      const image = body.image;
      const userPrompt = body.prompt;

      if (!image) {
        return new Response(
          "A imagem da cena não foi recebida.",
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      // Remove o cabeçalho:
      // data:image/png;base64,
      const image_b64 = image.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        ""
      );

      if (!image_b64) {
        throw new Error(
          "A imagem recebida está vazia ou em formato inválido."
        );
      }

      /*
       * Prompt principal
       *
       * O objetivo é aumentar o realismo sem redesenhar
       * os móveis criados no Marcenaria 3D.
       */
      const prompt =
        userPrompt ||
        `
Photorealistic architectural interior photography.

Use the supplied 3D scene as the exact visual reference.

Preserve the original furniture design.

Preserve exactly:
furniture geometry,
dimensions,
proportions,
position,
camera angle,
doors,
drawers,
shelves,
handles,
modules,
colors,
materials,
walls and room layout.

Do not redesign the furniture.
Do not add furniture.
Do not remove furniture.
Do not change furniture proportions.
Do not change the camera composition.

Improve only:
realistic architectural lighting,
natural shadows,
ambient illumination,
reflections,
MDF surface realism,
wood texture realism,
depth,
material definition,
photographic quality.

Professional interior design photography.
Realistic architectural visualization.
Natural lighting.
High detail.
        `.trim();

      /*
       * CLOUDFLARE WORKERS AI
       *
       * Utilizamos a imagem capturada do projeto
       * como referência para a geração.
       */
      const result = await env.AI.run(
        "@cf/runwayml/stable-diffusion-v1-5-inpainting",
        {
          prompt: prompt,

          image_b64: image_b64,

          /*
           * Valor baixo para tentar preservar
           * melhor a geometria original.
           */
          strength: 0.25,

          guidance: 8,

          num_steps: 20
        }
      );

      if (!result) {
        throw new Error(
          "O Workers AI não retornou nenhuma imagem."
        );
      }

      /*
       * O modelo retorna os bytes da imagem.
       * Enviamos diretamente para o Marcenaria 3D.
       */
      return new Response(result, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        }
      });

    } catch (error) {

      console.error("ERRO RENDER IA:", error);

      const message =
        error?.message ||
        String(error) ||
        "Erro desconhecido";

      return new Response(
        "Erro no Worker: " + message,
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "text/plain; charset=UTF-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }
  }
};
