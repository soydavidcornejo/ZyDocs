// src/contexts/AuthContext.tsx
'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import type { UserProfile, UserRole } from '@/types/user';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserDisplayName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          const role = (tokenResult.claims.role as UserRole) || 'reader'; // Default to reader if no role claim

          setCurrentUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: role,
          });
        } catch (error) {
          console.error("Error fetching token result:", error);
          // Fallback if token result fails
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: 'reader', // Default role on error
          });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({ title: 'Login Successful', description: 'Welcome!' });
      // onAuthStateChanged will handle setting currentUser and loading state
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({ title: 'Login Failed', description: 'Could not sign in with Google. Please try again.', variant: 'destructive' });
      setLoading(false); // Ensure loading is false on error
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      // onAuthStateChanged will handle setting currentUser and loading state
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: 'Logout Failed', description: 'Could not sign out. Please try again.', variant: 'destructive' });
      setLoading(false); // Ensure loading is false on error
    }
  }, [toast]);

  const updateUserDisplayName = useCallback(async (newName: string) => {
    if (!auth.currentUser) {
      toast({ title: 'Error', description: 'No user logged in.', variant: 'destructive' });
      throw new Error('No user logged in');
    }
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
      // Update local state immediately for better UX
      setFirebaseUser(auth.currentUser); // Re-fetch or update firebaseUser state
      setCurrentUser(prev => prev ? { ...prev, displayName: newName } : null);
      toast({ title: 'Profile Updated', description: 'Your display name has been updated.' });
    } catch (error) {
      console.error("Error updating display name:", error);
      toast({ title: 'Update Failed', description: 'Could not update display name.', variant: 'destructive' });
      throw error;
    }
  }, [toast]);

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, signInWithGoogle, logout, updateUserDisplayName }}>
      {loading ? (
         <div className="flex h-screen items-center justify-center">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
           <span className="ml-2 text-lg">Initializing ZyDocs...</span>
         </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
