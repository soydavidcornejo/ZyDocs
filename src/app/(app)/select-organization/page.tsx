// src/app/(app)/select-organization/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { List, PlusCircle, Loader2, Building } from 'lucide-react';
import type { OrganizationMember } from '@/types/organization';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations'; // To fetch org names

interface OrganizationWithName extends OrganizationMember {
  organizationName?: string;
}

export default function SelectOrganizationPage() {
  const { currentUser, loading: authLoading, selectActiveOrganization, requiresOrganizationCreation } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationWithName[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);
  const [isSelecting, setIsSelecting] = useState<string | null>(null); // Store ID of org being selected

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push('/login?redirect=/select-organization');
      } else if (currentUser.currentOrganizationId) {
        // If an organization is already active, redirect to docs
        router.push('/docs');
      } else if (requiresOrganizationCreation) {
        // If user truly has no orgs and must create one
        router.push('/create-organization');
      } else if (currentUser.organizationMemberships) {
        setIsLoadingOrganizations(true);
        Promise.all(
          currentUser.organizationMemberships
            .filter(mem => mem.status === 'active') // only show active memberships
            .map(async (mem) => {
              const orgDetails = await getOrganizationDetails(mem.organizationId);
              return { ...mem, organizationName: orgDetails?.name || 'Unnamed Organization' };
            })
        ).then(orgsWithNames => {
          setOrganizations(orgsWithNames);
          setIsLoadingOrganizations(false);
          if (orgsWithNames.length === 0 && !requiresOrganizationCreation) {
            // Edge case: User has memberships array but all are inactive, or error fetching names.
            // Treat as needing to create an organization if no active ones to select.
             router.push('/create-organization');
          }
        }).catch(error => {
            console.error("Error fetching organization names:", error);
            setIsLoadingOrganizations(false);
            // Potentially redirect to create-organization or show error
        });
      } else {
        // Fallback if memberships are somehow undefined but not loading and not requiresCreation
        setIsLoadingOrganizations(false);
        router.push('/create-organization');
      }
    }
  }, [currentUser, authLoading, router, requiresOrganizationCreation]);

  const handleSelectOrganization = async (organizationId: string) => {
    setIsSelecting(organizationId);
    await selectActiveOrganization(organizationId);
    // selectActiveOrganization should handle routing to /docs and loading state internally
    // setIsSelecting(null) might not be reached if routing happens first.
  };

  if (authLoading || isLoadingOrganizations || (!currentUser && !authLoading)) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your organizations...</span>
      </div>
    );
  }
  
  if (!currentUser || (currentUser.organizationMemberships && currentUser.organizationMemberships.filter(m => m.status === 'active').length === 0 && !requiresOrganizationCreation) ) {
     // If no active memberships and not explicitly in creation flow, likely needs to create one.
     // This is a fallback, useEffect should handle redirection.
    return (
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center flex-col">
            <Building className="h-12 w-12 text-primary/50 mb-4" />
            <p className="text-muted-foreground">No active organizations found.</p>
            <Button onClick={() => router.push('/create-organization')} className="mt-4">
                Create Your First Organization
            </Button>
        </div>
    );
  }


  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <List className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4 text-2xl font-bold">Select Your Organization</CardTitle>
          <CardDescription>Choose an organization to continue or create a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {organizations.length > 0 ? (
            organizations.map((org) => (
              <Button
                key={org.organizationId}
                variant="outline"
                className="w-full justify-start py-6 text-left"
                onClick={() => handleSelectOrganization(org.organizationId)}
                disabled={isSelecting === org.organizationId || authLoading}
              >
                {isSelecting === org.organizationId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Building className="mr-3 h-5 w-5 text-muted-foreground" />
                )}
                <span className="flex-grow">{org.organizationName}</span>
                <span className="text-xs capitalize text-muted-foreground">Role: {org.role}</span>
              </Button>
            ))
          ) : (
            <p className="text-center text-muted-foreground">You are not a member of any active organizations.</p>
          )}
        </CardContent>
        <CardFooter className="flex-col space-y-2">
          <Button 
            onClick={() => router.push('/create-organization')} 
            className="w-full"
            disabled={authLoading || !!isSelecting}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Organization
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
