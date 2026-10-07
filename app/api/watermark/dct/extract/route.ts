import { loadRaw } from "@/lib/image/sharp-utils";
import { extractDCT } from "@/lib/watermark/dct";

export async function POST(request: Request) {
  const form = await request.formData();
  const stego = form.get("stego");
  const stegoKey = form.get("stegoKey");
  if (!(stego instanceof File) || typeof stegoKey !== "string" || !stegoKey) {
    return Response.json({ error: "parameter stego/stegoKey tidak lengkap" }, { status: 400 });
  }
  try {
    const img = await loadRaw(Buffer.from(await stego.arrayBuffer()));
    const res = extractDCT(img, stegoKey);
    return Response.json({
      success: res.success,
      payload: res.payload,
      reason: res.reason,
      ber_estimate: res.berEstimate,
      blockMap: res.blockMap ? Array.from(res.blockMap) : undefined,
    });
  } catch (e) {
    return Response.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
