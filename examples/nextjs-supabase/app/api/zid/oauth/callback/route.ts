import { getMerchantContext } from "../../../../../src/lib/merchantAuth";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const storeId = url.searchParams.get("state");

  if (!code || !storeId) {
    return new Response("missing code or state", { status: 400 });
  }

  const context = await getMerchantContext(storeId, code);
  return Response.json({ ok: true, storeId: context.storeId });
}
