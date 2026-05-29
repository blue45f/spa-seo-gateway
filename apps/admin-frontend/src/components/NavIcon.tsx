import {
  Building2,
  ChartColumn,
  CircleQuestionMark,
  Database,
  Flame,
  FlaskConical,
  Gauge,
  Globe,
  House,
  Image,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Plug,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

/**
 * Maps a nav item id to a cohesive line icon. Keyed by id so nav.ts stays the
 * single source for structure while icons live here. Falls back to Sparkles
 * for any unmapped id.
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  welcome: House,
  dashboard: LayoutDashboard,
  routes: Route,
  cache: Database,
  warm: Flame,
  test: FlaskConical,
  metrics: ChartColumn,
  lighthouse: Gauge,
  visual: Image,
  ai: Sparkles,
  audit: ShieldCheck,
  sites: Globe,
  tenants: Building2,
  api: Plug,
  library: Package,
  help: CircleQuestionMark,
};

export function NavIcon({ id, className }: { id: string; className?: string }) {
  const Icon = NAV_ICONS[id] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
