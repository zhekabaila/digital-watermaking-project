import { loadRaw, rawToPng } from "@/lib/image/sharp-utils";
import { embedDCT, dctCapacityBits, DEFAULT_MARGIN } from "@/lib/watermark/dct";
import { msePsnr } from "@/lib/metrics/psnr";

export async function POST(request: Request) {
  const form = await request.formData();
  const cover = form.get("cover");
  const payload = form.get("payload");
  const stegoKey = form.get("stegoKey");
  const marginRaw = form.get("margin");
  if (!(cover instanceof File) || typeof payload !== "string" || typeof stegoKey !== "string" || !stegoKey) {
    return Response.json({ error: "parameter cover/payload/stegoKey tidak lengkap" }, { status: 400 });
  }
  const margin = typeof marginRaw === "string" && marginRaw ? Number(marginRaw) : DEFAULT_MARGIN;
  if (!Number.isFinite(margin) || margin <= 0) {
    return Response.json({ error: "margin tidak valid" }, { status: 400 });
  }
  try {
    const img = await loadRaw(Buffer.from(await cover.arrayBuffer()));
    const { stego, totalBits, margin: usedMargin } = embedDCT(img, payload, stegoKey, margin);
    const png = await rawToPng(stego);
    const { psnr, mse } = msePsnr(img, stego);
    return new Response(new Blob([new Uint8Array(png)]), {
      headers: {
        "Content-Type": "image/png",
        "X-Payload-Bits": String(totalBits),
        "X-Capacity-Bits": String(dctCapacityBits(img)),
        "X-Margin": String(usedMargin),
        "X-Psnr": psnr === Infinity ? "inf" : psnr.toFixed(4),
        "X-Mse": mse.toFixed(6),
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
