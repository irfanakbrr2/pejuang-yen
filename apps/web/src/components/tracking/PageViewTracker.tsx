"use client";

import { usePageView } from "@/hooks/use-tracking";

/** Drop-in page_view tracker for key pages: <PageViewTracker page="dashboard" /> */
export default function PageViewTracker({ page }: { page: string }) {
  usePageView(page);
  return null;
}
