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
  selectActiveOrganization: (organizationId: string) => Promise<void>;
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
      activeOrgId = null; // Ensure activeOrgId is null if no active memberships
      if (userProfileData.activeOrganizationId) { // If there was an active one, clear it
        await updateUserActiveOrgInFirestore(fbUser.uid, null);
        userProfileData.activeOrganizationId = null;
      }
    } else {
      setRequiresOrganizationCreation(false);
      const activeMembership = memberships.find(m => m.organizationId === activeOrgId); // Already filtered by 'active' status
      if (activeMembership) {
        currentOrgRole = activeMembership.role;
      } else {
        // No valid active org selected from the available active memberships.
        // Don't auto-select. Let UI (e.g. /organizations page) handle selection.
        activeOrgId = null; 
        currentOrgRole = null;
        if (userProfileData.activeOrganizationId) { // Clear invalid active org from DB
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
      organizationMemberships: memberships, // These are already filtered to 'active'
    };

  }, []);


  const refreshUserProfile = useCallback(async () => {
    if (auth.currentUser) {
      setLoading(true);
      try {
        const updatedProfile = await syncUserProfile(auth.currentUser);
        setCurrentUser(updatedProfile);
      } catch (error) {
        console.error("Error refreshing user profile:", error);
        toast({ title: "Error", description: "Could not refresh user profile.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false); // Ensure loading is false if no user
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
            setCurrentUser(null);
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
  }, [syncUserProfile]);

  const selectActiveOrganization = useCallback(async (organizationId: string) => {
    if (!currentUser || !firebaseUser) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        router.push('/login');
        return;
    }
    // Check if the organizationId is part of the user's current active memberships
    const isValidSelection = currentUser.organizationMemberships?.some(mem => mem.organizationId === organizationId && mem.status === 'active');

    if (!isValidSelection) {
        toast({ title: "Selection Error", description: "Cannot select this organization. It may be inactive or you are no longer a member.", variant: "destructive" });
        await refreshUserProfile(); // Refresh to get latest state
        router.push('/organizations'); // Redirect to organization selection
        return;
    }

    setLoading(true);
    try {
        await updateUserActiveOrgInFirestore(firebaseUser.uid, organizationId);
        await refreshUserProfile(); 
        router.push('/organizations'); // Changed from /docs
    } catch (error) {
        console.error("Error selecting active organization:", error);
        toast({ title: "Error", description: "Could not switch organization.", variant: "destructive" });
        setLoading(false); 
    }
  }, [currentUser, firebaseUser, refreshUserProfile, router, toast]);


  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({ title: 'Login Successful', description: 'Welcome!' });
      // onAuthStateChanged will handle further actions.
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({ title: 'Login Failed', description: 'Could not sign in with Google. Please try again.', variant: 'destructive' });
      setLoading(false); 
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (currentUser?.uid) { // Clear active org on logout from Firestore
        await updateUserActiveOrgInFirestore(currentUser.uid, null);
      }
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: 'Logout Failed', description: 'Could not sign out. Please try again.', variant: 'destructive' });
    } finally {
        setCurrentUser(null); // Ensure client state is cleared immediately
        setFirebaseUser(null);
        setRequiresOrganizationCreation(false);
        setLoading(false);
    }
  }, [toast, router, currentUser?.uid]);

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
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const firestoreUpdatePayload: Partial<UserProfile> = {
        displayName,
        updatedAt: serverTimestamp() as Timestamp,
      };
      if (photoURL !== undefined) {
        firestoreUpdatePayload.photoURL = photoURL;
      }
      await updateDoc(userRef, firestoreUpdatePayload);
      await refreshUserProfile();
      
      toast({ title: 'Profile Updated', description: 'Your profile has been updated.' });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: 'Update Failed', description: 'Could not update profile.', variant: 'destructive' });
      throw error;
    }
  }, [toast, refreshUserProfile]);

  const leaveOrganization = useCallback(async (organizationId: string) => {
    if (!currentUser || !firebaseUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      throw new Error("User not authenticated.");
    }
    
    const membership = currentUser.organizationMemberships?.find(mem => mem.organizationId === organizationId && mem.status === 'active');
    if (!membership || !membership.id) {
      toast({ title: "Error", description: "Membership not found or already inactive.", variant: "destructive" });
      throw new Error("Membership not found or already inactive.");
    }

    // Add check: User cannot leave if they are the owner AND the only admin.
    // This requires fetching organization details to check ownerUid and fetching all admin members for that org.
    // For simplicity now, this check is partially done on the UI. A robust check should be here or backend.

    setLoading(true);
    try {
      await updateOrganizationMemberStatus(membership.id, 'inactive'); // Or 'left'
      
      // If the left organization was the active one, clear it
      if (currentUser.currentOrganizationId === organizationId) {
        await updateUserActiveOrgInFirestore(firebaseUser.uid, null);
      }
      await refreshUserProfile(); // This will update currentUser and requiresOrganizationCreation
      // No explicit redirect here, AppLayout or page will handle it based on new currentUser state
    } catch (error) {
      setLoading(false);
      console.error("Error leaving organization:", error);
      toast({ title: "Error", description: "Could not leave organization.", variant: "destructive" });
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
      {loading && typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/' ? ( 
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

