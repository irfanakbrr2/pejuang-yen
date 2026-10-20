import { redirectAffiliate, safeParam, webinarParams } from "../../_affiliate-redirect";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function onRequest(context: any) {
  const slug = safeParam(context.params.slug);
  const refCode = safeParam(context.params.refCode);
  return redirectAffiliate(context, refCode, webinarParams(slug));
}
