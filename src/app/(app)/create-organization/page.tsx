// src/app/(app)/create-organization/page.tsx
'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createOrganizationInFirestore } from '@/lib/firebase/firestore/organizations';
import { addOrganizationMember } from '@/lib/firebase/firestore/organizationMembers';
import { updateUserActiveOrganization } from '@/lib/firebase/firestore/users';
import { Loader2, Building } from 'lucide-react';

export default function CreateOrganizationPage() {
  const { currentUser, loading: authLoading, refreshUserProfile, requiresOrganizationCreation, setRequiresOrganizationCreation } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [organizationName, setOrganizationName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login?redirect=/create-organization');
    }
    // If user lands here but already has an org, or requirement is false, redirect.
    if (!authLoading && currentUser && currentUser.currentOrganizationId && !requiresOrganizationCreation) {
        toast({ title: "Organization Exists", description: "You are already part of an organization.", variant: "default"});
        router.push('/docs');
    }
  }, [currentUser, authLoading, router, requiresOrganizationCreation, toast]);


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to create an organization.', variant: 'destructive' });
      return;
    }
    if (!organizationName.trim()) {
      toast({ title: 'Validation Error', description: 'Organization name cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const orgId = await createOrganizationInFirestore(organizationName.trim(), currentUser.uid);
      await addOrganizationMember(orgId, currentUser.uid, 'admin', 'active');
      await updateUserActiveOrganization(currentUser.uid, orgId);
      
      // Important: Refresh user profile in context to get new active org and role
      await refreshUserProfile(); 
      setRequiresOrganizationCreation(false); // Explicitly set this off

      toast({
        title: 'Organization Created!',
        description: `"${organizationName.trim()}" has been successfully created.`,
      });
      router.push('/docs'); // Redirect to the main app/docs page
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Creation Failed',
        description: (error as Error).message || 'Could not create organization. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authLoading || (!currentUser && !authLoading)) { // Show loader if auth is loading or if no current user yet (might be redirecting)
    return (
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading...</span>
        </div>
    );
  }
  
  // If still requires org creation after loading and current user is available
  if (currentUser && !currentUser.currentOrganizationId && requiresOrganizationCreation) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Building className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4 text-2xl font-bold">Create Your Organization</CardTitle>
            <CardDescription>Let's get your team started on ZyDocs. Give your organization a name.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g., Acme Corp, My Awesome Team"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Creating...' : 'Create Organization'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // Fallback if state is somehow inconsistent, should be handled by useEffect redirect
  if (currentUser && currentUser.currentOrganizationId && !requiresOrganizationCreation){
    // User already has an org, they shouldn't be here. Redirecting via useEffect.
    return (
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Redirecting...</span>
        </div>
    );
  }

  // If user is not logged in and not loading (should be redirected by useEffect)
  return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <p>Please log in to continue.</p>
      </div>
  );
}
