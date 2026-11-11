import { NavLink } from 'react-router-dom';
import { ChartNoAxesCombined, History, LayoutDashboard, Settings } from 'lucide-react';

const links = [{ to: '/', label: 'Home', icon: <LayoutDashboard size={19} strokeWidth={1.8} /> }, { to: '/history', label: 'Activity', icon: <History size={19} strokeWidth={1.8} /> }, { to: '/analytics', label: 'Insights', icon: <ChartNoAxesCombined size={19} strokeWidth={1.8} /> }, { to: '/settings', label: 'Settings', icon: <Settings size={19} strokeWidth={1.8} /> }];

const MobileNav = () => (
  <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
    <div className="mx-auto grid max-w-lg grid-cols-4">
      {links.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
          {icon}
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  </nav>
);

export default MobileNav;
