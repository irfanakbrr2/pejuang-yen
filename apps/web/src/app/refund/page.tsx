import type { Metadata } from "next";
import { LegalPage, Section, Bullets, CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Kebijakan Refund — PejuangYen",
  description: "Halaman Kebijakan Pengembalian Dana PejuangYen sedang dalam proses penyusunan.",
  robots: { index: false },
};

export default function RefundPage() {
  return (
    <LegalPage
      title="Kebijakan Pengembalian Dana"
      subtitle="Halaman ini sedang kami susun dan finalisasi."
      draft
    >
      <Section title="Sedang dalam proses">
        <p>
          Kebijakan pengembalian dana resmi sedang difinalisasi. Jika kamu mengalami kendala pembayaran atau ingin
          menanyakan status pesanan, silakan hubungi kami terlebih dahulu dan sertakan nomor pesananmu.
        </p>
      </Section>

      <Section title="Yang akan dicakup">
        <Bullets
          items={[
            "Ketentuan pengembalian dana untuk tiap jenis produk (kelas, membership, produk digital).",
            "Syarat dan jangka waktu pengajuan.",
            "Produk atau layanan yang tidak dapat dikembalikan, misalnya kredit AI Tools yang sudah terpakai.",
            "Cara dan jalur mengajukan permohonan.",
          ]}
        />
      </Section>

      <Section title="Butuh bantuan sekarang?">
        <p>
          Hubungi kami di{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a> dengan
          menyertakan nomor pesanan dan email akunmu.
        </p>
      </Section>
    </LegalPage>
  );
}
