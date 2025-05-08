'use client';

import { ReactNode, useRef, useMemo } from 'react';
import { SafeResizeObserver } from '@/components/SafeResizeObserver';
import {
  SidebarProvider,
} from '@/components/ui/sidebar';

interface WikiLayoutProps {
  children: ReactNode;
}

export default function WikiLayout({ children }: WikiLayoutProps) {
  // Utilizar una referencia para evitar regeneraciones y ciclos de actualización
  const stableRef = useRef({
    defaultOpen: true,
  }).current;
  
  // Usar useMemo para evitar recreación del componente y reducir rerenderizados
  const sidebarProviderContent = useMemo(() => {
    return (
      <SafeResizeObserver 
        className="h-full w-full"
        strategy="throttle"
        delay={500} // Aumentar el delay para reducir frecuencia de actualizaciones
      >
        <SidebarProvider defaultOpen={stableRef.defaultOpen}>
          {children}
        </SidebarProvider>
      </SafeResizeObserver>
    );
  }, [stableRef, children]);
  
  return sidebarProviderContent;
}
