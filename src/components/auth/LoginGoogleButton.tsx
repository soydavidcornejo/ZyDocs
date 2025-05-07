// src/components/auth/LoginGoogleButton.tsx
'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, Loader2 } from 'lucide-react';

export function LoginGoogleButton() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <Button onClick={signInWithGoogle} disabled={loading} className="w-full sm:w-auto">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
      {loading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  );
}
