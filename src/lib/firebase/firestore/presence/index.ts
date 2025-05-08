// src/lib/firebase/firestore/presence/index.ts
import { db } from '@/lib/firebase/config';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  deleteDoc, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  Timestamp, 
  getDocs 
} from 'firebase/firestore';

// Tipo para representar la información de presencia de un usuario
export interface UserPresence {
  userId: string;
  userName: string;
  photoURL?: string;
  documentId: string;
  lastActive: Timestamp | Date;
}

/**
 * Registra la presencia de un usuario en un documento
 * @param documentId ID del documento que está viendo/editando
 * @param userId ID del usuario
 * @param userName Nombre del usuario para mostrar
 * @param photoURL URL opcional de la foto de perfil del usuario
 * @returns Función para limpiar la presencia cuando el componente se desmonta
 */
export const registerUserPresence = async (
  documentId: string, 
  userId: string, 
  userName: string,
  photoURL?: string
): Promise<() => void> => {
  const presenceRef = doc(db, 'presence', `${documentId}_${userId}`);
  
  // Registrar presencia inicial
  await setDoc(presenceRef, {
    userId,
    userName,
    photoURL,
    documentId,
    lastActive: serverTimestamp(),
  });

  // Actualizar timestamp periódicamente para mantener la presencia activa
  const interval = setInterval(() => {
    setDoc(presenceRef, { lastActive: serverTimestamp() }, { merge: true })
      .catch(error => console.error("Error actualizando presencia:", error));
  }, 30000); // Cada 30 segundos

  // Configurar limpieza al cerrar la página
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
    deleteDoc(presenceRef).catch(err => console.error("Error limpiando presencia:", err));
  });

  // Función para limpiar al desmontar el componente
  return () => {
    clearInterval(interval);
    deleteDoc(presenceRef).catch(err => console.error("Error limpiando presencia:", err));
  };
};

/**
 * Obtiene los usuarios activos en un documento en tiempo real
 * @param documentId ID del documento
 * @param callback Función que recibe la lista de usuarios activos
 * @returns Función para desuscribirse
 */
export const getActiveUsers = (
  documentId: string, 
  callback: (users: UserPresence[]) => void
): (() => void) => {
  // Buscar usuarios que han estado activos en los últimos 5 minutos
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

  const q = query(
    collection(db, 'presence'),
    where('documentId', '==', documentId)
  );

  // Establecer listener en tiempo real
  return onSnapshot(q, (snapshot) => {
    const now = new Date();
    const users = snapshot.docs
      .map(doc => {
        const data = doc.data() as UserPresence;
        // Convertir Timestamp a Date si es necesario
        const lastActive = data.lastActive instanceof Timestamp 
          ? data.lastActive.toDate() 
          : data.lastActive;
        return { ...data, lastActive };
      })
      // Filtrar usuarios que no han estado activos en los últimos 5 minutos
      .filter(user => {
        // Comprobar que lastActive existe y es una fecha válida
        if (!user.lastActive) return false;
        
        try {
          const lastActive = user.lastActive as Date;
          const diffMs = now.getTime() - lastActive.getTime();
          const diffMinutes = diffMs / (1000 * 60);
          return diffMinutes < 5;
        } catch (error) {
          console.error('Error procesando fecha de presencia:', error);
          return false;
        }
      });
    
    callback(users);
  });
};

/**
 * Limpia registros de presencia antiguos (más de 10 minutos)
 * Útil para llamar periódicamente y limpiar datos obsoletos
 */
export const cleanupStalePresenceRecords = async (): Promise<void> => {
  try {
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
    
    const presenceCollection = collection(db, 'presence');
    const presenceSnapshot = await getDocs(presenceCollection);
    
    const batch = presenceSnapshot.docs.reduce((batch, docSnapshot) => {
      try {
        const data = docSnapshot.data();
        
        // Verificar que data.lastActive existe
        if (!data.lastActive) {
          // Si no hay fecha, eliminar el registro
          batch.delete(docSnapshot.ref);
          return batch;
        }
        
        const lastActive = data.lastActive instanceof Timestamp 
          ? data.lastActive.toDate() 
          : new Date(data.lastActive);
        
        // Verificar que la fecha es válida
        if (isNaN(lastActive.getTime())) {
          // Si la fecha no es válida, eliminar el registro
          batch.delete(docSnapshot.ref);
          return batch;
        }
        
        if (lastActive < tenMinutesAgo) {
          batch.delete(docSnapshot.ref);
        }
      } catch (error) {
        console.error('Error procesando registro de presencia:', error);
        // Si hay un error al procesar, eliminar el registro
        batch.delete(docSnapshot.ref);
      }
      
      return batch;
    }, db.batch());
    
    if (batch._mutations && batch._mutations.length > 0) {
      await batch.commit();
      console.log(`Limpiados ${batch._mutations.length} registros de presencia obsoletos`);
    }
  } catch (error) {
    console.error('Error limpiando registros de presencia obsoletos:', error);
  }
};
