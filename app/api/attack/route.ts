import { loadRaw, rawToPng, applyAttack, AttackType } from "@/lib/image/sharp-utils";

const ATTACK_TYPES = new Set<AttackType>([
  "none",
  "jpeg90",
  "jpeg70",
  "jpeg50",
  "crop",
  "resize",
  "noise",
  "brightness",
  "contrast",
]);

export async function POST(request: Request) {
  const form = await request.formData();
  const image = form.get("image");
  const type = form.get("type");
  if (!(image instanceof File) || typeof type !== "string" || !ATTACK_TYPES.has(type as AttackType)) {
    return Response.json({ error: "parameter image/type tidak valid" }, { status: 400 });
  }
  const paramsRaw = form.get("params");
  let params: Record<string, number> = {};
  if (typeof paramsRaw === "string" && paramsRaw) {
    try {
      params = JSON.parse(paramsRaw);
    } catch {
      return Response.json({ error: "params bukan JSON valid" }, { status: 400 });
    }
  }
  try {
    const img = await loadRaw(Buffer.from(await image.arrayBuffer()));
    const attacked = await applyAttack(img, type as AttackType, params);
    const png = await rawToPng(attacked);
    return new Response(new Blob([new Uint8Array(png)]), {
      headers: {
        "Content-Type": "image/png",
        "X-Attacked-Width": String(attacked.width),
        "X-Attacked-Height": String(attacked.height),
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
