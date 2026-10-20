export function generateStaticParams() {
  return [{ id: "_" }];
}

import CertificateDetailClient from "./CertificateDetailClient";

export default function CertificateDetailPage() {
  return <CertificateDetailClient />;
}
