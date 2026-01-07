'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from "next-themes";
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Sparkles,
  LayoutGrid,
  Settings,
  FolderOpen,
  PieChart,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isAdminView: boolean;
  className?: string; // Support custom classes for mobile positioning
}

const clientNavItems = [
  { href: '/', icon: LayoutGrid, label: 'Notebook' },
  { href: '/documents', icon: FolderOpen, label: 'Sources' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/generate', icon: Sparkles, label: 'Generate' },
];

const adminNavItems = [
  { href: '/', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/partners', icon: Users, label: 'Partners' },
  { href: '/analytics', icon: PieChart, label: 'Analytics' },
  { href: '/documents', icon: FolderOpen, label: 'All Sources' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ collapsed, onToggle, isAdminView, className }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const navItems = isAdminView ? adminNavItems : clientNavItems;

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'fixed left-0 top-16 h-[calc(100vh-4rem)] border-r border-gray-100 bg-white transition-all duration-300 z-40 flex flex-col',
          collapsed ? 'w-16' : 'w-64',
          className
        )}
      >
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                  isActive
                    ? 'bg-blue-50/50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0 transition-colors',
                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium bg-gray-900 text-white border-0">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-100 mt-auto">
          {!collapsed && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 hidden md:block">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1 font-medium">
                <BookOpen className="h-4 w-4" />
                <span>Guide</span>
              </div>
              <p className="text-xs text-gray-500">
                Need help? Check the <Link href="/#guide" className="underline decoration-blue-300 hover:text-blue-600">getting started guide</Link>.
              </p>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              'w-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 mb-2',
              collapsed ? 'justify-center' : 'justify-start pl-3'
            )}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {!collapsed && <span className="ml-2">Toggle Theme</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={cn(
              'w-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 hidden md:flex', // Hide toggle on mobile
              collapsed ? 'justify-center' : 'justify-start pl-3'
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <div className="flex items-center gap-2">
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse</span>
              </div>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
