// src/lib/firebase/firestore/organizationMembers.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, doc, setDoc, updateDoc, getDoc as getFirestoreDoc } from 'firebase/firestore'; // Added getDoc as getFirestoreDoc
import type { OrganizationMember, UserRole, OrganizationMemberWithDetails } from '@/types/organization';
import type { UserProfile } from '@/types/user';

/**
 * Adds or updates a member in an organization in Firestore.
 * Uses a composite document ID: `${organizationId}_${userId}`.
 * If member exists and is active, updates role. If inactive, reactivates. If not exists, creates.
 * @param organizationId - The ID of the organization.
 * @param userId - The UID of the user to add/update.
 * @param role - The role to assign to the user in this organization.
 * @param status - The status of the membership (e.g., 'active'). Defaults to 'active'.
 * @returns The ID of the organization member document (composite ID).
 */
export const addOrganizationMember = async (
  organizationId: string,
  userId: string,
  role: UserRole,
  status: OrganizationMember['status'] = 'active'
): Promise<string> => {
  try {
    const memberCollectionRef = collection(db, 'organizationMembers');
    const memberDocId = `${organizationId}_${userId}`; // Composite ID
    const memberDocRef = doc(memberCollectionRef, memberDocId);

    const memberDocSnap = await getFirestoreDoc(memberDocRef);

    const memberData: Partial<OrganizationMember> = {
      organizationId,
      userId,
      role,
      status,
      updatedAt: serverTimestamp() as Timestamp,
    };

    if (memberDocSnap.exists()) {
      // Member exists, update it
      console.warn(`User ${userId} is already a member of organization ${organizationId}. Updating status to ${status} and role to ${role}.`);
      // Do not overwrite joinedAt if member already exists
    } else {
      // New member, set joinedAt
      memberData.joinedAt = serverTimestamp() as Timestamp;
    }
    
    await setDoc(memberDocRef, memberData, { merge: true });

    return memberDocId;
  } catch (error) {
    console.error('Error adding or updating organization member:', error);
    throw new Error('Failed to add or update member in organization.');
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


/**
 * Updates the status of an organization member.
 * @param memberDocId - The Firestore document ID of the organizationMembership record (orgId_userId).
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


/**
 * Retrieves all members of a specific organization, optionally filtered by status, and includes their user details.
 * @param organizationId - The ID of the organization.
 * @param status - Optional. The status of the memberships to retrieve (e.g., 'active'). If undefined, fetches all.
 * @returns An array of OrganizationMemberWithDetails objects.
 */
export const getOrganizationMembersWithDetails = async (
  organizationId: string,
  status?: OrganizationMember['status']
): Promise<OrganizationMemberWithDetails[]> => {
  try {
    let q = query(collection(db, 'organizationMembers'), where('organizationId', '==', organizationId));
    if (status) {
      q = query(q, where('status', '==', status));
    }
    
    const membersSnapshot = await getDocs(q);
    const membersWithDetails: OrganizationMemberWithDetails[] = [];

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data() as Omit<OrganizationMember, 'id'>; // id is memberDoc.id
      const userRef = doc(db, 'users', memberData.userId);
      const userSnap = await getFirestoreDoc(userRef);

      let userProfile: Partial<UserProfile> = { displayName: 'N/A', email: 'N/A', photoURL: null };
      if (userSnap.exists()) {
        const specificUserData = userSnap.data() as UserProfile;
        userProfile = {
            displayName: specificUserData.displayName,
            email: specificUserData.email,
            photoURL: specificUserData.photoURL
        };
      }

      membersWithDetails.push({
        id: memberDoc.id, // This is the orgId_userId composite key
        organizationId: memberData.organizationId,
        userId: memberData.userId,
        role: memberData.role,
        status: memberData.status,
        joinedAt: (memberData.joinedAt as Timestamp).toDate(),
        updatedAt: memberData.updatedAt ? (memberData.updatedAt as Timestamp).toDate() : undefined,
        displayName: userProfile.displayName || 'Unknown User',
        email: userProfile.email || 'No Email',
        photoURL: userProfile.photoURL || null,
      });
    }
    return membersWithDetails.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  } catch (error) {
    console.error('Error fetching organization members with details:', error);
    throw new Error('Failed to fetch organization members.');
  }
};

/**
 * Updates the role of an organization member.
 * @param memberDocId - The Firestore document ID (orgId_userId) of the organizationMembership record.
 * @param role - The new role to assign.
 */
export const updateOrganizationMemberRole = async (
  memberDocId: string, // This is the orgId_userId composite ID
  role: UserRole
): Promise<void> => {
  try {
    const memberRef = doc(db, 'organizationMembers', memberDocId);
    await updateDoc(memberRef, {
      role: role,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating organization member role:', error);
    throw new Error('Failed to update member role.');
  }
};

/**
 * Removes a member from an organization by setting their status to 'inactive'.
 * This is a soft delete. For a hard delete, use deleteDoc.
 * @param memberDocId - The Firestore document ID (orgId_userId) of the organizationMembership record.
 */
export const removeOrganizationMember = async (memberDocId: string): Promise<void> => { // memberDocId is orgId_userId
  await updateOrganizationMemberStatus(memberDocId, 'inactive');
};
