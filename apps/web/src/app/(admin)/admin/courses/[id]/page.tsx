import AdminCourseDetailClient from "./page-client";

export async function generateStaticParams() {
  try {
    const res = await fetch("https://api.pejuangyen.com/api/courses");
    const data = await res.json();
    const ids = (data.data || []).map((c: { id: string }) => ({ id: c.id }));
    return [{ id: "_" }, ...ids];
  } catch {
    return [{ id: "_" }];
  }
}

export default function AdminCourseDetailPage() { return <AdminCourseDetailClient />; }
