// src/types/user.ts
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'editor' | 'reader';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  // Add other organization-specific or app-specific fields if needed
  // e.g., organizationId?: string;
}
