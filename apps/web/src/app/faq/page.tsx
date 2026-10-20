import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "FAQ — Pertanyaan yang Sering Ditanya | PejuangYen",
  description:
    "Jawaban untuk pertanyaan umum seputar akun, pembayaran, kelas, membership, dan program affiliate PejuangYen.",
};

type QA = { q: string; a: React.ReactNode };

const CATEGORIES: { title: string; items: QA[] }[] = [
  {
    title: "Akun & Akses",
    items: [
      {
        q: "Bagaimana cara mendaftar?",
        a: "Buka halaman daftar, isi nama, email, nomor WhatsApp, dan kata sandi. Begitu selesai, akun kamu langsung aktif dan kamu otomatis masuk ke dashboard — tanpa langkah verifikasi email.",
      },
      {
        q: "Saya lupa kata sandi.",
        a: "Gunakan tautan lupa kata sandi di halaman masuk. Kami akan mengirim tautan atur ulang ke email kamu yang berlaku untuk waktu terbatas.",
      },
    ],
  },
  {
    title: "Pembayaran & Pesanan",
    items: [
      {
        q: "Metode pembayaran apa yang tersedia?",
        a: "Pembayaran diproses secara aman melalui QRIS dan Virtual Account (transfer bank). Kamu dapat memilih metode di halaman checkout.",
      },
      {
        q: "Saya sudah bayar tapi status belum berubah.",
        a: "Status biasanya terbarui otomatis dalam beberapa saat. Kamu juga bisa menekan tombol Saya sudah bayar di halaman checkout untuk memicu pengecekan langsung.",
      },
      {
        q: "Berapa lama pesanan saya berlaku?",
        a: "Pesanan yang belum dibayar berstatus menunggu hingga sekitar 24 jam. Setelah itu pesanan kedaluwarsa dan kamu perlu membuat pesanan baru.",
      },
      {
        q: "Bisakah saya ganti metode pembayaran?",
        a: "Bisa. Di halaman checkout, pilih ganti metode pembayaran untuk membuat tagihan baru dengan metode yang berbeda.",
      },
    ],
  },
  {
    title: "Membership & Kelas",
    items: [
      {
        q: "Bagaimana cara mengakses kelas setelah membeli?",
        a: "Akses aktif otomatis setelah pembayaran terkonfirmasi. Buka halaman Kelas Saya untuk mulai belajar.",
      },
      {
        q: "Jika saya perpanjang membership, kapan masa berlakunya dihitung?",
        a: "Perpanjangan ditambahkan ke akhir masa aktif yang sedang berjalan — bukan dihitung ulang dari tanggal bayar. Jadi sisa masa aktifmu tidak hangus.",
      },
      {
        q: "Apakah saya dapat sertifikat?",
        a: "Ya, untuk kelas yang mendukung sertifikat. Sertifikat dapat diverifikasi publik melalui halaman verifikasi sertifikat.",
      },
    ],
  },
  {
    title: "Affiliate",
    items: [
      {
        q: "Berapa komisi program affiliate?",
        a: "Komisi 20% untuk penjualan kelas dan produk digital, serta 40% untuk penjualan membership premium. Daftar dan ambil tautan referralmu di halaman Affiliate.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <LegalPage
      title="Pertanyaan yang Sering Ditanya"
      subtitle="Jawaban singkat untuk hal-hal yang paling sering ditanyakan. Tidak menemukan jawabanmu? Lihat Pusat Bantuan atau hubungi kami."
    >
      <div className="mt-6 space-y-8">
        {CATEGORIES.map((cat) => (
          <section key={cat.title}>
            <h2 className="mb-3 text-base font-bold text-warm-black">{cat.title}</h2>
            <div className="space-y-2.5">
              {cat.items.map((item) => (
                <details key={item.q} className="group rounded-xl border border-black/[0.08] bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-warm-black hover:bg-warm-cream">
                    <span className="min-w-0">{item.q}</span>
                    <span className="shrink-0 text-xl leading-none text-primary transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-[15px] leading-relaxed text-gray-700">{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </LegalPage>
  );
}
