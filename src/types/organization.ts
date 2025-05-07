// src/types/organization.ts
import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './user';

export interface Organization {
  id: string; // Firestore document ID
  name: string;
  ownerUid: string; // UID of the user who created the organization
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface OrganizationMember {
  id?: string; // Firestore document ID (e.g., orgId_userId or auto-generated)
  organizationId: string;
  userId: string;
  role: UserRole;
  status: 'active' | 'invited' | 'pending_approval'; // Status of the membership
  joinedAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface Invitation {
  id?: string; // Firestore document ID
  organizationId: string;
  organizationName?: string; // For display purposes in notifications
  invitedByUserUid: string;
  invitedUserEmail: string;
  roleToAssign: UserRole;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  expiresAt?: Timestamp | Date; // Optional: for time-limited invitations
}
