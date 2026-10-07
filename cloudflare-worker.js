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

      // Remove o início data:image/png;base64,
      const base64 = body.image.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        ""
      );

      if (!base64) {
        throw new Error("Imagem Base64 inválida.");
      }

      // Base64 -> bytes
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const imageBlob = new Blob(
        [bytes],
        { type: "image/png" }
      );

      /*
       * O prompt começa com regras fixas.
       * O texto enviado pelo programa é apenas complementar.
       */
      const fixedPrompt = `
Use input image 0 as the exact architectural design reference.

Transform this existing 3D interior visualization into a
high-end photorealistic architectural photograph.

CRITICAL RULES:

Preserve the exact original design.

Keep exactly the same:
- camera position
- camera angle
- perspective
- room layout
- furniture geometry
- cabinet dimensions
- cabinet proportions
- cabinet positions
- number of cabinets
- number of doors
- number of drawers
- shelves
- countertops
- appliances
- openings
- walls
- floor layout
- colors
- material placement

DO NOT redesign the kitchen.
DO NOT move furniture.
DO NOT add furniture.
DO NOT remove furniture.
DO NOT add chairs, stools, cabinets or decorations
that are not visible in input image 0.
DO NOT change cabinet dimensions.
DO NOT change doors or drawers.
DO NOT change the architectural composition.

The goal is NOT to create a new kitchen.

The goal is to make INPUT IMAGE 0 look like a
professional photograph of the exact same finished project.

Improve only the visual realism:

- realistic MDF surfaces
- realistic wood grain where wood exists
- realistic stone surfaces
- realistic metal
- physically realistic reflections
- soft global illumination
- realistic contact shadows
- natural ambient shadows
- balanced exposure
- realistic ceiling lighting
- subtle indirect lighting
- photographic depth
- high material detail
- realistic interior photography
- professional architectural visualization

Avoid:
- orange color cast
- overexposure
- blown highlights
- plastic-looking materials
- excessive blur
- fantasy elements
- artistic reinterpretation

Neutral warm-white architectural lighting.
Natural realistic colors.
Sharp furniture edges.
Detailed materials.
Professional interior photography.
      `.trim();

      const extraPrompt = body.prompt
        ? `\n\nAdditional request:\n${body.prompt}`
        : "";

      const prompt = fixedPrompt + extraPrompt;

      /*
       * FLUX.2 recebe a imagem como multipart/form-data.
       */
      const form = new FormData();

      form.append("prompt", prompt);
      form.append(
        "input_image_0",
        imageBlob,
        "projeto.png"
      );

      /*
       * Saída maior que o modelo antigo.
       */
      form.append("width", "1024");
      form.append("height", "1024");

      /*
       * Valor moderado para seguir as instruções
       * sem transformar o projeto livremente.
       */
      form.append("guidance", "4");

      const formResponse = new Response(form);

      const formStream = formResponse.body;
      const formContentType =
        formResponse.headers.get("content-type");

      const result = await env.AI.run(
        "@cf/black-forest-labs/flux-2-klein-9b",
        {
          multipart: {
            body: formStream,
            contentType: formContentType
          }
        }
      );

      if (!result) {
        throw new Error(
          "A IA não retornou resultado."
        );
      }

      /*
       * FLUX.2 retorna a imagem em Base64.
       */
      let outputBase64 = null;

      if (typeof result === "string") {
        outputBase64 = result;
      } else if (result.image) {
        outputBase64 = result.image;
      }

      if (!outputBase64) {
        throw new Error(
          "O FLUX.2 não retornou uma imagem válida."
        );
      }

      // Remove prefixo caso exista
      outputBase64 = outputBase64.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        ""
      );

      const outputBinary = atob(outputBase64);
      const outputBytes =
        new Uint8Array(outputBinary.length);

      for (
        let i = 0;
        i < outputBinary.length;
        i++
      ) {
        outputBytes[i] =
          outputBinary.charCodeAt(i);
      }

      return new Response(outputBytes, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        }
      });

    } catch (error) {

      console.error(
        "ERRO RENDER FLUX:",
        error
      );

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
