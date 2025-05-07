// src/app/(app)/organization/[organizationId]/wiki/[[...pageId]]/page.tsx
'use client';

import type React from 'react';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation'; // useRouter instead of usePathname
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
import { createDocumentInFirestore, getDocumentsForOrganization } from '@/lib/firebase/firestore/documents';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';
import type { DocumentNode } from '@/types/document';
import type { Organization } from '@/types/organization';
import { buildDocumentTree, findDocumentInList } from '@/config/docs';
import { Loader2, Edit3, Save, BookOpen, PlusCircle, XCircle, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper component for sidebar content to access sidebar context
const WikiSidebarContent = ({
  organizationId,
  documents,
  currentDocumentId,
  onSelectDocument,
  organizationName,
}: {
  organizationId: string;
  documents: DocumentNode[];
  currentDocumentId?: string;
  onSelectDocument: (id: string) => void;
  organizationName: string;
}) => {
  const { open, setOpen } = useSidebar();
  const router = useRouter();
  const { toast } = useToast(); // Added toast for notifications

  const handleCreateNewPage = async () => {
    const pageName = prompt('Enter the name for the new page:');
    if (pageName && pageName.trim() !== '') {
      try {
        await createDocumentInFirestore(pageName.trim(), null, organizationId, 'page', 0, `# ${pageName.trim()}\n\nStart writing here...`);
        toast({ title: 'Page Created', description: `Page "${pageName.trim()}" created successfully.` });
        // Navigate to the wiki root, which will trigger a re-fetch of documents
        // including the new page, in the parent component's useEffect.
        router.push(`/organization/${organizationId}/wiki`); 
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to create page.', variant: 'destructive' });
        console.error("Error creating page:", error);
      }
    }
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
          {documents.length > 0 ? (
            <DocumentTree
              nodes={documents}
              currentDocumentId={currentDocumentId}
              onSelectDocument={onSelectDocument}
              basePath={`/organization/${organizationId}/wiki`}
            />
          ) : (
            <p className="text-sm text-muted-foreground p-4 text-center">No pages yet. Create one!</p>
          )}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        <Button variant="outline" size="sm" className="w-full" onClick={handleCreateNewPage}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Page
        </Button>
      </SidebarFooter>
    </>
  );
};


function OrganizationWikiPageComponent({ params }: { params: { organizationId: string; pageId?: string[] } }) {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const { organizationId } = params;
  const currentPageIdFromSlug = params.pageId?.[0];
  const searchParams = useSearchParams();
  const editModeQuery = searchParams.get('edit') === 'true';


  const [currentDocument, setCurrentDocument] = useState<DocumentNode | null>(null);
  const [documents, setDocuments] = useState<DocumentNode[]>([]);
  const [documentTree, setDocumentTree] = useState<DocumentNode[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isEditing, setIsEditing] = useState(editModeQuery);
  const [editedContent, setEditedContent] = useState('');
  const [organization, setOrganization] = useState<Organization | null>(null);

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
      }
    } catch (error) {
      console.error("Error fetching organization details:", error);
      toast({ title: 'Error', description: 'Could not load organization details.', variant: 'destructive' });
    }
  }, [organizationId, router, toast]);


  const fetchDocuments = useCallback(async () => {
    if (!organizationId || !currentUser) return;
    setIsLoadingContent(true);
    try {
      const fetchedDocs = await getDocumentsForOrganization(organizationId);
      setDocuments(fetchedDocs);
      const tree = buildDocumentTree(fetchedDocs);
      setDocumentTree(tree);

      if (currentPageIdFromSlug) {
        const doc = findDocumentInList(fetchedDocs, currentPageIdFromSlug);
        setCurrentDocument(doc);
        setEditedContent(doc?.content || '');
      } else {
        // If on the root of the wiki (no specific page selected), clear current document.
        setCurrentDocument(null);
        setEditedContent('');
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      toast({ title: 'Error', description: 'Could not load documents.', variant: 'destructive' });
    } finally {
      setIsLoadingContent(false);
    }
  }, [organizationId, currentUser, currentPageIdFromSlug, toast]);

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchOrganizationDetails();
      fetchDocuments(); // This will also handle setting currentDocument based on currentPageIdFromSlug
    } else if (!authLoading && !currentUser) {
      router.push(`/login?redirect=/organization/${organizationId}/wiki${currentPageIdFromSlug ? `/${currentPageIdFromSlug}` : ''}`);
    }
  }, [authLoading, currentUser, organizationId, currentPageIdFromSlug, fetchDocuments, fetchOrganizationDetails, router]);
  

  const handleSelectDocument = (id: string) => {
    // When a document is selected from the tree, navigate to its page.
    // This will trigger the useEffect above to fetch/set the document.
    // Also, exit edit mode if active.
    router.push(`/organization/${organizationId}/wiki/${id}`);
  };

  const handleSaveContent = async () => {
    if (!currentDocument) return;
    setIsLoadingContent(true);
    try {
      // This would be an update operation
      // await updateDocumentInFirestore(currentDocument.id, { content: editedContent });
      // For now, this part is conceptual as updateDocumentInFirestore is not fully implemented
      // Simulating save:
      const updatedDoc = { ...currentDocument, content: editedContent };
      setCurrentDocument(updatedDoc);
      // Update in local 'documents' list as well for tree refresh
      setDocuments(docs => docs.map(d => d.id === updatedDoc.id ? updatedDoc : d));
      
      toast({ title: 'Saved (Conceptual)', description: 'Content changes conceptually saved.' });
      // setIsEditing(false); // This will be handled by router push and useEffect on editModeQuery
      router.push(`/organization/${organizationId}/wiki/${currentDocument.id}`); // Remove ?edit=true
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
    
    const targetPath = `/organization/${organizationId}/wiki/${currentDocument?.id || ''}`;
    if (isEditing) { // Leaving edit mode
        // Optionally, reset editedContent if changes are not saved, or prompt user.
        // For now, just navigate away from edit mode.
        if (currentDocument) setEditedContent(currentDocument.content || ''); // Reset to original
        router.push(targetPath);
    } else { // Entering edit mode
        router.push(`${targetPath}?edit=true`);
    }
    // setIsEditing state will be updated by useEffect watching editModeQuery
  };

  if (authLoading || (!currentUser && !authLoading) || !organization) {
    return <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Wiki...</div>;
  }
  
  const canEdit = currentUser?.organizationMemberships?.find(m => m.organizationId === organizationId && (m.role === 'admin' || m.role === 'editor'));


  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-[calc(100vh-4rem)] bg-background"> {/* Ensure full height below header */}
        <Sidebar collapsible="icon" className="border-r">
          <WikiSidebarContent
            organizationId={organizationId}
            documents={documentTree}
            currentDocumentId={currentPageIdFromSlug}
            onSelectDocument={handleSelectDocument}
            organizationName={organization.name || 'Organization'}
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
                    <p>Use the sidebar to navigate through existing pages or click the &quot;New Page&quot; button to start a new document.</p>
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
                                    <Save className="mr-2 h-4 w-4" /> {isLoadingContent ? 'Saving...' : 'Save'}
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
                      initialContent={editedContent} // Use editedContent which is set from currentDocument.content
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
    // Suspense is important for useSearchParams
    <Suspense fallback={<div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Wiki UI...</div>}>
      <OrganizationWikiPageComponent params={params} />
    </Suspense>
  )
}
