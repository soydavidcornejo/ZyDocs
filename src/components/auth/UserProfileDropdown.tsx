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
import { LogOut, User, Users, UserPlus, Settings, Loader2, LogInIcon, Building } from 'lucide-react'; // Added Building
// import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations'; // Potentially for fetching org name
// import { useEffect, useState } from 'react';


export function UserProfileDropdown() {
  const { currentUser, logout, loading } = useAuth();
  // const [organizationName, setOrganizationName] = useState<string | null>(null);

  // useEffect(() => {
  //   if (currentUser?.currentOrganizationId) {
  //     getOrganizationDetails(currentUser.currentOrganizationId)
  //       .then(org => {
  //         if (org) setOrganizationName(org.name);
  //       })
  //       .catch(console.error);
  //   } else {
  //     setOrganizationName(null);
  //   }
  // }, [currentUser?.currentOrganizationId]);


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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    if (names.length > 0 && names[0]) {
        return names[0].substring(0, 2).toUpperCase();
    }
    return 'U';
  };

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
      <DropdownMenuContent className="w-64" align="end" forceMount> {/* Increased width */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{currentUser.displayName || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser.email}
            </p>
            {/* {organizationName && (
              <p className="text-xs leading-none text-muted-foreground pt-1">
                Org: {organizationName}
              </p>
            )} */}
             {currentUser.currentOrganizationId && currentUser.currentOrganizationRole && (
                <p className="text-xs leading-none text-muted-foreground capitalize pt-1">
                    Role: {currentUser.currentOrganizationRole}
                </p>
            )}
            {!currentUser.currentOrganizationId && (
                 <p className="text-xs leading-none text-muted-foreground capitalize pt-1 text-orange-500">
                    No active organization
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
        
        {currentUser.currentOrganizationId && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/users"> {/* Should be /organization/users or similar context */}
                <Users className="mr-2 h-4 w-4" />
                <span>Organization Members</span>
              </Link>
            </DropdownMenuItem>
            {(currentUser.currentOrganizationRole === 'admin' || currentUser.currentOrganizationRole === 'editor') && (
              <DropdownMenuItem asChild>
                <Link href="/invite"> {/* Should be /organization/invite */}
                  <UserPlus className="mr-2 h-4 w-4" />
                  <span>Invite Users</span>
                </Link>
              </DropdownMenuItem>
            )}
            {currentUser.currentOrganizationRole === 'admin' && (
              <DropdownMenuItem asChild>
                <Link href={`/organization/${currentUser.currentOrganizationId}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Organization Settings</span>
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
        {!currentUser.currentOrganizationId && (
            <DropdownMenuItem asChild>
                <Link href="/create-organization">
                    <Building className="mr-2 h-4 w-4" />
                    <span>Create Organization</span>
                </Link>
            </DropdownMenuItem>
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
