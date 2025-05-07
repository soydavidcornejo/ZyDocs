// src/app/(app)/organizations/page.tsx
'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ListChecks, PlusCircle, Loader2, Building, Settings, LogOutIcon as LeaveIcon, ExternalLink } from 'lucide-react';
import type { OrganizationMember } from '@/types/organization';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface OrganizationWithName extends OrganizationMember {
  organizationName?: string;
  isOwner?: boolean; // Add this to determine if the current user is the owner
}

export default function OrganizationsPage() {
  const { currentUser, loading: authLoading, selectActiveOrganization, leaveOrganization, refreshUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<OrganizationWithName[]>([]);
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // Store ID of org being processed (selected or left)

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push('/login?redirect=/organizations');
      } else if (currentUser.organizationMemberships && currentUser.organizationMemberships.length > 0) {
        setIsLoadingOrganizations(true);
        Promise.all(
          currentUser.organizationMemberships
            .filter(mem => mem.status === 'active')
            .map(async (mem) => {
              const orgDetails = await getOrganizationDetails(mem.organizationId);
              return { 
                ...mem, 
                organizationName: orgDetails?.name || 'Unnamed Organization',
                isOwner: orgDetails?.ownerUid === currentUser.uid // Check if current user is the owner
              };
            })
        ).then(orgsWithNames => {
          setOrganizations(orgsWithNames.sort((a,b) => (a.organizationName || "").localeCompare(b.organizationName || "")));
          setIsLoadingOrganizations(false);
        }).catch(error => {
            console.error("Error fetching organization names:", error);
            toast({ title: "Error", description: "Could not load organization details.", variant: "destructive" });
            setIsLoadingOrganizations(false);
        });
      } else {
        // No active memberships, but user exists. They might need to create one.
        // AppLayout or page logic should handle redirection to /create-organization if needed.
        setOrganizations([]);
        setIsLoadingOrganizations(false);
      }
    }
  }, [currentUser, authLoading, router, toast]);

  const handleSelectOrganization = async (organizationId: string) => {
    setIsProcessing(organizationId);
    await selectActiveOrganization(organizationId);
    // selectActiveOrganization handles routing to /docs.
    // setIsProcessing(null) might not be reached if routing is too fast.
  };

  const handleLeaveOrganization = async (organizationId: string, organizationName?: string) => {
    setIsProcessing(organizationId);
    try {
      await leaveOrganization(organizationId);
      toast({
        title: 'Left Organization',
        description: `You have successfully left "${organizationName || 'the organization'}".`,
      });
      // Refresh organizations list, refreshUserProfile is called within leaveOrganization
      // The useEffect for currentUser will re-fetch/re-filter organizations.
      // If no orgs remain, AuthContext/AppLayout will redirect to /create-organization
    } catch (error) {
      console.error('Error leaving organization:', error);
      toast({
        title: 'Error Leaving Organization',
        description: (error as Error).message || 'Could not leave the organization. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(null);
    }
  };

  if (authLoading || isLoadingOrganizations || (!currentUser && !authLoading)) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your organizations...</span>
      </div>
    );
  }
  
  if (!currentUser) {
    // Fallback, should be redirected by useEffect
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting to login...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="w-full shadow-xl mb-8">
        <CardHeader className="text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <ListChecks className="h-10 w-10 text-primary" />
              <div>
                <CardTitle className="text-3xl font-bold">Your Organizations</CardTitle>
                <CardDescription>Manage your organizations or create a new one.</CardDescription>
              </div>
            </div>
            <Button onClick={() => router.push('/create-organization')} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Organization
            </Button>
          </div>
        </CardHeader>
      </Card>

      {organizations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <Card key={org.organizationId} className="flex flex-col shadow-lg hover:shadow-primary/20 transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Building className="h-8 w-8 text-primary/70 mt-1" />
                  <div className="ml-4 flex-1">
                    <CardTitle className="text-xl">{org.organizationName}</CardTitle>
                    <CardDescription>Role: <span className="font-medium capitalize">{org.role}</span></CardDescription>
                  </div>
                  {currentUser?.currentOrganizationId === org.organizationId && (
                    <div className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Active</div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                {/* Add more org details here if needed, e.g., number of members */}
              </CardContent>
              <CardFooter className="flex flex-col space-y-2 pt-4 border-t">
                <Button
                  onClick={() => handleSelectOrganization(org.organizationId)}
                  disabled={isProcessing === org.organizationId || authLoading}
                  className="w-full"
                  variant={currentUser?.currentOrganizationId === org.organizationId ? "secondary" : "default"}
                >
                  {isProcessing === org.organizationId && currentUser?.currentOrganizationId !== org.organizationId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  {currentUser?.currentOrganizationId === org.organizationId ? 'Go to Dashboard' : 'Set Active & View Docs'}
                </Button>
                <div className="flex w-full space-x-2">
                  {org.role === 'admin' && (
                    <Button variant="outline" className="flex-1" asChild>
                       <Link href={`/organization/${org.organizationId}/settings`}>
                        <Settings className="mr-2 h-4 w-4" /> Settings
                       </Link>
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={`flex-1 ${org.role === 'admin' ? '' : 'w-full'}`}
                        disabled={isProcessing === org.organizationId || authLoading || (org.isOwner && organizations.filter(o => o.organizationId === org.organizationId && o.role === 'admin').length <=1 && org.role === 'admin' )}
                        title={(org.isOwner && organizations.filter(o => o.organizationId === org.organizationId && o.role === 'admin').length <=1 && org.role === 'admin' ) ? "Owner cannot leave if they are the only admin" : "Leave organization"}
                      >
                        <LeaveIcon className="mr-2 h-4 w-4" /> Leave
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Leave Organization</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to leave "{org.organizationName}"? 
                          {org.isOwner && org.role === 'admin' && " As the owner and an admin, leaving might transfer ownership or impact the organization if no other admins exist."}
                          This action cannot be undone by you directly.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessing === org.organizationId}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleLeaveOrganization(org.organizationId, org.organizationName)}
                          disabled={isProcessing === org.organizationId}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isProcessing === org.organizationId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Confirm Leave
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
            <CardHeader>
                 <Building className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <CardTitle className="text-2xl">No Organizations Yet</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription className="mb-6">
                    You are not a member of any organizations. <br/>
                    Create one to get started with ZyDocs.
                </CardDescription>
                <Button onClick={() => router.push('/create-organization')} size="lg">
                    <PlusCircle className="mr-2 h-5 w-5" /> Create Your First Organization
                </Button>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
