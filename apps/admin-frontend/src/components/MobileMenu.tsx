import { Menu } from 'lucide-react';
import { useStore } from '../lib/store';

export function MobileMenu() {
  const open = useStore((s) => s.sidebarOpen);
  const toggle = useStore((s) => s.toggleSidebar);
  return (
    <button
      type="button"
      className="md:hidden fixed top-3 left-3 z-50 p-2 rounded bg-rail text-rail-ink shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      onClick={toggle}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      aria-controls="primary-sidebar"
    >
      <Menu aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}
