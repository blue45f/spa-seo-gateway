import { useStore } from '../lib/store';

export function MobileMenu() {
  const toggle = useStore((s) => s.toggleSidebar);
  return (
    <button
      type="button"
      className="md:hidden fixed top-3 left-3 z-50 p-2 rounded bg-slate-900 text-white shadow-lg"
      onClick={toggle}
      aria-label="menu"
    >
      ☰
    </button>
  );
}
