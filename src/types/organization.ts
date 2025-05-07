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
  id: string; // Firestore document ID of the membership record (typically orgId_userId)
  organizationId: string;
  userId: string;
  role: UserRole;
  status: 'active' | 'invited' | 'pending_approval' | 'inactive'; // Added 'inactive' for leave functionality
  joinedAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface OrganizationMemberWithDetails extends OrganizationMember {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface Invitation {
  id?: string; // Firestore document ID
  organizationId: string;
  organizationName?: string; // For display purposes in notifications
  invitedByUserUid: string;
  invitedByUserEmail?: string; // Email of the user who sent the invite
  invitedUserEmail: string; // Email of the user being invited
  roleToAssign: UserRole;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'; // Added 'cancelled'
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  expiresAt?: Timestamp | Date; // Optional: for time-limited invitations
}
