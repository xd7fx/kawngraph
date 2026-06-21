/**
 * Dependency-free, deterministic markdown reader. It does NOT render markdown —
 * it extracts only the structural signals KawnGraph links against: frontmatter,
 * headings (sections), links, inline code, and fenced code blocks. Line numbers
 * are 1-based and refer to the original content so every edge can cite evidence.
 */

export interface MdHeading {
  level: number;
  text: string;
  slug: string;
  line: number;
}

export interface MdLink {
  text: string;
  href: string;
  line: number;
}

export interface MdToken {
  text: string;
  line: number;
}

export interface MdCodeBlock {
  lang: string | null;
  content: string;
  /** line of the opening fence */
  line: number;
}

export interface ParsedMarkdown {
  frontmatter: Record<string, string>;
  title: string | null;
  headings: MdHeading[];
  links: MdLink[];
  inlineCode: MdToken[];
  codeBlocks: MdCodeBlock[];
  /** original content, used for distinctive full-text matches (paths, route URLs) */
  content: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^\s*(```+|~~~+)(.*)$/;
const LINK_RE = /\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const INLINE_CODE_RE = /`([^`\n]+)`/g;

/** GitHub-style heading slug: lowercase, drop punctuation, spaces -> hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

export function parseMarkdown(content: string): ParsedMarkdown {
  const lines = content.split(/\r?\n/);
  const frontmatter: Record<string, string> = {};
  const headings: MdHeading[] = [];
  const links: MdLink[] = [];
  const inlineCode: MdToken[] = [];
  const codeBlocks: MdCodeBlock[] = [];

  let i = 0;

  // Frontmatter: a leading `---` block of `key: value` pairs.
  if (lines[0]?.trim() === "---") {
    let j = 1;
    for (; j < lines.length; j++) {
      if (lines[j].trim() === "---") {
        j++;
        break;
      }
      const fm = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(lines[j]);
      if (fm) frontmatter[fm[1]] = unquote(fm[2]);
    }
    i = j;
  }

  let inFence = false;
  let fenceMarker = "";
  let fenceLang: string | null = null;
  let fenceStart = 0;
  let fenceBuf: string[] = [];

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;

    const fence = FENCE_RE.exec(raw);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0]; // ` or ~
        fenceLang = fence[2].trim() || null;
        fenceStart = lineNo;
        fenceBuf = [];
        continue;
      }
      // a closing fence must use the same marker char
      if (fence[1][0] === fenceMarker) {
        codeBlocks.push({ lang: fenceLang, content: fenceBuf.join("\n"), line: fenceStart });
        inFence = false;
        continue;
      }
    }
    if (inFence) {
      fenceBuf.push(raw);
      continue;
    }

    const h = HEADING_RE.exec(raw);
    if (h) {
      const text = h[2].trim();
      headings.push({ level: h[1].length, text, slug: slugify(text), line: lineNo });
      continue;
    }

    for (const lm of raw.matchAll(LINK_RE)) {
      links.push({ text: lm[1].trim(), href: lm[2].trim(), line: lineNo });
    }
    for (const cm of raw.matchAll(INLINE_CODE_RE)) {
      const t = cm[1].trim();
      if (t) inlineCode.push({ text: t, line: lineNo });
    }
  }

  // unterminated fence: still record what we captured
  if (inFence) {
    codeBlocks.push({ lang: fenceLang, content: fenceBuf.join("\n"), line: fenceStart });
  }

  const title =
    frontmatter["title"] ?? headings.find((hd) => hd.level === 1)?.text ?? null;

  return { frontmatter, title, headings, links, inlineCode, codeBlocks, content };
}
