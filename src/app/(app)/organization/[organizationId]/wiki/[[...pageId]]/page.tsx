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
import { createDocumentInFirestore, getDocumentsForOrganization, updateDocumentInFirestore } from '@/lib/firebase/firestore/documents';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';
import type { DocumentNode } from '@/types/document';
import type { Organization } from '@/types/organization';
import { buildDocumentTree, findDocumentInList } from '@/config/docs';
import { Loader2, Edit3, Save, BookOpen, PlusCircle, XCircle, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const WIKI_TREE_STATE_KEY_PREFIX = 'zyDocsWikiTreeState_';

// Helper component for sidebar content to access sidebar context
const WikiSidebarContent = ({
  organizationId,
  documents,
  currentDocumentId,
  onSelectDocument,
  organizationName,
  expandedItems,
  setExpandedItems,
  onPageCreated,
}: {
  organizationId: string;
  documents: DocumentNode[];
  currentDocumentId?: string;
  onSelectDocument: (id: string) => void;
  organizationName: string;
  expandedItems: string[];
  setExpandedItems: (items: string[]) => void;
  onPageCreated: () => void;
}) => {
  const { open, setOpen } = useSidebar();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
          {documents.length > 0 ? (
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
        <Button variant="outline" size="sm" className="w-full" onClick={() => setIsCreateModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Page
        </Button>
      </SidebarFooter>
      <CreatePageModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        organizationId={organizationId}
        allDocuments={documents} // Pass flat list of documents for parent selection
        onPageCreated={onPageCreated}
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
  const [documents, setDocuments] = useState<DocumentNode[]>([]); // Flat list of all documents
  const [documentTree, setDocumentTree] = useState<DocumentNode[]>([]); // Hierarchical tree
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isEditing, setIsEditing] = useState(editModeQuery);
  const [editedContent, setEditedContent] = useState('');
  const [organization, setOrganization] = useState<Organization | null>(null);

  // State for persisted expanded items in DocumentTree
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
  }, [editModeQuery]);

  const fetchOrganizationDetails = useCallback(async () => {
    if (!organizationId) return;
    try {
      const org = await getOrganizationDetails(organizationId);
      if (!org) {
        toast({ title: 'Error', description: 'Organization not found.', variant: 'destructive' });
        router.push('/organizations');
      } else {
        setOrganization(org);
         // Ensure this organization is active
        if (currentUser && currentUser.currentOrganizationId !== organizationId) {
          await selectActiveOrganization(organizationId, `/organization/${organizationId}/wiki${currentPageIdFromSlug ? `/${currentPageIdFromSlug}` : ''}`);
        }
      }
    } catch (error) {
      console.error("Error fetching organization details:", error);
      toast({ title: 'Error', description: 'Could not load organization details.', variant: 'destructive' });
    }
  }, [organizationId, router, toast, currentUser, selectActiveOrganization, currentPageIdFromSlug]);


  const fetchDocuments = useCallback(async (selectPageId?: string) => {
    if (!organizationId || !currentUser) return;
    setIsLoadingContent(true);
    try {
      const fetchedDocs = await getDocumentsForOrganization(organizationId);
      setDocuments(fetchedDocs); // Store flat list
      const tree = buildDocumentTree(fetchedDocs);
      setDocumentTree(tree);

      const pageIdToSelect = selectPageId || currentPageIdFromSlug;

      if (pageIdToSelect) {
        const doc = findDocumentInList(fetchedDocs, pageIdToSelect);
        setCurrentDocument(doc);
        setEditedContent(doc?.content || '');
        // Direct parent expansion is handled here. Ancestor expansion is handled by useEffect below.
        if (doc && doc.parentId && !expandedItems.includes(`item-${doc.parentId}`)) {
            setExpandedItems(prev => [...new Set([...prev, `item-${doc.parentId}`])]);
        }
      } else {
        setCurrentDocument(null);
        setEditedContent('');
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      toast({ title: 'Error', description: 'Could not load documents.', variant: 'destructive' });
    } finally {
      setIsLoadingContent(false);
    }
  }, [organizationId, currentUser, currentPageIdFromSlug, toast]); // Removed expandedItems from dependencies

  // Effect to expand all ancestors of the current page
  useEffect(() => {
    if (currentPageIdFromSlug && documents.length > 0) {
      const pathIdsToExpand: string[] = [];
      let currentDocId: string | null | undefined = currentPageIdFromSlug;

      while (currentDocId) {
        const doc = findDocumentInList(documents, currentDocId);
        if (doc && doc.parentId) {
          const parentItemValue = `item-${doc.parentId}`;
          // Add to path if not already set to be expanded by this effect run
          if (!expandedItems.includes(parentItemValue) && !pathIdsToExpand.includes(parentItemValue)) {
            pathIdsToExpand.push(parentItemValue);
          }
          currentDocId = doc.parentId;
        } else {
          currentDocId = null; // Reached root or document/parent not found
        }
      }
      
      if (pathIdsToExpand.length > 0) {
        // Add new path items to existing expanded items without duplicates
        setExpandedItems(prev => [...new Set([...prev, ...pathIdsToExpand])]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIdFromSlug, documents]); // Not including expandedItems in deps to prevent potential loops


  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchOrganizationDetails();
      fetchDocuments();
    } else if (!authLoading && !currentUser) {
      router.push(`/login?redirect=/organization/${organizationId}/wiki${currentPageIdFromSlug ? `/${currentPageIdFromSlug}` : ''}`);
    }
  }, [authLoading, currentUser, organizationId, currentPageIdFromSlug, fetchDocuments, fetchOrganizationDetails, router]);
  

  const handleSelectDocument = (id: string) => {
    // If editing, prompt to save or cancel? For now, just navigate.
    if(isEditing) {
        router.push(`/organization/${organizationId}/wiki/${id}?edit=true`);
    } else {
        router.push(`/organization/${organizationId}/wiki/${id}`);
    }
  };
  
  const handlePageCreated = async (newPageId?: string) => {
    await fetchDocuments(newPageId); // Re-fetch and optionally select the new page
    if (newPageId) {
        router.push(`/organization/${organizationId}/wiki/${newPageId}`);
    }
  };

  const handleSaveContent = async () => {
    if (!currentDocument) return;
    setIsLoadingContent(true);
    try {
      await updateDocumentInFirestore(currentDocument.id, { content: editedContent });
      // Optimistically update local state before re-fetching or rely on re-fetch
      const updatedDocs = documents.map(d => d.id === currentDocument.id ? { ...d, content: editedContent, updatedAt: new Date() } : d);
      setDocuments(updatedDocs);
      setCurrentDocument(prev => prev ? { ...prev, content: editedContent, updatedAt: new Date() } : null);
      const newTree = buildDocumentTree(updatedDocs);
      setDocumentTree(newTree);
      
      toast({ title: 'Saved', description: 'Content changes saved successfully.' });
      router.push(`/organization/${organizationId}/wiki/${currentDocument.id}`); 
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save content.', variant: 'destructive' });
      // Optionally re-fetch on error to ensure consistency
      // await fetchDocuments(currentDocument.id);
    } finally {
      setIsLoadingContent(false);
    }
  };
  
  const toggleEditMode = () => {
    if (!currentDocument && !isEditing) {
      toast({title: "Cannot Edit", description: "Please select a page to edit.", variant: "default"});
      return;
    }
    
    const targetPath = `/organization/${organizationId}/wiki/${currentDocument?.id || ''}`;
    if (isEditing) { 
        if (currentDocument) setEditedContent(currentDocument.content || ''); 
        router.push(targetPath); // Exits edit mode by removing ?edit=true
    } else { 
        router.push(`${targetPath}?edit=true`); // Enters edit mode
    }
  };

  if (authLoading || (!currentUser && !authLoading) || !organization) {
    return <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Wiki...</div>;
  }
  
  const canEdit = currentUser?.organizationMemberships?.find(m => m.organizationId === organizationId && (m.role === 'admin' || m.role === 'editor'));


  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-[calc(100vh-4rem)] bg-background">
        <Sidebar collapsible="icon" className="border-r">
          <WikiSidebarContent
            organizationId={organizationId}
            documents={documentTree} // Pass the hierarchical tree
            currentDocumentId={currentPageIdFromSlug}
            onSelectDocument={handleSelectDocument}
            organizationName={organization.name || 'Organization'}
            expandedItems={expandedItems}
            setExpandedItems={setExpandedItems}
            onPageCreated={() => handlePageCreated()} // Pass the actual new page ID in CreatePageModal's call
          />
        </Sidebar>
        <SidebarInset>
          <ScrollArea className="h-full">
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
              {isLoadingContent && (!currentDocument && currentPageIdFromSlug) && <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /> <span className="ml-2">Loading page...</span></div>}
              
              {!currentPageIdFromSlug && !isLoadingContent && (
                <Card className="mt-4 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-2xl flex items-center"><Home className="mr-2 h-6 w-6 text-primary" /> Wiki Home</CardTitle>
                    <CardDescription>Welcome to the wiki for {organization.name}. Select a page from the sidebar or create a new one.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>Use the sidebar to navigate through existing pages or click the &quot;Create Page&quot; button to start a new document.</p>
                     {canEdit && !currentDocument && (
                      <Button onClick={toggleEditMode} variant="outline" size="sm" className="mt-4" disabled={true}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit Page (Select a page first)
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {currentDocument && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h1 className="text-3xl font-bold">{currentDocument.name}</h1>
                    {canEdit && (
                        isEditing ? (
                            <div className="space-x-2">
                                <Button onClick={handleSaveContent} disabled={isLoadingContent} size="sm">
                                    {isLoadingContent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {isLoadingContent ? 'Saving...' : 'Save'}
                                </Button>
                                <Button variant="outline" onClick={toggleEditMode} size="sm">
                                    <XCircle className="mr-2 h-4 w-4" /> Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={toggleEditMode} variant="outline" size="sm">
                                <Edit3 className="mr-2 h-4 w-4" /> Edit Page
                            </Button>
                        )
                    )}
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

              {!currentDocument && currentPageIdFromSlug && !isLoadingContent && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-destructive">Page Not Found</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>The page you are looking for does not exist or could not be loaded.</p>
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
    </SidebarProvider>
  );
}


export default function OrganizationWikiPageWrapper({ params }: { params: { organizationId: string; pageId?: string[] } }) {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Wiki UI...</div>}>
      <OrganizationWikiPageComponent params={params} />
    </Suspense>
  )
}

