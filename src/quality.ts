const SOFT_404_PATTERNS = [
  /<title>[^<]*(404|Not Found|Page Not Found|페이지를 찾을 수 없|존재하지 않)[^<]*<\/title>/i,
  /<h1[^>]*>[\s]*(404|Not Found|페이지를 찾을 수 없)[\s]*<\/h1>/i,
];

const ERROR_PATTERNS = [
  /<title>[^<]*(500|Internal Server Error|Service Unavailable|503|502|Bad Gateway)[^<]*<\/title>/i,
];

const TEXT_RE = /<body[^>]*>([\s\S]*?)<\/body>/i;
const TAG_RE = /<[^>]+>/g;
const SCRIPT_TAG_RE = /<(script|style)[\s\S]*?<\/\1>/gi;

export type QualityVerdict = {
  ok: boolean;
  reason: 'ok' | 'soft-404' | 'error-page' | 'empty' | 'too-small';
  textLength: number;
};

export function assessQuality(html: string, opts: { minTextLength?: number } = {}): QualityVerdict {
  const minText = opts.minTextLength ?? 50;

  for (const re of SOFT_404_PATTERNS) {
    if (re.test(html)) return { ok: false, reason: 'soft-404', textLength: 0 };
  }
  for (const re of ERROR_PATTERNS) {
    if (re.test(html)) return { ok: false, reason: 'error-page', textLength: 0 };
  }

  const bodyMatch = html.match(TEXT_RE);
  if (!bodyMatch) return { ok: false, reason: 'empty', textLength: 0 };

  const text = bodyMatch[1]
    .replace(SCRIPT_TAG_RE, '')
    .replace(TAG_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length === 0) return { ok: false, reason: 'empty', textLength: 0 };
  if (text.length < minText) return { ok: false, reason: 'too-small', textLength: text.length };

  return { ok: true, reason: 'ok', textLength: text.length };
}

export function shortTtlForStatus(status: number): number | null {
  if (status >= 500) return 60_000;
  if (status === 404 || status === 410) return 5 * 60_000;
  if (status >= 400) return 60_000;
  return null;
}
