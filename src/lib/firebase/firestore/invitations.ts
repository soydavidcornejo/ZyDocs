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
    // Consider checking for existing pending invitations for the same email and org
    const existingInviteQuery = query(
      collection(db, 'invitations'),
      where('organizationId', '==', organizationId),
      where('invitedUserEmail', '==', invitedUserEmail.toLowerCase()),
      where('status', '==', 'pending')
    );
    const existingInviteSnapshot = await getDocs(existingInviteQuery);
    if (!existingInviteSnapshot.empty) {
      // Potentially update the existing invite or throw an error
      // For now, let's throw an error to prevent duplicate pending invites
      throw new Error(`User ${invitedUserEmail} already has a pending invitation for this organization.`);
    }

    const invitationData: Omit<Invitation, 'id' | 'createdAt' | 'updatedAt'> = {
      organizationId,
      invitedUserEmail: invitedUserEmail.toLowerCase(), // Store email in lowercase for consistency
      roleToAssign,
      invitedByUserUid,
      invitedByUserEmail: invitedByUserEmail?.toLowerCase(),
      organizationName,
      status: 'pending',
      // expiresAt can be set here if needed, e.g., Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) for 7 days
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
