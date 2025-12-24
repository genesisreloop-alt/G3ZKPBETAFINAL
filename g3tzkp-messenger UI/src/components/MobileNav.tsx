import React from 'react';
import { Map, Users, Activity, Briefcase, User } from 'lucide-react';

export type PageType = 'geodesic' | 'mesh' | 'business' | 'system';

interface MobileNavProps {
  activePage: PageType;
  onPageChange: (page: PageType) => void;
  onNewAction: () => void;
  onProfileClick?: () => void;
  unreadCount?: number;
  pendingRequests?: number;
  hideOnNavigation?: boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({ 
  activePage, 
  onPageChange, 
  onNewAction,
  onProfileClick,
  unreadCount = 0,
  pendingRequests = 0,
  hideOnNavigation = false
}) => {
  if (hideOnNavigation) return null;
  
  const navItems = [
    { id: 'geodesic' as const, icon: Map, label: 'MAP' },
    { id: 'mesh' as const, icon: Users, label: 'MESH', badge: unreadCount },
    { id: 'business' as const, icon: Briefcase, label: 'BIZ' },
    { id: 'system' as const, icon: Activity, label: 'SYS' }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t-[0.5px] border-[var(--color-border,#4caf50)]/30 bg-[var(--color-background,#000000)]/98 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around px-1 h-[60px]">
        {navItems.map((item, index) => {
          if (index === 2) {
            return (
              <React.Fragment key="profile-center">
                <button
                  onClick={onProfileClick}
                  className="relative -top-3 w-10 h-10 border-[0.5px] border-[var(--color-primary,#00f3ff)]/60 bg-[var(--color-primary,#00f3ff)]/10 flex items-center justify-center text-[var(--color-primary,#00f3ff)] shadow-[0_0_20px_rgba(0,243,255,0.2)] active:scale-95 transition-all rounded-sm"
                >
                  <User size={18} strokeWidth={1.5} />
                </button>
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-1 sm:px-2 py-1.5 transition-all relative ${
                    activePage === item.id
                      ? 'text-[var(--color-primary,#00f3ff)]'
                      : 'text-[var(--color-secondary,#4caf50)]/60'
                  }`}
                >
                  <div className="relative">
                    <item.icon size={16} strokeWidth={activePage === item.id ? 1.5 : 1} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1 -right-2 min-w-[12px] h-[12px] flex items-center justify-center px-0.5 bg-[var(--color-primary,#00f3ff)] text-[var(--color-background,#000000)] text-[6px] font-black rounded-sm">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[5px] sm:text-[6px] font-black uppercase tracking-wide">{item.label}</span>
                  {activePage === item.id && (
                    <div className="absolute -top-[0.5px] left-1/2 -translate-x-1/2 w-5 h-[2px] bg-[var(--color-primary,#00f3ff)] shadow-[0_0_8px_var(--color-primary,#00f3ff)]" />
                  )}
                </button>
              </React.Fragment>
            );
          }
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex flex-col items-center gap-0.5 px-1 sm:px-2 py-1.5 transition-all relative ${
                activePage === item.id
                  ? 'text-[var(--color-primary,#00f3ff)]'
                  : 'text-[var(--color-secondary,#4caf50)]/60'
              }`}
            >
              <div className="relative">
                <item.icon size={16} strokeWidth={activePage === item.id ? 1.5 : 1} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[12px] h-[12px] flex items-center justify-center px-0.5 bg-[var(--color-primary,#00f3ff)] text-[var(--color-background,#000000)] text-[6px] font-black rounded-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[5px] sm:text-[6px] font-black uppercase tracking-wide">{item.label}</span>
              {activePage === item.id && (
                <div className="absolute -top-[0.5px] left-1/2 -translate-x-1/2 w-5 h-[2px] bg-[var(--color-primary,#00f3ff)] shadow-[0_0_8px_var(--color-primary,#00f3ff)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
