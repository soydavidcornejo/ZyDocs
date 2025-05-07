import type { DocumentNode } from '@/types/document';

// IMPORTANT: Document data is now managed in Firestore.
// The data structure below (initialDocumentsData) should be seeded into your
// Firestore `/documents` collection. Each object should become a document,
// using its `id` field as the Firestore document ID.
// Add `createdAt` and `updatedAt` fields (e.g., using serverTimestamp()).
// You might also want an `order` field for sorting children.

/*
export const initialDocumentsData: DocumentNode[] = [
  {
    id: 'org1',
    name: 'Zypher Corp',
    type: 'organization',
    parentId: null,
    // children: [ ... ], // Children are now derived client-side from parentId relations
    // createdAt: serverTimestamp(),
    // updatedAt: serverTimestamp(),
    order: 0,
  },
  // ... other organizations, spaces, and pages following the DocumentNode structure
  // For example:
  // {
  //   id: 'space1-org1',
  //   name: 'Product Development',
  //   type: 'space',
  //   parentId: 'org1',
  //   order: 0,
  //   // ...timestamps
  // },
  // {
  //   id: 'page1-space1',
  //   name: 'Q4 Roadmap',
  //   type: 'page',
  //   parentId: 'space1-org1',
  //   content: '# Q4 Product Roadmap\n\n...',
  //   order: 0,
  //   // ...timestamps
  // }
];
*/


// This function will need to be adapted or replaced if complex client-side filtering/searching is still needed
// on the raw flat list fetched from Firestore before building the tree.
// For now, it's commented out as tree building will happen after fetching.
/*
export const findDocument = (nodes: DocumentNode[], id: string): DocumentNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const foundInChildren = findDocument(node.children, id);
      if (foundInChildren) {
        return foundInChildren;
      }
    }
  }
  return null;
};
*/

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
      map[doc.parentId].childrenFromMap?.push(map[doc.id]);
    } else {
      roots.push(map[doc.id]);
    }
  });

  // Sort children by 'order' field if present, then by name
  const sortChildrenRecursive = (nodes: DocumentNode[]) => {
    nodes.forEach(node => {
      if (node.childrenFromMap) {
        node.childrenFromMap.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return a.name.localeCompare(b.name);
        });
        // Rename childrenFromMap to children for final structure
        node.children = node.childrenFromMap;
        delete (node as any).childrenFromMap;
        sortChildrenRecursive(node.children);
      }
    });
  };

  sortChildrenRecursive(roots);
  roots.sort((a, b) => { // Sort root nodes as well
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
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
