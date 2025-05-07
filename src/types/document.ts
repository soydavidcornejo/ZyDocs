// src/types/document.ts
import type { Timestamp } from 'firebase/firestore';

export interface DocumentNode {
  id: string; // Firestore document ID
  organizationId: string; // ID of the organization this document belongs to
  name: string;
  type: 'page'; // Only 'page' type. Pages can have children to act as containers.
  parentId?: string | null;
  content?: string; // Content for the page
  children?: DocumentNode[]; // This will be constructed client-side after fetching
  createdAt?: Timestamp | Date; 
  updatedAt?: Timestamp | Date; 
  order?: number; // Optional: for sorting children
}
