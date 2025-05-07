// src/app/(app)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, requiresOrganizationCreation } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        const currentPath = pathname + window.location.search;
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      } else {
        const memberships = currentUser.organizationMemberships || [];
        if (memberships.length === 0 && pathname !== '/create-organization') {
          // User has NO organizations, must create one.
          router.push('/create-organization');
        } else if (memberships.length > 0 && !currentUser.currentOrganizationId && pathname !== '/select-organization' && pathname !== '/create-organization') {
          // User HAS organizations, but NO active one selected. Must select or create.
          router.push('/select-organization');
        }
      }
    }
  }, [currentUser, loading, router, pathname]); // Added pathname to dependencies

  const isUserLoading = loading || (!currentUser && !loading);
  const needsOrgCreation = currentUser && (currentUser.organizationMemberships || []).length === 0;
  const needsOrgSelection = currentUser && (currentUser.organizationMemberships || []).length > 0 && !currentUser.currentOrganizationId;

  if (isUserLoading || 
      (needsOrgCreation && pathname !== '/create-organization') ||
      (needsOrgSelection && pathname !== '/select-organization' && pathname !== '/create-organization')
     ) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg text-foreground">Loading application...</span>
      </div>
    );
  }
  
  // If currentUser exists, and has an active organization
  if (currentUser && currentUser.currentOrganizationId) {
    return <>{children}</>;
  }

  // If user is on a page that is allowed during org creation/selection
  if ( (pathname === '/create-organization' && (needsOrgCreation || currentUser)) || // Allow if needs creation OR just wants to create another
       (pathname === '/select-organization' && needsOrgSelection) 
     ) {
    return <>{children}</>;
  }
  
  // Fallback loading/redirecting screen
  return (
     <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg text-foreground">Verifying session...</span>
      </div>
  );
}
