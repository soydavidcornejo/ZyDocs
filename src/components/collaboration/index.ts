// src/components/collaboration/index.ts
// Archivo de exportación para componentes de colaboración

export { ActiveUsersIndicator } from './ActiveUsersIndicator';
export { EditLockIndicator } from './EditLockIndicator';
export { EditConflictResolver } from './EditConflictResolver';
export { CollaborationWrapper } from './CollaborationWrapper';

// También exportamos tipos útiles
export type { UserPresence } from '@/lib/firebase/firestore/presence';
export type { DocumentLock } from '@/lib/firebase/firestore/documentLocks';
