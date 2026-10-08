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

      const base64 = body.image.replace(
        /^data:image\/[\w.+-]+;base64,/,
        ""
      );

      const binary = atob(base64);
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

      const preservation =
        "Create a photorealistic architectural render of input image 0. " +
        "Preserve object identities, layout, camera, dimensions, colors and reference materials. " +
        "Appliances are real electrical appliances with metal/enamel bodies and glass/control panels, NEVER wood or MDF. " +
        "Keep black appliances black. " +
        "Sinks are hollow metal or ceramic bowls; faucets are metal. " +
        "Apply wood/MDF only to furniture with that finish in the reference. " +
        "Do not redesign or add objects.";

      const requested = typeof body.prompt === "string"
        ? body.prompt.trim().slice(0, 24000)
        : "";

      // Encaminha as instruções e a identificação
      // dos objetos enviadas pelo aplicativo.
      form.append(
        "prompt",
        preservation + (requested ? "\n\n" + requested : "")
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

      const imageHeaders = {
        ...cors,
        "Content-Type": "image/png",
        "Cache-Control": "no-store"
      };

      if (
        result instanceof ReadableStream ||
        result instanceof ArrayBuffer ||
        result instanceof Uint8Array ||
        result instanceof Blob
      ) {
        return new Response(result, {
          headers: imageHeaders
        });
      }

      const encoded = typeof result === "string"
        ? result
        : result.image;

      if (!encoded || typeof encoded !== "string") {
        throw new Error("Formato de resposta inesperado da IA.");
      }

      const data = atob(
        encoded.replace(/^data:image\/[\w.+-]+;base64,/, "")
      );

      const output = new Uint8Array(data.length);

      for (let i = 0; i < data.length; i++) {
        output[i] = data.charCodeAt(i);
      }

      return new Response(output, {
        headers: imageHeaders
      });
    } catch (error) {
      console.error("Erro no render IA:", error);

      const message = String(error?.message || error);

      const friendly = message.includes("4006")
        ? "Cota gratuita diária da Cloudflare esgotada. Aguarde a renovação."
        : message;

      return new Response("Erro no Worker: " + friendly, {
        status: 500,
        headers: {
          ...cors,
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }
  }
};
