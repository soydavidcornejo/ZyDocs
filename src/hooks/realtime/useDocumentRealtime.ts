'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DocumentNode } from '@/types/document';

export function useDocumentRealtime(documentId: string | null) {
  const [document, setDocument] = useState<DocumentNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!documentId) {
      setDocument(null);
      setLoading(false);
      return () => {}; // No cleanup needed
    }

    setLoading(true);
    
    const docRef = doc(db, 'documents', documentId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const createdAt = data.createdAt?.toDate?.();
          const updatedAt = data.updatedAt?.toDate?.();
          
          setDocument({
            id: snapshot.id,
            organizationId: data.organizationId,
            name: data.name,
            type: 'page',
            parentId: data.parentId || null,
            content: data.content || '',
            order: data.order === undefined ? 0 : data.order,
            createdAt: createdAt || new Date(),
            updatedAt: updatedAt || new Date(),
          } as DocumentNode);
        } else {
          setDocument(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error getting document:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [documentId]);

  return { document, loading, error };
}
