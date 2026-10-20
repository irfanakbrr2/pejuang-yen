import CommunityDetailPage from "./page-client";

export async function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <CommunityDetailPage />;
}
