import WebinarDetailPage from "./page-client";

export async function generateStaticParams() {
  try {
    const res = await fetch("https://api.pejuangyen.com/api/public/webinars");
    const data = await res.json();
    const webinars = Array.isArray(data?.data) ? data.data : [];
    return [{ slug: "_" }, ...webinars.map((webinar: { slug: string }) => ({ slug: webinar.slug }))];
  } catch {
    return [{ slug: "_" }];
  }
}

export default function Page() {
  return <WebinarDetailPage />;
}
