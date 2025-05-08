// src/lib/firebase/firestore/documentLocks.ts
import { db } from '@/lib/firebase/config';
import { 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  serverTimestamp, 
  onSnapshot, 
  Timestamp 
} from 'firebase/firestore';

// Tipo para la información de bloqueo
export interface DocumentLock {
  userId: string;
  userName: string;
  photoURL?: string;
  timestamp: Timestamp | Date;
  expiresAt: Timestamp | Date;
}

// Tiempo de expiración del bloqueo en milisegundos (5 minutos)
const LOCK_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Intenta adquirir un bloqueo para editar un documento
 * @param documentId ID del documento
 * @param userId ID del usuario que intenta obtener el bloqueo
 * @param userName Nombre del usuario
 * @param photoURL URL opcional de la foto de perfil
 * @returns Promise<boolean> true si se adquirió el bloqueo, false si ya está bloqueado por otro usuario
 */
export const acquireLock = async (
  documentId: string, 
  userId: string, 
  userName: string,
  photoURL?: string
): Promise<boolean> => {
  const lockRef = doc(db, 'documentLocks', documentId);
  
  try {
    // Verificar si ya existe un bloqueo
    const lockDoc = await getDoc(lockRef);
    
    if (lockDoc.exists()) {
      const lockData = lockDoc.data() as DocumentLock;
      const lockTime = lockData.timestamp instanceof Timestamp 
        ? lockData.timestamp.toDate() 
        : new Date(lockData.timestamp);
      
      const now = new Date();
      
      // Si el bloqueo ha expirado o es del mismo usuario, podemos sobreescribirlo
      if ((now.getTime() - lockTime.getTime() > LOCK_EXPIRATION_MS) || lockData.userId === userId) {
        const expiresAt = new Date(now.getTime() + LOCK_EXPIRATION_MS);
        await setDoc(lockRef, {
          userId,
          userName,
          photoURL,
          timestamp: serverTimestamp(),
          expiresAt
        });
        return true;
      }
      
      // Alguien más tiene el bloqueo y no ha expirado
      return false;
    }
    
    // No hay bloqueo, podemos adquirirlo
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_EXPIRATION_MS);
    await setDoc(lockRef, {
      userId,
      userName,
      photoURL,
      timestamp: serverTimestamp(),
      expiresAt
    });
    
    return true;
  } catch (error) {
    console.error("Error adquiriendo bloqueo:", error);
    return false;
  }
};

/**
 * Libera un bloqueo si el usuario actual lo tiene
 * @param documentId ID del documento
 * @param userId ID del usuario que intenta liberar el bloqueo
 * @returns Promise<boolean> true si se liberó correctamente, false si no
 */
export const releaseLock = async (documentId: string, userId: string): Promise<boolean> => {
  try {
    const lockRef = doc(db, 'documentLocks', documentId);
    
    // Verificar si el usuario actual tiene el bloqueo
    const lockDoc = await getDoc(lockRef);
    
    if (lockDoc.exists() && lockDoc.data().userId === userId) {
      await deleteDoc(lockRef);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error liberando bloqueo:", error);
    return false;
  }
};

/**
 * Verifica el estado actual del bloqueo de un documento
 * @param documentId ID del documento
 * @returns Promise<DocumentLock | null> Información del bloqueo o null si no está bloqueado
 */
export const checkLockStatus = async (documentId: string): Promise<DocumentLock | null> => {
  try {
    const lockRef = doc(db, 'documentLocks', documentId);
    const lockDoc = await getDoc(lockRef);
    
    if (lockDoc.exists()) {
      const lockData = lockDoc.data() as DocumentLock;
      // Verificar si el bloqueo ha expirado
      const now = new Date();
      const expiresAt = lockData.expiresAt instanceof Timestamp 
        ? lockData.expiresAt.toDate() 
        : new Date(lockData.expiresAt);
      
      if (now > expiresAt) {
        // El bloqueo ha expirado, lo eliminamos
        await deleteDoc(lockRef);
        return null;
      }
      
      return lockData;
    }
    
    return null;
  } catch (error) {
    console.error("Error verificando estado del bloqueo:", error);
    return null;
  }
};

/**
 * Configura un listener para el estado del bloqueo en tiempo real
 * @param documentId ID del documento
 * @param callback Función que recibe el estado actualizado del bloqueo
 * @returns Función para desuscribirse
 */
export const watchLockStatus = (
  documentId: string, 
  callback: (lock: DocumentLock | null) => void
): (() => void) => {
  const lockRef = doc(db, 'documentLocks', documentId);
  
  return onSnapshot(lockRef, (snapshot) => {
    if (snapshot.exists()) {
      const lockData = snapshot.data() as DocumentLock;
      // Verificar si el bloqueo ha expirado
      const now = new Date();
      const expiresAt = lockData.expiresAt instanceof Timestamp 
        ? lockData.expiresAt.toDate() 
        : new Date(lockData.expiresAt);
      
      if (now > expiresAt) {
        // El bloqueo ha expirado
        callback(null);
      } else {
        callback(lockData);
      }
    } else {
      callback(null);
    }
  });
};

/**
 * Renueva un bloqueo existente para que no expire
 * @param documentId ID del documento
 * @param userId ID del usuario que tiene el bloqueo
 * @returns true si se renovó correctamente, false si no
 */
export const renewLock = async (documentId: string, userId: string): Promise<boolean> => {
  try {
    const lockRef = doc(db, 'documentLocks', documentId);
    const lockDoc = await getDoc(lockRef);
    
    if (lockDoc.exists() && lockDoc.data().userId === userId) {
      const lockData = lockDoc.data();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + LOCK_EXPIRATION_MS);
      
      await setDoc(lockRef, {
        ...lockData,
        timestamp: serverTimestamp(),
        expiresAt
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error renovando bloqueo:", error);
    return false;
  }
};
