// src/contexts/AuthContext.tsx
'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import type { UserProfile, UserRole } from '@/types/user';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserDisplayNameAndPhoto: (displayName: string, photoURL?: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const syncUserProfile = useCallback(async (fbUser: FirebaseUser): Promise<UserProfile> => {
    const userRef = doc(db, 'users', fbUser.uid);
    let userDoc = await getDoc(userRef);
    let userRole: UserRole = 'reader'; // Default role

    try {
      const tokenResult = await fbUser.getIdTokenResult(true); // Force refresh token
      userRole = (tokenResult.claims.role as UserRole) || 'reader';
    } catch (error) {
      console.error("Error fetching token result for role:", error);
      // Keep default role or try to get from existing doc
    }
    
    const userData: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName,
      photoURL: fbUser.photoURL,
      role: userRole, // Role from claims
      updatedAt: serverTimestamp() as Timestamp,
    };

    if (!userDoc.exists()) {
      userData.createdAt = serverTimestamp() as Timestamp;
      await setDoc(userRef, userData);
      // Re-fetch after creation if serverTimestamp needs to be resolved client-side (usually not necessary for display)
      // userDoc = await getDoc(userRef); 
    } else {
      // Only update if there are changes from Firebase Auth or if role needs syncing
      const existingData = userDoc.data() as UserProfile;
      const updates: Partial<UserProfile> = {};
      if (existingData.displayName !== fbUser.displayName) updates.displayName = fbUser.displayName;
      if (existingData.photoURL !== fbUser.photoURL) updates.photoURL = fbUser.photoURL;
      if (existingData.email !== fbUser.email) updates.email = fbUser.email; // Should rarely change but good to sync
      if (existingData.role !== userRole) updates.role = userRole; // Sync role from claims

      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, { ...updates, updatedAt: serverTimestamp() });
      }
    }
    // For currentUser state, use the fresh data including potentially resolved timestamps if needed.
    // For simplicity, we return userData which might have serverTimestamp() placeholder.
    // The onSnapshot listener in pages/components should handle real-time display.
    
    const finalDoc = await getDoc(userRef); // Get the potentially updated/created doc
    return finalDoc.data() as UserProfile;

  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const userProfile = await syncUserProfile(user);
          setCurrentUser(userProfile);
        } catch (error) {
            console.error("Error syncing user profile:", error);
            // Fallback to basic user object if Firestore sync fails
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
  }, [syncUserProfile]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle setting currentUser after syncUserProfile
      toast({ title: 'Login Successful', description: 'Welcome!' });
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({ title: 'Login Failed', description: 'Could not sign in with Google. Please try again.', variant: 'destructive' });
      setLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut(auth);
      // onAuthStateChanged will set currentUser to null
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: 'Logout Failed', description: 'Could not sign out. Please try again.', variant: 'destructive' });
      setLoading(false);
    }
  }, [toast]);

  const updateUserDisplayNameAndPhoto = useCallback(async (displayName: string, photoURL?: string | null) => {
    if (!auth.currentUser) {
      toast({ title: 'Error', description: 'No user logged in.', variant: 'destructive' });
      throw new Error('No user logged in');
    }
    try {
      const updatePayload: { displayName?: string; photoURL?: string | null } = { displayName };
      if (photoURL !== undefined) {
        updatePayload.photoURL = photoURL;
      }
      await updateFirebaseProfile(auth.currentUser, updatePayload);
      
      // Update Firestore document
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const firestoreUpdatePayload: Partial<UserProfile> = {
        displayName,
        updatedAt: serverTimestamp() as Timestamp,
      };
      if (photoURL !== undefined) {
        firestoreUpdatePayload.photoURL = photoURL;
      }
      await updateDoc(userRef, firestoreUpdatePayload);

      // Update local state immediately for better UX
      setFirebaseUser(auth.currentUser); // Re-fetch or update firebaseUser state
      setCurrentUser(prev => prev ? { ...prev, ...firestoreUpdatePayload, updatedAt: new Date() } : null); // Use new Date() for optimistic UI
      
      toast({ title: 'Profile Updated', description: 'Your profile has been updated.' });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: 'Update Failed', description: 'Could not update profile.', variant: 'destructive' });
      throw error;
    }
  }, [toast]);
  
  // Renamed from updateUserDisplayName to be more generic
  const contextValue = {
    currentUser,
    firebaseUser,
    loading,
    signInWithGoogle,
    logout,
    updateUserDisplayNameAndPhoto, // Updated name
  };


  return (
    <AuthContext.Provider value={contextValue}>
      {loading && !currentUser ? ( // Show loader only on initial load and if no user yet
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
