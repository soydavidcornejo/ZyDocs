import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a common, clean sans-serif font
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Header } from '@/components/layout/Header';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({
  variable: '--font-inter', // Example of setting CSS variable for font
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ZyDocs - Collaborative Document Management',
  description: 'ZyDocs: Centralize, organize, and share knowledge efficiently.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            {/* pt-16 ensures content starts below the fixed header (h-16) */}
            {/* The main content area itself will manage its internal layout (e.g. with sidebars) */}
            <main className="flex-grow pt-16 flex flex-col"> 
              {children}
            </main>
            <Toaster />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
