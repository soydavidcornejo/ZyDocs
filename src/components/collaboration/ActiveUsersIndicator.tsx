'use client';

import { useEffect, useState } from 'react';
import { getActiveUsers, type UserPresence } from '@/lib/firebase/firestore/presence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';

interface ActiveUsersIndicatorProps {
  documentId: string;
  excludeCurrentUser?: boolean;
  currentUserId?: string;
  showCount?: boolean;
  maxVisibleAvatars?: number;
}

export function ActiveUsersIndicator({ 
  documentId,
  excludeCurrentUser = false,
  currentUserId,
  showCount = true,
  maxVisibleAvatars = 3
}: ActiveUsersIndicatorProps) {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!documentId) return;
    
    const unsubscribe = getActiveUsers(documentId, (users) => {
      // Filtrar usuario actual si se requiere
      const filteredUsers = excludeCurrentUser && currentUserId 
        ? users.filter(user => user.userId !== currentUserId)
        : users;
      
      setActiveUsers(filteredUsers);
    });
    
    return () => unsubscribe();
  }, [documentId, excludeCurrentUser, currentUserId]);

  if (activeUsers.length === 0) {
    return null;
  }

  const visibleUsers = activeUsers.slice(0, maxVisibleAvatars);
  const hasMoreUsers = activeUsers.length > maxVisibleAvatars;
  const extraCount = activeUsers.length - maxVisibleAvatars;

  return (
    <TooltipProvider>
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {visibleUsers.map((user) => (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 border-2 border-background">
                  {user.photoURL ? (
                    <AvatarImage src={user.photoURL} alt={user.userName} />
                  ) : (
                    <AvatarFallback>
                      {user.userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{user.userName}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          
          {hasMoreUsers && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 border-2 border-background bg-primary text-primary-foreground">
                  <AvatarFallback>+{extraCount}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{extraCount} more active users</p>
                  <div className="text-xs">
                    {activeUsers.slice(maxVisibleAvatars).map(user => (
                      <p key={user.userId}>{user.userName}</p>
                    ))}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {showCount && (
          <div className="ml-2 flex items-center text-sm text-muted-foreground">
            <Users className="h-4 w-4 mr-1" />
            <span>{activeUsers.length} active</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
