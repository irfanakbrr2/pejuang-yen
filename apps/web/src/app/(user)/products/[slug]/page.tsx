import ProductAccessClient from "./page-client";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function ProductAccessPage() {
  return <ProductAccessClient />;
}
