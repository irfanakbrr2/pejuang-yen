import RecordingDetailClient from "./page-client";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function RecordingDetailPage() {
  return <RecordingDetailClient />;
}
