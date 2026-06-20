import * as fs from "node:fs/promises";
import * as path from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

export function contentTypeFor(p: string): string {
  return CONTENT_TYPES[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

export interface StaticFile {
  path: string;
  contentType: string;
}

/**
 * Resolve a URL pathname to a real file inside `staticDir`, or null if it does
 * not exist or escapes the directory. Defends against `..` and percent-encoded
 * traversal by decoding, resolving, then verifying containment — the server
 * never serves a path outside the built frontend directory.
 */
export async function resolveStatic(staticDir: string, urlPath: string): Promise<StaticFile | null> {
  const baseDir = path.resolve(staticDir);

  let rel: string;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null; // malformed percent-encoding
  }
  if (rel.includes("\0")) return null; // null-byte injection
  rel = rel.replace(/^\/+/, "");
  if (rel === "") rel = "index.html";

  const abs = path.resolve(baseDir, rel);
  // Containment: abs must be baseDir itself or strictly inside it.
  if (abs !== baseDir && !abs.startsWith(baseDir + path.sep)) return null;

  try {
    const st = await fs.stat(abs);
    if (st.isDirectory()) {
      const idx = path.join(abs, "index.html");
      const sIdx = await fs.stat(idx).catch(() => null);
      return sIdx && sIdx.isFile() ? { path: idx, contentType: contentTypeFor(idx) } : null;
    }
    if (!st.isFile()) return null;
    return { path: abs, contentType: contentTypeFor(abs) };
  } catch {
    return null;
  }
}

export function indexHtmlPath(staticDir: string): string {
  return path.join(path.resolve(staticDir), "index.html");
}
