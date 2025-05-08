'use client';

import React, { useRef, useEffect, useState } from 'react';

interface SafeResizeObserverProps {
  children: React.ReactNode;
  onResize?: (width: number, height: number) => void;
  className?: string;
  strategy?: 'debounce' | 'throttle';
  delay?: number;
}

/**
 * Componente que envuelve un ResizeObserver con manejo seguro
 * para evitar ciclos infinitos de actualizaciones
 */
export function SafeResizeObserver({
  children,
  onResize,
  className,
  strategy = 'throttle',
  delay = 200,
}: SafeResizeObserverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const lastDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  // Configurar observer solo al montar
  useEffect(() => {
    // Solo continuar si hay una función onResize
    if (!onResize) return;

    try {
      // Función para procesar el cambio de tamaño
      const handleResize = (entries: ResizeObserverEntry[]) => {
        if (!entries[0]) return;
        
        const entry = entries[0];
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        
        // Verificar si las dimensiones han cambiado significativamente (al menos 5px)
        // Esto evita actualizaciones por cambios mínimos que no afectan al layout
        const significantChange = 
          !lastDimensionsRef.current ||
          Math.abs(lastDimensionsRef.current.width - width) >= 5 ||
          Math.abs(lastDimensionsRef.current.height - height) >= 5;
        
        if (!significantChange) {
          return;
        }
        
        // Guardar las dimensiones actuales
        lastDimensionsRef.current = { width, height };
        
        // Implementar estrategia según configuración
        if (strategy === 'debounce') {
          // Limpiar timeout anterior
          if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
          }
          
          // Crear nuevo timeout
          timeoutIdRef.current = setTimeout(() => {
            // Verificar que el componente sigue montado
            if (containerRef.current) {
              onResize(width, height);
            }
          }, delay);
        } else if (strategy === 'throttle') {
          const now = Date.now();
          if (now - lastUpdateTimeRef.current >= delay) {
            lastUpdateTimeRef.current = now;
            onResize(width, height);
          }
        }
      };
      
      // Si no hay observer, crearlo
      if (!observerRef.current && containerRef.current) {
        observerRef.current = new ResizeObserver((entries) => {
          // Usar requestAnimationFrame para evitar que ResizeObserver cause errores
          window.requestAnimationFrame(() => {
            try {
              handleResize(entries);
            } catch (err) {
              console.error('Error en ResizeObserver callback:', err);
              setError(err as Error);
              
              // Limpiar observer en caso de error
              if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
              }
            }
          });
        });
        
        // Comenzar a observar el contenedor
        observerRef.current.observe(containerRef.current);
      }

      // Limpiar al desmontar
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
      };
    } catch (err) {
      console.error('Error al inicializar ResizeObserver:', err);
      setError(err as Error);
      return () => {};
    }
  }, [onResize, strategy, delay]);

  return (
    <div ref={containerRef} className={className}>
      {error ? (
        <div className="p-2 text-sm text-red-500">
          Error en ResizeObserver: {error.message}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
