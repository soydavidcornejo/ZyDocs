// src/app/features/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, BookOpenText, Edit3, UploadCloud, Users, ShieldCheck, Settings, HelpCircle, BarChart2, UserCircle, Bell } from "lucide-react";
import Image from 'next/image';

export default function FeaturesPage() {
  const features = [
    { 
      icon: <BookOpenText className="h-6 w-6 text-primary" />, 
      title: "Document Hierarchy", 
      description: "Organize content with organizations, spaces, and nested pages." 
    },
    { 
      icon: <Edit3 className="h-6 w-6 text-primary" />, 
      title: "Content Editor", 
      description: "Intuitive WYSIWYG editor with Markdown support and rich text formatting." 
    },
    { 
      icon: <UploadCloud className="h-6 w-6 text-primary" />, 
      title: "Multimedia Integration", 
      description: "Upload and embed PDFs, documents, images, videos, and external content." 
    },
    { 
      icon: <Users className="h-6 w-6 text-primary" />, 
      title: "Collaboration Tools", 
      description: "Real-time collaborative editing, version history, comments, and user mentions." 
    },
    {
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary lucide lucide-git-merge"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>,
      title: "Interactive Diagrams",
      description: "Support for Mermaid and Draw.io for creating and embedding diagrams."
    },
    { 
      icon: <ShieldCheck className="h-6 w-6 text-primary" />, 
      title: "Authentication & Permissions", 
      description: "Secure Google Gmail login (OAuth 2.0) and granular permission management." 
    },
    { 
      icon: <Settings className="h-6 w-6 text-primary" />, 
      title: "Organization Management", 
      description: "Create and configure organizations, manage spaces, and view usage statistics." 
    },
    { 
      icon: <UserCircle className="h-6 w-6 text-primary" />, 
      title: "User & Profile Management", 
      description: "Invite users, manage roles, create groups, and customize user profiles." 
    },
    { 
      icon: <BarChart2 className="h-6 w-6 text-primary" />, 
      title: "System Administration", 
      description: "Admin panel for global settings, monitoring, and backup management." 
    },
    { 
      icon: <HelpCircle className="h-6 w-6 text-primary" />, 
      title: "Help & Support", 
      description: "Comprehensive help center, support ticket system, and platform updates." 
    },
     { 
      icon: <Bell className="h-6 w-6 text-primary" />, 
      title: "Notifications", 
      description: "Stay updated with mentions and important changes via notifications." 
    },
  ];

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
          Features of <span className="text-primary">ZyDocs</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover the powerful capabilities that ZyDocs offers to streamline your document management and collaboration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((feature, index) => (
          <Card key={index} className="shadow-lg hover:shadow-primary/20 transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                {feature.icon}
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground mb-6">Visualize Your Workflow</h2>
        <Image 
          src="https://picsum.photos/1000/500?random=2" 
          alt="ZyDocs Workflow Illustration" 
          width={1000} 
          height={500}
          className="rounded-xl shadow-2xl mx-auto"
          data-ai-hint="team workflow"
        />
        <p className="mt-6 text-md text-muted-foreground max-w-xl mx-auto">
          ZyDocs helps you build a structured and accessible knowledge base, fostering better communication and productivity within your organization.
        </p>
      </div>
    </div>
  );
}
