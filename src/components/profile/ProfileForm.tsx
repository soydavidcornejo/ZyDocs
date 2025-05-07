// src/components/profile/ProfileForm.tsx
'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

export function ProfileForm() {
  const { currentUser, updateUserDisplayName, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
    }
  }, [currentUser]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || !displayName.trim()) {
      toast({ title: 'Validation Error', description: 'Display name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (displayName === currentUser.displayName) {
      toast({ title: 'No Changes', description: 'Display name is the same.', variant: 'default' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserDisplayName(displayName.trim());
      // Toast is handled within updateUserDisplayName context method
    } catch (error) {
      // Toast is handled within updateUserDisplayName context method
    } finally {
      setIsSubmitting(false);
    }
  };
  
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
  }; // Explicit semicolon added

  if (authLoading) {
    return (
      <Card className="w-full max-w-2xl shadow-lg">
        <CardContent className="flex items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          Loading profile...
        </CardContent>
      </Card>
    );
  }

  if (!currentUser) {
    return (
      <Card className="w-full max-w-2xl shadow-lg">
        <CardContent className="p-10">
          <p className="text-center text-muted-foreground">Please log in to view your profile.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.displayName || 'User'} data-ai-hint="profile avatar" />
            <AvatarFallback className="text-2xl">{getInitials(currentUser.displayName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl">User Profile</CardTitle>
            <CardDescription>Manage your personal information and preferences.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={currentUser.email || ''} disabled />
            <p className="text-xs text-muted-foreground">Your email address cannot be changed.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name or nickname"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)} disabled />
             <p className="text-xs text-muted-foreground">Your role is managed by an administrator.</p>
          </div>
          {/* Add other profile fields here: preferences, etc. */}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || displayName === (currentUser.displayName || '')}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}