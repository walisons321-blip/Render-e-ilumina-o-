export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Use POST", { status: 405, headers: cors });
    try {
      const { image, prompt } = await request.json();
      if (!image) return new Response("Imagem da cena ausente", { status: 400, headers: cors });
      const image_b64 = image.replace(/^data:image\/\w+;base64,/, "");
      const result = await env.AI.run("@cf/runwayml/stable-diffusion-v1-5-inpainting", {
        prompt: prompt || "Photorealistic architectural interior render. Preserve furniture geometry and layout.",
        image_b64,
        strength: 0.30,
        guidance: 8.0,
        num_steps: 20
      });
      return new Response(result, { headers: { ...cors, "Content-Type": "image/png", "Cache-Control": "no-store" } });
    } catch (e) {
      return new Response("Erro no Worker: " + (e?.message || e), { status: 500, headers: cors });
    }
  }
};
