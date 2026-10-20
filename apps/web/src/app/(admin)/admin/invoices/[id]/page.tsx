import InvoiceDetailClient from "./page-client";
export function generateStaticParams() { return [{ id: '_' }]; }
export default function AdminInvoiceDetailPage() { return <InvoiceDetailClient />; }
