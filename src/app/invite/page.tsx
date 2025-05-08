// src/app/invite/page.tsx
'use client';

import { useEffect, useState, type FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/user';
import { UserPlus, Loader2 } from 'lucide-react';
import { createInvitationInFirestore } from '@/lib/firebase/firestore/invitations';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';
import Link from 'next/link';


function InviteUserPageContent() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('reader');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetOrganizationId, setTargetOrganizationId] = useState<string | null>(null);
  const [targetOrganizationName, setTargetOrganizationName] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const orgIdFromQuery = searchParams.get('organizationId');
    let currentOrgIdToUse: string | null = null;

    if (orgIdFromQuery) {
      currentOrgIdToUse = orgIdFromQuery;
    } else if (currentUser?.currentOrganizationId) {
      currentOrgIdToUse = currentUser.currentOrganizationId;
    }
    setTargetOrganizationId(currentOrgIdToUse);

    if (!currentOrgIdToUse && !authLoading) {
      setPermissionError("No organization specified. Please access via an organization's settings or select an active organization.");
      setInitialLoading(false);
    }
  }, [searchParams, currentUser, authLoading]);

  useEffect(() => {
    if (targetOrganizationId && currentUser) { // Ensure currentUser is available
      setInitialLoading(true);
      getOrganizationDetails(targetOrganizationId)
        .then(org => {
          if (org) {
            setTargetOrganizationName(org.name);
            const membership = currentUser.organizationMemberships?.find(m => m.organizationId === targetOrganizationId && m.status === 'active');
            if (!membership || (membership.role !== 'admin' && membership.role !== 'editor')) {
              setPermissionError(`You do not have permission to invite users to "${org.name}".`);
            } else {
              setPermissionError(null); 
            }
          } else {
            setPermissionError("Target organization not found.");
          }
        })
        .catch(() => setPermissionError("Could not load organization details."))
        .finally(() => setInitialLoading(false));
    } else if (!targetOrganizationId && !authLoading) {
        // Handles case where org ID was never set (e.g. direct navigation without query param and no active org)
        setInitialLoading(false);
    }
  }, [targetOrganizationId, currentUser, authLoading]);


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetOrganizationId || permissionError) {
      toast({ title: 'Error', description: permissionError || 'Cannot send invitation without a target organization or due to permission issues.', variant: 'destructive' });
      return;
    }
    if (!email.trim()) {
      toast({ title: 'Validation Error', description: 'Email address cannot be empty.', variant: 'destructive' });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        toast({ title: 'Validation Error', description: 'Please enter a valid email address.', variant: 'destructive' });
        return;
    }
    if (!currentUser) {
        toast({ title: 'Authentication Error', description: 'You must be logged in.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    try {
      const invitationId = await createInvitationInFirestore(
        targetOrganizationId,
        email.trim(),
        role,
        currentUser.uid,
        currentUser.email || undefined, 
        targetOrganizationName || undefined 
      );
      console.log(`Invitation created successfully with ID: ${invitationId}. Please ensure Firestore indexes are set up for pending invitation queries as detailed in src/lib/firebase/firestore/invitations.ts.`);
      toast({
        title: 'Invitation Sent',
        description: `An invitation has been sent to ${email.trim()} to join "${targetOrganizationName || 'the organization'}" as a ${role}.`,
      });
      setEmail('');
      setRole('reader');
      router.push(`/organization/${targetOrganizationId}/settings`); 
    } catch (error) {
        toast({
            title: 'Failed to Send Invitation',
            description: (error as Error).message || 'Could not send the invitation. Please try again.',
            variant: 'destructive',
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || initialLoading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading...</span></div>;
  }

  if (permissionError) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <Card className="w-full max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{permissionError}</p>
            <Button asChild className="mt-4">
              <Link href={targetOrganizationId ? `/organization/${targetOrganizationId}/settings` : "/organizations"}>
                Go Back
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!targetOrganizationId && !authLoading && !initialLoading) { // Ensure not to show if still initialLoading
     return (
      <div className="container mx-auto py-12 px-4 text-center">
        <Card className="w-full max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Missing Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Organization ID is missing or could not be determined. Please access this page via an organization's settings page.</p>
            <Button asChild className="mt-4">
              <Link href="/organizations">Go to Organizations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-center">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
             <div className="flex items-center space-x-3">
                <UserPlus className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-2xl">Invite New Member</CardTitle>
                    <CardDescription>
                        Send an invitation to join {targetOrganizationName ? `"${targetOrganizationName}"` : 'your organization'}.
                    </CardDescription>
                </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                 <Label htmlFor="orgName">Organization</Label>
                 <Input id="orgName" value={targetOrganizationName || (targetOrganizationId ? 'Loading name...' : 'Not specified')} disabled />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Assign Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as UserRole)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reader">Reader</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    {currentUser?.organizationMemberships?.find(m => m.organizationId === targetOrganizationId)?.role === 'admin' && (
                        <SelectItem value="admin">Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-2">
              <Button type="submit" disabled={isSubmitting || !targetOrganizationId || !!permissionError || initialLoading} className="w-full sm:flex-1">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
              </Button>
              <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto" type="button" disabled={isSubmitting}>
                Cancel
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function InviteUserPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading invite page...</span></div>}>
      <InviteUserPageContent />
    </Suspense>
  );
}

