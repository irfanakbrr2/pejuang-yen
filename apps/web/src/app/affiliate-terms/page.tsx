import type { Metadata } from "next";
import { LegalPage, Section, Bullets, CONTACT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Ketentuan Program Affiliate — PejuangYen",
  description: "Halaman Ketentuan Program Affiliate PejuangYen sedang dalam proses penyusunan.",
  robots: { index: false },
};

export default function AffiliateTermsPage() {
  return (
    <LegalPage
      title="Ketentuan Program Affiliate"
      subtitle="Halaman ini sedang kami susun dan finalisasi."
      draft
    >
      <Section title="Sedang dalam proses">
        <p>
          Ketentuan resmi program affiliate sedang difinalisasi, termasuk aturan pencairan komisi. Sementara itu,
          struktur komisi yang berlaku adalah <strong>20% untuk penjualan kelas dan produk digital</strong> serta{" "}
          <strong>40% untuk penjualan membership premium</strong>.
        </p>
      </Section>

      <Section title="Yang akan dicakup">
        <Bullets
          items={[
            "Kelayakan menjadi affiliate dan cara bergabung.",
            "Struktur dan perhitungan komisi serta cara atribusi referral.",
            "Aturan pencairan komisi: minimum, jadwal, dan metode.",
            "Larangan: spam, klaim palsu atau menyesatkan, dan referral ke diri sendiri.",
            "Ketentuan pembatalan komisi dan diskualifikasi.",
          ]}
        />
      </Section>

      <Section title="Pertanyaan">
        <p>
          Untuk pertanyaan seputar program affiliate, hubungi kami di{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
