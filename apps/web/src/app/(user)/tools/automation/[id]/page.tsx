import AutomationDetailClient from "./page-client";

// output: export butuh daftar params; data automation dinamis & di-fetch
// client-side, jadi cukup placeholder (pola sama dgn community/[id], bonuses/[slug]).
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <AutomationDetailClient />;
}
