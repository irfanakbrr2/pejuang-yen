import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Pusat Bantuan — PejuangYen",
  description:
    "Panduan dan jawaban seputar akun, pembayaran, kelas, membership, dan program affiliate PejuangYen.",
};

type Topic = { title: string; desc: string; href: string };

const TOPICS: Topic[] = [
  { title: "Mulai Cepat", desc: "Langkah daftar hingga mulai belajar untuk member baru.", href: "/getting-started" },
  { title: "Akun & Keamanan", desc: "Daftar, verifikasi email, lupa kata sandi, dan kelola profil.", href: "/faq" },
  { title: "Pembayaran & Pesanan", desc: "Metode bayar, status pesanan, dan ganti metode pembayaran.", href: "/faq" },
  { title: "Kelas & Sertifikat", desc: "Akses kelas, progres belajar, dan sertifikat.", href: "/my-classes" },
  { title: "Membership", desc: "Paket, perpanjangan, dan benefit premium.", href: "/premium" },
  { title: "Program Affiliate", desc: "Ambil tautan referral dan pantau komisi.", href: "/affiliate" },
];

export default function HelpPage() {
  return (
    <LegalPage
      title="Pusat Bantuan"
      subtitle="Pilih topik di bawah untuk menemukan panduan dan jawaban. Untuk pertanyaan cepat, lihat FAQ."
    >
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className="group rounded-xl border border-black/[0.08] bg-white p-5 transition-colors hover:border-primary/40"
          >
            <h2 className="text-base font-bold text-warm-black group-hover:text-primary">{t.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{t.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-warm-black p-6 text-white">
        <h2 className="text-lg font-bold">Masih butuh bantuan?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
          Tim kami siap membantu. Kirim pertanyaanmu dan sertakan nomor pesanan jika berkaitan dengan transaksi.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-4 inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-warm-black transition-colors hover:bg-gray-100"
        >
          Email {CONTACT_EMAIL}
        </a>
      </div>

      <p className="mt-6 text-sm text-gray-600">
        Lihat juga <Link href="/faq" className="text-primary hover:underline">FAQ</Link> dan{" "}
        <Link href="/getting-started" className="text-primary hover:underline">panduan Mulai Cepat</Link>.
      </p>
    </LegalPage>
  );
}
