import StartClient from "./page-client";

export async function generateStaticParams() {
  try {
    const res = await fetch("https://api.pejuangyen.com/api/courses");
    const data = await res.json();
    const slugs = (data.data || []).map((c: { slug: string }) => ({ courseSlug: c.slug }));
    return [{ courseSlug: "_" }, ...slugs];
  } catch {
    return [{ courseSlug: "_" }];
  }
}

export default function StartCoursePage() {
  return <StartClient />;
}
