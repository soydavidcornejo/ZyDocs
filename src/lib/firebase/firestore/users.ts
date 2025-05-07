// src/lib/firebase/firestore/users.ts
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Updates the activeOrganizationId for a user in Firestore.
 * @param userId - The UID of the user to update.
 * @param organizationId - The ID of the organization to set as active.
 */
export const updateUserActiveOrganization = async (userId: string, organizationId: string | null): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      activeOrganizationId: organizationId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user active organization:', error);
    throw new Error('Failed to update user active organization.');
  }
};
