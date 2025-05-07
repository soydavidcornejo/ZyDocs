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
import { Loader2, Edit2 } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export function ProfileForm() {
  const { currentUser, updateUserDisplayNameAndPhoto, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL);
    }
  }, [currentUser]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || !displayName.trim()) {
      toast({ title: 'Validation Error', description: 'Display name cannot be empty.', variant: 'destructive' });
      return;
    }
    // Check if only display name or photoURL changed
    const nameChanged = displayName.trim() !== (currentUser.displayName || '');
    const photoChanged = photoURL !== currentUser.photoURL;

    if (!nameChanged && !photoChanged) {
      toast({ title: 'No Changes', description: 'Profile information is the same.', variant: 'default' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserDisplayNameAndPhoto(displayName.trim(), photoURL);
      // Toast is handled within updateUserDisplayNameAndPhoto context method
    } catch (error) {
      // Toast is handled within updateUserDisplayNameAndPhoto context method
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handlePhotoChange = () => {
    const newPhotoURL = prompt("Enter new photo URL (or leave blank to remove):", photoURL || "");
    if (newPhotoURL !== null) { // prompt returns null if cancelled
      setPhotoURL(newPhotoURL.trim() === '' ? null : newPhotoURL.trim());
    }
  };


  if (authLoading && !currentUser) {
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

  const currentOrgRoleDisplay = currentUser.currentOrganizationId && currentUser.currentOrganizationRole
    ? currentUser.currentOrganizationRole.charAt(0).toUpperCase() + currentUser.currentOrganizationRole.slice(1)
    : 'N/A';

  return (
    <Card className="w-full max-w-2xl shadow-lg">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center space-x-0 sm:space-x-4">
          <div className="relative group mb-4 sm:mb-0">
            <Avatar className="h-24 w-24 sm:h-20 sm:w-20">
              <AvatarImage src={photoURL || undefined} alt={currentUser.displayName || 'User'} data-ai-hint="profile avatar" />
              <AvatarFallback className="text-3xl sm:text-2xl">{getInitials(displayName || currentUser.displayName)}</AvatarFallback>
            </Avatar>
            <Button 
              variant="outline" 
              size="icon" 
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-primary hover:text-primary-foreground"
              onClick={handlePhotoChange}
              title="Change profile picture (URL)"
              type="button"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <CardTitle className="text-2xl text-center sm:text-left">{displayName || 'User Profile'}</CardTitle>
            <CardDescription className="text-center sm:text-left">Manage your personal information and preferences.</CardDescription>
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
            <Label htmlFor="currentOrganizationRole">Role in Active Organization</Label>
            <Input id="currentOrganizationRole" value={currentOrgRoleDisplay} disabled />
            <p className="text-xs text-muted-foreground">
              {currentUser.currentOrganizationId 
                ? "Your role within the active organization. This is managed by organization administrators."
                : "No organization is currently active."
              }
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || (displayName === (currentUser.displayName || '') && photoURL === currentUser.photoURL)}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
