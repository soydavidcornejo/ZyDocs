// src/app/docs/[...slug]/page.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentTree } from "@/components/document/DocumentTree";
import WysiwygEditor from "@/components/editor/WysiwygEditor";
import { initialDocumentsData, findDocument } from "@/config/docs";
import type { DocumentNode } from "@/types/document";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarInset, SidebarRail, SidebarFooter } from "@/components/ui/sidebar";
import { ThemeToggle } from '@/components/ThemeToggle'; // Assuming you might want theme toggle here too
import { Button } from '@/components/ui/button';
import { Save, PlusCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

// Helper to simulate saving content
const saveDocumentContent = async (documentId: string, content: string): Promise<boolean> => {
  console.log(`Saving content for document ${documentId}:`, content);
  // In a real app, this would be an API call.
  // For now, let's simulate a delay and success.
  await new Promise(resolve => setTimeout(resolve, 500));
  // Update mock data (this won't persist across reloads without a backend)
  const updateNodeContent = (nodes: DocumentNode[], id: string, newContent: string): boolean => {
    for (const node of nodes) {
      if (node.id === id) {
        node.content = newContent;
        return true;
      }
      if (node.children) {
        if (updateNodeContent(node.children, id, newContent)) return true;
      }
    }
    return false;
  };
  updateNodeContent(initialDocumentsData, documentId, content);
  return true;
};


export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  
  const [currentDocument, setCurrentDocument] = useState<DocumentNode | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [allDocuments, setAllDocuments] = useState<DocumentNode[]>(initialDocumentsData); // Manage state for documents

  const documentId = params.slug ? (Array.isArray(params.slug) ? params.slug[params.slug.length -1] : params.slug) : null;

  useEffect(() => {
    if (documentId) {
      const doc = findDocument(allDocuments, documentId);
      setCurrentDocument(doc);
      setEditedContent(doc?.content || '');
    } else if (allDocuments.length > 0 && allDocuments[0].children && allDocuments[0].children[0].children && allDocuments[0].children[0].children[0]) {
      // Default to the first page of the first space of the first org if no ID
      const firstPageId = allDocuments[0].children[0].children[0].id;
      router.push(`/docs/${firstPageId}`);
    }
  }, [documentId, allDocuments, router]);

  const handleContentChange = useCallback((content: string) => {
    setEditedContent(content);
  }, []);

  const handleSaveContent = async () => {
    if (currentDocument) {
      const success = await saveDocumentContent(currentDocument.id, editedContent);
      if (success) {
        // Update the document in the local state
        const updatedDocuments = allDocuments.map(org => ({
          ...org,
          children: org.children?.map(space => ({
            ...space,
            children: space.children?.map(page => 
              page.id === currentDocument.id ? { ...page, content: editedContent } : page
            )
          }))
        }));
        setAllDocuments(updatedDocuments);
        setCurrentDocument(prev => prev ? {...prev, content: editedContent} : null);

        toast({
          title: "Content Saved",
          description: `Changes to "${currentDocument.name}" have been saved.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Error Saving",
          description: "Could not save changes. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSelectDocument = (id: string) => {
     if (currentDocument && editedContent !== currentDocument.content) {
      if(confirm("You have unsaved changes. Are you sure you want to navigate away? Your changes will be lost.")) {
        router.push(`/docs/${id}`);
      }
    } else {
      router.push(`/docs/${id}`);
    }
  };
  
  const getBreadcrumbs = (docId: string | null): DocumentNode[] => {
    if (!docId) return [];
    const path: DocumentNode[] = [];
    
    function findPath(nodes: DocumentNode[], targetId: string): boolean {
      for (const node of nodes) {
        if (node.id === targetId) {
          path.unshift(node);
          return true;
        }
        if (node.children) {
          if (findPath(node.children, targetId)) {
            path.unshift(node);
            return true;
          }
        }
      }
      return false;
    }

    findPath(allDocuments, docId);
    return path;
  };

  const breadcrumbs = getBreadcrumbs(currentDocument?.id || null);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader>
            <div className="flex items-center justify-between w-full">
               <h2 className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                Navigation
              </h2>
              <SidebarTrigger className="md:hidden" />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <ScrollArea className="h-full px-2">
              <DocumentTree 
                nodes={allDocuments} 
                currentDocumentId={currentDocument?.id}
                onSelectDocument={handleSelectDocument}
              />
            </ScrollArea>
          </SidebarContent>
          <SidebarFooter className="group-data-[collapsible=icon]:hidden">
            <Button variant="outline" size="sm" className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> New Page
            </Button>
          </SidebarFooter>
        </Sidebar>
        <SidebarRail />

        <SidebarInset>
          <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-8">
              {currentDocument && currentDocument.type === 'page' ? (
                <Card className="w-full shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground mb-1">
                          {breadcrumbs.map((crumb, index) => (
                            <span key={crumb.id}>
                              <Button variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-primary" onClick={() => handleSelectDocument(crumb.id)}>
                                {crumb.name}
                              </Button>
                              {index < breadcrumbs.length - 1 && ' / '}
                            </span>
                          ))}
                        </div>
                        <CardTitle className="text-3xl font-bold">{currentDocument.name}</CardTitle>
                        <CardDescription>
                          Last updated: {new Date().toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Button onClick={handleSaveContent} disabled={editedContent === currentDocument.content}>
                        <Save className="mr-2 h-4 w-4" /> Save Changes
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <WysiwygEditor
                      key={currentDocument.id} // Force re-render on document change
                      initialContent={currentDocument.content || ''}
                      onContentChange={handleContentChange}
                    />
                  </CardContent>
                </Card>
              ) : (
                 <Card className="w-full shadow-md">
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      {currentDocument ? currentDocument.name : "Select a document"}
                    </CardTitle>
                     {currentDocument && (
                      <Badge variant="secondary" className="w-fit">{currentDocument.type.toUpperCase()}</Badge>
                     )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {currentDocument 
                        ? `This is ${currentDocument.type === 'organization' ? 'an organization' : 'a space'}. Select a page from the sidebar to view or edit content.`
                        : "Please select a document from the sidebar to get started or create a new one."}
                    </p>
                    {currentDocument && currentDocument.children && currentDocument.children.length > 0 && (
                       <div className="mt-4">
                          <h3 className="text-lg font-semibold mb-2">
                            {currentDocument.type === 'organization' ? 'Spaces:' : 'Pages:'}
                          </h3>
                          <ul className="list-disc list-inside">
                            {currentDocument.children.map(child => (
                              <li key={child.id}>
                                <Button variant="link" onClick={() => handleSelectDocument(child.id)} className="p-0 h-auto">
                                  {child.name}
                                </Button>
                              </li>
                            ))}
                          </ul>
                       </div>
                    )}
                  </CardContent>
                 </Card>
              )}
            </div>
          </ScrollArea>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
