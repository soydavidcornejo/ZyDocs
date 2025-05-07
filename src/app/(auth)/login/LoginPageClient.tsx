// src/app/(auth)/login/LoginPageClient.tsx
'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginGoogleButton } from '@/components/auth/LoginGoogleButton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpenText, Loader2 } from 'lucide-react';

export function LoginPageClient() {
  const { currentUser, loading, requiresOrganizationCreation } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');


  useEffect(() => {
    if (!loading && currentUser) {
      const memberships = currentUser.organizationMemberships || [];
      if (redirectPath && redirectPath !== '/create-organization' && redirectPath !== '/organizations' && redirectPath !== '/docs') {
        router.push(redirectPath);
      } else if (requiresOrganizationCreation) { 
        // This implies memberships.length === 0 for active ones
        router.push('/create-organization');
      } else if (memberships.length > 0 && !currentUser.currentOrganizationId) {
        // Has organizations, but no active one selected
        router.push('/organizations');
      } else if (currentUser.currentOrganizationId) {
        // Has an active organization, redirect to organizations page
         router.push('/organizations'); 
      } else {
        // Fallback for any other scenario where user is logged in but no clear next step
        // e.g. if redirectPath was one of the excluded ones but other conditions didn't match
        router.push('/organizations'); 
      }
    }
  }, [currentUser, loading, router, redirectPath, requiresOrganizationCreation]);

  if (loading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading...</span></div>;
  }
  
  // If already logged in and redirection is in progress via useEffect
  if (currentUser) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Checking your details, redirecting soon...</div>;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <BookOpenText className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4 text-2xl font-bold">Welcome to ZyDocs</CardTitle>
          <CardDescription>Sign in to access your documents and collaboration tools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginGoogleButton />
        </CardContent>
        <CardFooter className="px-6 pb-6">
           <p className="text-center text-xs text-muted-foreground">
            By clicking continue, you agree to our{' '}
            <a href="/terms" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

