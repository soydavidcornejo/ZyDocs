// src/app/docs/[...slug]/page.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card';
import { DocumentTree } from "@/components/document/DocumentTree";
import WysiwygEditor from "@/components/editor/WysiwygEditor";
import { initialDocumentsData, findDocument } from "@/config/docs";
import type { DocumentNode } from "@/types/document";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarInset, SidebarRail, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { Save, PlusCircle, Edit, XCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

// Helper to simulate saving content
const saveDocumentContent = async (documentId: string, content: string): Promise<boolean> => {
  console.log(`Saving content for document ${documentId}:`, content);
  // In a real app, this would be an API call.
  // For now, let's simulate a delay and success.
  await new Promise(resolve => setTimeout(resolve, 500));
  
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
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  
  const [currentDocument, setCurrentDocument] = useState<DocumentNode | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [allDocuments, setAllDocuments] = useState<DocumentNode[]>(initialDocumentsData);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const documentId = params.slug ? (Array.isArray(params.slug) ? params.slug[params.slug.length -1] : params.slug) : null;
  const currentPath = `/docs/${documentId || 'org1'}`;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [currentUser, authLoading, router, currentPath]);

  useEffect(() => {
    if (currentUser) { // Only process document logic if user is authenticated
      if (documentId) {
        const doc = findDocument(allDocuments, documentId);
        setCurrentDocument(doc);
        if (doc) {
          setEditedContent(doc.content || '');
        }
        setIsEditing(false); // Reset to view mode when document changes
      } else if (allDocuments.length > 0 && allDocuments[0]?.children?.[0]?.children?.[0]) {
        const firstPageId = allDocuments[0].children[0].children[0].id;
        router.push(`/docs/${firstPageId}`);
      }
    }
  }, [documentId, allDocuments, router, currentUser]);

  const handleContentChange = useCallback((content: string) => {
    setEditedContent(content);
  }, []);

  const handleSaveContent = async () => {
    if (currentDocument) {
      setIsSaving(true);
      const success = await saveDocumentContent(currentDocument.id, editedContent);
      setIsSaving(false);
      if (success) {
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
        setIsEditing(false); // Switch back to view mode

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
  
  const handleCancelEdit = () => {
    if (currentDocument) {
      setEditedContent(currentDocument.content || ''); // Reset to original content
    }
    setIsEditing(false);
    toast({
      title: "Editing Cancelled",
      description: "Your changes have been discarded.",
      variant: "default",
    });
  };

  const handleSelectDocument = (id: string) => {
     if (isEditing && currentDocument && editedContent !== currentDocument.content) {
      if(confirm("You have unsaved changes. Are you sure you want to navigate away? Your changes will be lost.")) {
        setIsEditing(false); // Reset editing state before navigating
        setEditedContent(currentDocument.content || ''); // Revert changes
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

  if (authLoading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading documents...</span></div>;
  }

  if (!currentUser) {
    // This is mainly a fallback, the useEffect should redirect.
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting to login...</div>;
  }

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'editor';

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-[calc(100vh-4rem)]"> {/* Ensure full height below header */}
        <Sidebar collapsible="icon" className="border-r"> {/* Sidebar will be positioned by its own fixed logic */}
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
          {canEdit && ( 
            <SidebarFooter className="group-data-[collapsible=icon]:hidden">
              <Button variant="outline" size="sm" className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> New Page
              </Button>
            </SidebarFooter>
          )}
        </Sidebar>
        <SidebarRail />

        <SidebarInset>
          <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-8">
              {currentDocument && currentDocument.type === 'page' ? (
                <Card className="w-full shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1 flex-grow">
                        <div className="text-sm text-muted-foreground mb-1 flex flex-wrap items-center">
                          {breadcrumbs.map((crumb, index) => (
                            <span key={crumb.id} className="flex items-center">
                              <Button variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-primary" onClick={() => handleSelectDocument(crumb.id)}>
                                {crumb.name}
                              </Button>
                              {index < breadcrumbs.length - 1 && <span className="mx-1">/</span>}
                            </span>
                          ))}
                        </div>
                        <CardTitle className="text-3xl font-bold">{currentDocument.name}</CardTitle>
                        <CardDescription>
                          Last updated: {new Date().toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {canEdit && (
                        <div className="flex items-center space-x-2 ml-auto shrink-0 self-start sm:self-center">
                          {isEditing ? (
                            <>
                              <Button onClick={handleSaveContent} disabled={!currentDocument || editedContent === currentDocument.content || isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {isSaving ? "Saving..." : "Save"}
                              </Button>
                              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                                <XCircle className="mr-2 h-4 w-4" /> Cancel
                              </Button>
                            </>
                          ) : (
                            <Button onClick={() => {
                              if (currentDocument) { 
                                setEditedContent(currentDocument.content || '');
                                setIsEditing(true);
                              }
                            }}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isEditing && canEdit ? (
                      <WysiwygEditor
                        key={currentDocument.id} 
                        initialContent={editedContent}
                        onContentChange={handleContentChange}
                      />
                    ) : (
                      <article className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none py-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentDocument.content || `*No content yet.${canEdit ? " Click 'Edit' to start writing." : "" }*`}
                        </ReactMarkdown>
                      </article>
                    )}
                    {!canEdit && isEditing && ( // Show read-only view if user loses edit rights while editing
                       <article className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none py-4">
                        <p className="text-destructive">You no longer have permission to edit this document. Displaying read-only content.</p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentDocument.content || "*No content yet.*"}
                        </ReactMarkdown>
                      </article>
                    )}
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
                     {!currentDocument && (
                        <div className="mt-6 text-center">
                            <Loader2 className="mx-auto h-12 w-12 text-primary/50 animate-spin mb-4" />
                            <p className="text-muted-foreground">Loading document structure...</p>
                            <p className="text-sm text-muted-foreground">If this persists, try refreshing or selecting a document from the sidebar.</p>
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
