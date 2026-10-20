import CheckoutPageClient from "./page-client";

export function generateStaticParams() {
  return [{ orderId: "_" }];
}

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
