// src/app/docs/[...slug]/page.tsx
"use client";

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentTree } from "@/components/document/DocumentTree";
import WysiwygEditor from "@/components/editor/WysiwygEditor";
import { buildDocumentTree, findDocumentInList } from "@/config/docs";
import type { DocumentNode } from "@/types/document";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarInset, SidebarRail, SidebarFooter } from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Save, PlusCircle, Edit, XCircle, Loader2, Building, FilePlus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { createDocumentInFirestore, getDocumentsForOrganization } from '@/lib/firebase/firestore/documents';

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
  const { currentUser, loading: authLoading, requiresOrganizationCreation } = useAuth();
  
  const [currentDocument, setCurrentDocument] = useState<DocumentNode | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [flatDocumentsList, setFlatDocumentsList] = useState<DocumentNode[]>([]);
  const [documentTree, setDocumentTree] = useState<DocumentNode[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(true);

  const [isCreatePageDialogOpen, setIsCreatePageDialogOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [isCreatingPage, setIsCreatingPage] = useState(false);


  const documentIdFromRoute = params.slug ? (Array.isArray(params.slug) ? params.slug[params.slug.length -1] : params.slug) : null;
  const currentPath = `/docs/${documentIdFromRoute || ''}`; 

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      } else if (requiresOrganizationCreation) {
        router.push('/create-organization');
      } else if (!currentUser.currentOrganizationId) {
        toast({ title: "No Organization Selected", description: "Please select an organization from the '/organizations' page.", variant: "default"});
        router.push('/organizations'); 
      }
    }
  }, [currentUser, authLoading, requiresOrganizationCreation, router, currentPath, toast]);

  useEffect(() => {
    if (currentUser && currentUser.currentOrganizationId && !requiresOrganizationCreation) {
      const fetchDocs = async () => {
        setLoadingDocuments(true);
        try {
          const docsList = await getDocumentsForOrganization(currentUser.currentOrganizationId!);
          setFlatDocumentsList(docsList);
          const tree = buildDocumentTree(docsList);
          setDocumentTree(tree);

          if (!documentIdFromRoute && tree.length > 0) {
            // Default to the organization node or first available page.
            const orgNode = tree.find(n => n.id === currentUser.currentOrganizationId && n.type === 'organization');
            if (orgNode) {
               router.push(`/docs/${orgNode.id}`);
            } else if (tree[0]?.id) { 
               router.push(`/docs/${tree[0].id}`);
            }
          } else if (documentIdFromRoute && !docsList.find(d => d.id === documentIdFromRoute)) {
            // If route ID is invalid for current org, redirect to org root or first doc
             toast({ title: "Document Not Found", description: "The requested document does not exist in this organization or you don't have access.", variant: "destructive" });
             const orgNode = tree.find(n => n.id === currentUser.currentOrganizationId && n.type === 'organization');
             router.push(orgNode ? `/docs/${orgNode.id}` : (tree[0] ? `/docs/${tree[0].id}` : '/organizations'));
          }

        } catch (error) {
          console.error("Error fetching documents:", error);
          toast({ title: "Error", description: "Could not load documents for your organization.", variant: "destructive" });
        } finally {
          setLoadingDocuments(false);
        }
      };
      fetchDocs();
    } else if (currentUser && !currentUser.currentOrganizationId && !requiresOrganizationCreation) {
        setLoadingDocuments(false);
        setFlatDocumentsList([]);
        setDocumentTree([]);
    }
  }, [currentUser, currentUser?.currentOrganizationId, requiresOrganizationCreation, toast, router, documentIdFromRoute]);


  useEffect(() => {
    if (currentUser && currentUser.currentOrganizationId && flatDocumentsList.length > 0) { 
      if (documentIdFromRoute) {
        const doc = findDocumentInList(flatDocumentsList, documentIdFromRoute);
        // Ensure the found doc actually belongs to the current organization
        if (doc && doc.organizationId === currentUser.currentOrganizationId) {
            setCurrentDocument(doc);
            setEditedContent(doc.content || '');
            const userCanEdit = currentUser.currentOrganizationRole === 'admin' || currentUser.currentOrganizationRole === 'editor';
            setIsEditing(searchParams.get('edit') === 'true' && userCanEdit);
        } else if (doc && doc.organizationId !== currentUser.currentOrganizationId) {
            // Doc exists but not for this org. Clear currentDocument, show error/redirect.
            setCurrentDocument(null);
            toast({ title: "Access Denied", description: "This document does not belong to your active organization.", variant: "destructive"});
            router.push(`/docs/${currentUser.currentOrganizationId}`); // Go to org root
        } else {
             // Document not found in list, could be loading or invalid ID for this org
            setCurrentDocument(null);
             // Potentially show a "not found" message if loading is complete
            if (!loadingDocuments) {
                // toast({ title: "Document not found", description: `Document with ID ${documentIdFromRoute} not found.`, variant: "destructive" });
            }
        }
      } else {
        // No specific document in route, clear current document. A default might be set by other useEffect.
        setCurrentDocument(null);
      }
    }
  }, [documentIdFromRoute, flatDocumentsList, currentUser, searchParams, loadingDocuments, router, toast]);

  const handleContentChange = useCallback((content: string) => {
    setEditedContent(content);
  }, []);

  const handleSaveContent = async () => {
    if (currentDocument && canEdit) {
      setIsSaving(true);
      const success = await saveDocumentContentToFirestore(currentDocument.id, editedContent);
      setIsSaving(false);
      if (success) {
        const updatedFlatList = flatDocumentsList.map(doc =>
          doc.id === currentDocument.id ? { ...doc, content: editedContent, updatedAt: new Date() } : doc
        );
        setFlatDocumentsList(updatedFlatList);
        // No need to rebuild tree if only content changed, but if metadata like name changes, then yes.
        // For content, just update currentDocument
        setCurrentDocument(prev => prev ? {...prev, content: editedContent, updatedAt: new Date()} : null);
        
        router.push(`/docs/${currentDocument.id}`, { scroll: false });
        setIsEditing(false);

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
  
  const handleEnterEditMode = () => {
    if (canEdit && currentDocument && currentDocument.type === 'page') {
      router.push(`/docs/${documentIdFromRoute}?edit=true`, { scroll: false });
      // setIsEditing(true); // This will be set by useEffect watching searchParams
    } else if (currentDocument && currentDocument.type !== 'page') {
        toast({ title: "Cannot Edit", description: "Only pages can be edited directly. Select a page.", variant: "default" });
    }
  };

  const handleCancelEdit = () => {
    if (currentDocument) {
      setEditedContent(currentDocument.content || ''); 
    }
    router.push(`/docs/${documentIdFromRoute}`, { scroll: false }); 
    // setIsEditing(false); // This will be set by useEffect watching searchParams
    toast({
      title: "Editing Cancelled",
      description: "Your changes have been discarded.",
      variant: "default",
    });
  };

  const handleSelectDocument = (id: string) => {
     if (isEditing && currentDocument && editedContent !== currentDocument.content) {
        // Using AlertDialog for unsaved changes confirmation
        // This needs to be wired up if AlertDialog is preferred over simple confirm()
        if(confirm("You have unsaved changes. Are you sure you want to navigate away? Your changes will be lost.")) {
            router.push(`/docs/${id}`); 
            // setIsEditing(false); // Let useEffect handle based on new route
        }
     } else {
        router.push(`/docs/${id}`);
        // setIsEditing(false); // Let useEffect handle
     }
  };
  
  const getBreadcrumbs = (docId: string | null, docs: DocumentNode[]): DocumentNode[] => {
    if (!docId) return [];
    const path: DocumentNode[] = [];
    let currentCRDoc = findDocumentInList(docs, docId);
    while(currentCRDoc) {
      path.unshift(currentCRDoc);
      currentCRDoc = currentCRDoc.parentId ? findDocumentInList(docs, currentCRDoc.parentId) : null;
    }
    return path;
  };

  const breadcrumbs = getBreadcrumbs(currentDocument?.id || null, flatDocumentsList);

  const handleCreatePageSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.currentOrganizationId || !newPageName.trim()) {
      toast({ title: "Error", description: "Page name cannot be empty.", variant: "destructive" });
      return;
    }
    setIsCreatingPage(true);
    try {
      const effectiveParentId = currentDocument ? (currentDocument.type === 'page' ? currentDocument.parentId : currentDocument.id) : currentUser.currentOrganizationId;
      const orgId = currentUser.currentOrganizationId!;
      
      const siblings = flatDocumentsList.filter(doc => doc.parentId === effectiveParentId);
      const order = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) + 1 : 0;

      const newDoc = await createDocumentInFirestore(
        newPageName.trim(),
        effectiveParentId,
        orgId,
        'page',
        order,
        `# ${newPageName.trim()}\n\nStart writing your content here...`
      );

      setFlatDocumentsList(prev => [...prev, newDoc].sort((a,b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)));
      // setDocumentTree will be re-calculated in useEffect based on flatDocumentsList change, but we can trigger it manually
      setDocumentTree(buildDocumentTree([...flatDocumentsList, newDoc]));


      toast({ title: "Page Created", description: `Page "${newDoc.name}" created successfully.` });
      setIsCreatePageDialogOpen(false);
      setNewPageName('');
      router.push(`/docs/${newDoc.id}?edit=true`);

    } catch (error) {
      console.error("Error creating page:", error);
      toast({ title: "Creation Failed", description: (error as Error).message || "Could not create page.", variant: "destructive" });
    } finally {
      setIsCreatingPage(false);
    }
  };


  if (authLoading || (loadingDocuments && currentUser && currentUser.currentOrganizationId)) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading documents...</span></div>;
  }

  if (!currentUser || !currentUser.currentOrganizationId || requiresOrganizationCreation) {
    return (
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center flex-col">
            <Building className="h-12 w-12 text-primary/50 mb-4" />
            <p className="text-muted-foreground">Organization context is required.</p>
            <p className="text-sm text-muted-foreground">Please ensure you are logged in and have an active organization.</p>
            {!authLoading && requiresOrganizationCreation && (
                <Button onClick={() => router.push('/create-organization')} className="mt-4">
                    Create Organization
                </Button>
            )}
             {!authLoading && !currentUser && (
                <Button onClick={() => router.push('/login')} className="mt-4">
                    Login
                </Button>
            )}
             {!authLoading && currentUser && !currentUser.currentOrganizationId && !requiresOrganizationCreation && (
                 <Button onClick={() => router.push('/organizations')} className="mt-4">
                    Select Organization
                </Button>
            )}
        </div>
    );
  }


  const canEdit = currentUser.currentOrganizationRole === 'admin' || currentUser.currentOrganizationRole === 'editor';
  const displayDate = currentDocument?.updatedAt || currentDocument?.createdAt;

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-[calc(100vh-4rem)]"> {/* Adjusted for header height */}
        <Sidebar collapsible="icon" className="border-r fixed h-full z-20 pt-0"> {/* pt-16 removed */}
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
                <p className="p-4 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">No documents yet.</p>
              )}
            </ScrollArea>
          </SidebarContent>
          {canEdit && ( 
            <SidebarFooter className="group-data-[collapsible=icon]:hidden">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setIsCreatePageDialogOpen(true)}>
                <FilePlus className="mr-2 h-4 w-4" /> New Page
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
                        {breadcrumbs.length > 0 && (
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
                        )}
                        <CardTitle className="text-3xl font-bold">{currentDocument.name}</CardTitle>
                        {displayDate && (
                            <CardDescription>
                                Last updated: {new Date(displayDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
              ) : currentDocument ? ( 
                 <Card className="w-full shadow-md">
                  <CardHeader>
                     {breadcrumbs.length > 0 && (
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
                    )}
                    <CardTitle className="text-2xl">{currentDocument.name}</CardTitle>
                    <Badge variant="secondary" className="w-fit">{currentDocument.type.toUpperCase()}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {`This is ${currentDocument.type === 'organization' ? currentUser.currentOrganizationId === currentDocument.id ? 'your organization root' : 'an organization' : 'a space'}. Select an item from the sidebar to view or edit content.`}
                    </p>
                    {(flatDocumentsList.filter(d => d.parentId === currentDocument.id).length > 0) ? (
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
                    )}
                    {canEdit && (currentDocument.type === 'organization' || currentDocument.type === 'space') && (
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsCreatePageDialogOpen(true)}>
                            <FilePlus className="mr-2 h-4 w-4" /> New Page in {currentDocument.name}
                        </Button>
                    )}
                  </CardContent>
                 </Card>
              ) : ( 
                <Card className="w-full shadow-md">
                  <CardHeader><CardTitle>Welcome to Your ZyDocs Workspace!</CardTitle></CardHeader>
                  <CardContent>
                  <div className="mt-6 text-center">
                      {loadingDocuments ? <Loader2 className="mx-auto h-12 w-12 text-primary/50 animate-spin mb-4" /> : <Building className="mx-auto h-12 w-12 text-primary/50 mb-4" />}
                      <p className="text-muted-foreground">
                        {loadingDocuments ? "Loading content..." : "Please select a document from the sidebar or create a new one."}
                      </p>
                      {!loadingDocuments && documentTree.length === 0 && canEdit && (
                         <Button variant="outline" size="lg" className="mt-6" onClick={() => setIsCreatePageDialogOpen(true)}>
                            <FilePlus className="mr-2 h-5 w-5" /> Create Your First Page
                        </Button>
                      )}
                  </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </SidebarInset>
      </div>

      <AlertDialog open={isCreatePageDialogOpen} onOpenChange={setIsCreatePageDialogOpen}>
        <AlertDialogContent>
          <form onSubmit={handleCreatePageSubmit}>
            <AlertDialogHeader>
              <AlertDialogTitle>Create New Page</AlertDialogTitle>
              <AlertDialogDescription>
                Enter a name for your new page. It will be created under {currentDocument ? `"${currentDocument.name}"` : "the organization root"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="newPageName" className="sr-only">Page Name</Label>
              <Input
                id="newPageName"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="e.g., Project Plan, Meeting Notes"
                disabled={isCreatingPage}
                required
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCreatingPage} onClick={() => setNewPageName('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={isCreatingPage || !newPageName.trim()}>
                {isCreatingPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isCreatingPage ? 'Creating...' : 'Create Page'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}