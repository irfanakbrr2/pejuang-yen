import AdminDashboardLayout from "@/components/layout/AdminDashboardLayout";

export const metadata = { title: "Admin — PejuangYen" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
}
