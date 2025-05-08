// src/components/notifications/NotificationItem.tsx
'use client';

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { Invitation } from '@/types/organization';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
  invitation: Invitation;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ invitation }) => {
  const { acceptUserInvitation, declineUserInvitation } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await acceptUserInvitation(invitation);
      // Toast is handled in AuthContext
    } catch (error) {
      // Error toast is handled in AuthContext
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!invitation.id) return;
    setIsProcessing(true);
    try {
      await declineUserInvitation(invitation.id);
      // Toast is handled in AuthContext
    } catch (error) {
      // Error toast is handled in AuthContext
    } finally {
      setIsProcessing(false);
    }
  };

  const timeAgo = invitation.createdAt ? formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true }) : 'a while ago';

  return (
    <div className="p-3 border-b border-border last:border-b-0">
      <p className="text-sm text-foreground mb-1">
        <span className="font-semibold">{invitation.invitedByUserEmail || 'Someone'}</span> invited you to join{' '}
        <span className="font-semibold">{invitation.organizationName || 'an organization'}</span> as a{' '}
        <span className="font-semibold capitalize">{invitation.roleToAssign}</span>.
      </p>
      <p className="text-xs text-muted-foreground mb-2">{timeAgo}</p>
      <div className="flex space-x-2">
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={isProcessing}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDecline}
          disabled={isProcessing}
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
          Decline
        </Button>
      </div>
    </div>
  );
};
