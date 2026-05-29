import type { ReactNode } from 'react';

type EmptyStateProps = {
  /** Primary line — what's empty. Keep it short. */
  title: string;
  /** Optional second line — teach the next step, don't just restate the title. */
  hint?: ReactNode;
  /** Override the default mark. */
  icon?: ReactNode;
  'data-testid'?: string;
};

/**
 * Centered empty state. Teaches the interface instead of stating "nothing here":
 * a quiet mark, the condition, and an optional next-step hint. Tokens only.
 */
export function EmptyState({ title, hint, icon, ...rest }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center" {...rest}>
      <span className="mb-3 text-ink-subtle" aria-hidden="true">
        {icon ?? <DefaultMark />}
      </span>
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

function DefaultMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7.5 12 3l9 4.5-9 4.5z" opacity="0.55" />
      <path d="M3 7.5v9L12 21l9-4.5v-9" />
      <path d="M12 12v9" opacity="0.55" />
    </svg>
  );
}
