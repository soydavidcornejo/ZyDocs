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
import { getUserOrganizationMemberships, updateOrganizationMemberStatus } from '@/lib/firebase/firestore/organizationMembers';
import { updateUserActiveOrganization as updateUserActiveOrgInFirestore } from '@/lib/firebase/firestore/users';
import { useRouter } from 'next/navigation';


interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  requiresOrganizationCreation: boolean; // True if user has NO organizations with 'active' status
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserDisplayNameAndPhoto: (displayName: string, photoURL?: string | null) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  selectActiveOrganization: (organizationId: string, targetPath?: string) => Promise<void>;
  leaveOrganization: (organizationId: string) => Promise<void>;
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
    let userRoleFromClaims: UserRole = 'reader';

    try {
      const tokenResult = await fbUser.getIdTokenResult(true); // Force refresh token for latest claims
      userRoleFromClaims = (tokenResult.claims.role as UserRole) || 'reader';
    } catch (error) {
      console.warn("Warning: Error fetching token result for role.", error);
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
      // Fetch again to get server timestamps resolved
      userDoc = await getDoc(userRef); 
      userProfileData = userDoc.data() as UserProfile;
    } else {
      userProfileData = userDoc.data() as UserProfile;
      // Update role from claims if it differs from Firestore, or if Firestore role is missing
      if (userProfileData.role !== userRoleFromClaims || !userProfileData.role) {
        await updateDoc(userRef, { role: userRoleFromClaims, updatedAt: serverTimestamp() });
        userProfileData.role = userRoleFromClaims;
      }
    }
    
    const memberships = await getUserOrganizationMemberships(fbUser.uid); // Fetches only 'active' status memberships
    let activeOrgId = userProfileData.activeOrganizationId;
    let currentOrgRole: UserRole | null = null;

    if (memberships.length === 0) {
      setRequiresOrganizationCreation(true);
      activeOrgId = null; 
      if (userProfileData.activeOrganizationId) { 
        await updateUserActiveOrgInFirestore(fbUser.uid, null);
        userProfileData.activeOrganizationId = null;
      }
    } else {
      setRequiresOrganizationCreation(false);
      const activeMembership = memberships.find(m => m.organizationId === activeOrgId); 
      if (activeMembership) {
        currentOrgRole = activeMembership.role;
      } else {
        activeOrgId = null; 
        currentOrgRole = null;
        if (userProfileData.activeOrganizationId) { 
             await updateUserActiveOrgInFirestore(fbUser.uid, null);
             userProfileData.activeOrganizationId = null;
        }
      }
    }
    
    const resolvedUserProfile: UserProfile = {
        ...userProfileData,
        createdAt: userProfileData.createdAt && (userProfileData.createdAt as Timestamp).toDate ? (userProfileData.createdAt as Timestamp).toDate() : new Date(),
        updatedAt: userProfileData.updatedAt && (userProfileData.updatedAt as Timestamp).toDate ? (userProfileData.updatedAt as Timestamp).toDate() : new Date(),
    };

    return {
      ...resolvedUserProfile,
      currentOrganizationId: activeOrgId,
      currentOrganizationRole: currentOrgRole,
      organizationMemberships: memberships, 
    };

  }, [toast]); // Added toast to dependencies of syncUserProfile


  const refreshUserProfile = useCallback(async () => {
    if (auth.currentUser) {
      try {
        const updatedProfile = await syncUserProfile(auth.currentUser);
        setCurrentUser(updatedProfile);
      } catch (error) {
        console.error("Error refreshing user profile:", error);
        toast({ title: "Error", description: "Could not refresh user profile data.", variant: "destructive" });
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
        } catch (error) {
            console.error("Error syncing user profile on auth state change:", error);
            setCurrentUser(null); // Ensure consistent state on error
            toast({ title: "Profile Sync Error", description: "Could not load your profile information.", variant: "destructive"});
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
  }, [syncUserProfile, toast]); // Added toast to dependencies of useEffect

  const selectActiveOrganization = useCallback(async (organizationId: string, targetPath?: string) => {
    if (!currentUser || !firebaseUser) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        if (typeof window !== 'undefined') router.push('/login');
        return;
    }
    
    const isValidSelection = currentUser.organizationMemberships?.some(mem => mem.organizationId === organizationId && mem.status === 'active');

    if (!isValidSelection) {
        toast({ title: "Selection Error", description: "Cannot select this organization. It may be inactive or you are no longer a member.", variant: "destructive" });
        await refreshUserProfile(); 
        if (typeof window !== 'undefined') router.push('/organizations'); 
        return;
    }

    if (currentUser.currentOrganizationId !== organizationId) {
      // Consider showing a specific loading indicator if this is a long operation,
      // but global 'setLoading(true)' might be too disruptive.
      // The calling component can manage its own 'isProcessing' state.
    }

    try {
        if (currentUser.currentOrganizationId !== organizationId) {
            await updateUserActiveOrgInFirestore(firebaseUser.uid, organizationId);
            await refreshUserProfile(); 
        }
        
        if (targetPath && typeof window !== 'undefined') {
            router.push(targetPath);
        } else if (typeof window !== 'undefined') {
             router.push(`/organization/${organizationId}/wiki`); // Default to org wiki
        }
    } catch (error) {
        console.error("Error selecting active organization:", error);
        toast({ title: "Error Switching Organization", description: (error as Error).message || "Could not switch organization.", variant: "destructive" });
    }
  }, [currentUser, firebaseUser, refreshUserProfile, router, toast]);


  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // `onAuthStateChanged` will handle profile syncing and subsequent state updates.
      // Toast for successful login can be shown here or after profile sync,
      // depending on desired UX. For now, keeping it simple.
      toast({ title: 'Login Successful', description: 'Welcome!' });
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({ title: 'Login Failed', description: (error as Error).message || 'Could not sign in with Google. Please try again.', variant: 'destructive' });
      setLoading(false); 
    }
    // setLoading(false) will be called by onAuthStateChanged's handler.
  }, [toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (currentUser?.uid) { 
        await updateUserActiveOrgInFirestore(currentUser.uid, null);
      }
      await signOut(auth);
      // `onAuthStateChanged` will set currentUser to null and loading to false.
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      if (typeof window !== 'undefined') router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: 'Logout Failed', description: (error as Error).message || 'Could not sign out. Please try again.', variant: 'destructive' });
      setLoading(false); // Ensure loading is false on error
    }
  }, [toast, router, currentUser?.uid]);

  const updateUserDisplayNameAndPhoto = useCallback(async (displayName: string, photoURL?: string | null) => {
    if (!auth.currentUser) {
      toast({ title: 'Error', description: 'No user logged in.', variant: 'destructive' });
      throw new Error('No user logged in');
    }
    // setLoading(true); // Consider if global loading is desired here.
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
      await refreshUserProfile(); // This will update the currentUser state in the context
      
      toast({ title: 'Profile Updated', description: 'Your profile has been updated.' });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: 'Update Failed', description: (error as Error).message || 'Could not update profile.', variant: 'destructive' });
      throw error; // Re-throw for component to handle
    } finally {
      // setLoading(false);
    }
  }, [toast, refreshUserProfile]);

  const leaveOrganization = useCallback(async (organizationId: string) => {
    if (!currentUser || !firebaseUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      throw new Error("User not authenticated.");
    }
    
    const membership = currentUser.organizationMemberships?.find(mem => mem.organizationId === organizationId && mem.status === 'active');
    if (!membership || !membership.id) {
      toast({ title: "Error", description: "Membership not found or you're not an active member.", variant: "destructive" });
      throw new Error("Membership not found or already inactive.");
    }

    try {
      await updateOrganizationMemberStatus(membership.id, 'inactive'); // Set status to inactive
      
      // If leaving the currently active organization, clear it from user's profile in Firestore
      if (currentUser.currentOrganizationId === organizationId) {
        await updateUserActiveOrgInFirestore(firebaseUser.uid, null);
      }
      
      // Crucial: Refresh user profile to update memberships and active org state
      await refreshUserProfile(); 
      
      // Success toast is better handled by the calling page for context.
    } catch (error) {
      console.error("Error leaving organization:", error);
      toast({ title: "Error Leaving Organization", description: (error as Error).message || "Could not process request.", variant: "destructive"});
      throw error; 
    }
  }, [currentUser, firebaseUser, refreshUserProfile, toast]);
  
  const contextValue = {
    currentUser,
    firebaseUser,
    loading,
    requiresOrganizationCreation,
    signInWithGoogle,
    logout,
    updateUserDisplayNameAndPhoto,
    refreshUserProfile,
    selectActiveOrganization,
    leaveOrganization,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {/* More selective loading screen: only show if auth is loading AND we are not on public pages like /login or / */}
      {loading && typeof window !== 'undefined' && !['/login', '/', '/features'].includes(window.location.pathname) ? ( 
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

