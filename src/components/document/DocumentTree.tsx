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
import { FileText, Folder, ChevronRight, Dot } from 'lucide-react'; 

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
      return <Folder className="h-4 w-4 mr-2 text-muted-foreground" />; 
    }
    switch (type) {
      case 'space': 
        return <Folder className="h-4 w-4 mr-2 text-muted-foreground" />;
      case 'page':
        return <FileText className="h-4 w-4 mr-2 text-muted-foreground" />;
      default: 
        return <Dot className="h-4 w-4 mr-2 text-muted-foreground" />;
    }
  };
  
  const getItemValue = (node: DocumentNode) => `item-${node.id}`;

  const handleAccordionChange = (value: string[]) => {
    setExpandedItems(value);
  };

  // Removed internal useEffect for ancestor expansion as it's now handled by the parent component.

  return (
    <Accordion 
        type="multiple" 
        value={expandedItems} 
        onValueChange={handleAccordionChange} 
        className="w-full"
    >
      {nodes.map((node) => (
        <AccordionItem key={node.id} value={getItemValue(node)} className="border-none">
          <AccordionTrigger 
            className={`py-1.5 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md text-sm 
            ${currentDocumentId === node.id ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground' : 'text-sidebar-foreground'}
            ${level > 0 ? `pl-${(level * 2) + 2}` : ''}
            justify-start group`} 
          >
             <Link href={`${basePath}/${node.id}`} className="flex flex-1 items-center" onClick={onSelectDocument ? () => onSelectDocument(node.id): undefined}>
                {getIcon(node.type, !!node.children && node.children.length > 0)}
                <span className="truncate flex-1 text-left">{node.name}</span>
              </Link>
              {node.children && node.children.length > 0 && (
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90 ml-auto" />
              )}
          </AccordionTrigger>
          {node.children && node.children.length > 0 && (
            <AccordionContent className="pl-0 pt-0 pb-0">
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

