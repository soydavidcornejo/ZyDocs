// src/components/notifications/NotificationBell.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, Loader2 } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { ScrollArea } from '@/components/ui/scroll-area';

export function NotificationBell() {
  const { pendingInvitations, loading: authLoading } = useAuth();

  if (authLoading && !pendingInvitations?.length) {
    return (
      <Button variant="ghost" size="icon" disabled className="relative h-9 w-9 rounded-full">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <Bell className="h-5 w-5" />
          {pendingInvitations && pendingInvitations.length > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96" align="end">
        <DropdownMenuLabel className="font-medium text-base px-3 py-2">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pendingInvitations && pendingInvitations.length > 0 ? (
          <ScrollArea className="max-h-[calc(100vh-10rem)] md:max-h-96"> {/* Adjust max-h as needed */}
            {pendingInvitations.map((invitation) => (
              <NotificationItem key={invitation.id} invitation={invitation} />
            ))}
          </ScrollArea>
        ) : (
          <p className="p-4 text-sm text-muted-foreground text-center">No new notifications.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
