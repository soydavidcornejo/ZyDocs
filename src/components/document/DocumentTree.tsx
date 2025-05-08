// src/components/document/DocumentTree.tsx
"use client";
import type React from 'react';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { DocumentNode } from "@/types/document";
import { FileText, Folder, Dot, ChevronRight, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentTreeProps {
  nodes: DocumentNode[];
  level?: number;
  currentDocumentId?: string;
  onSelectDocument?: (id: string) => void;
  basePath: string; 
  expandedItems: string[]; 
  setExpandedItems: (items: string[]) => void; 
}

export const DocumentTree: React.FC<DocumentTreeProps> = ({ 
  nodes, 
  level = 0, 
  currentDocumentId, 
  onSelectDocument, 
  basePath,
  expandedItems,
  setExpandedItems,
}) => {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  const getIcon = (type: DocumentNode['type'], hasChildren: boolean) => {
    if (type === 'page' && hasChildren) {
      return <Folder className="h-4 w-4 flex-shrink-0 text-primary/70" />; 
    }
    switch (type) {
      case 'space': // This case might be obsolete if only 'page' type is used
        return <Folder className="h-4 w-4 flex-shrink-0 text-primary/70" />;
      case 'page':
        return <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
      default: 
        return <Dot className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
    }
  };
  
  const getItemValue = (node: DocumentNode) => `item-${node.id}`;

  const handleAccordionChange = (value: string[]) => {
    setExpandedItems(value);
  };

  return (
    <Accordion 
        type="multiple" 
        value={expandedItems} 
        onValueChange={handleAccordionChange} 
        className="w-full"
    >
      {nodes.map((node) => (
        <AccordionItem key={node.id} value={getItemValue(node)} className="border-none relative">
          {/* Línea vertical de indentación con gradiente */}
          {level > 0 && (
            <div 
              className="absolute left-0 top-0 bottom-0 border-l-2 border-dotted z-0 transition-all duration-300 ease-in-out" 
              style={{
                left: `${level * 12}px`, 
                height: '100%',
                borderColor: `hsla(var(--sidebar-border)/${0.8 - level * 0.1})`,
                borderLeftWidth: `${Math.max(1, 3 - level * 0.5)}px`
              }}
            />
          )}
          <AccordionTrigger 
            asChild={!!(node.children && node.children.length > 0)} // Pass asChild only if there are children
            className={cn(
              'relative py-1.5 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md text-sm',
              'justify-start group z-10 transition-all duration-200 ease-in-out',
              currentDocumentId === node.id ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground font-medium' : 'text-sidebar-foreground',
              level > 0 && `border-l-[2px] border-sidebar-accent/30 ml-${Math.min(level, 5)}`
            )}
            style={{
              paddingLeft: level > 0 ? `${(level * 16) + 8}px` : '8px',
            }}
          >
             <Link href={`${basePath}/${node.id}`} className="flex flex-1 items-center" onClick={onSelectDocument ? (e) => {
                  e.preventDefault();
                  onSelectDocument(node.id);
                } : undefined} shallow>
                {/* Icono del documento con indicador visual del nivel */}
                <div className="relative flex items-center">
                  {/* Marcadores de nivel (opcional) */}
                  {level > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 flex items-center">
                      {Array.from({length: Math.min(level, 3)}).map((_, i) => (
                        <ChevronsRight key={i} size={8} className="opacity-20 text-primary" />
                      ))}
                    </div>
                  )}
                  <div className={cn(
                    "relative flex items-center justify-center",
                    currentDocumentId === node.id ? "text-primary" : "text-muted-foreground",
                    level > 0 ? "ml-0" : ""
                  )}>
                    {getIcon(node.type, !!node.children && node.children.length > 0)}
                  </div>
                </div>
                <span className={cn(
                  "truncate flex-1 text-left ml-2",
                  node.children && node.children.length > 0 ? "font-medium" : "",
                  currentDocumentId === node.id ? "text-primary-foreground" : "text-sidebar-foreground"
                )}>{node.name}</span>
                {node.children && node.children.length > 0 && (
                  <ChevronRight 
                    size={14} 
                    className="transition-transform duration-200 text-muted-foreground group-data-[state=open]:rotate-90 opacity-70 group-hover:opacity-100" 
                  />
                )}
              </Link>
          </AccordionTrigger>
          {node.children && node.children.length > 0 && (
            <AccordionContent className="pl-0 pt-0 pb-0 animate-accordion-down">
              <DocumentTree 
                nodes={node.children} 
                level={level + 1} 
                currentDocumentId={currentDocumentId}
                onSelectDocument={onSelectDocument}
                basePath={basePath}
                expandedItems={expandedItems}
                setExpandedItems={setExpandedItems}
              />
            </AccordionContent>
          )}
        </AccordionItem>
      ))}
    </Accordion>
  );
};
