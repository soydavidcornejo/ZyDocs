// src/app/(app)/organization/[organizationId]/settings/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, SettingsIcon, UserPlus, Users, MailWarning, Loader2, Trash2, Edit, ShieldCheck, ShieldAlert, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import type { Organization, OrganizationMemberWithDetails, Invitation } from '@/types/organization';
import { getOrganizationDetails } from '@/lib/firebase/firestore/organizations';
import { getOrganizationMembersWithDetails, updateOrganizationMemberRole, removeOrganizationMember } from '@/lib/firebase/firestore/organizationMembers';
import { getPendingInvitationsForOrganization, cancelInvitationInFirestore, createInvitationInFirestore } from '@/lib/firebase/firestore/invitations';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getInitials } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserRole } from '@/types/user';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


export default function OrganizationSettingsPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const router = useRouter();
  const { currentUser, loading: authLoading, refreshUserProfile } = useAuth();
  const { toast } = useToast();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMemberWithDetails[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null); // e.g., "cancel-invite-id" or "remove-member-id"

  const fetchData = useCallback(async () => {
    if (!organizationId || !currentUser) return;
    setIsLoading(true);
    try {
      const [orgDetails, orgMembers, orgInvites] = await Promise.all([
        getOrganizationDetails(organizationId),
        getOrganizationMembersWithDetails(organizationId, 'active'),
        (currentUser.currentOrganizationRole === 'admin' || currentUser.currentOrganizationRole === 'editor') 
          ? getPendingInvitationsForOrganization(organizationId) 
          : Promise.resolve([]),
      ]);
      setOrganization(orgDetails);
      setMembers(orgMembers);
      setPendingInvitations(orgInvites);
    } catch (error) {
      console.error('Error fetching organization data:', error);
      toast({ title: 'Error', description: 'Could not load organization details.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, currentUser, toast]);

  useEffect(() => {
    if (currentUser && organizationId) {
      if (currentUser.currentOrganizationId !== organizationId) {
        toast({ title: "Access Denied", description: "This is not your active organization.", variant: "destructive" });
        router.push('/organizations');
        return;
      }
      fetchData();
    }
  }, [currentUser, organizationId, fetchData, router, toast]);

  const handleRoleChange = async (memberCompositeId: string, newRole: UserRole) => {
     const memberUserId = memberCompositeId.split('_')[1]; // Extract userId from compositeId
    if (!currentUser || currentUser.currentOrganizationRole !== 'admin' || currentUser.uid === memberUserId) { 
        toast({ title: "Permission Denied", description: "You cannot change your own role or you lack permissions.", variant: "destructive" });
        return;
    }
    const memberToChange = members.find(m => m.id === memberCompositeId);
    if(memberToChange && organization?.ownerUid === memberToChange.userId && newRole !== 'admin') {
        toast({ title: "Action Not Allowed", description: "The organization owner must always be an admin.", variant: "destructive" });
        return;
    }

    setProcessingAction(`role-${memberCompositeId}`);
    try {
      await updateOrganizationMemberRole(memberCompositeId, newRole); 
      toast({ title: 'Role Updated', description: `Member's role has been changed to ${newRole}.` });
      fetchData(); 
    } catch (error) {
      console.error('Error updating role:', error);
      toast({ title: 'Error', description: 'Could not update member role.', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRemoveMember = async (memberCompositeId: string, memberName?: string) => {
     const memberUserId = memberCompositeId.split('_')[1];
     if (!currentUser || currentUser.currentOrganizationRole !== 'admin' || currentUser.uid === memberUserId) {
        toast({ title: "Permission Denied", description: "You cannot remove yourself or you lack permissions.", variant: "destructive" });
        return;
    }
    const memberToRemove = members.find(m => m.id === memberCompositeId);
    if(memberToRemove && organization?.ownerUid === memberToRemove.userId) {
        toast({ title: "Action Not Allowed", description: "The organization owner cannot be removed.", variant: "destructive" });
        return;
    }

    setProcessingAction(`remove-${memberCompositeId}`);
    try {
      await removeOrganizationMember(memberCompositeId);
      toast({ title: 'Member Removed', description: `${memberName || 'The member'} has been removed from the organization.` });
      fetchData(); 
       if (memberUserId === currentUser?.uid) { 
        await refreshUserProfile(); 
        router.push('/organizations');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast({ title: 'Error', description: 'Could not remove member.', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string, inviteeEmail: string) => {
    setProcessingAction(`cancel-${invitationId}`);
    try {
      await cancelInvitationInFirestore(invitationId);
      toast({ title: 'Invitation Cancelled', description: `Invitation for ${inviteeEmail} has been cancelled.` });
      fetchData(); 
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({ title: 'Error', description: 'Could not cancel invitation.', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };
  
  const handleResendInvitation = async (invitation: Invitation) => {
    setProcessingAction(`resend-${invitation.id}`);
    try {
      if (invitation.id) {
         await cancelInvitationInFirestore(invitation.id);
      }
      await createInvitationInFirestore(
        invitation.organizationId,
        invitation.invitedUserEmail,
        invitation.roleToAssign,
        currentUser!.uid, 
        currentUser!.email || undefined,
        organization?.name
      );
      toast({ title: 'Invitation Resent', description: `A new invitation has been sent to ${invitation.invitedUserEmail}.` });
      fetchData(); 
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({ title: 'Error Resending', description: (error as Error).message || 'Could not resend invitation.', variant: 'destructive' });
    } finally {
      setProcessingAction(null);
    }
  };


  const canManageMembers = currentUser?.currentOrganizationId === organizationId && 
                           (currentUser?.currentOrganizationRole === 'admin' || currentUser?.currentOrganizationRole === 'editor');
  const isAdmin = currentUser?.currentOrganizationRole === 'admin';


  if (authLoading || isLoading) {
    return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2">Loading settings...</span></div>;
  }

  if (!organization) {
     return (
      <div className="container mx-auto py-12 px-4 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader><CardTitle>Organization Not Found</CardTitle></CardHeader>
          <CardContent><p>The requested organization does not exist or you do not have access.</p>
          <Button asChild className="mt-4"><Link href="/organizations">Go to Organizations</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // This check is now also handled by useEffect, but kept for safety
  if (currentUser?.currentOrganizationId !== organizationId) {
     return (
      <div className="container mx-auto py-12 px-4 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
          <CardContent><p>This is not your active organization. Please switch organizations to view its settings.</p>
          <Button asChild className="mt-4"><Link href="/organizations">Go to Organizations</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <SettingsIcon className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Organization Settings</CardTitle>
                <CardDescription>
                  Manage settings for &quot;{organization.name}&quot;.
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
        <CardContent className="mt-2">
           <h3 className="text-lg font-semibold mb-2">General</h3>
           <p className="text-sm text-muted-foreground">Organization Name: <span className="font-medium">{organization.name}</span></p>
           {/* TODO: Add rename organization functionality for owner/admin */}
        </CardContent>
      </Card>

      {/* Members Section */}
      {canManageMembers && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Users className="h-6 w-6 text-primary" />
                    <CardTitle className="text-xl">Manage Members</CardTitle>
                </div>
                <Button asChild>
                    <Link href={`/invite?organizationId=${organizationId}`}>
                        <UserPlus className="mr-2 h-4 w-4" /> Invite New Member
                    </Link>
                </Button>
            </div>
            <CardDescription>View and manage current members of your organization.</CardDescription>
          </CardHeader>
          <CardContent>
            {members.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Avatar</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead>Role</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.photoURL || undefined} alt={member.displayName || 'User'} data-ai-hint="profile avatar"/>
                            <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{member.displayName || 'N/A'}</TableCell>
                        <TableCell className="hidden sm:table-cell">{member.email}</TableCell>
                        <TableCell>
                          {isAdmin && currentUser.uid !== member.userId && organization.ownerUid !== member.userId ? (
                            <Select 
                                value={member.role} 
                                onValueChange={(newRole) => handleRoleChange(member.id, newRole as UserRole)}
                                disabled={processingAction === `role-${member.id}`}
                            >
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="reader">Reader</SelectItem>
                                </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={member.role === 'admin' ? 'default' : member.role === 'editor' ? 'secondary' : 'outline'} className="capitalize">{member.role}</Badge>
                          )}
                           {organization.ownerUid === member.userId && <Badge variant="destructive" className="ml-2 text-xs">Owner</Badge>}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {currentUser.uid !== member.userId && organization.ownerUid !== member.userId && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                   <Button variant="ghost" size="icon" title="Remove Member" disabled={processingAction === `remove-${member.id}`}>
                                      {processingAction === `remove-${member.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                   </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {member.displayName || member.email} from this organization? Their access will be revoked.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={processingAction === `remove-${member.id}`}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRemoveMember(member.id, member.displayName || member.email || undefined)}
                                      disabled={processingAction === `remove-${member.id}`}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {processingAction === `remove-${member.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                      Remove Member
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No active members found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations Section */}
       {(isAdmin || currentUser?.currentOrganizationRole === 'editor') && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center space-x-3">
                <MailWarning className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl">Pending Invitations</CardTitle>
            </div>
            <CardDescription>Manage invitations that have been sent but not yet accepted.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invited Email</TableHead>
                      <TableHead>Role to Assign</TableHead>
                      <TableHead className="hidden md:table-cell">Invited By</TableHead>
                      <TableHead className="hidden md:table-cell">Date Invited</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvitations.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.invitedUserEmail}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{invite.roleToAssign}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell">{invite.invitedByUserEmail || getInitials(invite.invitedByUserUid)}</TableCell>
                        <TableCell className="hidden md:table-cell">{(invite.createdAt as Date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right space-x-1">
                           <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleResendInvitation(invite)} 
                              disabled={!!processingAction && processingAction.startsWith('resend-')}
                              title="Resend Invitation"
                            >
                              {processingAction === `resend-${invite.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                           </Button>
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="Cancel Invitation" disabled={!!processingAction && processingAction.startsWith('cancel-')}>
                                    {processingAction === `cancel-${invite.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to cancel the invitation for {invite.invitedUserEmail}?
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={processingAction === `cancel-${invite.id}`}>Keep Invitation</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleCancelInvitation(invite.id!, invite.invitedUserEmail)}
                                    disabled={processingAction === `cancel-${invite.id}`}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {processingAction === `cancel-${invite.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Cancel Invitation
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No pending invitations.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger Zone - Placeholder */}
      {isAdmin && (
        <Card className="shadow-lg border-destructive">
          <CardHeader>
             <div className="flex items-center space-x-3">
                <ShieldAlert className="h-6 w-6 text-destructive" />
                <CardTitle className="text-xl text-destructive">Danger Zone</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              These actions are critical and may have irreversible consequences.
            </p>
            {/* Example: Delete Organization Button (placeholder) */}
            <Button variant="destructive" disabled>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Organization
            </Button>
            <p className="text-xs text-destructive mt-1">This action cannot be undone.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
