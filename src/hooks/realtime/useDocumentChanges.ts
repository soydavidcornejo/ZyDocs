'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DocumentNode } from '@/types/document';

interface DocumentChangeOptions {
  documentId: string | null;
  onContentChanged?: (updatedContent: string, updatedAt: Date) => void;
  isEditing?: boolean;
  localContent?: string;
  skipInitial?: boolean;
}

/**
 * Hook personalizado para monitorear cambios en un documento y detectar posibles conflictos
 * 
 * @param options Opciones de configuración
 * @returns Objeto con información del último cambio y estado de carga
 */
export function useDocumentChanges({
  documentId,
  onContentChanged,
  isEditing = false,
  localContent = '',
  skipInitial = true
}: DocumentChangeOptions) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Función para detectar conflictos - estabilizada con useRef para el contenido local
  const localContentRef = useRef(localContent);
  const isEditingRef = useRef(isEditing);
  const documentIdRef = useRef(documentId);
  const initialLoadDoneRef = useRef(initialLoadDone);
  const onContentChangedRef = useRef(onContentChanged);
  
  // Actualizar las referencias cuando cambien los valores
  useEffect(() => {
    localContentRef.current = localContent;
    isEditingRef.current = isEditing;
    documentIdRef.current = documentId;
    initialLoadDoneRef.current = initialLoadDone;
    onContentChangedRef.current = onContentChanged;
  }, [localContent, isEditing, documentId, initialLoadDone, onContentChanged]);
  
  const checkForConflicts = useCallback((newContent: string, updatedAt: Date) => {
    if (!isEditingRef.current || !localContentRef.current) return;
    
    // Si tenemos contenido local diferente al del servidor, podría haber un conflicto
    if (localContentRef.current !== newContent && onContentChangedRef.current) {
      // Verificar que la diferencia sea significativa, no solo espacios
      const localTrimmed = localContentRef.current.trim();
      const newTrimmed = newContent.trim();
      
      if (localTrimmed !== newTrimmed) {
        onContentChangedRef.current(newContent, updatedAt);
      }
    }
  }, []); // Sin dependencias externas, todo usa refs

  useEffect(() => {
    if (!documentId) {
      setLoading(false);
      return () => {};
    }

    // Para evitar actualizaciones en bucle, usamos una variable local
    let isFirstLoad = !initialLoadDoneRef.current;
    let processingUpdate = false;
    
    setLoading(true);
    
    const docRef = doc(db, 'documents', documentId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        // Evitar procesar actualizaciones mientras ya estamos procesando una
        if (processingUpdate) return;
        processingUpdate = true;
        
        if (snapshot.exists()) {
          const data = snapshot.data() as Omit<DocumentNode, 'id'>;
          
          // Procesar timestamp si existe
          const updatedAt = data.updatedAt instanceof Timestamp 
            ? data.updatedAt.toDate() 
            : (data.updatedAt as Date || new Date());
          
          setLastUpdate(updatedAt);
          
          // Solo revisamos conflictos después de la carga inicial
          // o si skip initial está desactivado, y solo si estamos editando
          if ((!isFirstLoad || !skipInitial) && isEditingRef.current) {
            // Verificar que el contenido realmente cambió antes de llamar al callback
            if (data.content !== localContentRef.current) {
              checkForConflicts(data.content || '', updatedAt);
            }
          }
          
          // Marcar que ya no es la carga inicial para futuras actualizaciones
          if (isFirstLoad) {
            isFirstLoad = false;
            if (!initialLoadDoneRef.current) {
              setInitialLoadDone(true);
            }
          }
        }
        
        setLoading(false);
        processingUpdate = false;
      },
      (err) => {
        console.error('Error observando cambios en documento:', err);
        setError(err as Error);
        setLoading(false);
        processingUpdate = false;
      }
    );

    return () => unsubscribe();
  }, [documentId, checkForConflicts]); // Dependencias mínimas para evitar recreación

  return { lastUpdate, loading, error };
}
