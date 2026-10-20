import type { Metadata } from "next";
import { LegalPage, Section, Bullets, CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — PejuangYen",
  description:
    "Bagaimana PejuangYen mengumpulkan, menggunakan, membagikan, dan melindungi data pribadi kamu, serta hak kamu berdasarkan UU PDP No. 27/2022.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      subtitle="Kebijakan ini menjelaskan data apa yang kami kumpulkan saat kamu menggunakan PejuangYen, untuk apa data itu dipakai, dengan siapa dibagikan, dan hak kamu atas data tersebut."
      updatedAt="14 Juni 2026"
    >
      <Section title="1. Pendahuluan">
        <p>
          PejuangYen (&quot;kami&quot;) menghargai privasi kamu. Dengan membuat akun dan menggunakan layanan kami,
          kamu memahami praktik yang dijelaskan dalam kebijakan ini. Kebijakan ini disusun mengacu pada
          Undang-Undang Pelindungan Data Pribadi (UU PDP) No. 27 Tahun 2022 dan peraturan terkait di Indonesia.
        </p>
      </Section>

      <Section title="2. Data yang Kami Kumpulkan">
        <p>Kami mengumpulkan data berikut, sebagian besar kamu berikan secara langsung saat mendaftar dan memakai layanan:</p>
        <Bullets
          items={[
            <><strong>Data akun</strong> — nama, alamat email, dan nomor WhatsApp. Kata sandi disimpan dalam bentuk teracak (hash), tidak pernah dalam bentuk asli.</>,
            <><strong>Data profil</strong> — foto profil, bio, kota, dan preferensi onboarding (peran, tujuan, minat) yang kamu isi sendiri.</>,
            <><strong>Data transaksi</strong> — riwayat pesanan, paket yang dibeli, status pembayaran, kode kupon, dan kode referral. Kami tidak menyimpan data kartu kredit/debit kamu.</>,
            <><strong>Data aktivitas belajar</strong> — progres kelas, riwayat menonton, kehadiran webinar, sertifikat, serta poin dan pencapaian.</>,
            <><strong>Data teknis</strong> — jenis perangkat, halaman yang dikunjungi, sumber rujukan, serta alamat IP dan identitas peramban yang kami simpan dalam bentuk teracak (hash) untuk keamanan dan analitik.</>,
          ]}
        />
      </Section>

      <Section title="3. Cara Kami Menggunakan Data">
        <Bullets
          items={[
            "Membuat dan mengamankan akun serta memverifikasi identitas kamu.",
            "Memproses pesanan dan mengaktifkan akses kelas/membership.",
            "Mengirim notifikasi penting, email transaksional (mis. invoice, konfirmasi), dan — bila kamu setuju — informasi serta promosi.",
            "Mempersonalisasi rekomendasi konten dan pengalaman belajar.",
            "Menganalisis penggunaan layanan agar kami bisa memperbaiki kualitas dan performa.",
            "Mencegah penyalahgunaan, penipuan, dan aktivitas yang melanggar ketentuan.",
          ]}
        />
      </Section>

      <Section title="4. Berbagi Data dengan Pihak Ketiga">
        <p>
          Kami <strong>tidak menjual</strong> data pribadi kamu. Kami hanya membagikan data seperlunya kepada
          penyedia layanan tepercaya yang membantu mengoperasikan platform, antara lain:
        </p>
        <Bullets
          items={[
            "Penyedia layanan pembayaran — untuk memproses transaksi.",
            "Penyedia layanan pengiriman email — untuk mengirim email transaksional dan komunikasi.",
            "Penyedia infrastruktur cloud dan keamanan — untuk hosting, penyimpanan, dan perlindungan dari bot.",
            "Layanan analitik standar (Google Analytics) — untuk statistik penggunaan secara agregat.",
          ]}
        />
        <p>
          Para penyedia ini hanya boleh memproses data sesuai instruksi kami dan untuk tujuan yang disebutkan.
          Kami juga dapat mengungkap data bila diwajibkan oleh hukum.
        </p>
      </Section>

      <Section title="5. Cookie dan Pelacakan">
        <p>
          Kami menggunakan cookie sesi untuk menjaga kamu tetap masuk, menyimpan kode referral di peramban untuk
          atribusi program affiliate, serta mencatat aktivitas penggunaan secara first-party. Penjelasan lengkap ada
          di <a href="/cookies" className="text-primary hover:underline">Kebijakan Cookie</a>.
        </p>
      </Section>

      <Section title="6. Penyimpanan dan Masa Retensi">
        <Bullets
          items={[
            "Data akun dan riwayat transaksi disimpan selama akun aktif dan/atau selama diperlukan untuk kebutuhan layanan, hukum, dan akuntansi.",
            "Data aktivitas mentah (event penggunaan) dibersihkan secara berkala (umumnya setelah sekitar 90 hari); hanya ringkasan agregat yang disimpan lebih lama untuk pelaporan.",
            "Akun yang tidak menyelesaikan verifikasi email akan dihapus otomatis dalam waktu sekitar 24 jam.",
            "Sesi login yang sudah tidak aktif dibersihkan secara berkala.",
          ]}
        />
      </Section>

      <Section title="7. Keamanan Data">
        <p>
          Kami menerapkan langkah pengamanan yang wajar: enkripsi HTTPS untuk semua lalu lintas data, kata sandi dan
          token sesi yang disimpan dalam bentuk teracak (hash), serta perlindungan terhadap bot dan penyalahgunaan.
          Meski demikian, tidak ada sistem yang sepenuhnya bebas risiko; jaga kerahasiaan kredensial akun kamu.
        </p>
      </Section>

      <Section title="8. Hak Kamu (UU PDP No. 27/2022)">
        <p>Sesuai UU PDP, kamu memiliki sejumlah hak atas data pribadimu:</p>
        <Bullets
          items={[
            <><strong>Akses dan koreksi</strong> — kamu dapat melihat dan memperbarui data profil langsung dari halaman <a href="/account" className="text-primary hover:underline">Akun</a>.</>,
            <><strong>Menarik persetujuan pemasaran</strong> — gunakan tautan berhenti berlangganan (unsubscribe) di bagian bawah email kami kapan saja.</>,
            <><strong>Penghapusan akun dan data</strong> — kamu dapat meminta penghapusan akun beserta data pribadimu.</>,
            <><strong>Salinan data</strong> — kamu dapat meminta salinan data pribadi yang kami simpan.</>,
          ]}
        />
        <p>
          Untuk permintaan penghapusan akun atau salinan data, kirim email ke{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a> dari alamat
          email akun kamu. Permintaan ini saat ini kami proses secara manual; sebagian data tertentu (seperti riwayat
          transaksi) dapat kami simpan dalam bentuk teranonimkan bila diwajibkan untuk kepatuhan hukum dan akuntansi.
        </p>
      </Section>

      <Section title="9. Anak di Bawah Umur">
        <p>
          Layanan ini ditujukan untuk pengguna dewasa. Jika kamu di bawah umur menurut hukum yang berlaku, gunakan
          layanan ini hanya dengan persetujuan dan pengawasan orang tua atau wali.
        </p>
      </Section>

      <Section title="10. Perubahan Kebijakan">
        <p>
          Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Perubahan penting akan kami informasikan melalui
          email atau pengumuman di dalam aplikasi. Tanggal pembaruan terakhir tercantum di bagian atas halaman ini.
        </p>
      </Section>

      <Section title="11. Kontak">
        <p>
          Pertanyaan tentang privasi atau data pribadimu dapat dikirim ke{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
