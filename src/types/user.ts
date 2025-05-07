// src/types/user.ts
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'editor' | 'reader';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole; // This might represent a global role or the highest role from claims
  activeOrganizationId?: string | null; // ID of the currently active organization
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// This interface will be used within AuthContext for the currently logged-in user
export interface AuthenticatedUser extends UserProfile {
  currentOrganizationId: string | null;
  currentOrganizationRole: UserRole | null; // Role within the currentOrganizationId
  // globalRoleFromClaims?: UserRole; // If we need to differentiate global claim role from org role
}
