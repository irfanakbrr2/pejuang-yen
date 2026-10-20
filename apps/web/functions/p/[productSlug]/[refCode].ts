import { productParams, redirectAffiliate, safeParam } from "../../_affiliate-redirect";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function onRequest(context: any) {
  const productSlug = safeParam(context.params.productSlug);
  const refCode = safeParam(context.params.refCode);
  return redirectAffiliate(context, refCode, productParams(productSlug));
}
