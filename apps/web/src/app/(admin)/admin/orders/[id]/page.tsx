import AdminOrderDetailClient from "./page-client";
export function generateStaticParams() { return [{ id: '_' }]; }
export default function AdminOrderDetailPage() { return <AdminOrderDetailClient />; }
