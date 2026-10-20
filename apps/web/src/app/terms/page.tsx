import type { Metadata } from "next";
import { LegalPage, Section, Bullets, CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — PejuangYen",
  description: "Halaman Syarat & Ketentuan PejuangYen sedang dalam proses penyusunan.",
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      subtitle="Halaman ini sedang kami susun dan finalisasi."
      draft
    >
      <Section title="Sedang dalam proses">
        <p>
          Kami sedang menyusun Syarat &amp; Ketentuan resmi yang akurat sesuai cara kerja layanan. Sampai halaman ini
          terbit, penggunaan layanan tetap tunduk pada kebijakan operasional kami dan{" "}
          <a href="/privacy" className="text-primary hover:underline">Kebijakan Privasi</a>.
        </p>
      </Section>

      <Section title="Yang akan dicakup">
        <Bullets
          items={[
            "Ketentuan penggunaan layanan dan tanggung jawab pemegang akun.",
            "Ketentuan pembelian, pemberian akses (kelas, membership, produk, kredit), dan masa berlaku.",
            "Hak kekayaan intelektual atas materi dan larangan distribusi ulang.",
            "Penggunaan yang dilarang (penyalahgunaan, bot, multi-akun untuk manipulasi).",
            "Disclaimer, termasuk bahwa output AI Tools dapat tidak akurat dan perlu kamu verifikasi.",
            "Pembatasan tanggung jawab serta ketentuan pembatasan dan penghentian akun.",
          ]}
        />
        <p>
          Kebijakan pengembalian dana diatur terpisah di halaman{" "}
          <a href="/refund" className="text-primary hover:underline">Kebijakan Refund</a>.
        </p>
      </Section>

      <Section title="Pertanyaan">
        <p>
          Ada pertanyaan sebelum halaman ini terbit? Hubungi kami di{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
