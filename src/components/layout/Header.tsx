// src/components/layout/Header.tsx
import Link from 'next/link';
import { BookOpenText } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <BookOpenText className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">ZyDocs</span>
        </Link>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" asChild>
            <Link href="/docs/org1">Docs</Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
