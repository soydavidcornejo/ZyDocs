import type { DocumentNode } from '@/types/document';

// IMPORTANT: Document data is now managed in Firestore.
// Firestore `/documents` collection is the source of truth.
// Each object should become a document,
// using its `id` field as the Firestore document ID.
// Add `createdAt` and `updatedAt` fields (e.g., using serverTimestamp()).
// Add an `order` field for sorting children.
// Add `organizationId` to associate document with an organization.


/**
 * Helper to build a tree structure from a flat list of documents.
 * Assumes documents are fetched and have `id` and `parentId`.
 */
export const buildDocumentTree = (documents: DocumentNode[]): DocumentNode[] => {
  const map: { [key: string]: DocumentNode & { childrenFromMap?: DocumentNode[] } } = {};
  const roots: DocumentNode[] = [];

  documents.forEach(doc => {
    map[doc.id] = { ...doc, childrenFromMap: [] };
  });

  documents.forEach(doc => {
    if (doc.parentId && map[doc.parentId]) {
      // Ensure parent exists before pushing
      if(map[doc.parentId].childrenFromMap) {
        map[doc.parentId].childrenFromMap?.push(map[doc.id]);
      } else {
        // This case should ideally not happen if data is consistent, but as a fallback:
        console.warn(`Parent ${doc.parentId} for doc ${doc.id} not found in map's childrenFromMap. Adding as root.`);
        roots.push(map[doc.id]);
      }
    } else {
      roots.push(map[doc.id]);
    }
  });

  // Sort children by 'order' field if present, then by name
  const sortChildrenRecursive = (nodes: DocumentNode[]) => {
    nodes.forEach(node => {
      if (node.childrenFromMap && node.childrenFromMap.length > 0) {
        node.childrenFromMap.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            const orderDiff = (a.order ?? 0) - (b.order ?? 0);
            if (orderDiff !== 0) return orderDiff;
          }
          return a.name.localeCompare(b.name);
        });
        node.children = node.childrenFromMap; // Assign to 'children'
        sortChildrenRecursive(node.children);
      } else {
        node.children = []; // Ensure children is an empty array if no childrenFromMap
      }
      delete (node as any).childrenFromMap; // Clean up temporary property
    });
  };

  sortChildrenRecursive(roots);
  roots.sort((a, b) => { // Sort root nodes as well
      if (a.order !== undefined && b.order !== undefined) {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
      }
      return a.name.localeCompare(b.name);
    });

  return roots;
};

/**
 * Helper to find a specific document from a flat list.
 */
export const findDocumentInList = (documents: DocumentNode[], id: string): DocumentNode | null => {
  return documents.find(doc => doc.id === id) || null;
};