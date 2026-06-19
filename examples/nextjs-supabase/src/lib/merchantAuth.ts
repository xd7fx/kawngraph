import { exchangeCodeForToken } from "./oauth";
import { saveStoreTokens } from "../server/repositories/storeTokens";

export interface MerchantContext {
  storeId: string;
  accessToken: string;
}

/**
 * Complete the OAuth handshake for a store: trade the code for tokens,
 * persist them, and return the minimal context callers need.
 */
export async function getMerchantContext(storeId: string, code: string): Promise<MerchantContext> {
  const tokens = await exchangeCodeForToken(code);
  await saveStoreTokens(storeId, tokens);
  return { storeId, accessToken: tokens.accessToken };
}
