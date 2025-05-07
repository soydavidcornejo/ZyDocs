// src/types/user.ts
export type UserRole = 'admin' | 'editor' | 'reader';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  // Add other organization-specific or app-specific fields if needed
  // e.g., organizationId?: string;
}
