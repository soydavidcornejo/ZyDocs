// src/app/users/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2 } from 'lucide-react';

// Mock data for user directory - replace with actual data fetching
const mockUsers: UserProfile[] = [
  { uid: '1', displayName: 'Alice Wonderland', email: 'alice@example.com', photoURL: 'https://picsum.photos/seed/alice/40/40', role: 'admin' },
  { uid: '2', displayName: 'Bob The Builder', email: 'bob@example.com', photoURL: 'https://picsum.photos/seed/bob/40/40', role: 'editor' },
  { uid: '3', displayName: 'Charlie Brown', email: 'charlie@example.com', photoURL: 'https://picsum.photos/seed/charlie/40/40', role: 'reader' },
  { uid: '4', displayName: 'Diana Prince', email: 'diana@example.com', photoURL: null, role: 'reader' },
];

export default function UserDirectoryPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login?redirect=/users');
    } else if (currentUser) {
      // In a real app, fetch users associated with the current user's organization or permissions
      // For now, using mock data
      // Add current user to the list if not already there for demo purposes
      const existingUser = mockUsers.find(u => u.uid === currentUser.uid);
      let allMockUsers = mockUsers;
      if (!existingUser) {
        allMockUsers = [currentUser, ...mockUsers];
      } else {
         allMockUsers = mockUsers.map(u => u.uid === currentUser.uid ? currentUser : u);
      }

      setUsers(allMockUsers);
      setLoading(false);
    }
  }, [currentUser, authLoading, router]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    if (names.length > 0 && names[0]) {
        return names[0].substring(0, 2).toUpperCase();
    }
    return 'U';
  };
  
  const roleVariant = (role: UserProfile['role']): "default" | "secondary" | "outline" | "destructive" => {
    switch(role) {
      case 'admin': return 'default'; // Using primary color for admin
      case 'editor': return 'secondary';
      case 'reader': return 'outline';
      default: return 'outline';
    }
  };


  if (authLoading || loading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading user directory...</span></div>;
  }

  if (!currentUser) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Redirecting to login...</div>;
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">User Directory</CardTitle>
              <CardDescription>Browse members of your organization.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] sm:w-[80px] pr-2">Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    {/* Add actions column if needed, e.g., view profile, manage role (for admins) */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell className="pr-2">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} data-ai-hint="profile picture" />
                          <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.displayName || 'N/A'}</TableCell>
                      <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleVariant(user.role)} className="capitalize">{user.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No users found in this directory.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
