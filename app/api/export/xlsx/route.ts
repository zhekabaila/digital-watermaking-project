import ExcelJS from "exceljs";

export interface HasilUjiRow {
  citra: string;
  metode: "LSB" | "DCT";
  serangan: string;
  psnr: number | null;
  mse: number | null;
  nc: number | null;
  ber: number | null;
  ekstraksi: "berhasil" | "gagal";
  payloadTerkstrak?: string;
  catatan?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { results?: HasilUjiRow[] };
  const results = Array.isArray(body.results) ? body.results : null;
  if (!results || results.length === 0) {
    return Response.json({ error: "body { results: [] } wajib diisi" }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kelompok Kriptografi — Universitas Siliwangi";
  wb.created = new Date();
  const ws = wb.addWorksheet("Hasil Uji");
  ws.columns = [
    { header: "Citra", key: "citra", width: 24 },
    { header: "Metode", key: "metode", width: 10 },
    { header: "Serangan", key: "serangan", width: 14 },
    { header: "PSNR (dB)", key: "psnr", width: 12 },
    { header: "MSE", key: "mse", width: 12 },
    { header: "NC", key: "nc", width: 10 },
    { header: "BER", key: "ber", width: 10 },
    { header: "Ekstraksi", key: "ekstraksi", width: 12 },
    { header: "Payload Terkstrak", key: "payloadTerkstrak", width: 32 },
    { header: "Catatan", key: "catatan", width: 32 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of results) {
    ws.addRow({ ...r, psnr: r.psnr ?? "-", mse: r.mse ?? "-", nc: r.nc ?? "-", ber: r.ber ?? "-" });
  }
  ws.getRow(1).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Blob([new Uint8Array(buf as unknown as Uint8Array)]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="hasil-uji.xlsx"',
    },
  });
}
