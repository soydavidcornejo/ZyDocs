// src/components/auth/UserProfileDropdown.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut, User, Users, UserPlus, Settings, Loader2, LogInIcon, Building, ListChecks } from 'lucide-react'; 
import { getInitials } from '@/lib/utils';

export function UserProfileDropdown() {
  const { currentUser, logout, loading } = useAuth();

  if (loading) {
     return <Button variant="ghost" size="icon" disabled className="h-8 w-8 rounded-full flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></Button>;
  }

  if (!currentUser) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">
          <LogInIcon className="mr-2 h-4 w-4" /> Login
        </Link>
      </Button>
    );
  }
  
  const memberships = currentUser.organizationMemberships || [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.displayName || 'User'} data-ai-hint="profile avatar" />
            <AvatarFallback>{getInitials(currentUser.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount> 
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{currentUser.displayName || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser.email}
            </p>
             {currentUser.currentOrganizationId && currentUser.currentOrganizationRole && (
                <p className="text-xs leading-none text-muted-foreground capitalize pt-1">
                    Role: {currentUser.currentOrganizationRole}
                </p>
            )}
            {!currentUser.currentOrganizationId && memberships.length > 0 && (
                 <p className="text-xs leading-none text-orange-500 pt-1">
                    No active organization selected
                </p>
            )}
             {!currentUser.currentOrganizationId && memberships.length === 0 && (
                 <p className="text-xs leading-none text-orange-500 pt-1">
                    No organizations joined
                </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        
        {/* Organization related items */}
        {/* Always show link to manage organizations if logged in */}
        <DropdownMenuItem asChild>
          <Link href="/organizations">
            <ListChecks className="mr-2 h-4 w-4" /> 
            <span>Manage Organizations</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
            <Link href="/create-organization">
                <Building className="mr-2 h-4 w-4" />
                <span>Create New Organization</span>
            </Link>
        </DropdownMenuItem>

        {currentUser.currentOrganizationId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Current Organization Actions</DropdownMenuLabel>
            {/* Link to organization members specific to current org (part of settings) */}
             <DropdownMenuItem asChild>
              <Link href={`/organization/${currentUser.currentOrganizationId}/settings`}>
                <Users className="mr-2 h-4 w-4" />
                <span>Members & Settings</span>
              </Link>
            </DropdownMenuItem>
            {(currentUser.currentOrganizationRole === 'admin' || currentUser.currentOrganizationRole === 'editor') && (
              <DropdownMenuItem asChild>
                {/* Pass current org ID to invite page */}
                <Link href={`/invite?organizationId=${currentUser.currentOrganizationId}`}> 
                  <UserPlus className="mr-2 h-4 w-4" />
                  <span>Invite Users</span>
                </Link>
              </DropdownMenuItem>
            )}
            {/* Settings link might be redundant if members are inside settings page already. Keeping for explicitness.
            {currentUser.currentOrganizationRole === 'admin' && (
              <DropdownMenuItem asChild>
                <Link href={`/organization/${currentUser.currentOrganizationId}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
            )}
            */}
          </>
        )}
       
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
