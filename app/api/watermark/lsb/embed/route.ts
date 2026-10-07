import { loadRaw, rawToPng } from "@/lib/image/sharp-utils";
import { embedLSB, lsbCapacityBits, lsbMaxPayloadBytes } from "@/lib/watermark/lsb";
import { msePsnr } from "@/lib/metrics/psnr";

export async function POST(request: Request) {
  const form = await request.formData();
  const cover = form.get("cover");
  const payload = form.get("payload");
  const stegoKey = form.get("stegoKey");
  if (!(cover instanceof File) || typeof payload !== "string" || typeof stegoKey !== "string" || !stegoKey) {
    return Response.json({ error: "parameter cover/payload/stegoKey tidak lengkap" }, { status: 400 });
  }
  try {
    const img = await loadRaw(Buffer.from(await cover.arrayBuffer()));
    const { stego, totalBits, blockCount } = embedLSB(img, payload, stegoKey);
    const png = await rawToPng(stego);
    const { psnr, mse } = msePsnr(img, stego);
    return new Response(new Blob([new Uint8Array(png)]), {
      headers: {
        "Content-Type": "image/png",
        "X-Payload-Bits": String(totalBits),
        "X-Capacity-Bits": String(lsbCapacityBits(img)),
        "X-Max-Payload-Bytes": String(lsbMaxPayloadBytes(img)),
        "X-Block-Count": String(blockCount),
        "X-Psnr": psnr === Infinity ? "inf" : psnr.toFixed(4),
        "X-Mse": mse.toFixed(6),
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
