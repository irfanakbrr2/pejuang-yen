"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 max-w-md w-full">
        <h2 className="text-xl font-semibold text-destructive mb-2">Terjadi kesalahan</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {error.message || "Sesuatu tidak berjalan dengan benar. Silakan coba lagi."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
