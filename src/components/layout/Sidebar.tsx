'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FileText,
  MessageSquare,
  Sparkles,
  Database,
  Video,
  LayoutGrid,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isAdminView: boolean;
}

const clientNavItems = [
  { href: '/', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/documents', icon: FileText, label: 'Documents' },
  { href: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { href: '/generate', icon: Sparkles, label: 'Generate' },
  { href: '/meetings', icon: Video, label: 'Meetings' },
  { href: '/data', icon: Database, label: 'Data' },
  { href: '/sources', icon: FolderOpen, label: 'Sources' },
];

const adminNavItems = [
  { href: '/', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/partners', icon: Users, label: 'Partners' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/documents', icon: FileText, label: 'All Documents' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ collapsed, onToggle, isAdminView }: SidebarProps) {
  const pathname = usePathname();
  const navItems = isAdminView ? adminNavItems : clientNavItems;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r transition-all duration-300 z-40',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));

              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-blue-600')} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.href}>{linkContent}</div>;
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-3 border-t">
            {/* Help */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/help"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  <HelpCircle className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>Help & Support</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="font-medium">
                  Help & Support
                </TooltipContent>
              )}
            </Tooltip>

            {/* Collapse toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className={cn(
                'w-full mt-2 text-gray-500 hover:text-gray-700',
                collapsed ? 'justify-center' : 'justify-start'
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
