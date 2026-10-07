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

      const model = body.mode === "quality"
        ? "@cf/black-forest-labs/flux-2-klein-9b"
        : "@cf/black-forest-labs/flux-2-klein-4b";

      const b64 = body.image.replace(
        /^data:image\/[\w.+-]+;base64,/,
        ""
      );

      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const form = new FormData();

      form.append(
        "input_image_0",
        new Blob([bytes], { type: "image/png" }),
        "projeto.png"
      );

      form.append(
        "prompt",
        "Create a realistic architectural visualization based on input image 0. Keep the same cabinetry, arrangement, geometry, perspective and composition. Use realistic neutral lighting, MDF, wood and subtle shadows. Do not redesign the scene."
      );

      form.append("width", "1024");
      form.append("height", "1024");

      const payload = new Response(form);

      const result = await env.AI.run(model, {
        multipart: {
          body: payload.body,
          contentType: payload.headers.get("content-type")
        }
      });

      if (!result) {
        throw new Error("A IA não retornou uma imagem.");
      }

      if (
        result instanceof ReadableStream ||
        result instanceof ArrayBuffer ||
        result instanceof Uint8Array ||
        result instanceof Blob
      ) {
        return new Response(result, {
          headers: {
            ...cors,
            "Content-Type": "image/png",
            "Cache-Control": "no-store"
          }
        });
      }

      const encoded =
        typeof result === "string"
          ? result
          : result.image;

      if (!encoded || typeof encoded !== "string") {
        throw new Error("Formato de resposta inesperado da IA.");
      }

      const data = atob(
        encoded.replace(
          /^data:image\/[\w.+-]+;base64,/,
          ""
        )
      );

      const output = new Uint8Array(data.length);

      for (let i = 0; i < data.length; i++) {
        output[i] = data.charCodeAt(i);
      }

      return new Response(output, {
        headers: {
          ...cors,
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        }
      });

    } catch (error) {
      console.error("Erro no render IA:", error);

      const message = String(error?.message || error);

      const friendly = message.includes("4006")
        ? "Cota gratuita diária da Cloudflare esgotada. Aguarde a renovação."
        : message;

      return new Response(
        "Erro no Worker: " + friendly,
        {
          status: 500,
          headers: {
            ...cors,
            "Content-Type": "text/plain; charset=utf-8"
          }
        }
      );
    }
  }
};
