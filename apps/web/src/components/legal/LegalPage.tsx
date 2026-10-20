import Link from "next/link";
import Image from "next/image";

export const CONTACT_EMAIL = "hello@pejuangyen.com";

const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: "Pusat Bantuan", href: "/help" },
  { label: "FAQ", href: "/faq" },
  { label: "Mulai Cepat", href: "/getting-started" },
  { label: "Kebijakan Privasi", href: "/privacy" },
  { label: "Kebijakan Cookie", href: "/cookies" },
  { label: "Syarat & Ketentuan", href: "/terms" },
  { label: "Kebijakan Refund", href: "/refund" },
  { label: "Ketentuan Affiliate", href: "/affiliate-terms" },
];

/** Judul bagian + isi, dipakai di seluruh halaman legal/bantuan. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-warm-black mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

/** List bullet konsisten. */
export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-primary">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** Shell halaman publik (legal & bantuan) — header logo, konten, footer cross-link. */
export function LegalPage({
  title,
  subtitle,
  updatedAt,
  draft = false,
  children,
}: {
  title: string;
  subtitle?: string;
  updatedAt?: string;
  draft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-warm-cream">
      <header className="border-b border-black/[0.06] bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex items-center" aria-label="PejuangYen beranda">
            <Image src="/logo.png" alt="PejuangYen" width={128} height={32} className="h-7 w-auto" priority />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-primary"
          >
            Ke Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {draft && (
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Sedang disusun
          </span>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-warm-black">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{subtitle}</p>}
        {updatedAt && <p className="mt-3 text-xs text-gray-400">Terakhir diperbarui: {updatedAt}</p>}

        <div className="mt-2">{children}</div>

        <footer className="mt-14 border-t border-black/[0.08] pt-8">
          <p className="mb-3 text-sm font-semibold text-warm-black">Halaman lain</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-gray-600 transition-colors hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p className="mt-6 text-xs text-gray-400">
            Butuh bantuan? Hubungi kami di{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
