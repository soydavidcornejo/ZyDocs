'use client';

import { useEffect, useState } from 'react';
import { watchLockStatus, releaseLock, type DocumentLock } from '@/lib/firebase/firestore/documentLocks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';

interface EditLockIndicatorProps {
  documentId: string;
  currentUserId: string;
  onForceUnlock?: () => void;
  isAdmin?: boolean;
  showAlert?: boolean; // Nueva prop para controlar si mostrar la alerta (por defecto false)
}

export function EditLockIndicator({ 
  documentId, 
  currentUserId,
  onForceUnlock,
  isAdmin = false,
  showAlert = false // Por defecto, no mostrar la alerta
}: EditLockIndicatorProps) {
  const [lock, setLock] = useState<DocumentLock | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!documentId) return;
    
    const unsubscribe = watchLockStatus(documentId, (lockStatus) => {
      setLock(lockStatus);
    });
    
    return () => unsubscribe();
  }, [documentId]);

  // Si no hay bloqueo o el bloqueo es del usuario actual, no mostramos nada
  if (!lock || lock.userId === currentUserId) {
    return null;
  }

  const handleForceUnlock = async () => {
    if (!isAdmin) return;
    
    try {
      await releaseLock(documentId, lock.userId);
      toast({
        title: "Bloqueo liberado",
        description: `Has liberado el bloqueo de edición de ${lock.userName}`,
      });
      
      if (onForceUnlock) {
        onForceUnlock();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo liberar el bloqueo",
        variant: "destructive",
      });
    }
  };

  // Si no queremos mostrar la alerta (en modo lectura por ejemplo), no renderizamos nada
  if (!showAlert) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center">
        <Lock className="h-4 w-4 mr-2" />
        Documento bloqueado para edición
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex items-center">
          <Avatar className="h-8 w-8 mr-2">
            {lock.photoURL ? (
              <AvatarImage src={lock.photoURL} alt={lock.userName} />
            ) : (
              <AvatarFallback>
                {lock.userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <span>
            <strong>{lock.userName}</strong> está editando este documento actualmente.
          </span>
        </div>
        <p className="mt-1 text-sm">
          No puedes editar mientras otro usuario tiene el documento abierto en modo edición.
        </p>
        {isAdmin && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleForceUnlock} 
            className="mt-2 bg-white/10 border-white/20 hover:bg-white/20"
          >
            <Unlock className="h-3 w-3 mr-1" />
            Forzar desbloqueo (solo administradores)
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
