'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ActiveUsersIndicator } from './ActiveUsersIndicator';
import { EditLockIndicator } from './EditLockIndicator';
import { EditConflictResolver } from './EditConflictResolver';
import { registerUserPresence } from '@/lib/firebase/firestore/presence';
import { acquireLock, releaseLock, renewLock } from '@/lib/firebase/firestore/documentLocks';
import { useToast } from '@/hooks/use-toast';
import { useDocumentChanges } from '@/hooks/realtime/useDocumentChanges';

interface CollaborationWrapperProps {
  documentId: string;
  organizationId: string;
  isEditing: boolean;
  onEditBlocked?: () => void;
  documentName?: string;
  localContent?: string;
  onResolveConflict?: (resolvedContent: string) => void;
  children: React.ReactNode;
}

export function CollaborationWrapper({
  documentId,
  organizationId,
  isEditing,
  onEditBlocked,
  documentName = 'Documento',
  localContent = '',
  onResolveConflict,
  children
}: CollaborationWrapperProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [hasLock, setHasLock] = useState(false);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [serverContent, setServerContent] = useState('');
  const [serverUpdatedAt, setServerUpdatedAt] = useState<Date>(new Date());

  // Manejar el registro y limpieza de la presencia de usuario
  useEffect(() => {
    if (!documentId || !currentUser) return;

    const registerPresence = async () => {
      try {
        const cleanup = await registerUserPresence(
          documentId,
          currentUser.uid,
          currentUser.displayName || 'Usuario',
          currentUser.photoURL || undefined
        );
        
        return cleanup;
      } catch (error) {
        console.error('Error registrando presencia:', error);
        // No bloqueamos la UI por un error de presencia
        return () => {};
      }
    };

    const cleanupFn = registerPresence();
    
    return () => {
      cleanupFn.then(cleanup => cleanup());
    };
  }, [documentId, currentUser]);

  // Manejar la adquisición y renovación de bloqueos para edición
  useEffect(() => {
    if (!documentId || !currentUser || !isEditing) return;

    let lockInterval: NodeJS.Timeout;
    
    const acquireDocumentLock = async () => {
      try {
        const acquired = await acquireLock(
          documentId,
          currentUser.uid,
          currentUser.displayName || 'Usuario',
          currentUser.photoURL || undefined
        );
        
        if (acquired) {
          setHasLock(true);
          
          // Configurar renovación periódica del bloqueo
          lockInterval = setInterval(async () => {
            const renewed = await renewLock(documentId, currentUser.uid);
            if (!renewed) {
              clearInterval(lockInterval);
              setHasLock(false);
              
              if (onEditBlocked) {
                onEditBlocked();
              }
              
              toast({
                title: 'Bloqueo perdido',
                description: 'Has perdido el bloqueo de edición del documento.',
                variant: 'destructive'
              });
            }
          }, 60000); // Renovar cada minuto
        } else {
          setHasLock(false);
          
          if (onEditBlocked) {
            console.log("Documento bloqueado para edición, redirigiendo a modo lectura");
            onEditBlocked();
          }
          
          // Eliminamos el toast que muestra la alerta
          /* toast({
            title: 'Documento bloqueado',
            description: 'Este documento está siendo editado por otro usuario.',
            variant: 'destructive'
          }); */
        }
      } catch (error) {
        console.error('Error adquiriendo bloqueo:', error);
        setHasLock(false);
        
        if (onEditBlocked) {
          onEditBlocked();
        }
      }
    };
    
    acquireDocumentLock();
    
    // Limpiar al desmontar
    return () => {
      if (lockInterval) {
        clearInterval(lockInterval);
      }
      
      if (hasLock) {
        releaseLock(documentId, currentUser.uid).catch(err => 
          console.error('Error liberando bloqueo:', err)
        );
      }
    };
  }, [documentId, currentUser, isEditing, onEditBlocked, hasLock, toast]);

  // Verificar si el usuario es administrador para permitir forzar desbloqueo
  const isAdmin = currentUser?.organizationMemberships?.some(
    membership => membership.organizationId === organizationId && membership.role === 'admin'
  ) || false;
  
  // Configurar detector de cambios para conflictos
  useDocumentChanges({
    documentId: isEditing ? documentId : null, // Solo activar en modo edición
    isEditing,
    localContent,
    onContentChanged: (remoteContent, updatedAt) => {
      // Si el contenido local y remoto son diferentes, mostrar diálogo de conflicto
      if (localContent !== remoteContent) {
        // Verificar que hay diferencias significativas, no solo espacios en blanco
        const localTrimmed = localContent.trim();
        const remoteTrimmed = remoteContent.trim();
        
        if (localTrimmed !== remoteTrimmed) {
          console.log("Diferencias de contenido detectadas, abriendo resolución de conflictos");
          setServerContent(remoteContent);
          setServerUpdatedAt(updatedAt);
          setIsConflictDialogOpen(true);
        }
      }
    },
    skipInitial: true // Asegurarnos de omitir la carga inicial para evitar falsos conflictos
  });
  
  // Función para manejar detección de conflictos manual
  const handleConflictDetected = (remoteContent: string, updatedAt: Date) => {
    if (!isEditing || !localContent) return;
    
    // Si el contenido local y remoto son diferentes, mostrar diálogo de conflicto
    if (localContent !== remoteContent) {
      setServerContent(remoteContent);
      setServerUpdatedAt(updatedAt);
      setIsConflictDialogOpen(true);
    }
  };
  
  // Función para resolver conflictos
  const handleResolveConflict = (resolvedContent: string) => {
    setIsConflictDialogOpen(false);
    
    if (onResolveConflict) {
      onResolveConflict(resolvedContent);
    }
  };

  return (
    <div className="w-full">
      {/* Indicador de usuarios en el documento */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Colaboración en tiempo real</h3>
        {documentId && currentUser && (
          <ActiveUsersIndicator 
            documentId={documentId}
            currentUserId={currentUser.uid}
            excludeCurrentUser={false}
          />
        )}
      </div>
      
      {/* Indicador de bloqueo de edición - solo mostrar alerta en modo edición */}
      {documentId && currentUser && (
        <EditLockIndicator 
          documentId={documentId}
          currentUserId={currentUser.uid}
          isAdmin={isAdmin}
          onForceUnlock={onEditBlocked}
          showAlert={isEditing} // Solo mostrar alerta si estamos intentando editar
        />
      )}
      
      {/* Contenido del componente hijo */}
      {children}
      
      {/* Diálogo de resolución de conflictos */}
      {isConflictDialogOpen && (
        <EditConflictResolver
          isOpen={isConflictDialogOpen}
          onClose={() => setIsConflictDialogOpen(false)}
          documentId={documentId}
          documentTitle={documentName}
          localContent={localContent}
          serverContent={serverContent}
          serverUpdatedAt={serverUpdatedAt}
          onResolve={handleResolveConflict}
        />
      )}
    </div>
  );
}
