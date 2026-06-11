import { Menu } from 'lucide-react';
import { useStore } from '../lib/store';

export function MobileMenu() {
  const open = useStore((s) => s.sidebarOpen);
  const toggle = useStore((s) => s.toggleSidebar);
  return (
    <button
      type="button"
      className={`lg:hidden fixed top-3 left-3 z-50 grid place-items-center min-h-[44px] min-w-[44px] rounded bg-rail text-rail-ink shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-all duration-200 ${open ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      onClick={toggle}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="primary-sidebar"
    >
      <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}
