'use client';

import { useState } from 'react';
import { updateDocumentInFirestore } from '@/lib/firebase/firestore/documents';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { compareAsc } from 'date-fns';
import { AlertTriangle, Check, X, Merge } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface EditConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  localContent: string;
  serverContent: string;
  serverUpdatedAt: Date;
  onResolve: (resolvedContent: string) => void;
}

export function EditConflictResolver({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  localContent,
  serverContent,
  serverUpdatedAt,
  onResolve
}: EditConflictResolverProps) {
  const [selectedOption, setSelectedOption] = useState<'local' | 'server' | 'merge'>('local');
  const [mergedContent, setMergedContent] = useState(localContent);
  const { toast } = useToast();
  
  // Función para resolver el conflicto
  const handleResolve = async () => {
    try {
      let resolvedContent: string;
      
      switch (selectedOption) {
        case 'local':
          resolvedContent = localContent;
          break;
        case 'server':
          resolvedContent = serverContent;
          break;
        case 'merge':
          resolvedContent = mergedContent;
          break;
        default:
          resolvedContent = localContent;
      }
      
      // Actualizar el documento en Firestore
      await updateDocumentInFirestore(documentId, { content: resolvedContent });
      
      // Notificar al componente padre
      onResolve(resolvedContent);
      
      toast({
        title: "Conflicto resuelto",
        description: "El documento ha sido actualizado correctamente",
      });
      
      onClose();
    } catch (error) {
      console.error('Error al resolver conflicto:', error);
      toast({
        title: "Error",
        description: "No se pudo resolver el conflicto de edición",
        variant: "destructive",
      });
    }
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
            Conflicto de edición detectado
          </DialogTitle>
          <DialogDescription>
            Se ha detectado un conflicto en el documento "{documentTitle}". 
            Otra persona ha modificado este documento desde que comenzaste a editarlo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Importante</AlertTitle>
            <AlertDescription>
              El documento ha sido modificado por otro usuario el {formatDate(serverUpdatedAt)}. 
              Selecciona qué versión deseas conservar.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Button 
              variant={selectedOption === 'local' ? "default" : "outline"} 
              className="justify-start p-4 h-auto"
              onClick={() => setSelectedOption('local')}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center mb-2">
                  <Check className={`h-4 w-4 mr-2 ${selectedOption === 'local' ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="font-semibold">Tu versión</span>
                </div>
                <p className="text-xs text-muted-foreground text-left">
                  Conservar los cambios que has realizado durante esta sesión.
                </p>
              </div>
            </Button>
            
            <Button 
              variant={selectedOption === 'server' ? "default" : "outline"} 
              className="justify-start p-4 h-auto"
              onClick={() => setSelectedOption('server')}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center mb-2">
                  <Check className={`h-4 w-4 mr-2 ${selectedOption === 'server' ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="font-semibold">Versión del servidor</span>
                </div>
                <p className="text-xs text-muted-foreground text-left">
                  Usar la versión más reciente guardada por otro usuario.
                </p>
              </div>
            </Button>
            
            <Button 
              variant={selectedOption === 'merge' ? "default" : "outline"} 
              className="justify-start p-4 h-auto"
              onClick={() => {
                setSelectedOption('merge');
                // Inicializar el contenido combinado
                setMergedContent(`# Versión combinada

## Tu versión
${localContent}

## Versión del servidor
${serverContent}
`);
              }}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center mb-2">
                  <Check className={`h-4 w-4 mr-2 ${selectedOption === 'merge' ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="font-semibold">Combinar manualmente</span>
                </div>
                <p className="text-xs text-muted-foreground text-left">
                  Editar manualmente para combinar ambas versiones.
                </p>
              </div>
            </Button>
          </div>
          
          {/* Vista previa o editor según la opción seleccionada */}
          <div className="border rounded-md p-4 bg-card min-h-[300px] max-h-[500px] overflow-auto">
            {selectedOption === 'local' && (
              <div className="prose dark:prose-invert max-w-none">
                <h3>Tu versión</h3>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {localContent || '(Sin contenido)'}
                </ReactMarkdown>
              </div>
            )}
            
            {selectedOption === 'server' && (
              <div className="prose dark:prose-invert max-w-none">
                <h3>Versión del servidor</h3>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {serverContent || '(Sin contenido)'}
                </ReactMarkdown>
              </div>
            )}
            
            {selectedOption === 'merge' && (
              <div className="flex flex-col h-full">
                <h3 className="mb-2">Edita para combinar ambas versiones</h3>
                <textarea
                  className="flex-1 min-h-[300px] p-2 border rounded-md bg-background text-foreground"
                  value={mergedContent}
                  onChange={(e) => setMergedContent(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleResolve}>
            <Merge className="h-4 w-4 mr-2" />
            Resolver conflicto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
