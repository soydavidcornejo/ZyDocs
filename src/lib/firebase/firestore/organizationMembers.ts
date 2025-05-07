// src/lib/firebase/firestore/organizationMembers.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, doc, setDoc } from 'firebase/firestore';
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
    // Using a composite ID orgId_userId to prevent duplicates if desired, or allow Firestore to auto-generate.
    // For this example, let's use auto-generated ID for simplicity in other queries.
    // const memberRef = doc(db, 'organizationMembers', `${organizationId}_${userId}`);
    // await setDoc(memberRef, { /* data */ });
    // return memberRef.id;

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
 * Retrieves all organization memberships for a given user.
 * @param userId - The UID of the user.
 * @returns An array of OrganizationMember objects.
 */
export const getUserOrganizationMemberships = async (userId: string): Promise<OrganizationMember[]> => {
  try {
    const q = query(collection(db, 'organizationMembers'), where('userId', '==', userId), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
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
