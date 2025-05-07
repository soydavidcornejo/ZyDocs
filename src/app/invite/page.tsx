// src/app/invite/page.tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/user';
import { UserPlus, Loader2 } from 'lucide-react';

export default function InviteUserPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('reader');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'editor'))) {
      toast({ title: 'Access Denied', description: 'You do not have permission to invite users.', variant: 'destructive'});
      router.push('/'); // Or to a "permission denied" page
    }
  }, [currentUser, authLoading, router, toast]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Validation Error', description: 'Email address cannot be empty.', variant: 'destructive' });
      return;
    }
    // Basic email validation (can be more robust)
    if (!/\S+@\S+\.\S+/.test(email)) {
        toast({ title: 'Validation Error', description: 'Please enter a valid email address.', variant: 'destructive' });
        return;
    }


    setIsSubmitting(true);
    // Simulate sending an invitation
    // In a real app, this would call a backend API or Firebase Function
    // to create an invitation record and potentially send an email.
    console.log(`Inviting user: ${email} with role: ${role}`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

    toast({
      title: 'Invitation Sent (Simulated)',
      description: `An invitation has been sent to ${email} with the role of ${role}.`,
    });

    setEmail('');
    setRole('reader');
    setIsSubmitting(false);
  };

  if (authLoading) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading...</span></div>;
  }

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'editor')) {
    // This is a fallback, useEffect should handle redirection.
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Access Denied. You will be redirected.</div>;
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="flex justify-center">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader>
             <div className="flex items-center space-x-3">
                <UserPlus className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-2xl">Invite New User</CardTitle>
                    <CardDescription>Send an invitation to join your organization.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
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
              <div className="space-y-2">
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
                    {currentUser.role === 'admin' && ( // Only admins can assign admin role
                        <SelectItem value="admin">Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
