// src/lib/firebase/firestore/invitations.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, orderBy, doc, updateDoc } from 'firebase/firestore';
import type { Invitation, UserRole } from '@/types/organization';

/**
 * Creates a new invitation in Firestore.
 * @param organizationId - The ID of the organization.
 * @param invitedUserEmail - The email of the user being invited.
 * @param roleToAssign - The role to assign to the user.
 * @param invitedByUserUid - The UID of the user sending the invitation.
 * @param invitedByUserEmail - The email of the user sending the invitation.
 * @param organizationName - The name of the organization.
 * @returns The ID of the newly created invitation document.
 */
export const createInvitationInFirestore = async (
  organizationId: string,
  invitedUserEmail: string,
  roleToAssign: UserRole,
  invitedByUserUid: string,
  invitedByUserEmail?: string,
  organizationName?: string,
): Promise<string> => {
  try {
    const existingInviteQuery = query(
      collection(db, 'invitations'),
      where('organizationId', '==', organizationId),
      where('invitedUserEmail', '==', invitedUserEmail.toLowerCase()),
      where('status', '==', 'pending')
    );
    const existingInviteSnapshot = await getDocs(existingInviteQuery);
    if (!existingInviteSnapshot.empty) {
      throw new Error(`User ${invitedUserEmail} already has a pending invitation for this organization.`);
    }

    const invitationData: Omit<Invitation, 'id' | 'createdAt' | 'updatedAt'> = {
      organizationId,
      invitedUserEmail: invitedUserEmail.toLowerCase(),
      roleToAssign,
      invitedByUserUid,
      invitedByUserEmail: invitedByUserEmail?.toLowerCase(),
      organizationName,
      status: 'pending',
    };

    const invitationRef = await addDoc(collection(db, 'invitations'), {
      ...invitationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return invitationRef.id;
  } catch (error)
  {
    console.error('Error creating invitation in Firestore:', error);
    if (error instanceof Error && error.message.includes("already has a pending invitation")) {
        throw error;
    }
    throw new Error('Failed to create invitation.');
  }
};

/**
 * Retrieves all pending invitations for a given organization.
 * IMPORTANT: This query requires a composite index in Firestore.
 * If you see an error like "The query requires an index...", create an index on the 'invitations' collection with:
 * - organizationId (Ascending)
 * - status (Ascending)
 * - createdAt (Descending)
 * @param organizationId The ID of the organization.
 * @returns A promise that resolves to an array of Invitation objects.
 */
export const getPendingInvitationsForOrganization = async (organizationId: string): Promise<Invitation[]> => {
  const invitationsCollection = collection(db, 'invitations');
  const q = query(
    invitationsCollection,
    where("organizationId", "==", organizationId),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docData => {
    const data = docData.data();
    return {
      id: docData.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
      updatedAt: (data.updatedAt as Timestamp).toDate(),
      expiresAt: data.expiresAt ? (data.expiresAt as Timestamp).toDate() : undefined,
    } as Invitation;
  });
};

/**
 * Retrieves all pending invitations for a given user email.
 * IMPORTANT: This query requires a composite index in Firestore.
 * If you see an error like "FirebaseError: The query requires an index..." during login or profile sync,
 * you MUST create a composite index in your Firebase Firestore console for the 'invitations' collection.
 * The required index fields are:
 * 1. invitedUserEmail (Ascending)
 * 2. status (Ascending)
 * 3. createdAt (Descending)
 * The error message from Firebase usually provides a direct link to create this index.
 * @param userEmail The email of the user.
 * @returns A promise that resolves to an array of Invitation objects.
 */
export const getPendingInvitationsForUser = async (userEmail: string): Promise<Invitation[]> => {
  if (!userEmail) return [];
  const invitationsCollection = collection(db, 'invitations');
  const q = query(
    invitationsCollection,
    where("invitedUserEmail", "==", userEmail.toLowerCase()),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docData => {
    const data = docData.data();
    return {
      id: docData.id,
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
      updatedAt: (data.updatedAt as Timestamp).toDate(),
      expiresAt: data.expiresAt ? (data.expiresAt as Timestamp).toDate() : undefined,
    } as Invitation;
  });
};


/**
 * Updates the status of an invitation to 'accepted'.
 * @param invitationId The ID of the invitation to accept.
 */
export const acceptInvitationInFirestore = async (invitationId: string): Promise<void> => {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    await updateDoc(invitationRef, {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    throw new Error('Failed to accept invitation.');
  }
};

/**
 * Updates the status of an invitation to 'declined'.
 * @param invitationId The ID of the invitation to decline.
 */
export const declineInvitationInFirestore = async (invitationId: string): Promise<void> => {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    await updateDoc(invitationRef, {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    throw new Error('Failed to decline invitation.');
  }
};


/**
 * Cancels a pending invitation.
 * @param invitationId The ID of the invitation to cancel.
 * @returns A promise that resolves when the invitation is cancelled.
 */
export const cancelInvitationInFirestore = async (invitationId: string): Promise<void> => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        await updateDoc(invitationRef, {
            status: 'cancelled',
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        throw new Error('Failed to cancel invitation.');
    }
};

