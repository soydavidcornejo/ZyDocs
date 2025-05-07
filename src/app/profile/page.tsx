// src/app/profile/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login?redirect=/profile');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading profile...</span></div>;
  }

  if (!currentUser) {
    // Should be redirected by useEffect, this is a fallback.
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting to login...</div>;
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-center">
        <ProfileForm />
      </div>
    </div>
  );
}
