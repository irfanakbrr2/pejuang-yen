"use client";

// Redirect stub — halaman learning sudah jadi tab di hub /admin/analytics?tab=learning
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LearningRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/analytics?tab=learning");
  }, [router]);
  return <p className="py-10 text-center text-sm text-gray-400">Mengalihkan ke Analytics → Learning...</p>;
}
