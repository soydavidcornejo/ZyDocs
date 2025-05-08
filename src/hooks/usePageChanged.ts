'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook para detectar cuando un parámetro de página ha cambiado y ejecutar una función
 * sin volver a ejecutarla cuando otros estados cambian
 * 
 * @param pageId ID o parámetro que identifica la página actual
 * @param callback Función a ejecutar cuando cambia la página
 */
export function usePageChanged<T>(pageId: T, callback: () => void) {
  const prevPageIdRef = useRef<T | null>(null);
  const callbackRef = useRef(callback);
  
  // Actualizar la referencia del callback cuando cambie
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    // Si es la primera carga o si el ID de página cambió
    if (prevPageIdRef.current !== pageId) {
      // Ejecutar el callback desde la referencia
      callbackRef.current();
      
      // Actualizar la referencia
      prevPageIdRef.current = pageId;
    }
    // Solo se vuelve a ejecutar cuando cambia el ID de página, no el callback
  }, [pageId]);
}
