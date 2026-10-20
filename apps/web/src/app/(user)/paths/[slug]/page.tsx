import PathDetailClient from "./page-client";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function PathDetailPage() {
  return <PathDetailClient />;
}
