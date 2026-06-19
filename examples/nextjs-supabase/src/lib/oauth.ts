export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

const TOKEN_URL = "https://oauth.zid.sa/oauth/token";

/**
 * Exchange a short-lived authorization code for a Zid OAuth token set.
 * Network call is stubbed here — the example exists to shape the graph.
 */
export async function exchangeCodeForToken(code: string): Promise<TokenSet> {
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();
  return {
    accessToken: `access-for-${code}`,
    refreshToken: `refresh-for-${code}`,
    expiresAt,
  };
}

export function tokenEndpoint(): string {
  return TOKEN_URL;
}
