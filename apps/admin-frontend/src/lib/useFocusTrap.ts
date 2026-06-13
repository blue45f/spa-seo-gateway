import { type RefObject, useEffect } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * `active` 동안 `ref` 컨테이너 안으로 Tab 포커스를 가둔다(마지막↔처음 순환).
 * 포커스 가능한 자식이 없으면 컨테이너(tabIndex=-1)에 머문다. 리스너는 컨테이너에만
 * 붙어(window 아님) 다이얼로그 밖에서는 동작하지 않는다.
 *
 * 가시성 필터(offsetParent)는 브라우저에서 숨겨진 요소를 제외하지만, 레이아웃이 없는
 * 환경(jsdom)에선 전부 걸러지므로 — 결과가 비면 raw 매치로 폴백해 항상 동작하게 한다.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active || !ref.current) return undefined
    const node: HTMLElement = ref.current
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const raw = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      const visible = raw.filter((el) => el.offsetParent !== null)
      const focusables = visible.length ? visible : raw
      if (focusables.length === 0) {
        e.preventDefault()
        node.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const current = document.activeElement
      if (e.shiftKey) {
        // 컨테이너 자체(진입 포커스)거나 첫 요소면 마지막으로 순환 — 배경 이탈 방지
        if (current === node || current === first || !node.contains(current)) {
          e.preventDefault()
          last.focus()
        }
      } else if (current === last) {
        e.preventDefault()
        first.focus()
      }
    }
    node.addEventListener('keydown', onKey)
    return () => node.removeEventListener('keydown', onKey)
  }, [ref, active])
}
