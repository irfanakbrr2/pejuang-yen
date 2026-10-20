import FunnelEditorClient from "./page-client";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function FunnelEditorPage() {
  return <FunnelEditorClient />;
}
