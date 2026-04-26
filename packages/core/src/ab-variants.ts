/**
 * A/B 메타 태그 변형 — 같은 URL 에 다른 title / description / og:* 를 무작위 노출.
 *
 * 라우트 오버라이드의 variants 필드:
 *   {
 *     pattern: "^/products/",
 *     variants: [
 *       { title: "구매 30% 할인", description: "...", weight: 1 },
 *       { title: "지금 구매하면 무료배송", description: "...", weight: 1 },
 *     ],
 *   }
 *
 * 서비스 시점에 weight 비율로 무작위 선택해 응답 마크업을 변형. 선택된 variant
 * 인덱스는 x-prerender-variant 헤더 + Prometheus 라벨로 노출되어 외부 분석 백엔드
 * (GA, Plausible 등) 가 클릭률과 매칭할 수 있게 한다.
 */
import { variantImpressions } from './metrics.js';

/**
 * 메타 태그 변형 — 같은 URL 에 다른 title/description/og:* 를 weight 비율로 노출.
 * weight 미지정 시 1 로 가정. 응답 헤더 `x-prerender-variant` + Prometheus
 * `gateway_variant_impressions_total{route,variant}` 로 외부 분석과 매칭.
 */
export type AbVariant = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  weight?: number;
};

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * weight 비율로 한 variant 무작위 선택. 빈 배열이면 null 반환.
 * @returns 선택된 variant 와 해당 index (인덱스는 응답 헤더/메트릭 라벨로 노출됨)
 */
export function selectVariant<T extends { weight?: number }>(
  variants: T[],
): { variant: T; index: number } | null {
  if (!variants.length) return null;
  const total = variants.reduce((s, v) => s + (v.weight ?? 1), 0);
  let r = Math.random() * total;
  for (let i = 0; i < variants.length; i++) {
    r -= variants[i].weight ?? 1;
    if (r <= 0) return { variant: variants[i], index: i };
  }
  return { variant: variants[0], index: 0 };
}

const TITLE_RE = /<title[^>]*>[\s\S]*?<\/title>/i;
const META_DESC_RE = /<meta[^>]+(?:property|name)=["']description["'][^>]*>/i;
const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]*>/i;
const OG_DESC_RE = /<meta[^>]+property=["']og:description["'][^>]*>/i;

/**
 * 선택된 variant 의 메타 태그를 HTML 에 적용.
 * 기존 태그가 있으면 교체, 없으면 `<head>` 직후 또는 `</head>` 직전에 삽입.
 * 호출 시 자동으로 `gateway_variant_impressions_total` 카운터 증가.
 */
export function applyVariant(
  html: string,
  variant: AbVariant,
  routePattern: string,
  index: number,
): string {
  let out = html;
  if (variant.title) {
    const t = `<title>${escapeAttr(variant.title)}</title>`;
    out = TITLE_RE.test(out)
      ? out.replace(TITLE_RE, t)
      : out.replace(/<head([^>]*)>/i, `<head$1>\n${t}`);
  }
  if (variant.description) {
    const d = `<meta name="description" content="${escapeAttr(variant.description)}">`;
    out = META_DESC_RE.test(out)
      ? out.replace(META_DESC_RE, d)
      : out.replace(/<\/head>/i, `${d}\n</head>`);
  }
  if (variant.ogTitle) {
    const og = `<meta property="og:title" content="${escapeAttr(variant.ogTitle)}">`;
    out = OG_TITLE_RE.test(out)
      ? out.replace(OG_TITLE_RE, og)
      : out.replace(/<\/head>/i, `${og}\n</head>`);
  }
  if (variant.ogDescription) {
    const od = `<meta property="og:description" content="${escapeAttr(variant.ogDescription)}">`;
    out = OG_DESC_RE.test(out)
      ? out.replace(OG_DESC_RE, od)
      : out.replace(/<\/head>/i, `${od}\n</head>`);
  }
  variantImpressions.inc({ route: routePattern, variant: String(index) });
  return out;
}
