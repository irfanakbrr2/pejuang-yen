import AdminUserDetailClient from "./page-client";
export function generateStaticParams() { return [{ id: '_' }]; }
export default function AdminUserDetailPage() { return <AdminUserDetailClient />; }
