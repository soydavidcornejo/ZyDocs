// src/app/(app)/organization/[organizationId]/wiki/[[...pageId]]/page.tsx
'use client';

import type React from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentTree } from "@/components/document/DocumentTree";
import WysiwygEditor from "@/components/editor/WysiwygEditor";
import { useDocumentRealtime } from '@/hooks/realtime/useDocumentRealtime';
import { useDocumentChanges } from '@/hooks/realtime/useDocumentChanges';
import { CollaborationWrapper, ActiveUsersIndicator } from '@/components/collaboration/index';
import { CreatePageModal } from '@/components/document/CreatePageModal';
import { createDocumentInFirestore, getDocumentsForOrganization, updateDocumentInFirestore, getDocumentById, deleteDocumentAndChildren } from '@/lib/firebase/firestore/documents';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';
import type { DocumentNode } from '@/types/document';
import type { Organization } from '@/types/organization';
import { buildDocumentTree, findDocumentInList } from '@/config/docs';
import { Loader2, Edit3, Save, BookOpen, PlusCircle, XCircle, Home, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import { usePageChanged } from '@/hooks/usePageChanged';
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


function OrganizationWikiPageComponent() {
  const { currentUser, loading: authLoading, selectActiveOrganization } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Usar useParams() en lugar de recibir params como props
  const params = useParams();
  const organizationId = params.organizationId as string;
  const pageId = params.pageId as string[] | undefined;
  const currentPageIdFromSlug = pageId?.[0];
  const searchParams = useSearchParams();
  const editModeQuery = searchParams.get('edit') === 'true';

  // Usar el hook de tiempo real para el documento actual
  const { document: currentDocumentRealtime, loading: isLoadingDocumentRealtime } = useDocumentRealtime(currentPageIdFromSlug || null);
  const [currentDocument, setCurrentDocument] = useState<DocumentNode | null>(null);
  const [allDocumentsFlat, setAllDocumentsFlat] = useState<DocumentNode[]>([]);
  const [documentTree, setDocumentTree] = useState<DocumentNode[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false); // For main content area
  const [isEditing, setIsEditing] = useState(editModeQuery);
  const [editedContent, setEditedContent] = useState('');
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isFetchingOrg, setIsFetchingOrg] = useState(true);
  const [isFetchingDocs, setIsFetchingDocs] = useState(true); // For document list fetching state
  
  // Evitar múltiples actualizaciones de estado usando memoización
  const handleDocumentChange = useCallback((updatedContent: string, updatedAt: Date) => {
    // Si estamos editando, el componente CollaborationWrapper manejará los conflictos
    if (!isEditing) {
      // Si no estamos en modo edición, actualizar silenciosamente
      setCurrentDocument(prev => prev ? { ...prev, content: updatedContent, updatedAt } : null);
    }
  }, [isEditing]);
  
  // Detectar cambios en el documento para colaboración en tiempo real
  // Solo activar cuando realmente necesitamos seguir cambios
  const shouldWatchChanges = currentPageIdFromSlug && !isLoadingDocumentRealtime;
  
  useDocumentChanges({
    documentId: shouldWatchChanges ? currentPageIdFromSlug : null,
    isEditing,
    localContent: editedContent,
    onContentChanged: handleDocumentChange,
    skipInitial: true
  });

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
    // Solo cambiar isEditing si realmente cambió el valor de la consulta
    const shouldBeEditing = editModeQuery === true;
    if (isEditing !== shouldBeEditing) {
      console.log(`Cambiando modo de edición: ${isEditing} -> ${shouldBeEditing}`);
      setIsEditing(shouldBeEditing);
    }
     
    // Solo actualizar el contenido editado cuando cambiamos de documento 
    // o cuando salimos del modo edición
    if (!shouldBeEditing && currentDocument && editedContent !== currentDocument.content) {
      console.log('Actualizando contenido editado desde documento actual');
      setEditedContent(currentDocument.content || '');
    }
  }, [editModeQuery, currentDocument, isEditing, editedContent]);


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

  // Detectar cuando cambia la página actual sin reaccionar a otros cambios de estado
  usePageChanged(currentPageIdFromSlug, () => {
    // Cada vez que cambie el ID de página, iniciar carga
    setIsLoadingContent(true);
  });
  
  // Effect to set the current document for display and manage content loading state
  // Efecto para actualizar el documento actual, priorizando la versión en tiempo real
  useEffect(() => {
    // Si tenemos la versión en tiempo real, usarla
    if (currentDocumentRealtime) {
      setCurrentDocument(currentDocumentRealtime);
      setEditedContent(currentDocumentRealtime.content || '');
      setIsLoadingContent(false);
    } 
    // Si no hay versión en tiempo real pero tenemos el ID y la lista plana, buscar ahí
    else if (!isLoadingDocumentRealtime && currentPageIdFromSlug && allDocumentsFlat.length > 0) {
      const doc = findDocumentInList(allDocumentsFlat, currentPageIdFromSlug);
      setCurrentDocument(doc);
      setEditedContent(doc?.content || '');
      setIsLoadingContent(false);
    } 
    // Si no hay ID (Wiki home)
    else if (!currentPageIdFromSlug) {
      setCurrentDocument(null);
      setEditedContent('');
      setIsLoadingContent(false);
    }
    // Si todavía estamos cargando el documento en tiempo real, mantener el estado de carga
    else if (isLoadingDocumentRealtime) {
      // Estado de carga manejado por isLoadingContent=true
    } 
    // Si no hay documento en la lista plana, mostrar estado de no encontrado
    else {
      setCurrentDocument(null);
      setIsLoadingContent(false);
    }
  }, [currentPageIdFromSlug, allDocumentsFlat, currentDocumentRealtime, isLoadingDocumentRealtime]);


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


  // Determinar si hay cambios sin guardar
  const hasUnsavedChanges = isEditing && currentDocument && editedContent !== (currentDocument.content || '');
  
  // Usar el hook de navegación segura
  const { navigateTo } = useSafeNavigation({
    hasUnsavedChanges,
    confirmationMessage: "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir? Tus cambios se perderán."
  });
  
  const handleSelectDocument = (id: string) => {
    const targetPath = `/organization/${organizationId}/wiki/${id}`;
    const fullPath = isEditing && id !== currentPageIdFromSlug ? `${targetPath}?edit=true` : targetPath;
    
    // Asegurarnos de usar navegación del lado cliente (shallow) para evitar recargas completas
    console.log(`Navegando a: ${fullPath} (shallow: true)`);
    navigateTo(fullPath, { shallow: true });
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
      toast({title: "No se puede editar", description: "Por favor selecciona una página para editar.", variant: "default"});
      return;
    }
    
    const basePath = `/organization/${organizationId}/wiki/${currentDocument?.id || ''}`;
    
    if (isEditing) {
      // Saliendo del modo edición - verificar cambios sin guardar
      if (hasUnsavedChanges) {
        if (confirm("Tienes cambios sin guardar. ¿Estás seguro de que quieres cancelar la edición? Tus cambios se perderán.")) {
          // Actualizar primero el contenido local para evitar conflictos
          setEditedContent(currentDocument?.content || '');
          // Usar navegación segura con shallow routing
          console.log(`Saliendo del modo edición con cambios descartados: ${basePath}`);
          navigateTo(basePath, { shallow: true });
        }
      } else {
        // No hay cambios sin guardar, salir directamente
        console.log(`Saliendo del modo edición sin cambios: ${basePath}`);
        navigateTo(basePath, { shallow: true });
      }
    } else {
      // Entrando al modo edición
      console.log(`Entrando al modo edición: ${basePath}?edit=true`);
      navigateTo(`${basePath}?edit=true`, { shallow: true });
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
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl flex items-center">
                        <Home className="mr-2 h-6 w-6 text-primary" /> Wiki Home
                      </CardTitle>
                      {/* Mostrar usuarios activos en la organización */}
                      <div>
                        {currentUser && (
                          <ActiveUsersIndicator 
                            documentId={organizationId} 
                            currentUserId={currentUser.uid}
                            showCount={true}
                          />
                        )}
                      </div>
                    </div>
                    <CardDescription>Bienvenido a la wiki de {organization.name}. Selecciona una página desde el menú lateral o crea una nueva.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>Usa el menú lateral para navegar entre páginas existentes o haz clic en el botón &quot;Create Page&quot; para comenzar un nuevo documento.</p>
                    <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {canEdit && (
                        <Button
                          onClick={toggleEditMode}
                          variant="outline"
                          size="sm"
                          disabled={!currentDocument}
                        >
                          <Edit3 className="mr-2 h-4 w-4" />
                          {currentDocument ? "Editar página seleccionada" : "Selecciona una página para editar"}
                        </Button>
                      )}
                      
                      <div className="flex items-center text-sm text-muted-foreground">
                        <p className="italic">
                          Última actualización de la wiki: {allDocumentsFlat.length > 0 
                            ? (() => {
                                // Filtramos documentos con fecha válida y obtenemos el más reciente
                                const validDocs = allDocumentsFlat
                                  .filter(d => d.updatedAt && !isNaN(d.updatedAt.getTime()))
                                  .map(d => d.updatedAt!.getTime());
                                
                                return validDocs.length > 0
                                  ? new Date(Math.max(...validDocs)).toLocaleString()
                                  : 'Fecha desconocida';
                              })()
                            : 'No hay documentos aún'}
                        </p>
                      </div>
                    </div>
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

                  <CollaborationWrapper
                    documentId={currentDocument.id}
                    organizationId={organizationId}
                    isEditing={isEditing}
                    documentName={currentDocument.name}
                    localContent={editedContent}
                    onEditBlocked={() => router.push(`/organization/${organizationId}/wiki/${currentDocument.id}`)}
                    onResolveConflict={(resolvedContent) => {
                      setEditedContent(resolvedContent);
                      toast({ title: 'Conflicto resuelto', description: 'El documento ha sido actualizado con la versión reconciliada.' });
                    }}
                  >
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
                  </CollaborationWrapper>
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


export default function OrganizationWikiPageWrapper() {
  return <OrganizationWikiPageComponent />;
}
