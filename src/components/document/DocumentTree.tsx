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
import { FileText, Folder, ChevronRight, Dot } from 'lucide-react'; // Removed Building icon

interface DocumentTreeProps {
  nodes: DocumentNode[];
  level?: number;
  currentDocumentId?: string;
  onSelectDocument?: (id: string) => void;
  basePath: string; 
  expandedItems: string[]; // State for expanded items
  setExpandedItems: (items: string[]) => void; // Function to update expanded items
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
      return <Folder className="h-4 w-4 mr-2 text-muted-foreground" />; // Page acting as container
    }
    switch (type) {
      case 'space': // 'space' type might represent a container page. Visually a folder.
        return <Folder className="h-4 w-4 mr-2 text-muted-foreground" />;
      case 'page':
        return <FileText className="h-4 w-4 mr-2 text-muted-foreground" />;
      default: // Should not happen for 'page' or 'space'
        return <Dot className="h-4 w-4 mr-2 text-muted-foreground" />;
    }
  };
  
  const getItemValue = (node: DocumentNode) => `item-${node.id}`;

  const handleAccordionChange = (value: string[]) => {
    setExpandedItems(value);
  };

  // Determine initially open items for the current path. This should only run on initial mount or when currentDocumentId changes significantly.
  // The expandedItems state now handles persistence.
  React.useEffect(() => {
    if (currentDocumentId) {
      const path: string[] = [];
      function findPath(nodesToScan: DocumentNode[], targetId: string): boolean {
        for (const node of nodesToScan) {
          if (node.id === targetId) {
            if (node.parentId) { // Add parent to path if it exists
              path.push(getItemValue({ id: node.parentId } as DocumentNode)); // Simplified for getItemValue
              // Recursively find path for parent to open all ancestors
              const parentNode = nodes.find(n => n.id === node.parentId); // Requires flat list or different tree traversal
              if (parentNode) findPath(nodes, parentNode.id); // This needs adjustment if 'nodes' is not flat list here
            }
            return true;
          }
          if (node.children && findPath(node.children, targetId)) {
            path.push(getItemValue(node));
            return true;
          }
        }
        return false;
      }
      
      // To open ancestors, we need to traverse the tree structure passed (nodes)
      // This logic might be simplified if buildDocumentTree also marks path to current node.
      if(findPath(nodes, currentDocumentId)){
         setExpandedItems(prev => {
           const newItems = [...new Set([...prev, ...path.reverse()])];
           return newItems;
         });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocumentId, nodes]); // Note: `nodes` in deps might cause re-runs if tree structure changes.


  return (
    <Accordion 
        type="multiple" 
        value={expandedItems} // Controlled component
        onValueChange={handleAccordionChange} // Update state on change
        className="w-full"
    >
      {nodes.map((node) => (
        <AccordionItem key={node.id} value={getItemValue(node)} className="border-none">
          <AccordionTrigger 
            className={`py-1.5 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md text-sm 
            ${currentDocumentId === node.id ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground' : 'text-sidebar-foreground'}
            ${level > 0 ? `pl-${(level * 2) + 2}` : ''}
            justify-start group`} // `group` for chevron visibility
            // No asChild, let AccordionTrigger render its own button structure for better accessibility & control
          >
             <Link href={`${basePath}/${node.id}`} className="flex flex-1 items-center" onClick={onSelectDocument ? () => onSelectDocument(node.id): undefined}>
                {getIcon(node.type, !!node.children && node.children.length > 0)}
                <span className="truncate flex-1 text-left">{node.name}</span>
              </Link>
              {/* Chevron should be managed by AccordionTrigger internally when not asChild */}
              {/* If custom chevron is needed, place it outside the Link but inside Trigger */}
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

