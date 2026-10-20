import AdminUserJourneyClient from "./page-client";
export function generateStaticParams() { return [{ id: '_' }]; }
export default function AdminUserJourneyPage() { return <AdminUserJourneyClient />; }
