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
import { FileText, Building, Folder, ChevronRight, Dot } from 'lucide-react';

interface DocumentTreeProps {
  nodes: DocumentNode[];
  level?: number;
  currentDocumentId?: string;
  onSelectDocument?: (id: string) => void;
  basePath: string; // e.g., /organization/orgId/wiki
}

export const DocumentTree: React.FC<DocumentTreeProps> = ({ nodes, level = 0, currentDocumentId, onSelectDocument, basePath }) => {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  const getIcon = (type: DocumentNode['type']) => {
    switch (type) {
      case 'organization': // This type might not be used directly in organization-specific wikis
        return <Building className="h-4 w-4 mr-2 text-muted-foreground" />;
      case 'space':
        return <Folder className="h-4 w-4 mr-2 text-muted-foreground" />;
      case 'page':
        return <FileText className="h-4 w-4 mr-2 text-muted-foreground" />;
      default:
        return <Dot className="h-4 w-4 mr-2 text-muted-foreground" />;
    }
  };
  
  const getItemValue = (node: DocumentNode) => `item-${node.id}`;

  const getOpenItems = (nodesToScan: DocumentNode[], currentId?: string): string[] => {
    if (!currentId) return [];
    const path: string[] = [];
    
    function findPath(currentNode: DocumentNode, targetId: string): boolean {
      if (currentNode.id === targetId) {
        // If current node is the target, and it has children, it should be open.
        if(currentNode.children && currentNode.children.length > 0) path.push(getItemValue(currentNode));
        return true;
      }
      if (currentNode.children) {
        for (const child of currentNode.children) {
          if (findPath(child, targetId)) {
            // If a child path leads to target, current node (parent) should be open.
            path.push(getItemValue(currentNode));
            return true;
          }
        }
      }
      return false;
    }

    for (const node of nodesToScan) {
      if (findPath(node, currentId)) {
        break; 
      }
    }
    return path.reverse(); // Reverse to get parent -> child order for defaultValue
  };

  const openItems = getOpenItems(nodes, currentDocumentId);

  return (
    <Accordion type="multiple" defaultValue={openItems} className="w-full">
      {nodes.map((node) => (
        <AccordionItem key={node.id} value={getItemValue(node)} className="border-none">
          <AccordionTrigger 
            className={`py-1.5 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md text-sm 
            ${currentDocumentId === node.id && node.type === 'page' ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground' : 'text-sidebar-foreground'}
            ${level > 0 ? `pl-${(level * 2) + 2}` : ''}`}
            // onClick={node.type === 'page' && onSelectDocument ? () => onSelectDocument(node.id) : undefined}
            // asChild={node.type === 'page'} // Keep asChild only for link case
          >
            <Link href={`${basePath}/${node.id}`} className="flex flex-1 items-center justify-between" onClick={onSelectDocument ? () => onSelectDocument(node.id): undefined}>
              <span className="flex items-center">
                {getIcon(node.type)}
                {node.name}
              </span>
              {/* Chevron is part of AccordionTrigger by default if not asChild. We need it if children exist. */}
              {node.children && node.children.length > 0 && <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 accordion-chevron" />}
            </Link>
          </AccordionTrigger>
          {node.children && node.children.length > 0 && (
            <AccordionContent className="pl-0 pt-0 pb-0">
              <DocumentTree 
                nodes={node.children} 
                level={level + 1} 
                currentDocumentId={currentDocumentId}
                onSelectDocument={onSelectDocument}
                basePath={basePath}
              />
            </AccordionContent>
          )}
        </AccordionItem>
      ))}
    </Accordion>
  );
};
