// src/lib/firebase/firestore/organizations.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, doc, getDoc, Timestamp } from 'firebase/firestore';
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
