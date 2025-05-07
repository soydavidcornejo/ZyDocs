// src/app/docs/[...slug]/page.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentTree } from "@/components/document/DocumentTree";
import WysiwygEditor from "@/components/editor/WysiwygEditor";
import { buildDocumentTree, findDocumentInList } from "@/config/docs"; // Use buildDocumentTree
import type { DocumentNode } from "@/types/document";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarInset, SidebarRail, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { Save, PlusCircle, Edit, XCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp, query, orderBy, type Timestamp } from 'firebase/firestore';

const saveDocumentContentToFirestore = async (documentId: string, content: string): Promise<boolean> => {
  console.log(`Saving content for document ${documentId} to Firestore:`, content);
  try {
    const docRef = doc(db, 'documents', documentId);
    await updateDoc(docRef, { 
      content: content,
      updatedAt: serverTimestamp() 
    });
    return true;
  } catch (error) {
    console.error("Error saving document content to Firestore:", error);
    return false;
  }
};


export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  
  const [currentDocument, setCurrentDocument] = useState<DocumentNode | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [flatDocumentsList, setFlatDocumentsList] = useState<DocumentNode[]>([]); // Stores flat list from Firestore
  const [documentTree, setDocumentTree] = useState<DocumentNode[]>([]); // Stores the built tree
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(true);

  const documentId = params.slug ? (Array.isArray(params.slug) ? params.slug[params.slug.length -1] : params.slug) : null;
  const currentPath = `/docs/${documentId || ''}`; // Default to empty if no docId initially

  // Fetch all documents from Firestore on mount
  useEffect(() => {
    if (currentUser) { // Only fetch if user is authenticated
      const fetchDocs = async () => {
        setLoadingDocuments(true);
        try {
          const docsCollection = collection(db, 'documents');
          // Optional: order by a specific field like 'order' or 'name'
          const q = query(docsCollection, orderBy("parentId"), orderBy("order", "asc"), orderBy("name", "asc"));
          const snapshot = await getDocs(q);
          const docsList = snapshot.docs.map(docData => {
            const data = docData.data() as Omit<DocumentNode, 'id'>;
            const createdAt = data.createdAt && (data.createdAt as unknown as Timestamp).toDate ? (data.createdAt as unknown as Timestamp).toDate() : undefined;
            const updatedAt = data.updatedAt && (data.updatedAt as unknown as Timestamp).toDate ? (data.updatedAt as unknown as Timestamp).toDate() : undefined;
            
            return { 
              ...data, 
              id: docData.id,
              createdAt,
              updatedAt,
            } as DocumentNode;
          });
          setFlatDocumentsList(docsList);
          setDocumentTree(buildDocumentTree(docsList));
        } catch (error) {
          console.error("Error fetching documents:", error);
          toast({ title: "Error", description: "Could not load documents.", variant: "destructive" });
        } finally {
          setLoadingDocuments(false);
        }
      };
      fetchDocs();
    }
  }, [currentUser, toast]);


  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [currentUser, authLoading, router, currentPath]);

  useEffect(() => {
    if (currentUser && flatDocumentsList.length > 0) { 
      if (documentId) {
        const doc = findDocumentInList(flatDocumentsList, documentId);
        setCurrentDocument(doc);
        if (doc) {
          setEditedContent(doc.content || '');
        }
        const userCanEdit = currentUser.role === 'admin' || currentUser.role === 'editor';
        setIsEditing(searchParams.get('edit') === 'true' && userCanEdit);
      } else if (documentTree.length > 0 && documentTree[0]?.children?.[0]?.children?.[0]) {
        // Default to first actual page if no docId
        const firstPage = documentTree[0].children[0].children[0];
        if(firstPage && firstPage.type === 'page') {
          router.push(`/docs/${firstPage.id}`);
        } else if (documentTree[0]?.children?.[0]?.id) { // Fallback to first space if no page
           router.push(`/docs/${documentTree[0].children[0].id}`);
        } else if (documentTree[0]?.id) { // Fallback to first org
           router.push(`/docs/${documentTree[0].id}`);
        }
      } else if (flatDocumentsList.length > 0 && !documentId) {
         // If tree is empty but flat list has items, pick the first org/space/page as default
        const defaultDoc = flatDocumentsList.find(d => d.type === 'organization') || flatDocumentsList[0];
        if (defaultDoc) router.push(`/docs/${defaultDoc.id}`);
      }
    }
  }, [documentId, flatDocumentsList, documentTree, router, currentUser, searchParams]);

  const handleContentChange = useCallback((content: string) => {
    setEditedContent(content);
  }, []);

  const handleSaveContent = async () => {
    if (currentDocument && canEdit) {
      setIsSaving(true);
      const success = await saveDocumentContentToFirestore(currentDocument.id, editedContent);
      setIsSaving(false);
      if (success) {
        // Update local state to reflect saved content and timestamp
        const updatedFlatList = flatDocumentsList.map(doc =>
          doc.id === currentDocument.id ? { ...doc, content: editedContent, updatedAt: new Date() } : doc
        );
        setFlatDocumentsList(updatedFlatList);
        setDocumentTree(buildDocumentTree(updatedFlatList)); // Rebuild tree if necessary
        setCurrentDocument(prev => prev ? {...prev, content: editedContent, updatedAt: new Date()} : null);
        
        router.push(`/docs/${currentDocument.id}`, { scroll: false });
        setIsEditing(false);

        toast({
          title: "Content Saved",
          description: `Changes to "${currentDocument.name}" have been saved to Firestore.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Error Saving",
          description: "Could not save changes to Firestore. Please try again.",
          variant: "destructive",
        });
      }
    }
  };
  
  const handleEnterEditMode = () => {
    if (canEdit) {
      router.push(`/docs/${documentId}?edit=true`, { scroll: false });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    if (currentDocument) {
      setEditedContent(currentDocument.content || ''); 
    }
    router.push(`/docs/${documentId}`, { scroll: false }); 
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
        router.push(`/docs/${id}`); 
        setIsEditing(false); 
      }
    } else {
      router.push(`/docs/${id}`);
      setIsEditing(false); 
    }
  };
  
  const getBreadcrumbs = (docId: string | null, docs: DocumentNode[]): DocumentNode[] => {
    if (!docId) return [];
    const path: DocumentNode[] = [];
    let currentDoc = findDocumentInList(docs, docId);
    while(currentDoc) {
      path.unshift(currentDoc);
      currentDoc = currentDoc.parentId ? findDocumentInList(docs, currentDoc.parentId) : null;
    }
    return path;
  };

  const breadcrumbs = getBreadcrumbs(currentDocument?.id || null, flatDocumentsList);

  if (authLoading || loadingDocuments) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading documents...</span></div>;
  }

  if (!currentUser) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting to login...</div>;
  }

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'editor';
  const displayDate = currentDocument?.updatedAt || currentDocument?.createdAt;

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar collapsible="icon" className="border-r fixed h-full z-20 pt-16">
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
              {documentTree.length > 0 ? (
                <DocumentTree 
                  nodes={documentTree} 
                  currentDocumentId={currentDocument?.id}
                  onSelectDocument={handleSelectDocument}
                />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">No documents found or still loading.</p>
              )}
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
        <SidebarRail className="fixed z-20 top-16" /> 

        <SidebarInset className="ml-[var(--sidebar-width)] group-data-[sidebar-state=collapsed]:ml-[var(--sidebar-width-icon)] transition-[margin-left] duration-200 ease-linear">
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
                        {displayDate && (
                            <CardDescription>
                                Last updated: {new Date(displayDate).toLocaleDateString()}
                            </CardDescription>
                        )}
                      </div>
                       {canEdit && (
                        <div className="flex items-center space-x-2 ml-auto shrink-0 self-start sm:self-center">
                          {isEditing ? (
                            <>
                              <Button onClick={handleSaveContent} disabled={isSaving || (currentDocument && editedContent === currentDocument.content)}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {isSaving ? "Saving..." : "Save"}
                              </Button>
                              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                                <XCircle className="mr-2 h-4 w-4" /> Cancel
                              </Button>
                            </>
                          ) : (
                            <Button onClick={handleEnterEditMode}>
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
                          {currentDocument.content || `*No content yet.${canEdit ? " Click 'Edit' to start." : "" }*`}
                        </ReactMarkdown>
                        {!currentDocument.content && !canEdit && <p className="mt-4 text-muted-foreground">This page is empty.</p>}
                        {!currentDocument.content && canEdit && !isEditing && 
                          <Button onClick={handleEnterEditMode} variant="outline" className="mt-4">
                            <Edit className="mr-2 h-4 w-4" /> Start Editing
                          </Button>
                        }
                      </article>
                    )}
                     {!canEdit && isEditing && ( 
                       <article className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none py-4">
                        <p className="text-destructive">You do not have permission to edit this document. Displaying read-only content.</p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentDocument.content || "*No content yet.*"}
                        </ReactMarkdown>
                      </article>
                    )}
                  </CardContent>
                </Card>
              ) : currentDocument ? ( // For org or space nodes
                 <Card className="w-full shadow-md">
                  <CardHeader>
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
                    <CardTitle className="text-2xl">{currentDocument.name}</CardTitle>
                    <Badge variant="secondary" className="w-fit">{currentDocument.type.toUpperCase()}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {`This is ${currentDocument.type === 'organization' ? 'an organization' : 'a space'}. Select an item from the sidebar to view or edit content.`}
                    </p>
                    {currentDocument && (
                      (flatDocumentsList.filter(d => d.parentId === currentDocument.id).length > 0) ? (
                       <div className="mt-4">
                          <h3 className="text-lg font-semibold mb-2">
                            {currentDocument.type === 'organization' ? 'Spaces:' : 'Pages:'}
                          </h3>
                          <ul className="list-disc list-inside">
                            {flatDocumentsList.filter(d => d.parentId === currentDocument.id)
                              .sort((a,b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
                              .map(child => (
                              <li key={child.id}>
                                <Button variant="link" onClick={() => handleSelectDocument(child.id)} className="p-0 h-auto">
                                  {child.name}
                                </Button>
                              </li>
                            ))}
                          </ul>
                       </div>
                    ) : (
                      <p className="mt-4 text-muted-foreground">This {currentDocument.type} is empty.</p>
                    )
                   )}
                  </CardContent>
                 </Card>
              ) : ( // No document selected or found
                <Card className="w-full shadow-md">
                  <CardHeader><CardTitle>No Document Selected</CardTitle></CardHeader>
                  <CardContent>
                  <div className="mt-6 text-center">
                      <Loader2 className="mx-auto h-12 w-12 text-primary/50 animate-spin mb-4" />
                      <p className="text-muted-foreground">Please select a document from the sidebar.</p>
                      <p className="text-sm text-muted-foreground">If the sidebar is empty, your organization may not have any documents yet.</p>
                  </div>
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
