"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 max-w-md w-full">
        <h2 className="text-xl font-semibold text-destructive mb-2">Error di halaman admin</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {error.message || "Terjadi kesalahan saat memuat halaman admin."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Coba Lagi
          </button>
          <a
            href="/admin"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Ke Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
