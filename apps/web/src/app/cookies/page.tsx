import type { Metadata } from "next";
import { LegalPage, Section, Bullets } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Kebijakan Cookie — PejuangYen",
  description:
    "Cookie dan teknologi serupa yang digunakan PejuangYen, untuk apa, dan cara mengelolanya.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Kebijakan Cookie"
      subtitle="Penjelasan tentang cookie dan teknologi serupa yang kami gunakan, beserta cara mengelolanya. Kebijakan ini merupakan bagian dari Kebijakan Privasi kami."
      updatedAt="14 Juni 2026"
    >
      <Section title="1. Apa Itu Cookie">
        <p>
          Cookie adalah berkas kecil yang disimpan di peramban kamu. Kami juga memakai teknologi serupa seperti
          penyimpanan lokal peramban (local storage). Teknologi ini membantu layanan berfungsi dengan benar dan
          membantu kami memahami cara layanan digunakan.
        </p>
      </Section>

      <Section title="2. Cookie yang Kami Gunakan">
        <Bullets
          items={[
            <><strong>Cookie sesi (wajib)</strong> — menjaga kamu tetap masuk setelah login. Tanpa ini, kamu tidak dapat menggunakan area yang membutuhkan akun. Cookie ini bersifat aman dan tidak dapat dibaca oleh skrip di halaman.</>,
            <><strong>Penyimpanan kode referral</strong> — saat kamu masuk melalui tautan affiliate, kode referral disimpan di peramban untuk mengaitkan pendaftaran atau pembelianmu dengan affiliate yang merujuk.</>,
          ]}
        />
      </Section>

      <Section title="3. Analitik dan Pelacakan">
        <p>Untuk memahami penggunaan dan memperbaiki layanan, kami mencatat aktivitas secara terbatas:</p>
        <Bullets
          items={[
            "Pelacakan first-party — kami mencatat event penggunaan (halaman yang dibuka, jenis perangkat, sumber rujukan). Alamat IP dan identitas peramban disimpan dalam bentuk teracak (hash).",
            "Analitik pihak ketiga (Google Analytics) — untuk statistik agregat seperti jumlah kunjungan dan halaman populer.",
          ]}
        />
      </Section>

      <Section title="4. Mengelola Cookie">
        <p>
          Kamu dapat mengatur atau menghapus cookie melalui pengaturan peramban. Perlu diketahui, menonaktifkan cookie
          sesi akan membuat kamu tidak bisa tetap masuk ke akun. Untuk analitik, kamu dapat menggunakan pengaturan
          privasi peramban atau ekstensi penolak pelacakan sesuai preferensimu.
        </p>
      </Section>

      <Section title="5. Kontak">
        <p>
          Pertanyaan tentang penggunaan cookie dapat dikirim melalui kontak yang tercantum pada{" "}
          <a href="/privacy" className="text-primary hover:underline">Kebijakan Privasi</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
