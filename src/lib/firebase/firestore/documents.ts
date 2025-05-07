// src/lib/firebase/firestore/documents.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, where, orderBy, doc, updateDoc as updateFirestoreDoc, getDoc as getFirestoreDoc } from 'firebase/firestore';
import type { DocumentNode } from '@/types/document';

/**
 * Creates a new page in Firestore.
 * @param name - The name of the page.
 * @param parentId - The ID of the parent page. Null if root page.
 * @param organizationId - The ID of the organization this page belongs to.
 * @param order - The order of this page among its siblings.
 * @param initialContent - Optional initial content for the page.
 * @returns The newly created DocumentNode object with resolved timestamps.
 */
export const createDocumentInFirestore = async (
  name: string,
  parentId: string | null,
  organizationId: string,
  order: number = 0,
  initialContent: string = ''
): Promise<DocumentNode> => {
  try {
    const docData: Omit<DocumentNode, 'id' | 'createdAt' | 'updatedAt' | 'children'> = {
      name,
      parentId,
      organizationId,
      type: 'page', // All documents are now 'page' type
      order,
      content: initialContent,
    };

    const docRef = await addDoc(collection(db, 'documents'), {
      ...docData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const now = new Date();
    return {
      id: docRef.id,
      ...docData,
      createdAt: now,
      updatedAt: now,
      type: 'page', // Explicitly set type for return object
    } as DocumentNode;

  } catch (error) {
    console.error('Error creating document in Firestore:', error);
    throw new Error('Failed to create document.');
  }
};


/**
 * Fetches all documents (pages) for a given organization, ordered for tree building.
 * @param organizationId The ID of the organization.
 * @returns A promise that resolves to an array of DocumentNode.
 */
export const getDocumentsForOrganization = async (organizationId: string): Promise<DocumentNode[]> => {
  const docsCollection = collection(db, 'documents');
  const q = query(
    docsCollection,
    where("organizationId", "==", organizationId),
    orderBy("parentId"), 
    orderBy("order", "asc"),
    orderBy("name", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docData => {
    const data = docData.data();
    const createdAt = data.createdAt && (data.createdAt as Timestamp).toDate ? (data.createdAt as Timestamp).toDate() : undefined;
    const updatedAt = data.updatedAt && (data.updatedAt as Timestamp).toDate ? (data.updatedAt as Timestamp).toDate() : undefined;
    
    return {
      id: docData.id,
      organizationId: data.organizationId,
      name: data.name,
      type: 'page', // All documents are of type 'page'
      parentId: data.parentId || null,
      content: data.content,
      order: data.order,
      createdAt,
      updatedAt,
    } as DocumentNode;
  });
};

/**
 * Updates an existing document in Firestore.
 * @param documentId - The ID of the document to update.
 * @param updates - An object containing the fields to update.
 * @returns A promise that resolves when the update is complete.
 */
export const updateDocumentInFirestore = async (
  documentId: string,
  updates: Partial<Pick<DocumentNode, 'name' | 'content' | 'parentId' | 'order'>>
): Promise<void> => {
  try {
    const docRef = doc(db, 'documents', documentId);
    await updateFirestoreDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating document in Firestore:', error);
    throw new Error('Failed to update document.');
  }
};

/**
 * Retrieves a single document by its ID.
 * @param documentId The ID of the document to fetch.
 * @returns A promise that resolves to the DocumentNode or null if not found.
 */
export const getDocumentById = async (documentId: string): Promise<DocumentNode | null> => {
  try {
    const docRef = doc(db, 'documents', documentId);
    const docSnap = await getFirestoreDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const createdAt = data.createdAt && (data.createdAt as Timestamp).toDate ? (data.createdAt as Timestamp).toDate() : undefined;
      const updatedAt = data.updatedAt && (data.updatedAt as Timestamp).toDate ? (data.updatedAt as Timestamp).toDate() : undefined;
      return {
        id: docSnap.id,
        organizationId: data.organizationId,
        name: data.name,
        type: 'page',
        parentId: data.parentId || null,
        content: data.content,
        order: data.order,
        createdAt,
        updatedAt,
      } as DocumentNode;
    }
    return null;
  } catch (error) {
    console.error('Error fetching document by ID:', error);
    throw new Error('Failed to fetch document.');
  }
};
