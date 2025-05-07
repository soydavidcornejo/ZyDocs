// src/components/editor/WysiwygEditor.tsx
"use client";

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Image as ImageIcon, Film, FileUp, Code, Pilcrow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

interface WysiwygEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
}

const WysiwygEditor: React.FC<WysiwygEditorProps> = ({ initialContent = '', onContentChange }) => {
  const [content, setContent] = useState(initialContent);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onContentChange(newContent);
  };

  const applyFormat = (formatType: 'bold' | 'italic' | 'ul' | 'ol') => {
    // This is a very basic implementation. A real editor would need a library or more complex logic.
    let newContent = content;
    switch (formatType) {
      case 'bold':
        newContent += '**bold text**';
        break;
      case 'italic':
        newContent += '*italic text*';
        break;
      case 'ul':
        newContent += '\n- List item 1\n- List item 2';
        break;
      case 'ol':
        newContent += '\n1. Ordered item 1\n2. Ordered item 2';
        break;
    }
    setContent(newContent);
    onContentChange(newContent);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        setPreviewImageUrl(imageUrl); // For local preview
        // In a real app, upload to a server and get URL
        const markdownImage = `![${file.name}](${imageUrl})`; // Placeholder for actual URL
        const newContent = `${content}\n${markdownImage}`;
        setContent(newContent);
        onContentChange(newContent);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const insertMediaPlaceholder = (type: 'video' | 'file') => {
    let placeholder = '';
    if (type === 'video') {
      placeholder = '\n\n`youtube:VIDEO_ID` or `vimeo:VIDEO_ID`';
    } else {
      placeholder = '\n\n`file:FILE_URL` or `pdf:PDF_URL`';
    }
    const newContent = content + placeholder;
    setContent(newContent);
    onContentChange(newContent);
  };


  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-xl">Content Editor</CardTitle>
        <div className="flex items-center space-x-1 py-2 border-b">
          <Button variant="ghost" size="sm" onClick={() => applyFormat('bold')} title="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyFormat('italic')} title="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyFormat('ul')} title="Unordered List">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyFormat('ol')} title="Ordered List">
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="sm" onClick={triggerFileUpload} title="Upload Image">
            <ImageIcon className="h-4 w-4" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
            data-ai-hint="image upload"
          />
          <Button variant="ghost" size="sm" onClick={() => insertMediaPlaceholder('video')} title="Embed Video">
            <Film className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => insertMediaPlaceholder('file')} title="Upload File">
            <FileUp className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button 
            variant={isMarkdownMode ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setIsMarkdownMode(!isMarkdownMode)}
            title={isMarkdownMode ? "Rich Text Mode" : "Markdown Mode"}
          >
            {isMarkdownMode ? <Pilcrow className="h-4 w-4" /> : <Code className="h-4 w-4" /> }
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Start writing your document... Use Markdown for advanced formatting."
          className="min-h-[300px] resize-y text-base border rounded-md p-3 focus:ring-primary focus:border-primary"
          aria-label="Document content editor"
        />
        {previewImageUrl && (
          <div className="mt-4 p-2 border rounded-md">
            <p className="text-sm font-medium mb-1">Image Preview:</p>
            <Image src={previewImageUrl} alt="Preview" width={200} height={200} className="rounded-md object-contain" data-ai-hint="content image" />
          </div>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          Supports Markdown. For images, upload and it will insert Markdown. For videos/files, use placeholders like `youtube:VIDEO_ID` or `file:your-file-url.pdf`.
        </div>
      </CardContent>
    </Card>
  );
};

export default WysiwygEditor;
