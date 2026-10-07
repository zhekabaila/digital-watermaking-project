import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center">
      <div className="flex gap-2" aria-hidden>
        <span className="blob h-7 w-7 rounded-full bg-sun/70" />
        <span className="blob h-7 w-7 rounded-full bg-coral/70 [animation-delay:-3s]" />
        <span className="blob h-7 w-7 rounded-full bg-teal/70 [animation-delay:-6s]" />
      </div>
      <h1 className="font-display text-5xl font-bold tracking-tight">
        4<span className="text-coral">0</span>4
      </h1>
      <p className="max-w-sm text-sm font-semibold leading-6 text-muted">
        Halaman ini tidak ada — atau mungkin LSB-nya sudah tergeser. Kembali ke beranda untuk
        melanjutkan.
      </p>
      <Link
        href="/"
        className="rounded-full bg-sun px-6 py-3 text-sm font-extrabold text-foreground shadow-pop-sun transition-all hover:-translate-y-0.5 hover:bg-sun-deep active:scale-[0.98]"
      >
        ← Kembali ke beranda
      </Link>
    </div>
  );
}
