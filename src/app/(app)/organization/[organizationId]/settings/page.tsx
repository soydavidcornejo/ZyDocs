// src/app/(app)/organization/[organizationId]/settings/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import type { Organization } from '@/types/organization';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';

export default function OrganizationSettingsPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const { currentUser, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loadingOrgDetails, setLoadingOrgDetails] = useState(true);

  useEffect(() => {
    if (organizationId) {
      getOrganizationDetails(organizationId)
        .then(setOrganization)
        .catch(console.error)
        .finally(() => setLoadingOrgDetails(false));
    }
  }, [organizationId]);

  // Basic permission check (can be more granular)
  const canViewSettings = currentUser?.currentOrganizationId === organizationId && currentUser?.currentOrganizationRole === 'admin';

  if (authLoading || loadingOrgDetails) {
    return <div className="flex h-screen items-center justify-center">Loading settings...</div>;
  }

  if (!canViewSettings) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You do not have permission to view settings for this organization.</p>
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
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SettingsIcon className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Organization Settings</CardTitle>
                <CardDescription>
                  Manage settings for {organization ? `"${organization.name}"` : 'your organization'}.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/organizations">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Organizations
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="mt-6">
          <p className="text-muted-foreground">
            This is a placeholder for organization settings.
            Features like renaming the organization, managing member roles (beyond inviting),
            billing, integrations, and advanced security settings would go here.
          </p>
          {/* Example sections (to be implemented) */}
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">General</h3>
              <p className="text-sm text-muted-foreground">Organization Name: {organization?.name || 'Loading...'}</p>
              {/* Input to change name would go here */}
            </div>
            <div>
              <h3 className="text-lg font-semibold">Members</h3>
              <p className="text-sm text-muted-foreground">Manage member roles and permissions.</p>
              {/* Link to a more detailed member management page or component */}
            </div>
            <div>
              <h3 className="text-lg font-semibold">Billing</h3>
              <p className="text-sm text-muted-foreground">View subscription details and payment history.</p>
            </div>
             <div>
              <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
              <p className="text-sm text-muted-foreground">Delete organization (irreversible action).</p>
              <Button variant="destructive" className="mt-2" disabled>Delete Organization</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
