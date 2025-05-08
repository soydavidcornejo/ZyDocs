'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SafeNavigationOptions {
  /**
   * Función que comprueba si hay cambios sin guardar
   */
  hasUnsavedChanges: boolean | (() => boolean);
  
  /**
   * Mensaje a mostrar cuando hay cambios sin guardar
   */
  confirmationMessage?: string;
}

interface NavigateOptions {
  shallow?: boolean;
}

/**
 * Hook para proporcionar navegación segura cuando hay cambios sin guardar
 */
export function useSafeNavigation({ 
  hasUnsavedChanges, 
  confirmationMessage = "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir? Tus cambios se perderán."
}: SafeNavigationOptions) {
  const router = useRouter();
  const { toast } = useToast();
  
  /**
   * Navega a una ruta, pero pide confirmación si hay cambios sin guardar
   */
  const navigateTo = useCallback((href: string, options?: NavigateOptions) => {
    // Determinar si hay cambios sin guardar
    const unsavedChanges = typeof hasUnsavedChanges === 'function' 
      ? hasUnsavedChanges() 
      : hasUnsavedChanges;
    
    // Por defecto, usar shallow=true para evitar recargas completas
    const shallowOption = options?.shallow !== undefined ? options.shallow : true;
    
    if (unsavedChanges) {
      // Mostrar confirmación
      if (window.confirm(confirmationMessage)) {
        console.log(`Navegando a ${href} (shallow: ${shallowOption})`);
        router.push(href, undefined, { shallow: shallowOption });
      } else {
        // El usuario canceló la navegación
        toast({
          title: "Navegación cancelada",
          description: "Tus cambios no guardados se mantienen.",
        });
      }
    } else {
      // No hay cambios sin guardar, navegar directamente con shallow=true por defecto
      console.log(`Navegando a ${href} (shallow: ${shallowOption})`);
      router.push(href, undefined, { shallow: shallowOption });
    }
  }, [router, hasUnsavedChanges, confirmationMessage, toast]);
  
  /**
   * Comprueba si es seguro navegar (devuelve true si es seguro)
   */
  const canNavigate = useCallback((): boolean => {
    const unsavedChanges = typeof hasUnsavedChanges === 'function' 
      ? hasUnsavedChanges() 
      : hasUnsavedChanges;
    
    if (unsavedChanges) {
      return window.confirm(confirmationMessage);
    }
    
    return true;
  }, [hasUnsavedChanges, confirmationMessage]);
  
  return { navigateTo, canNavigate };
}
