// src/app/(app)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, requiresOrganizationCreation } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        // Allow query params for redirect to be passed along
        const currentPath = window.location.pathname + window.location.search;
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      } else if (requiresOrganizationCreation && window.location.pathname !== '/create-organization') {
        router.push('/create-organization');
      } else if (currentUser && !currentUser.currentOrganizationId && !requiresOrganizationCreation && window.location.pathname !== '/create-organization') {
        // This might happen if user navigates away from create-org before finishing
        // Or if state is somehow inconsistent.
        router.push('/create-organization');
      }
    }
  }, [currentUser, loading, requiresOrganizationCreation, router]);

  if (loading || (!currentUser && !loading) || (currentUser && requiresOrganizationCreation && window.location.pathname !== '/create-organization') || (currentUser && !currentUser.currentOrganizationId && !requiresOrganizationCreation && window.location.pathname !== '/create-organization') ) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg text-foreground">Loading application...</span>
      </div>
    );
  }
  
  // If currentUser exists, has an org, and not in org creation flow, render children
  if (currentUser && currentUser.currentOrganizationId && !requiresOrganizationCreation) {
    return <>{children}</>;
  }

  // Fallback for any other state, typically means one of the conditions above for loading screen is met
  // Or user is on create-organization page itself.
  if (window.location.pathname === '/create-organization' && currentUser && requiresOrganizationCreation) {
    return <>{children}</>;
  }
  
  // If loading is false, currentUser exists, but conditions for rendering children or create-org are not met,
  // this implies redirection is happening or an unexpected state.
  // The loading screen will cover most cases.
  return (
     <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg text-foreground">Verifying session...</span>
      </div>
  );
}
