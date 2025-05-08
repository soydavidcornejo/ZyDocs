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
import type { OrganizationMember, Invitation } from '@/types/organization';
import { useToast } from '@/hooks/use-toast';
// import { Loader2 } from 'lucide-react'; // Loader2 no longer used directly in this component
import { getUserOrganizationMemberships, addOrganizationMember, updateOrganizationMemberStatus } from '@/lib/firebase/firestore/organizationMembers';
import { updateUserActiveOrganization as updateUserActiveOrgInFirestore } from '@/lib/firebase/firestore/users';
import { getPendingInvitationsForUser, acceptInvitationInFirestore, declineInvitationInFirestore } from '@/lib/firebase/firestore/invitations';
import { useRouter } from 'next/navigation';


interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  requiresOrganizationCreation: boolean; 
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserDisplayNameAndPhoto: (displayName: string, photoURL?: string | null) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  selectActiveOrganization: (organizationId: string, targetPath?: string) => Promise<void>;
  leaveOrganization: (organizationId: string) => Promise<void>;
  acceptUserInvitation: (invitation: Invitation) => Promise<void>;
  declineUserInvitation: (invitationId: string) => Promise<void>;
  pendingInvitations: Invitation[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOrganizationCreation, setRequiresOrganizationCreation] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const syncUserProfile = useCallback(async (fbUser: FirebaseUser): Promise<AuthenticatedUser | null> => {
    try { 
        const userRef = doc(db, 'users', fbUser.uid);
        let userDoc = await getDoc(userRef);
        let userRoleFromClaims: UserRole = 'reader';

        try {
          const tokenResult = await fbUser.getIdTokenResult(true); 
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
          userDoc = await getDoc(userRef); 
          userProfileData = userDoc.data() as UserProfile;
        } else {
          userProfileData = userDoc.data() as UserProfile;
          if (userProfileData.role !== userRoleFromClaims || !userProfileData.role) {
            await updateDoc(userRef, { role: userRoleFromClaims, updatedAt: serverTimestamp() });
            userProfileData.role = userRoleFromClaims;
          }
        }
        
        const memberships = await getUserOrganizationMemberships(fbUser.uid); 
        
        // getPendingInvitationsForUser now catches its own errors and returns [] if query fails
        const userInvitations = fbUser.email ? await getPendingInvitationsForUser(fbUser.email) : [];
        setPendingInvitations(userInvitations);

        let activeOrgId = userProfileData.activeOrganizationId;
        let currentOrgRole: UserRole | null = null;
        
        const activeMemberships = memberships.filter(mem => mem.status === 'active');
        setRequiresOrganizationCreation(activeMemberships.length === 0);


        if (activeMemberships.length === 0) {
          activeOrgId = null; 
          if (userProfileData.activeOrganizationId) { 
            await updateUserActiveOrgInFirestore(fbUser.uid, null);
            userProfileData.activeOrganizationId = null;
          }
        } else {
          const activeMembership = activeMemberships.find(m => m.organizationId === activeOrgId); 
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
          pendingInvitations: userInvitations,
        };
    } catch (error) {
        console.error("Critical error in syncUserProfile:", error);
        toast({ title: "Profile Sync Failed", description: "There was a problem loading your user profile. Please ensure you have a stable internet connection and try again.", variant: "destructive" });
        return null; 
    }
  }, [toast]); 


  const refreshUserProfile = useCallback(async () => {
    if (auth.currentUser) {
      setLoading(true); 
      try {
        const updatedProfile = await syncUserProfile(auth.currentUser);
        setCurrentUser(updatedProfile);
      } catch (error) {
        console.error("Error refreshing user profile:", error);
        toast({ title: "Error", description: "Could not refresh user profile data.", variant: "destructive" });
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
        // let profile: AuthenticatedUser | null = null; // Not strictly needed here with current flow
        try {
          const profile = await syncUserProfile(user); // Directly assign to profile
          setCurrentUser(profile); 
          // requiresOrganizationCreation is set within syncUserProfile now.
          // If profile is null, it means sync failed. The default for requiresOrganizationCreation (false)
          // or the last valid state will persist until next successful sync.
          // Components should primarily react to currentUser being null.
        } catch (error) { 
            console.error("Unhandled error during auth state change processing (outer catch):", error);
            setCurrentUser(null);
            setRequiresOrganizationCreation(false); // Fallback if syncUserProfile itself throws an unexpected error
            toast({ title: "Authentication Error", description: "An unexpected error occurred. Please try logging in again.", variant: "destructive"});
        } finally {
            setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setPendingInvitations([]);
        setRequiresOrganizationCreation(false); 
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [syncUserProfile, toast]); 

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

    try {
        if (currentUser.currentOrganizationId !== organizationId) {
            await updateUserActiveOrgInFirestore(firebaseUser.uid, organizationId);
        }
        await refreshUserProfile(); 
        
        if (targetPath && typeof window !== 'undefined') {
            router.push(targetPath);
        } else if (typeof window !== 'undefined') {
             router.push(`/organization/${organizationId}/wiki`); 
        }
    } catch (error) {
        console.error("Error selecting active organization:", error);
        toast({ title: "Error Switching Organization", description: (error as Error).message || "Could not switch organization.", variant: "destructive" });
         await refreshUserProfile(); 
    }
  }, [currentUser, firebaseUser, refreshUserProfile, router, toast]);


  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Success toast is implicitly handled by the app navigating, or can be added if login page persists.
      // setLoading(false) is handled by onAuthStateChanged
    } catch (error) {
      console.error("Error signing in with Google:", error);
      toast({ title: 'Login Failed', description: (error as Error).message || 'Could not sign in with Google. Please try again.', variant: 'destructive' });
      setLoading(false); // Only set loading false here on direct error of signInWithPopup
    }
  }, [toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (currentUser?.uid) { 
        await updateUserActiveOrgInFirestore(currentUser.uid, null);
      }
      await signOut(auth);
      // toast({ title: 'Logged Out', description: 'You have been successfully logged out.' }); // Usually not needed as page redirects
      if (typeof window !== 'undefined') router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
      toast({ title: 'Logout Failed', description: (error as Error).message || 'Could not sign out. Please try again.', variant: 'destructive' });
    } finally {
       setLoading(false); // Ensure loading is false after attempt
    }
  }, [toast, router, currentUser?.uid]);

  const updateUserDisplayNameAndPhoto = useCallback(async (displayName: string, photoURL?: string | null) => {
    if (!auth.currentUser) {
      toast({ title: 'Error', description: 'No user logged in.', variant: 'destructive' });
      throw new Error('No user logged in');
    }
    // setIsSubmittingProfileUpdate(true); // Assuming a state for this if needed (e.g., in ProfileForm)
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
      toast({ title: 'Update Failed', description: (error as Error).message || 'Could not update profile.', variant: 'destructive' });
      throw error; 
    } finally {
       // setIsSubmittingProfileUpdate(false); // e.g., in ProfileForm
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
      await updateOrganizationMemberStatus(membership.id, 'inactive'); 
      
      if (currentUser.currentOrganizationId === organizationId) {
        await updateUserActiveOrgInFirestore(firebaseUser.uid, null);
      }
      
      await refreshUserProfile(); 
      toast({title: 'Left Organization', description: 'You have successfully left the organization.'});
    } catch (error) {
      console.error("Error leaving organization:", error);
      toast({ title: "Error Leaving Organization", description: (error as Error).message || "Could not process request.", variant: "destructive"});
      throw error; 
    }
  }, [currentUser, firebaseUser, refreshUserProfile, toast]);

  const acceptUserInvitation = useCallback(async (invitation: Invitation) => {
    if (!currentUser || !firebaseUser || !invitation.id) {
        toast({ title: "Error", description: "User not authenticated or invitation is invalid.", variant: "destructive" });
        throw new Error("User not authenticated or invitation is invalid.");
    }
    try {
        await acceptInvitationInFirestore(invitation.id);
        await addOrganizationMember(invitation.organizationId, firebaseUser.uid, invitation.roleToAssign, 'active');
        await refreshUserProfile();
        toast({ title: "Invitation Accepted", description: `You are now a member of "${invitation.organizationName || 'the organization'}".` });
    } catch (error) {
        console.error("Error accepting invitation:", error);
        toast({ title: "Accept Failed", description: (error as Error).message || "Could not accept invitation.", variant: "destructive" });
        await refreshUserProfile(); 
        throw error;
    }
  }, [currentUser, firebaseUser, refreshUserProfile, toast]);

  const declineUserInvitation = useCallback(async (invitationId: string) => {
     if (!invitationId) {
        toast({ title: "Error", description: "Invitation ID is missing.", variant: "destructive" });
        throw new Error("Invitation ID is missing.");
    }
    try {
        await declineInvitationInFirestore(invitationId);
        await refreshUserProfile();
        toast({ title: "Invitation Declined", description: "You have declined the invitation." });
    } catch (error) {
        console.error("Error declining invitation:", error);
        toast({ title: "Decline Failed", description: (error as Error).message || "Could not decline invitation.", variant: "destructive" });
        await refreshUserProfile(); 
        throw error;
    }
  }, [refreshUserProfile, toast]);
  
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
    acceptUserInvitation,
    declineUserInvitation,
    pendingInvitations,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {/* Removed the aggressive global loading screen. 
          Individual pages and AppLayout will handle their own loading states 
          based on the 'loading' and 'currentUser' values from this context.
      */}
      {children}
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

