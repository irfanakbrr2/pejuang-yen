import StorefrontClient from "./page-client";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function StorefrontPage() {
  return <StorefrontClient />;
}
