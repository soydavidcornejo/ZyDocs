// src/app/(app)/organization/[organizationId]/wiki/[[...pageId]]/page.tsx
'use client';

import type React from 'react';
import { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarInset,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentTree } from "@/components/document/DocumentTree";
import WysiwygEditor from "@/components/editor/WysiwygEditor";
import { CreatePageModal } from '@/components/document/CreatePageModal';
import { createDocumentInFirestore, getDocumentsForOrganization, updateDocumentInFirestore, getDocumentById, deleteDocumentAndChildren } from '@/lib/firebase/firestore/documents';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';
import type { DocumentNode } from '@/types/document';
import type { Organization } from '@/types/organization';
import { buildDocumentTree, findDocumentInList } from '@/config/docs';
import { Loader2, Edit3, Save, BookOpen, PlusCircle, XCircle, Home, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const WIKI_TREE_STATE_KEY_PREFIX = 'zyDocsWikiTreeState_';

// Helper component for sidebar content to access sidebar context
const WikiSidebarContent = ({
  organizationId,
  documents,
  flatDocuments,
  currentDocumentId,
  onSelectDocument,
  organizationName,
  expandedItems,
  setExpandedItems,
  onPageCreated,
  isFetchingTree, // New prop for initial tree loading
}: {
  organizationId: string;
  documents: DocumentNode[];
  flatDocuments: DocumentNode[];
  currentDocumentId?: string;
  onSelectDocument: (id: string) => void;
  organizationName: string;
  expandedItems: string[];
  setExpandedItems: (items: string[]) => void;
  onPageCreated: (newPageId?: string) => void;
  isFetchingTree: boolean;
}) => {
  const { setOpen } = useSidebar();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreatePage = () => {
    setIsCreateModalOpen(true);
  };

  const handlePageCreationDone = (newPageId?: string) => {
    setIsCreateModalOpen(false);
    onPageCreated(newPageId);
  };

  return (
    <>
      <SidebarHeader className="flex items-center justify-between p-3 border-b border-sidebar-border">
        <Link href={`/organization/${organizationId}/wiki`} className="font-semibold text-lg hover:underline">
          {organizationName} Wiki
        </Link>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="p-0">
        <ScrollArea className="h-full p-3">
          {isFetchingTree ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm">Loading tree...</span>
            </div>
          ) : documents.length > 0 ? (
            <DocumentTree
              nodes={documents}
              currentDocumentId={currentDocumentId}
              onSelectDocument={onSelectDocument}
              basePath={`/organization/${organizationId}/wiki`}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
            />
          ) : (
            <p className="text-sm text-muted-foreground p-4 text-center">No pages yet. Create one!</p>
          )}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        <Button variant="outline" size="sm" className="w-full" onClick={handleCreatePage}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Page
        </Button>
      </SidebarFooter>
      <CreatePageModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        organizationId={organizationId}
        allDocuments={flatDocuments}
        onPageCreated={handlePageCreationDone}
      />
    </>
  );
};


