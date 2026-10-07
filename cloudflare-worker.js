export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    if (request.method !== "POST") {
      return new Response("Use POST", {
        status: 405,
        headers: cors
      });
    }

    try {
      if (!env.AI) {
        throw new Error("Binding AI não encontrado.");
      }

      const body = await request.json();

      if (!body.image) {
        throw new Error("Imagem da cena não recebida.");
      }

      // Remove "data:image/png;base64,"
      const image_b64 = body.image.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        ""
      );

      if (!image_b64) {
        throw new Error("Imagem Base64 inválida.");
      }

      /*
       * Converte o Base64 da imagem para bytes.
       * A Cloudflare documenta o campo "mask"
       * como um array de bytes (0-255).
       */
      const binary = atob(image_b64);

      const mask = new Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        mask[i] = binary.charCodeAt(i);
      }

      const prompt =
        body.prompt ||
        `
Photorealistic architectural interior render.

Preserve the supplied 3D scene.

Keep exactly:
furniture geometry,
dimensions,
proportions,
positions,
doors,
drawers,
shelves,
modules,
camera angle,
colors and materials.

Do not add furniture.
Do not remove furniture.
Do not redesign the furniture.

Improve:
realistic lighting,
natural shadows,
reflections,
MDF textures,
wood textures,
material realism,
ambient illumination,
depth and photographic quality.

Professional architectural visualization.
        `.trim();

      const result = await env.AI.run(
        "@cf/runwayml/stable-diffusion-v1-5-inpainting",
        {
          prompt: prompt,

          image_b64: image_b64,

          /*
           * Máscara exigida pelo modelo.
           */
          mask: mask,

          /*
           * Valor baixo = tenta manter
           * mais da imagem original.
           */
          strength: 0.25,

          guidance: 7.5,

          num_steps: 20
        }
      );

      if (!result) {
        throw new Error(
          "A IA não retornou uma imagem."
        );
      }

      return new Response(result, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        }
      });

    } catch (error) {
      console.error("ERRO RENDER IA:", error);

      return new Response(
        "Erro no Worker: " +
        (error?.message || String(error)),
        {
          status: 500,
          headers: {
            ...cors,
            "Content-Type":
              "text/plain; charset=UTF-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }
  }
};
