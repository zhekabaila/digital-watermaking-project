import Link from "next/link";

const CARDS = [
  {
    href: "/embed",
    title: "Embed",
    accent: "border-sun bg-sun/10 text-sun-deep shadow-pop-sun",
    badge: "LSB + DCT",
    desc: "Sisipkan watermark terenkripsi AES-256-GCM ke citra cover. Bandingkan cover & stego berdampingan, lihat PSNR/MSE, kapasitas bit, dan histogram RGB.",
  },
  {
    href: "/extract",
    title: "Extract",
    accent: "border-teal bg-teal/10 text-teal-deep shadow-pop-teal",
    badge: "verifikasi",
    desc: "Baca ulang payload dengan stego-key. AuthTag gagal = key salah atau citra dimanipulasi, lengkap dengan peta paritas blok.",
  },
  {
    href: "/attack-lab",
    title: "Attack Lab",
    accent: "border-coral bg-coral/10 text-coral-deep shadow-pop-coral",
    badge: "matriks uji",
    desc: "JPEG 90/70/50, crop, resize, noise, brightness, contrast — dijalankan otomatis atas 5 citra × 2 metode.",
  },
  {
    href: "/compare",
    title: "Compare",
    accent: "border-grape bg-grape/10 text-grape-deep shadow-pop-grape",
    badge: "pengayaan",
    desc: "Grafik NC & BER LSB vs DCT pada data uji yang sama, lalu ekspor hasil ke XLSX untuk laporan.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-14">
      <section className="relative grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr]">
        <div className="pop-in">
          <p className="mb-3 inline-block rounded-full bg-sky/15 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-sky">
            topik C · jalur ganda
          </p>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Air di dalam{" "}
            <span className="text-sun-deep">pixel</span>,
            <br />
            kunci di dalam{" "}
            <span className="text-teal-deep">angka</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Dua metode watermarking dalam satu laboratorium: <strong className="text-foreground">LSB</strong>{" "}
            yang rapuh — pecah oleh manipulasi terkecil sekalipun — dan <strong className="text-foreground">DCT 8×8</strong>{" "}
            yang tahan banting terhadap kompresi. Semua payload dienkripsi AES-256-GCM lebih dulu.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/embed"
              className="rounded-full bg-sun px-6 py-3 text-sm font-extrabold text-foreground shadow-pop-sun transition-transform duration-200 hover:-translate-y-0.5 hover:bg-sun-deep active:scale-[0.98]"
            >
              Mulai embed →
            </Link>
            <Link
              href="/attack-lab"
              className="rounded-full border-2 border-line bg-paper px-6 py-3 text-sm font-extrabold transition-colors duration-200 hover:border-coral hover:bg-coral/10 hover:text-coral-deep active:scale-[0.98]"
            >
              Lihat Attack Lab
            </Link>
          </div>
        </div>
        <div aria-hidden className="pop-in pop-in-2 relative hidden md:block">
          <div className="blob absolute -right-4 top-2 h-36 w-36 rounded-full bg-sun/60 blur-[2px]" />
          <div className="blob absolute right-24 top-24 h-24 w-24 rounded-[30%_70%_70%_30%] bg-teal/50 [animation-delay:-3s]" />
          <div className="blob absolute right-2 top-44 h-20 w-20 rounded-full bg-coral/50 [animation-delay:-6s]" />
          <div className="absolute right-16 top-16 grid grid-cols-8 gap-1.5 rounded-3xl border-2 border-line bg-paper p-4 shadow-card">
            {Array.from({ length: 32 }, (_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-[4px] ${
                  [3, 6, 9, 12, 18, 21, 26, 29].includes(i)
                    ? i % 3 === 0
                      ? "bg-grape"
                      : "bg-sky"
                    : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        aria-label="Menu utama"
        className="grid gap-4 md:grid-cols-2"
      >
        {CARDS.map((c, i) => (
          <Link
            key={c.href}
            href={c.href}
            className={`pop-in pop-in-${i + 1} group flex flex-col justify-between gap-4 rounded-blobby border-2 p-6 transition-transform duration-200 hover:-translate-y-1 active:scale-[0.99] md:odd:col-span-2 ${c.accent}`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-80">
                {c.badge}
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold text-foreground">
                {c.title}
              </h2>
              <p className="mt-2 max-w-[46ch] text-sm leading-6 text-muted">
                {c.desc}
              </p>
            </div>
            <span className="text-sm font-extrabold transition-transform duration-200 group-hover:translate-x-1.5">
              Buka →
            </span>
          </Link>
        ))}
      </section>

      <section className="rounded-blobby border-2 border-sky/40 bg-sky/10 p-6 text-sm leading-7">
        <h2 className="font-display text-lg font-bold">Catatan keamanan</h2>
        <p className="mt-1 max-w-3xl text-muted">
          Stego-key hanya lewat form — tidak pernah disimpan, di-log, atau ditulis ke disk;
          semua citra diproses in-memory. PRNG posisi piksel/blok ditulis manual dan
          deterministik (mulberry32 ber-seed turunan scrypt dari key Anda).
        </p>
      </section>
    </div>
  );
}
