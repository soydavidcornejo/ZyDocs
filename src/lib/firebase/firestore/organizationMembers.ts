// src/lib/firebase/firestore/organizationMembers.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import type { OrganizationMember, UserRole } from '@/types/organization';

/**
 * Adds a member to an organization in Firestore.
 * @param organizationId - The ID of the organization.
 * @param userId - The UID of the user to add.
 * @param role - The role to assign to the user in this organization.
 * @param status - The status of the membership (e.g., 'active').
 * @returns The ID of the newly created organization member document.
 */
export const addOrganizationMember = async (
  organizationId: string,
  userId: string,
  role: UserRole,
  status: OrganizationMember['status'] = 'active'
): Promise<string> => {
  try {
    // Check if member already exists with 'active' status (optional, depends on desired behavior)
    const existingMemberQuery = query(
      collection(db, 'organizationMembers'),
      where('organizationId', '==', organizationId),
      where('userId', '==', userId)
    );
    const existingMemberSnapshot = await getDocs(existingMemberQuery);
    const activeExistingMember = existingMemberSnapshot.docs.find(doc => doc.data().status === 'active');

    if (activeExistingMember) {
      // If user is already an active member, perhaps update their role or just return existing ID.
      // For now, let's throw an error or handle as an update. For simplicity, we'll assume adding a new one is an error if already active.
      // Or, if they were 'inactive', reactivate them.
      // This logic needs to be defined based on product requirements.
      // For now, we'll allow re-adding if they were inactive, effectively reactivating.
      // If they are 'active', one might want to prevent adding again.
      // A robust solution might use a unique ID like `orgId_userId` and `setDoc` with merge.
      console.warn(`User ${userId} is already a member of organization ${organizationId}. Current status: ${activeExistingMember.data().status}`);
       // If reactivating an inactive member:
      // await updateDoc(doc(db, 'organizationMembers', activeExistingMember.id), { status: 'active', role, updatedAt: serverTimestamp() });
      // return activeExistingMember.id;
      // For this implementation, let's assume new invitations/additions are for new records or can overwrite for simplicity here.
      // A more robust approach uses explicit invite/accept flow.
    }


    const memberCollectionRef = collection(db, 'organizationMembers');
    const memberDocRef = await addDoc(memberCollectionRef, {
      organizationId,
      userId,
      role,
      status,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return memberDocRef.id;
  } catch (error) {
    console.error('Error adding organization member:', error);
    throw new Error('Failed to add member to organization.');
  }
};

/**
 * Retrieves all organization memberships for a given user with a specific status.
 * @param userId - The UID of the user.
 * @param status - The status of the memberships to retrieve (e.g., 'active'). Defaults to 'active'.
 * @returns An array of OrganizationMember objects.
 */
export const getUserOrganizationMemberships = async (
  userId: string,
  status: OrganizationMember['status'] = 'active'
): Promise<OrganizationMember[]> => {
  try {
    const q = query(
        collection(db, 'organizationMembers'), 
        where('userId', '==', userId), 
        where('status', '==', status)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id, // This is the Firestore document ID of the membership itself
        ...data,
        joinedAt: (data.joinedAt as Timestamp).toDate(),
        updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
      } as OrganizationMember;
    });
  } catch (error) {
    console.error('Error fetching user organization memberships:', error);
    throw new Error('Failed to fetch user organization memberships.');
  }
};


/**
 * Updates the status of an organization member.
 * @param memberDocId - The Firestore document ID of the organizationMembership record.
 * @param status - The new status to set for the member.
 */
export const updateOrganizationMemberStatus = async (
  memberDocId: string,
  status: OrganizationMember['status']
): Promise<void> => {
  try {
    const memberRef = doc(db, 'organizationMembers', memberDocId);
    await updateDoc(memberRef, {
      status: status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating organization member status:', error);
    throw new Error('Failed to update member status.');
  }
};
