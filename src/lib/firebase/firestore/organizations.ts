// src/lib/firebase/firestore/organizations.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, doc, getDoc, Timestamp, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import type { Organization } from '@/types/organization';

/**
 * Creates a new organization in Firestore.
 * @param name - The name of the organization.
 * @param ownerUid - The UID of the user creating the organization.
 * @returns The ID of the newly created organization.
 */
export const createOrganizationInFirestore = async (name: string, ownerUid: string): Promise<string> => {
  try {
    const orgRef = await addDoc(collection(db, 'organizations'), {
      name,
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return orgRef.id;
  } catch (error) {
    console.error('Error creating organization in Firestore:', error);
    throw new Error('Failed to create organization.');
  }
};

/**
 * Retrieves organization details from Firestore.
 * @param organizationId - The ID of the organization to retrieve.
 * @returns The Organization object or null if not found.
 */
export const getOrganizationDetails = async (organizationId: string): Promise<Organization | null> => {
  try {
    const orgRef = doc(db, 'organizations', organizationId);
    const orgSnap = await getDoc(orgRef);

    if (orgSnap.exists()) {
      const data = orgSnap.data();
      return {
        id: orgSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate(),
        updatedAt: (data.updatedAt as Timestamp).toDate(),
      } as Organization;
    }
    return null;
  } catch (error) {
    console.error('Error fetching organization details:', error);
    throw new Error('Failed to fetch organization details.');
  }
};


/**
 * Deletes an organization and all its associated data from Firestore.
 * This includes documents, members, and invitations.
 * @param organizationId - The ID of the organization to delete.
 */
export const deleteOrganizationAndAssociatedData = async (organizationId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // 1. Delete documents associated with the organization
    const docsQuery = query(collection(db, 'documents'), where('organizationId', '==', organizationId));
    const docsSnapshot = await getDocs(docsQuery);
    docsSnapshot.forEach(docSnap => {
      batch.delete(doc(db, 'documents', docSnap.id));
    });

    // 2. Delete organization members associated with the organization
    // Member IDs are composite: ${organizationId}_${userId}
    // We need to query by organizationId field within the member documents.
    const membersQuery = query(collection(db, 'organizationMembers'), where('organizationId', '==', organizationId));
    const membersSnapshot = await getDocs(membersQuery);
    membersSnapshot.forEach(docSnap => {
      batch.delete(doc(db, 'organizationMembers', docSnap.id));
    });

    // 3. Delete invitations associated with the organization
    const invitationsQuery = query(collection(db, 'invitations'), where('organizationId', '==', organizationId));
    const invitationsSnapshot = await getDocs(invitationsQuery);
    invitationsSnapshot.forEach(docSnap => {
      batch.delete(doc(db, 'invitations', docSnap.id));
    });
    
    // Commit batched deletions of associated data
    await batch.commit();

    // 4. Delete the organization document itself
    const orgDocRef = doc(db, 'organizations', organizationId);
    await deleteDoc(orgDocRef);

  } catch (error) {
    console.error(`Error deleting organization ${organizationId} and associated data:`, error);
    throw new Error(`Failed to delete organization and its data. ${(error as Error).message}`);
  }
};
