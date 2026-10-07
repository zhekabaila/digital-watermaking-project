import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import Link from "next/link";
import { TopNav } from "@/app/nav";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Watermaking — Watermark LSB + DCT",
  description:
    "Digital watermarking jalur ganda (fragile LSB & robust DCT) — Tugas Keamanan Informasi, Universitas Siliwangi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#konten"
          className="sr-only rounded-full bg-foreground px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
        >
          Lompat ke konten
        </a>
        <header className="border-b-2 border-line bg-paper/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link
              href="/"
              className="font-display text-xl font-bold tracking-tight"
            >
              <span className="text-sun-deep">Water</span>
              <span className="text-teal-deep">making</span>
              <span className="ml-1 inline-block -rotate-6 rounded-md bg-grape/15 px-1.5 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-widest text-grape-deep">
                lab
              </span>
            </Link>
            <TopNav />
          </div>
        </header>
        <main id="konten" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
          {children}
        </main>
        <footer className="border-t-2 border-line bg-paper/70 py-4 text-center text-xs font-semibold text-muted">
          Keamanan Informasi · Universitas Siliwangi · LSB{" "}
          <span className="text-sun-deep">fragile</span> + DCT{" "}
          <span className="text-teal-deep">robust</span> · payload{" "}
          <span className="text-grape-deep">AES-256-GCM</span>
        </footer>
      </body>
    </html>
  );
}
