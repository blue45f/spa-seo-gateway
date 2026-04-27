/**
 * Admin API 클라이언트 — 쿠키 기반 인증 + JSON 응답 처리.
 * Fastify 가 set-cookie 로 발급한 `seo-admin` httpOnly 쿠키를 자동으로 동봉.
 *
 * 헤더 토큰 (`X-Admin-Token`) 도 후방 호환을 위해 받아주지만, 새 UI 는 쿠키 사용을 우선시한다.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiOptions = {
  /** Welcome / API explorer / Library / Help 같이 인증 없이 호출 가능한 endpoint 표시. */
  publicEndpoint?: boolean;
  /** 응답 본문을 JSON 으로 파싱하지 않고 string 으로 반환 (예: /metrics 텍스트) */
  asText?: boolean;
  /** 헤더 토큰 — legacy 호환 */
  token?: string;
};

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown,
  opts: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token && !opts.publicEndpoint) headers['x-admin-token'] = opts.token;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (opts.asText) {
    const text = await res.text();
    if (!res.ok) throw new ApiError(text || `${res.status} ${res.statusText}`, res.status);
    return text as unknown as T;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiError(errMsg, res.status);
  }
  return data as T;
}

export async function fetchText(path: string): Promise<string> {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status);
  return await res.text();
}
