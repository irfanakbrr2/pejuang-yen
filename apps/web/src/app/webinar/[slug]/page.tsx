import { Suspense } from "react";
import WebinarRegistrationPage from "./page-client";

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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-warm-cream flex items-center justify-center">
          <div className="text-sm text-[rgba(12,12,10,0.45)]">Memuat webinar...</div>
        </div>
      }
    >
      <WebinarRegistrationPage />
    </Suspense>
  );
}
