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
import { collection, getDocs, query, orderBy, limit, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { getInitials } from '@/lib/utils'; // Import the utility

export default function UserDirectoryPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login?redirect=/users');
    } else if (currentUser) {
      // This page currently shows all users in the system.
      // For organization-specific members, see organization settings page.
      // if (currentUser.currentOrganizationRole !== 'admin') { // This check is against current active org, not global role
         // Optionally restrict access to this global directory to admins only
         // toast({ title: "Access Denied", description: "You do not have permission to view the global user directory.", variant: "destructive"});
         // router.push('/organizations'); 
         // return;
      // }

      const fetchUsers = async () => {
        setLoadingData(true);
        try {
          const usersCol = collection(db, 'users');
          const usersQuery = query(usersCol, orderBy('displayName', 'asc'), limit(50));
          const userSnapshot = await getDocs(usersQuery);
          const userList = userSnapshot.docs.map(doc => {
            const data = doc.data() as Omit<UserProfile, 'uid'>; 
            const createdAt = data.createdAt && (data.createdAt as unknown as Timestamp).toDate ? (data.createdAt as unknown as Timestamp).toDate() : undefined;
            const updatedAt = data.updatedAt && (data.updatedAt as unknown as Timestamp).toDate ? (data.updatedAt as unknown as Timestamp).toDate() : undefined;
            return { 
              ...data, 
              uid: doc.id,
              createdAt,
              updatedAt,
            } as UserProfile;
          });
          setUsers(userList);
        } catch (error) {
          console.error("Error fetching users:", error);
        } finally {
          setLoadingData(false);
        }
      };
      fetchUsers();
    }
  }, [currentUser, authLoading, router]);
  
  const roleVariant = (role: UserProfile['role']): "default" | "secondary" | "outline" | "destructive" => {
    // This reflects global role from user's profile document, not org-specific role.
    switch(role) {
      case 'admin': return 'default'; // e.g., system admin based on Firestore user.role
      case 'editor': return 'secondary'; 
      case 'reader': return 'outline';
      default: return 'outline';
    }
  };


  if (authLoading || loadingData) {
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
              <CardTitle className="text-2xl">Global User Directory</CardTitle>
              <CardDescription>Browse all registered users in the system. Roles shown are global system roles.</CardDescription>
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
                    <TableHead>Global Role</TableHead>
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
