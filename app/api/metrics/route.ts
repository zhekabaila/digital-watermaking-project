import { loadRaw } from "@/lib/image/sharp-utils";
import { msePsnr } from "@/lib/metrics/psnr";
import { ber, normalizedCorrelation, textToBits } from "@/lib/metrics/nc-ber";
import { histogram } from "@/lib/metrics/entropy-histogram";

export async function POST(request: Request) {
  const form = await request.formData();
  const imageA = form.get("imageA");
  const imageB = form.get("imageB");
  const wmA = form.get("watermarkA");
  const wmB = form.get("watermarkB");
  const wantHist = form.get("histogram") === "true";
  const out: Record<string, unknown> = {};

  try {
    if (imageA instanceof File && imageB instanceof File) {
      const a = await loadRaw(Buffer.from(await imageA.arrayBuffer()));
      const b = await loadRaw(Buffer.from(await imageB.arrayBuffer()));
      const m = msePsnr(a, b);
      out.psnr = m.psnr === Infinity ? null : Number(m.psnr.toFixed(4));
      out.mse = Number(m.mse.toFixed(6));
      out.maxDiff = m.maxDiff;
      if (wantHist) {
        out.histogramA = histogram(a);
        out.histogramB = histogram(b);
      }
    }
    if (typeof wmA === "string" && typeof wmB === "string") {
      const bitsA = textToBits(wmA);
      const bitsB = textToBits(wmB);
      out.nc = Number(normalizedCorrelation(bitsA, bitsB).toFixed(6));
      out.ber = Number(ber(bitsA, bitsB).toFixed(6));
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  if (Object.keys(out).length === 0) {
    return Response.json(
      { error: "butuh imageA+imageB dan/atau watermarkA+watermarkB" },
      { status: 400 }
    );
  }
  return Response.json(out);
}
