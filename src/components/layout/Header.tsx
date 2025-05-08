// src/components/layout/Header.tsx
import Link from 'next/link';
import { BookOpenText } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { UserProfileDropdown } from '@/components/auth/UserProfileDropdown';
import { NotificationBell } from '@/components/notifications/NotificationBell'; // Added import

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center space-x-2">
          <BookOpenText className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">ZyDocs</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-1">
           <Button variant="ghost" asChild size="sm">
            <Link href="/features">Features</Link>
          </Button>
          {/* Add other navigation links here if needed */}
        </nav>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <NotificationBell /> {/* Added NotificationBell component */}
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
