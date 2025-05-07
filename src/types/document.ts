// src/types/document.ts
import type { Timestamp } from 'firebase/firestore';

export interface DocumentNode {
  id: string; // Firestore document ID
  organizationId: string; // ID of the organization this document belongs to
  name: string;
  type: 'organization' | 'space' | 'page'; // 'organization' type here might represent the root node for display
  parentId?: string | null;
  content?: string; // Content for 'page' type
  children?: DocumentNode[]; // This will be constructed client-side after fetching
  createdAt?: Timestamp | Date; 
  updatedAt?: Timestamp | Date; 
  order?: number; // Optional: for sorting children
}
