import { z } from "zod";
import { RecommendationImageError } from "./recommendation-image";
import { limitedRecommendationImage } from "./recommendation-image.server";

export const imageReply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function recommendationImageResponse(request: Request, key: string) {
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new RecommendationImageError("invalid");
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.length;
        if (bytes > 4096) { await reader.cancel(); throw new RecommendationImageError("invalid"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const body = z.object({ href: z.string().trim().min(1).max(2000) }).strict().parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    return imageReply({ ok: true, data: await limitedRecommendationImage(key, body.href) });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError || (error instanceof RecommendationImageError && error.code === "invalid"))
      return imageReply({ ok: false, error: "Informe um link válido para buscar a imagem." }, 400);
    const code = error instanceof RecommendationImageError ? error.code : "unavailable";
    const messages = {
      unsupported: "A busca aceita links HTTPS da Amazon, Mercado Livre, KaBuM! e Magalu. Você também pode informar a imagem manualmente.",
      no_image: "A loja não forneceu uma imagem. Você pode informar a imagem manualmente.",
      unavailable: "Não foi possível buscar a imagem agora. Tente novamente ou informe a imagem manualmente.",
      rate_limit: "Aguarde um pouco antes de buscar outra imagem.",
      invalid: "Informe um link válido para buscar a imagem.",
    };
    return imageReply({ ok: false, error: messages[code] }, code === "rate_limit" ? 429 : code === "unsupported" || code === "no_image" ? 422 : 503);
  }
}
