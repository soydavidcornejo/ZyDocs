// src/app/(app)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation'; 
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, requiresOrganizationCreation } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); 

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        const currentPath = pathname + window.location.search;
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      } else {
        const memberships = currentUser.organizationMemberships || [];
        if (memberships.length === 0 && pathname !== '/create-organization') {
          // User has NO organizations (active status), must create one.
          // requiresOrganizationCreation flag from AuthContext should align with this.
          router.push('/create-organization');
        } else if (memberships.length > 0 && !currentUser.currentOrganizationId && pathname !== '/organizations' && pathname !== '/create-organization') {
          // User HAS organizations, but NO active one selected. Must select from /organizations page or create.
          router.push('/organizations');
        }
        // If user has an active org (currentUser.currentOrganizationId is set), they can access /docs, /profile etc.
        // If they are on /create-organization or /organizations, allow them to stay.
      }
    }
  }, [currentUser, loading, router, pathname, requiresOrganizationCreation]);

  const isUserLoading = loading || (!currentUser && !loading);
  // Use requiresOrganizationCreation from context, which is derived from memberships with 'active' status
  const needsOrgCreationCheck = currentUser && requiresOrganizationCreation; 
  const needsOrgSelectionCheck = currentUser && (currentUser.organizationMemberships || []).length > 0 && !currentUser.currentOrganizationId;


  // Show loading screen if:
  // 1. Auth state is loading OR user data is not yet available while auth isn't loading (initial state before first redirect)
  // 2. User needs to create an organization AND is not on the create-organization page.
  // 3. User needs to select an organization AND is not on the organizations or create-organization page.
  if (isUserLoading || 
      (needsOrgCreationCheck && pathname !== '/create-organization') ||
      (needsOrgSelectionCheck && pathname !== '/organizations' && pathname !== '/create-organization')
     ) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg text-foreground">Loading application...</span>
      </div>
    );
  }
  
  // If currentUser exists, and has an active organization, allow access.
  if (currentUser && currentUser.currentOrganizationId) {
    return <>{children}</>;
  }

  // If user is on a page that is allowed during org creation/selection states.
  if ( (pathname === '/create-organization' && (needsOrgCreationCheck || currentUser)) || 
       (pathname === '/organizations' && needsOrgSelectionCheck) 
     ) {
    return <>{children}</>;
  }
  
  // Fallback loading/redirecting screen for any other intermediate states
  // This might be hit briefly during redirects or if a state is not perfectly caught above.
  return (
     <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg text-foreground">Verifying session...</span>
      </div>
  );
}
