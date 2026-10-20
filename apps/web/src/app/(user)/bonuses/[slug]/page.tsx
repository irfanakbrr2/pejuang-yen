import BonusBundleClient from "./page-client";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function BonusBundlePage() {
  return <BonusBundleClient />;
}
