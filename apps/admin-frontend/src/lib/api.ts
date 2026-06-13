/**
 * Admin API 클라이언트 — 쿠키 기반 인증 + JSON 응답 처리.
 * Fastify 가 set-cookie 로 발급한 `seo-admin` httpOnly 쿠키를 자동으로 동봉.
 *
 * 헤더 토큰 (`X-Admin-Token`) 도 후방 호환을 위해 받아주지만, 새 UI 는 쿠키 사용을 우선시한다.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 알 수 없는 throw 값에서 사람이 읽을 메시지를 안전하게 추출.
 * `ApiError extends Error` 이므로 별도 분기 불필요. `as Error` 캐스팅은 비-Error throw 시
 * undefined 를 내 토스트/배너가 빈칸이 되므로 쓰지 않는다.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return String(e)
}

export type ApiOptions = {
  /** Welcome / API explorer / Library / Help 같이 인증 없이 호출 가능한 endpoint 표시. */
  publicEndpoint?: boolean
  /** 응답 본문을 JSON 으로 파싱하지 않고 string 으로 반환 (예: /metrics 텍스트) */
  asText?: boolean
  /** 헤더 토큰 — legacy 호환 */
  token?: string
  /** 요청 타임아웃(ms). 기본 15s — 멎은 게이트웨이가 UI 를 영원히 매달지 않게. */
  timeoutMs?: number
  /** 외부 AbortSignal — 호출부가 직접 취소(예: 컴포넌트 unmount/요청 교체). */
  signal?: AbortSignal
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown,
  opts: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.token && !opts.publicEndpoint) headers['x-admin-token'] = opts.token

  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, opts.timeoutMs ?? 15_000)
  opts.signal?.addEventListener('abort', () => ctrl.abort())
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal: ctrl.signal,
    })
  } catch (e) {
    // 타임아웃은 408 로 표면화, 외부 취소(unmount 등)는 그대로 전파해 호출부가 무시할 수 있게.
    if (e instanceof DOMException && e.name === 'AbortError' && timedOut) {
      throw new ApiError('timeout', 408)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }

  if (opts.asText) {
    const text = await res.text()
    if (!res.ok) throw new ApiError(text || `${res.status} ${res.statusText}`, res.status)
    return text as unknown as T
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error ?? `${res.status} ${res.statusText}`
    throw new ApiError(errMsg, res.status)
  }
  return data as T
}

export async function fetchText(path: string, signal?: AbortSignal): Promise<string> {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, 15_000)
  signal?.addEventListener('abort', () => ctrl.abort())
  try {
    const res = await fetch(path, { credentials: 'same-origin', signal: ctrl.signal })
    if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status)
    return await res.text()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError' && timedOut) {
      throw new ApiError('timeout', 408)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
