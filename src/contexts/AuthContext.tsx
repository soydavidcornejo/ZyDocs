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
import type { UserProfile, UserRole, AuthenticatedUser } from '@/types/user';
import type { OrganizationMember } from '@/types/organization';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { getUserOrganizationMemberships } from '@/lib/firebase/firestore/organizationMembers';
import { updateUserActiveOrganization as updateUserActiveOrgInFirestore } from '@/lib/firebase/firestore/users';
import { useRouter } from 'next/navigation';


interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  requiresOrganizationCreation: boolean;
  setRequiresOrganizationCreation: (value: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserDisplayNameAndPhoto: (displayName: string, photoURL?: string | null) => Promise<void>;
  refreshUserProfile: () => Promise<void>; // To refresh after org creation etc.
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOrganizationCreation, setRequiresOrganizationCreation] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const syncUserProfile = useCallback(async (fbUser: FirebaseUser): Promise<AuthenticatedUser | null> => {
    const userRef = doc(db, 'users', fbUser.uid);
    let userDoc = await getDoc(userRef);
    let userRoleFromClaims: UserRole = 'reader'; // Default role from claims

    try {
      const tokenResult = await fbUser.getIdTokenResult(true);
      userRoleFromClaims = (tokenResult.claims.role as UserRole) || 'reader';
    } catch (error) {
      console.warn("Warning: Error fetching token result for role. User might not have custom claims set yet or there's a token issue.", error);
    }
    
    let userProfileData: UserProfile;

    if (!userDoc.exists()) {
      userProfileData = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
        role: userRoleFromClaims, 
        activeOrganizationId: null,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };
      await setDoc(userRef, userProfileData);
      userDoc = await getDoc(userRef); // Re-fetch to get server-generated timestamps
      userProfileData = userDoc.data() as UserProfile;
    } else {
      userProfileData = userDoc.data() as UserProfile;
      // Ensure role from claims is synced if it's different or not set
      if (userProfileData.role !== userRoleFromClaims) {
        await updateDoc(userRef, { role: userRoleFromClaims, updatedAt: serverTimestamp() });
        userProfileData.role = userRoleFromClaims;
      }
    }
    
    // Fetch organization memberships
    const memberships = await getUserOrganizationMemberships(fbUser.uid);
    let activeOrgId = userProfileData.activeOrganizationId;
    let currentOrgRole: UserRole | null = null;

    if (memberships.length > 0) {
      if (!activeOrgId || !memberships.find(m => m.organizationId === activeOrgId)) {
        // If no active org set, or active org is not in memberships, pick the first one.
        // In a multi-org setup, you'd have a mechanism to select/store preferred active org.
        activeOrgId = memberships[0].organizationId;
        await updateUserActiveOrgInFirestore(fbUser.uid, activeOrgId);
        userProfileData.activeOrganizationId = activeOrgId;
      }
      const activeMembership = memberships.find(m => m.organizationId === activeOrgId);
      currentOrgRole = activeMembership ? activeMembership.role : null;
    } else {
      // No memberships, this user might need to create an organization
      setRequiresOrganizationCreation(true);
      activeOrgId = null; // ensure no active org is set
      if (userProfileData.activeOrganizationId) { // clear it from DB if they had one but no longer a member
        await updateUserActiveOrgInFirestore(fbUser.uid, null);
        userProfileData.activeOrganizationId = null;
      }
    }
    
    // Ensure createdAt and updatedAt are Date objects for client-side use
    const resolvedUserProfile: UserProfile = {
        ...userProfileData,
        createdAt: userProfileData.createdAt && (userProfileData.createdAt as Timestamp).toDate ? (userProfileData.createdAt as Timestamp).toDate() : new Date(),
        updatedAt: userProfileData.updatedAt && (userProfileData.updatedAt as Timestamp).toDate ? (userProfileData.updatedAt as Timestamp).toDate() : new Date(),
    };

    return {
      ...resolvedUserProfile,
      currentOrganizationId: activeOrgId,
      currentOrganizationRole: currentOrgRole,
    };

  }, []);


  const refreshUserProfile = useCallback(async () => {
    if (auth.currentUser) {
      setLoading(true);
      try {
        const updatedProfile = await syncUserProfile(auth.currentUser);
        setCurrentUser(updatedProfile);
        if (updatedProfile && !updatedProfile.currentOrganizationId) {
             setRequiresOrganizationCreation(true);
        } else {
            setRequiresOrganizationCreation(false);
        }
      } catch (error) {
        console.error("Error refreshing user profile:", error);
        toast({ title: "Error", description: "Could not refresh user profile.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  }, [syncUserProfile, toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setLoading(true);
        try {
          const userProfile = await syncUserProfile(user);
          setCurrentUser(userProfile);
          if (userProfile && !userProfile.currentOrganizationId) {
            setRequiresOrganizationCreation(true);
            // router.push('/create-organization'); // Moved to component logic
          } else {
            setRequiresOrganizationCreation(false);
          }
        } catch (error) {
            console.error("Error syncing user profile on auth state change:", error);
            setCurrentUser(null); // Fallback on error
        } finally {
            setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setRequiresOrganizationCreation(false);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [syncUserProfile, router]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle setting currentUser
      toast({ title: 'Login Successful', description: 'Welcome!' });
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({ title: 'Login Failed', description: 'Could not sign in with Google. Please try again.', variant: 'destructive' });
    } finally {
        // setLoading(false); // onAuthStateChanged will handle final loading state
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setCurrentUser(null);
      setFirebaseUser(null);
      setRequiresOrganizationCreation(false);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: 'Logout Failed', description: 'Could not sign out. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, router]);

  const updateUserDisplayNameAndPhoto = useCallback(async (displayName: string, photoURL?: string | null) => {
    if (!auth.currentUser) {
      toast({ title: 'Error', description: 'No user logged in.', variant: 'destructive' });
      throw new Error('No user logged in');
    }
    setLoading(true);
    try {
      const updatePayload: { displayName?: string; photoURL?: string | null } = { displayName };
      if (photoURL !== undefined) {
        updatePayload.photoURL = photoURL;
      }
      await updateFirebaseProfile(auth.currentUser, updatePayload);
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const firestoreUpdatePayload: Partial<UserProfile> = {
        displayName,
        updatedAt: serverTimestamp() as Timestamp,
      };
      if (photoURL !== undefined) {
        firestoreUpdatePayload.photoURL = photoURL;
      }
      await updateDoc(userRef, firestoreUpdatePayload);
      
      // Optimistically update local state and then refresh from source
      // This assumes firebaseUser is up-to-date from updateFirebaseProfile.
      // We must call syncUserProfile to get the combined profile with org data.
      await refreshUserProfile();
      
      toast({ title: 'Profile Updated', description: 'Your profile has been updated.' });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: 'Update Failed', description: 'Could not update profile.', variant: 'destructive' });
      throw error;
    } finally {
        setLoading(false);
    }
  }, [toast, refreshUserProfile]);
  
  const contextValue = {
    currentUser,
    firebaseUser,
    loading,
    requiresOrganizationCreation,
    setRequiresOrganizationCreation,
    signInWithGoogle,
    logout,
    updateUserDisplayNameAndPhoto,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {loading && !currentUser ? (
         <div className="flex h-screen items-center justify-center bg-background">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
           <span className="ml-2 text-lg text-foreground">Initializing ZyDocs...</span>
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
