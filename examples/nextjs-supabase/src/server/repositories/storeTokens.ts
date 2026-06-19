import { TokenSet } from "../../lib/oauth";

export interface StoreTokenRow {
  storeId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// In-memory stand-in for a Supabase table write.
const rows: StoreTokenRow[] = [];

export async function saveStoreTokens(storeId: string, tokens: TokenSet): Promise<void> {
  rows.push({
    storeId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });
}

export async function getStoreToken(storeId: string): Promise<StoreTokenRow | undefined> {
  return rows.find((r) => r.storeId === storeId);
}
