import OrderPageClient from "./page-client";

export async function generateStaticParams() {
  const slugs: { productSlug: string }[] = [
    { productSlug: "_" },
    { productSlug: "membership-monthly" },
    { productSlug: "membership-yearly" },
    { productSlug: "membership-lifetime" },
    { productSlug: "monthly" },
    { productSlug: "yearly" },
    { productSlug: "lifetime" },
    // Pre-launch promo plans (1-6 Juni 2026)
    { productSlug: "monthly-promo" },
    { productSlug: "annual-promo" },
    { productSlug: "lifetime-promo" },
  ];
  try {
    const res = await fetch("https://api.pejuangyen.com/api/courses");
    const data = await res.json();
    for (const course of (data.data || [])) {
      slugs.push({ productSlug: course.slug });
    }
  } catch {}
  return slugs;
}

export default function OrderPage() {
  return <OrderPageClient />;
}
