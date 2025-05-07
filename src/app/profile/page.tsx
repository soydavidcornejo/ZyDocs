// src/app/profile/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, loading, requiresOrganizationCreation } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.push('/login?redirect=/profile');
      } else {
        const memberships = currentUser.organizationMemberships || [];
        if (memberships.length === 0) { // requiresOrganizationCreation
          router.push('/create-organization');
        } else if (memberships.length > 0 && !currentUser.currentOrganizationId) {
          router.push('/select-organization');
        }
        // If user has an active org, they can access profile page.
      }
    }
  }, [currentUser, loading, router, requiresOrganizationCreation]);

  if (loading || (!currentUser && !loading)) { 
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading profile...</span></div>;
  }

  // Fallback if redirection logic in useEffect hasn't kicked in or user should be elsewhere
  if (!currentUser || 
      (currentUser && (currentUser.organizationMemberships || []).length === 0) || 
      (currentUser && (currentUser.organizationMemberships || []).length > 0 && !currentUser.currentOrganizationId)
     ) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting...</div>;
  }


  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-center">
        <ProfileForm />
      </div>
    </div>
  );
}
