import { cloneElement, type ReactElement, useId } from 'react';

/**
 * 폼 행 — label 과 단일 입력 컨트롤을 useId 로 묶어 접근성(htmlFor↔id)을 보장한다.
 * 자식은 `id` prop 을 받을 수 있는 단일 엘리먼트여야 한다(cloneElement 로 주입).
 */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="block">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <div className="mt-1">{cloneElement(children, { id })}</div>
    </div>
  );
}
