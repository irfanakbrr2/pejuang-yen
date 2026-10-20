import WebinarAnalyticsClient from "./page-client";

export function generateStaticParams() {
  return [{ id: "_" }]; // Need at least one item for output: export
}

export default function WebinarAnalyticsPage() {
  return <WebinarAnalyticsClient />;
}
