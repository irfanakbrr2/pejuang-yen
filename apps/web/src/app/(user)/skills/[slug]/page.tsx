import SkillDetailClient from "./page-client";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function SkillDetailPage() {
  return <SkillDetailClient />;
}
