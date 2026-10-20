"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Halaman lama /resources sudah tidak dipakai — arahkan ke hub Jelajahi.
export default function ResourcesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/explore");
  }, [router]);

  return (
    <p className="py-10 text-center text-sm text-gray-400">
      Mengalihkan ke Jelajahi…
    </p>
  );
}
