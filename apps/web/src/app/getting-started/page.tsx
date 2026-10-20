import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Mulai Cepat — Panduan Member Baru | PejuangYen",
  description:
    "Langkah demi langkah memulai di PejuangYen: daftar, verifikasi, pilih kelas atau membership, dan mulai belajar.",
};

type Step = { n: number; title: string; body: React.ReactNode };

const STEPS: Step[] = [
  {
    n: 1,
    title: "Buat akun",
    body: (
      <>
        Daftar dengan nama, email, dan nomor WhatsApp di halaman{" "}
        <Link href="/register" className="text-primary hover:underline">daftar</Link>. Gunakan email yang aktif —
        akses dan notifikasi penting dikirim ke sana.
      </>
    ),
  },
  {
    n: 2,
    title: "Akun langsung aktif",
    body: (
      <>
        Tidak ada langkah verifikasi email. Begitu selesai mendaftar, akun kamu langsung aktif dan kamu otomatis masuk
        ke dashboard — siap dipakai untuk mulai belajar.
      </>
    ),
  },
  {
    n: 3,
    title: "Lengkapi profil",
    body: (
      <>
        Isi peran, tujuan, dan minatmu saat onboarding agar rekomendasi kelas lebih relevan. Kamu bisa memperbarui
        data ini kapan saja di halaman{" "}
        <Link href="/account" className="text-primary hover:underline">Akun</Link>.
      </>
    ),
  },
  {
    n: 4,
    title: "Pilih kelas atau membership",
    body: (
      <>
        Jelajahi katalog di halaman <Link href="/kelas" className="text-primary hover:underline">Kelas</Link> atau lihat
        paket di <Link href="/premium" className="text-primary hover:underline">Premium</Link>. Pilih yang sesuai
        kebutuhanmu, lalu lanjut ke pembayaran.
      </>
    ),
  },
  {
    n: 5,
    title: "Selesaikan pembayaran",
    body: (
      <>
        Bayar dengan QRIS atau Virtual Account langsung di halaman checkout. Akses aktif otomatis begitu pembayaran
        terkonfirmasi — tidak perlu menunggu konfirmasi manual.
      </>
    ),
  },
  {
    n: 6,
    title: "Mulai belajar",
    body: (
      <>
        Buka <Link href="/my-classes" className="text-primary hover:underline">Kelas Saya</Link> untuk menonton materi.
        Progresmu tersimpan otomatis, dan kamu bisa mendapatkan sertifikat untuk kelas yang mendukungnya.
      </>
    ),
  },
  {
    n: 7,
    title: "Jelajahi fitur lain",
    body: (
      <>
        Jelajahi koleksi <Link href="/kelas" className="text-primary hover:underline">Kelas</Link>, kumpulkan{" "}
        <Link href="/certificates" className="text-primary hover:underline">Sertifikat</Link>, atau dapatkan komisi lewat{" "}
        <Link href="/affiliate" className="text-primary hover:underline">program Affiliate</Link>.
      </>
    ),
  },
];

export default function GettingStartedPage() {
  return (
    <LegalPage
      title="Mulai Cepat"
      subtitle="Tujuh langkah singkat untuk memulai perjalanan belajarmu di PejuangYen."
    >
      <ol className="mt-8 space-y-5">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-4 rounded-xl border border-black/[0.08] bg-white p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
              {s.n}
            </span>
            <div>
              <h2 className="text-base font-bold text-warm-black">{s.title}</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-700">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border border-black/[0.08] bg-white p-5">
        <p className="text-sm text-gray-700">
          Masih bingung? Lihat <Link href="/faq" className="text-primary hover:underline">FAQ</Link> atau{" "}
          <Link href="/help" className="text-primary hover:underline">Pusat Bantuan</Link> untuk panduan lebih lengkap.
        </p>
      </div>
    </LegalPage>
  );
}
