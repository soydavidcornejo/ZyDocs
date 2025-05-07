// src/app/(auth)/login/page.tsx
import { Suspense } from 'react';
import { LoginPageClient } from './LoginPageClient'; 
import { Loader2 } from 'lucide-react';

// This page component is now a Server Component or can be,
// as client-specific logic is deferred to LoginPageClient.
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
        <span className="ml-2">Loading login page...</span>
      </div>
    }>
      <LoginPageClient />
    </Suspense>
  );
}
