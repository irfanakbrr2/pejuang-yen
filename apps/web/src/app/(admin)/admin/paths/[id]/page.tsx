import AdminPathBuilderClient from "./page-client";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function AdminPathBuilderPage() {
  return <AdminPathBuilderClient />;
}
