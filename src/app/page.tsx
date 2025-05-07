// src/app/page.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BookOpenText, Edit3, UploadCloud, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { currentUser, loading, requiresOrganizationCreation } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser) {
      const memberships = currentUser.organizationMemberships || [];
      if (memberships.length === 0) { // Corresponds to requiresOrganizationCreation
        router.push('/create-organization');
      } else if (memberships.length > 0 && !currentUser.currentOrganizationId) {
        // Has orgs, but no active one selected
        router.push('/select-organization');
      } else if (currentUser.currentOrganizationId) {
        router.push('/docs');
      }
      // If none of the above, user stays on home page (e.g. error state or unexpected scenario)
    }
  }, [currentUser, loading, requiresOrganizationCreation, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background to-secondary/30 py-12 px-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading ZyDocs...</p>
      </div>
    );
  }
  
  // If user is logged in and redirection is in progress via useEffect
  if (currentUser && 
      ( (currentUser.organizationMemberships || []).length === 0 || // requiresOrganizationCreation
        ((currentUser.organizationMemberships || []).length > 0 && !currentUser.currentOrganizationId) ||
        currentUser.currentOrganizationId 
      )
     ) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background to-secondary/30 py-12 px-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Redirecting to your workspace...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background to-secondary/30 py-12 px-4">
      <div className="text-center max-w-3xl mx-auto">
        <BookOpenText className="h-20 w-20 text-primary mx-auto mb-6" />
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl text-foreground">
          Welcome to <span className="text-primary">ZyDocs</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
          Your collaborative hub for creating, managing, and sharing documentation seamlessly. Empower your teams with a centralized knowledge base.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button asChild size="lg" className="shadow-lg hover:shadow-primary/50 transition-shadow">
            {/* Link destination dynamically determined by auth state */}
            <Link href={currentUser ? 
                          ( (currentUser.organizationMemberships || []).length === 0 ? "/create-organization" : 
                            ((currentUser.organizationMemberships || []).length > 0 && !currentUser.currentOrganizationId ? "/select-organization" : "/docs") 
                          ) 
                          : "/login"}>
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="shadow-sm hover:shadow-md transition-shadow">
            <Link href="/features">
              Learn More
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3 max-w-5xl mx-auto">
        <FeatureCard
          icon={<BookOpenText className="h-8 w-8 text-primary" />}
          title="Document Hierarchy"
          description="Organize your knowledge with a flexible tree structure: organizations, spaces, and pages."
        />
        <FeatureCard
          icon={<Edit3 className="h-8 w-8 text-primary" />}
          title="Powerful Content Editor"
          description="Enjoy an intuitive WYSIWYG editor with Markdown support for efficient content creation."
        />
        <FeatureCard
          icon={<UploadCloud className="h-8 w-8 text-primary" />}
          title="Multimedia Integration"
          description="Easily upload and embed images, PDFs, videos, and other files directly into your documents."
        />
      </div>
      
      <div className="mt-16 max-w-4xl mx-auto">
        <Image 
          src="https://picsum.photos/1200/600?random=1" 
          alt="ZyDocs Platform Showcase" 
          width={1200} 
          height={600}
          className="rounded-xl shadow-2xl"
          data-ai-hint="collaboration software"
        />
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="text-center shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="items-center">
        <div className="p-3 bg-primary/10 rounded-full mb-3">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