function OrganizationWikiPageComponent({ params }: { params: { organizationId: string; pageId?: string[] } }) {
  const { currentUser, loading: authLoading, selectActiveOrganization } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { organizationId } = params;
  const currentPageIdFromSlug = params.pageId?.[0];
  const searchParams = useSearchParams();
  const editModeQuery = searchParams.get('edit') === 'true';

  const [currentDocument, setCurrentDocument] = useState<DocumentNode | null>(null);
  const [allDocumentsFlat, setAllDocumentsFlat] = useState<DocumentNode[]>([]);
  const [documentTree, setDocumentTree] = useState<DocumentNode[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false); // For main content area
  const [isEditing, setIsEditing] = useState(editModeQuery);
  const [editedContent, setEditedContent] = useState('');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isFetchingOrg, setIsFetchingOrg] = useState(true);
  const [isFetchingDocs, setIsFetchingDocs] = useState(true); // For document list fetching state

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<DocumentNode | null>(null);

  const wikiTreeStorageKey = useMemo(() => `${WIKI_TREE_STATE_KEY_PREFIX}${organizationId}`, [organizationId]);
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem(wikiTreeStorageKey);
      return savedState ? JSON.parse(savedState) : [];
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(wikiTreeStorageKey, JSON.stringify(expandedItems));
    }
  }, [expandedItems, wikiTreeStorageKey]);

  useEffect(() => {
    setIsEditing(editModeQuery);
     if (!editModeQuery && currentDocument) {
        setEditedContent(currentDocument.content || '');
    }
  }, [editModeQuery, currentDocument]);


  const fetchOrganizationDetails = useCallback(async () => {
    if (!organizationId) return;
    setIsFetchingOrg(true);
    try {
      const org = await getOrganizationDetails(organizationId);
      if (!org) {
        toast({ title: 'Error', description: 'Organization not found.', variant: 'destructive' });
        router.push('/organizations');
      } else {
        setOrganization(org);
        if (currentUser && currentUser.currentOrganizationId !== organizationId) {
          const targetPath = `/organization/${organizationId}/wiki${currentPageIdFromSlug ? `/${currentPageIdFromSlug}` : ''}${editModeQuery ? '?edit=true' : ''}`;
          await selectActiveOrganization(organizationId, targetPath);
        }
      }
    } catch (error) {
      console.error("Error fetching organization details:", error);
      toast({ title: 'Error', description: 'Could not load organization details.', variant: 'destructive' });
    } finally {
      setIsFetchingOrg(false);
    }
  }, [organizationId, router, toast, currentUser, selectActiveOrganization, currentPageIdFromSlug, editModeQuery]);

  const fetchDocuments = useCallback(async () => {
    if (!organizationId || !currentUser || currentUser.currentOrganizationId !== organizationId) {
      setIsFetchingDocs(false);
      return;
    }
    setIsFetchingDocs(true);
    // isLoadingContent will be handled by the effect that sets currentDocument
    try {
      const fetchedDocs = await getDocumentsForOrganization(organizationId);
      setAllDocumentsFlat(fetchedDocs);
      const tree = buildDocumentTree(fetchedDocs);
      setDocumentTree(tree);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      toast({ title: 'Error Fetching Documents', description: (error as Error).message || 'Could not load documents.', variant: 'destructive' });
    } finally {
      setIsFetchingDocs(false);
    }
  }, [organizationId, currentUser, toast]);


  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchOrganizationDetails();
    } else if (!authLoading && !currentUser) {
      const redirectUrl = `/login?redirect=/organization/${organizationId}/wiki${currentPageIdFromSlug ? `/${currentPageIdFromSlug}` : ''}${editModeQuery ? '?edit=true' : ''}`;
      router.push(redirectUrl);
    }
  }, [authLoading, currentUser, organizationId, fetchOrganizationDetails, currentPageIdFromSlug, editModeQuery, router]);

  // Effect to fetch the document list when organization or user context changes
  useEffect(() => {
    if (organization && currentUser && currentUser.currentOrganizationId === organizationId) {
      fetchDocuments();
    }
  }, [organization, currentUser, organizationId, fetchDocuments]);

  // Effect to set the current document for display and manage content loading state
  useEffect(() => {
    setIsLoadingContent(true);
    if (currentPageIdFromSlug && allDocumentsFlat.length > 0) {
      const doc = findDocumentInList(allDocumentsFlat, currentPageIdFromSlug);
      setCurrentDocument(doc);
      setEditedContent(doc?.content || '');
    } else if (!currentPageIdFromSlug) { // Wiki home
      setCurrentDocument(null);
      setEditedContent('');
    }
    // If doc not found with currentPageIdFromSlug but slug exists, currentDocument will be null (handled by UI)
    setIsLoadingContent(false);
  }, [currentPageIdFromSlug, allDocumentsFlat]);


  // Auto-expand parent logic
  useEffect(() => {
    if (currentPageIdFromSlug && allDocumentsFlat.length > 0) {
      const pathIdsToExpand = new Set<string>(expandedItems);
      let currentDocForPathId: string | null | undefined = currentPageIdFromSlug;
      let changed = false;

      while (currentDocForPathId) {
        const doc = findDocumentInList(allDocumentsFlat, currentDocForPathId);
        if (doc && doc.parentId) {
          const parentItemValue = `item-${doc.parentId}`;
          if (!pathIdsToExpand.has(parentItemValue)) {
            pathIdsToExpand.add(parentItemValue);
            changed = true;
          }
          currentDocForPathId = doc.parentId;
        } else {
          currentDocForPathId = null;
        }
      }
      if (changed) {
        setExpandedItems(Array.from(pathIdsToExpand));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIdFromSlug, allDocumentsFlat]);


  const handleSelectDocument = (id: string) => {
    const targetPath = `/organization/${organizationId}/wiki/${id}`;
    if (isEditing && currentDocument && editedContent !== (currentDocument.content || '')) {
        if (confirm("You have unsaved changes. Are you sure you want to navigate away? Your changes will be lost.")) {
            router.push(isEditing ? `${targetPath}?edit=true` : targetPath);
        }
    } else {
         router.push(isEditing && id !== currentPageIdFromSlug ? `${targetPath}?edit=true` : targetPath);
    }
  };

  const handlePageCreated = async (newPageId?: string) => {
    await fetchDocuments(); // Re-fetch the list, which updates allDocumentsFlat and documentTree
    if (newPageId) {
        // The useEffect for auto-expansion will handle expanding to the new page
        // after allDocumentsFlat is updated by fetchDocuments.
        // To ensure the new page's parent is expanded if needed, we explicitly update allDocumentsFlat
        // again here AFTER fetchDocuments if necessary, though fetchDocuments should already do this.
        // This ensures the expansion logic has the very latest data.
        const latestDocs = await getDocumentsForOrganization(organizationId);
        setAllDocumentsFlat(latestDocs); // Ensure this is set before navigation for expansion logic
        
        const newPage = findDocumentInList(latestDocs, newPageId);
        if(newPage && newPage.parentId && !expandedItems.includes(`item-${newPage.parentId}`)){
            setExpandedItems(prev => [...new Set([...prev, `item-${newPage.parentId}`])]);
        }
        router.push(`/organization/${organizationId}/wiki/${newPageId}${isEditing ? '?edit=true' : ''}`);
    }
  };

  const handleSaveContent = async () => {
    if (!currentDocument) return;
    setIsLoadingContent(true); // Show loader in content area while saving
    try {
      await updateDocumentInFirestore(currentDocument.id, { content: editedContent });
      // Optimistically update local state to reflect changes immediately
      const updatedDocsFlat = allDocumentsFlat.map(d => d.id === currentDocument.id ? { ...d, content: editedContent, updatedAt: new Date() } : d);
      setAllDocumentsFlat(updatedDocsFlat);
      setCurrentDocument(prev => prev ? { ...prev, content: editedContent, updatedAt: new Date() } : null);
      const newTree = buildDocumentTree(updatedDocsFlat);
      setDocumentTree(newTree); // Update sidebar tree
      toast({ title: 'Saved', description: 'Content changes saved successfully.' });
      router.push(`/organization/${organizationId}/wiki/${currentDocument.id}`); // Exit edit mode
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save content.', variant: 'destructive' });
    } finally {
      setIsLoadingContent(false);
    }
  };

  const toggleEditMode = () => {
    if (!currentDocument && !isEditing) {
      toast({title: "Cannot Edit", description: "Please select a page to edit.", variant: "default"});
      return;
    }
    const basePath = `/organization/${organizationId}/wiki/${currentDocument?.id || ''}`;
    if (isEditing) {
        if (currentDocument && editedContent !== (currentDocument.content || '')) {
             if (confirm("You have unsaved changes. Are you sure you want to cancel editing? Your changes will be lost.")) {
                setEditedContent(currentDocument.content || '');
                router.push(basePath);
            }
        } else {
            router.push(basePath);
        }
    } else {
        router.push(`${basePath}?edit=true`);
    }
  };

  const handleDeleteInitiate = (doc: DocumentNode) => {
    setPageToDelete(doc);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pageToDelete || !organizationId) return;
    setIsLoadingContent(true); // Indicate processing in content area
    try {
        await deleteDocumentAndChildren(pageToDelete.id, organizationId);
        toast({ title: 'Page Deleted', description: `"${pageToDelete.name}" and its sub-pages have been deleted.` });

        const parentIdOfDeletedPage = pageToDelete.parentId;
        setIsDeleteDialogOpen(false);
        setPageToDelete(null);

        await fetchDocuments(); // Refresh the document list

        if (currentPageIdFromSlug === pageToDelete.id || findDocumentInList(allDocumentsFlat, currentPageIdFromSlug)?.parentId === pageToDelete.id ) {
          // If current page or its parent was deleted, navigate
          if (parentIdOfDeletedPage) {
              router.push(`/organization/${organizationId}/wiki/${parentIdOfDeletedPage}`);
          } else {
              router.push(`/organization/${organizationId}/wiki`);
          }
        }
        // setIsLoadingContent(false) is implicitly handled by subsequent state updates or fetchDocuments finishing
    } catch (error) {
        console.error("Error deleting page:", error);
        toast({ title: 'Error Deleting Page', description: (error as Error).message, variant: 'destructive' });
        setIsLoadingContent(false);
        setIsDeleteDialogOpen(false);
        setPageToDelete(null);
    }
  };


  if (authLoading || isFetchingOrg || (!currentUser && !authLoading)) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Wiki...</div>;
  }

  const canEdit = currentUser?.organizationMemberships?.find(m => m.organizationId === organizationId && (m.role === 'admin' || m.role === 'editor'));

  if (organization && currentUser && currentUser.currentOrganizationId !== organizationId && !isFetchingOrg) {
     return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" /> Verifying organization context...
        </div>
     );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-full bg-background">
        <Sidebar collapsible="icon" className="border-r">
          {organization ? ( // Sidebar content always shown if org exists, internal loader for tree
            <WikiSidebarContent
              organizationId={organizationId}
              documents={documentTree}
              flatDocuments={allDocumentsFlat}
              currentDocumentId={currentPageIdFromSlug}
              onSelectDocument={handleSelectDocument}
              organizationName={organization.name || 'Wiki'}
              expandedItems={expandedItems}
              setExpandedItems={setExpandedItems}
              onPageCreated={handlePageCreated}
              isFetchingTree={isFetchingDocs && documentTree.length === 0} // Pass tree-specific loading
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
               <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </Sidebar>
        <SidebarInset>
          <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
              {(isLoadingContent) && <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /> <span className="ml-2">Loading page...</span></div>}

              {!currentPageIdFromSlug && !isLoadingContent && !isFetchingDocs && organization && (
                <Card className="mt-4 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center"><Home className="mr-2 h-6 w-6 text-primary" /> Wiki Home</CardTitle>
                    <CardDescription>Welcome to the wiki for {organization.name}. Select a page from the sidebar or create a new one.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>Use the sidebar to navigate through existing pages or click the &quot;Create Page&quot; button to start a new document.</p>
                     {canEdit && (
                      <Button
                        onClick={toggleEditMode}
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        disabled={!currentDocument}
                      >
                          <Edit3 className="mr-2 h-4 w-4" />
                          {currentDocument ? "Edit Selected Page" : "Select a page to edit"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {currentDocument && !isLoadingContent && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold">{currentDocument.name}</h1>
                    <div className="flex items-center space-x-2">
                        {canEdit && (
                            isEditing ? (
                                <>
                                    <Button onClick={handleSaveContent} disabled={isLoadingContent} size="sm">
                                        {isLoadingContent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        {isLoadingContent ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button variant="outline" onClick={toggleEditMode} size="sm">
                                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={toggleEditMode} variant="outline" size="sm">
                                    <Edit3 className="mr-2 h-4 w-4" /> Edit Page
                                </Button>
                            )
                        )}
                         {canEdit && !isEditing && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteInitiate(currentDocument)}
                                className="text-destructive hover:bg-destructive/10 border-destructive/50 hover:text-destructive"
                                title="Delete Page"
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                        )}
                    </div>
                  </div>

                  {isEditing && canEdit ? (
                    <WysiwygEditor
                      initialContent={editedContent}
                      onContentChange={setEditedContent}
                    />
                  ) : (
                    <article className="prose dark:prose-invert max-w-none bg-card p-4 sm:p-6 rounded-md shadow">
                      {currentDocument.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentDocument.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-muted-foreground">This page is empty. {canEdit ? 'Click "Edit Page" to add content.' : ''}</p>
                      )}
                    </article>
                  )}
                </>
              )}

              {!currentDocument && currentPageIdFromSlug && !isLoadingContent && !isFetchingDocs && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-destructive">Page Not Found</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>The page you are looking for (ID: {currentPageIdFromSlug}) does not exist or could not be loaded.</p>
                    <Button asChild variant="link" className="mt-2">
                      <Link href={`/organization/${organizationId}/wiki`}>Go to Wiki Home</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </SidebarInset>
      </div>
      {pageToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Delete Page</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the page &quot;{pageToDelete.name}&quot;?
                        This will also delete all its sub-pages. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)} disabled={isLoadingContent}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDeleteConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isLoadingContent}
                    >
                         {isLoadingContent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete Page
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}
    </SidebarProvider>
  );
}


export default function OrganizationWikiPageWrapper({ params }: { params: { organizationId: string; pageId?: string[] } }) {
  return (
    <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Wiki UI...</div>}>
      <OrganizationWikiPageComponent params={params} />
    </Suspense>
  )
}
