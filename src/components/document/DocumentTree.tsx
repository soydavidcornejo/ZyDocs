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
}

export const DocumentTree: React.FC<DocumentTreeProps> = ({ nodes, level = 0, currentDocumentId, onSelectDocument }) => {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  const getIcon = (type: DocumentNode['type']) => {
    switch (type) {
      case 'organization':
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

  const getOpenItems = (nodes: DocumentNode[], currentId?: string): string[] => {
    if (!currentId) return [];
    const path: string[] = [];
    
    function findPath(currentNode: DocumentNode, targetId: string): boolean {
      if (currentNode.id === targetId) {
        if(currentNode.children && currentNode.children.length > 0) path.push(getItemValue(currentNode));
        return true;
      }
      if (currentNode.children) {
        for (const child of currentNode.children) {
          if (findPath(child, targetId)) {
            path.push(getItemValue(currentNode));
            return true;
          }
        }
      }
      return false;
    }

    for (const node of nodes) {
      if (findPath(node, currentId)) {
        break;
      }
    }
    return path.reverse();
  };

  const openItems = getOpenItems(nodes, currentDocumentId);


  return (
    <Accordion type="multiple" defaultValue={openItems} className="w-full">
      {nodes.map((node) => (
        <AccordionItem key={node.id} value={getItemValue(node)} className="border-none">
          <AccordionTrigger 
            className={`py-2 px-2 hover:bg-accent hover:text-accent-foreground rounded-md text-sm 
            ${currentDocumentId === node.id && node.type === 'page' ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}
            ${level > 0 ? `pl-${(level * 2) + 2}` : ''}`}
            onClick={node.type === 'page' && onSelectDocument ? () => onSelectDocument(node.id) : undefined}
            asChild={node.type === 'page'}
          >
            {node.type === 'page' ? (
              <Link href={`/docs/${node.id}`} className="flex flex-1 items-center justify-between">
                <span className="flex items-center">
                  {getIcon(node.type)}
                  {node.name}
                </span>
                {node.children && node.children.length > 0 && <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 accordion-chevron" />}
              </Link>
            ) : (
              <span className="flex items-center">
                {getIcon(node.type)}
                {node.name}
              </span>
            )}
          </AccordionTrigger>
          {node.children && node.children.length > 0 && (
            <AccordionContent className="pl-0 pt-0 pb-0">
               {/* Custom styling for nested accordion to avoid double border or padding issues */}
              <DocumentTree 
                nodes={node.children} 
                level={level + 1} 
                currentDocumentId={currentDocumentId}
                onSelectDocument={onSelectDocument}
              />
            </AccordionContent>
          )}
        </AccordionItem>
      ))}
    </Accordion>
  );
};
