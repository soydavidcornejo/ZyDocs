'use client';

import { useRef, useState, useEffect } from 'react';

interface UseResizeObserverOptions {
  debounceTime?: number;
}

/**
 * Hook personalizado para observar cambios de tamaño en un elemento del DOM
 * con manejo de errores y límite de actualizaciones
 * 
 * @param options Opciones de configuración
 * @returns [ref, { width, height }]
 */
export function useResizeObserver<T extends HTMLElement = HTMLElement>(
  options: UseResizeObserverOptions = {}
) {
  const { debounceTime = 0 } = options;
  
  const elementRef = useRef<T | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Función para actualizar dimensiones con debounce
  const updateDimensions = (entries: ResizeObserverEntry[]) => {
    if (!entries[0]) return;
    
    const { width, height } = entries[0].contentRect;
    
    // Si las dimensiones no han cambiado, no hacer nada
    if (dimensions && dimensions.width === width && dimensions.height === height) {
      return;
    }
    
    // Limpiar timeout anterior si existe
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Aplicar debounce
    timeoutRef.current = setTimeout(() => {
      setDimensions({ width, height });
    }, debounceTime);
  };
  
  useEffect(() => {
    // Limpiar timeout al desmontar
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    try {
      // Crear observer solo si no existe
      if (!observerRef.current) {
        observerRef.current = new ResizeObserver((entries) => {
          // Usamos requestAnimationFrame para evitar actualizaciones excesivas
          window.requestAnimationFrame(() => {
            try {
              updateDimensions(entries);
            } catch (error) {
              console.error('Error en ResizeObserver callback:', error);
            }
          });
        });
      }
      
      // Observar elemento actual
      observerRef.current.observe(element);
      
      // Limpiar al desmontar
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    } catch (error) {
      console.error('Error al configurar ResizeObserver:', error);
      return undefined;
    }
  }, [debounceTime]);
  
  return [elementRef, dimensions] as const;
}
