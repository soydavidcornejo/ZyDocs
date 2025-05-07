// src/app/(auth)/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginGoogleButton } from '@/components/auth/LoginGoogleButton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpenText, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { currentUser, loading, requiresOrganizationCreation } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');


  useEffect(() => {
    if (!loading && currentUser) {
      if (requiresOrganizationCreation) {
        router.push('/create-organization');
      } else if (redirectPath && redirectPath !== '/create-organization') {
        router.push(redirectPath);
      } else if (currentUser.currentOrganizationId) {
         router.push('/docs'); // Default to docs if org exists
      } else {
        // This case should ideally be handled by requiresOrganizationCreation
        // but as a fallback, go to create org if no specific redirect and no org.
        router.push('/create-organization');
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
