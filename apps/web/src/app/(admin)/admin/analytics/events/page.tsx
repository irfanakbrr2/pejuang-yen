"use client";

// Redirect stub — halaman events sudah jadi tab di hub /admin/analytics?tab=events
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EventsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/analytics?tab=events");
  }, [router]);
  return <p className="py-10 text-center text-sm text-gray-400">Mengalihkan ke Analytics → Events...</p>;
}
