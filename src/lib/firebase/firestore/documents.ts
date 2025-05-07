// src/lib/firebase/firestore/documents.ts
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { DocumentNode } from '@/types/document';

/**
 * Creates a new document (page or space) in Firestore.
 * @param name - The name of the document.
 * @param parentId - The ID of the parent document node.
 * @param organizationId - The ID of the organization this document belongs to.
 * @param type - The type of document ('page' or 'space').
 * @param order - The order of this document among its siblings.
 * @param initialContent - Optional initial content for 'page' type.
 * @returns The newly created DocumentNode object with resolved timestamps.
 */
export const createDocumentInFirestore = async (
  name: string,
  parentId: string | null,
  organizationId: string,
  type: 'page' | 'space' = 'page',
  order: number = 0,
  initialContent: string = ''
): Promise<DocumentNode> => {
  try {
    const docData: Omit<DocumentNode, 'id' | 'createdAt' | 'updatedAt' | 'children'> = {
      name,
      parentId,
      organizationId,
      type,
      order,
      content: type === 'page' ? initialContent : undefined,
      // Timestamps will be set by Firestore
    };

    const docRef = await addDoc(collection(db, 'documents'), {
      ...docData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Firestore timestamps are not immediately available client-side after serverTimestamp()
    // For immediate UI update, we can use current date or fetch the doc again (adds latency)
    // Here, we'll return with estimated client-side dates for createdAt/updatedAt for immediate use
    // The actual server timestamps will be in the database.
    const now = new Date();
    return {
      id: docRef.id,
      ...docData,
      createdAt: now,
      updatedAt: now,
    } as DocumentNode; // Cast as DocumentNode, children will be undefined

  } catch (error) {
    console.error('Error creating document in Firestore:', error);
    throw new Error('Failed to create document.');
  }
};


/**
 * Fetches all documents for a given organization, ordered for tree building.
 * @param organizationId The ID of the organization.
 * @returns A promise that resolves to an array of DocumentNode.
 */
export const getDocumentsForOrganization = async (organizationId: string): Promise<DocumentNode[]> => {
  const docsCollection = collection(db, 'documents');
  const q = query(
    docsCollection,
    where("organizationId", "==", organizationId),
    orderBy("parentId"), // Important for tree building logic that groups children
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
      type: data.type,
      parentId: data.parentId || null,
      content: data.content,
      order: data.order,
      createdAt,
      updatedAt,
    } as DocumentNode;
  });
};