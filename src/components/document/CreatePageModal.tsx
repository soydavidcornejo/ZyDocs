// src/components/document/CreatePageModal.tsx
'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createDocumentInFirestore } from '@/lib/firebase/firestore/documents';
import type { DocumentNode } from '@/types/document';
import { Loader2 } from 'lucide-react';

interface CreatePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  allDocuments: DocumentNode[]; // Flat list of all documents in the org for parent selection
  onPageCreated: (newPageId?: string) => void; // Callback after page is created, passes new page ID
  initialParentId?: string | null; // Optional: pre-select a parent
}

const NO_PARENT_VALUE = "__NO_PARENT_SELECTED__"; // Unique value for the "No Parent" option

export const CreatePageModal: React.FC<CreatePageModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  allDocuments, // This should be the hierarchical tree if used directly for display, or flat for logic
  onPageCreated,
  initialParentId = null,
}) => {
  const [pageName, setPageName] = useState('');
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // The `allDocuments` prop here is used for selecting a parent.
  // It should be a flat list of documents that can be parents.
  const parentPageOptions = allDocuments
    .filter(doc => doc.type === 'page') // Ensure only pages can be parents
    .sort((a, b) => a.name.localeCompare(b.name));
    
  // Función para construir la ruta completa de un documento
  const getDocumentPath = (docId: string): string => {
    const paths: string[] = [];
    let currentDocId = docId;
    let loopGuard = 0; // Prevenir bucles infinitos
    
    while (currentDocId && loopGuard < 10) {
      const doc = allDocuments.find(d => d.id === currentDocId);
      if (!doc) break;
      
      paths.unshift(doc.name);
      currentDocId = doc.parentId || '';
      loopGuard++;
    }
    
    return `"/${paths.join('/')}"`;  // Cambiado para usar el formato solicitado
  };


  useEffect(() => {
    if (isOpen) {
      setPageName('');
      setParentId(initialParentId); // Reset form when modal opens
    }
  }, [isOpen, initialParentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageName.trim()) {
      toast({ title: 'Validation Error', description: 'Page name cannot be empty.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      // Determine order for the new page based on actual flat list.
      // `allDocuments` passed to the modal should be the flat list from OrganizationWikiPageComponent.
      const flatListOfAllDocs = allDocuments; // Assuming this is the flat list.
      const siblings = flatListOfAllDocs.filter(doc => doc.parentId === parentId);
      const order = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) + 1 : 0;

      const newPage = await createDocumentInFirestore(
        pageName.trim(),
        parentId, 
        organizationId,
        order,
        `# ${pageName.trim()}\n\nStart writing here...`
      );
      toast({ title: 'Page Created', description: `Page "${newPage.name}" created successfully.` });
      onPageCreated(newPage.id); // Pass the new page ID
      onClose();
    } catch (error) {
      console.error("Error creating page:", error);
      toast({ title: 'Error', description: 'Failed to create page.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Page</DialogTitle>
          <DialogDescription>
            Enter a name for your new page and optionally select a parent page to nest it under.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pageName" className="text-right">
                Page Name
              </Label>
              <Input
                id="pageName"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Project Overview"
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parentId" className="text-right">
                Parent Page
              </Label>
              <Select
                value={parentId === null ? NO_PARENT_VALUE : parentId}
                onValueChange={(value) => setParentId(value === NO_PARENT_VALUE ? null : value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT_VALUE}>
                    <em>No Parent (Root Level)</em>
                  </SelectItem>
                  {parentPageOptions.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <span className="text-muted-foreground font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                        {getDocumentPath(doc.id)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Creating...' : 'Create Page'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

