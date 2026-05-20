import { useStore } from '../lib/store';

export function MobileMenu() {
  const open = useStore((s) => s.sidebarOpen);
  const toggle = useStore((s) => s.toggleSidebar);
  return (
    <button
      type="button"
      className="md:hidden fixed top-3 left-3 z-50 p-2 rounded bg-slate-900 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
      onClick={toggle}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="primary-sidebar"
    >
      <span aria-hidden="true">☰</span>
    </button>
  );
}
