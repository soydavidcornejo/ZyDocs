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
      } else if (requiresOrganizationCreation) {
        router.push('/create-organization');
      }
    }
  }, [currentUser, loading, router, requiresOrganizationCreation]);

  if (loading || (!currentUser && !loading)) { // Show loader if auth is loading or if no current user yet (might be redirecting)
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading profile...</span></div>;
  }

  if (!currentUser) { // Should have been redirected by useEffect
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting to login...</div>;
  }

  if (requiresOrganizationCreation) { // Should have been redirected by useEffect
     return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting to organization setup...</div>;
  }


  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-center">
        <ProfileForm />
      </div>
    </div>
  );
}
