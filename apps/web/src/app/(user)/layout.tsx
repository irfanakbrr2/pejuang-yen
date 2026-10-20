import UserDashboardLayout from "@/components/layout/UserDashboardLayout";

export const metadata = { title: "Dashboard — PejuangYen" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <UserDashboardLayout>{children}</UserDashboardLayout>;
}
