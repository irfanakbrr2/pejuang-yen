import StoreProductClient from "./page-client";

export function generateStaticParams() {
  return [{ slug: "_", productSlug: "_" }];
}

export default function StoreProductPage() {
  return <StoreProductClient />;
}
