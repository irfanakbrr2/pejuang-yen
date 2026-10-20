export function generateStaticParams() {
  return [{ number: "_" }];
}

import VerifyClient from "./VerifyClient";

export default function VerifyPage() {
  return <VerifyClient />;
}
