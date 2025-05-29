'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { GoogleLogo } from './google-logo';

export function GoogleAuthButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        disabled
        className="border-gray-300 bg-white text-gray-400"
      >
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (status === 'authenticated') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 hidden sm:block">
          {session?.user?.email}
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => signOut()}
          className="flex items-center gap-2 border-red-300 bg-white hover:bg-red-50 text-red-600 hover:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => signIn('google')}
      className="flex items-center gap-2 border-blue-300 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 shadow-sm transition-all duration-200 hover:shadow-md"
    >
      <GoogleLogo size={16} />
      <span className="hidden sm:inline font-medium">Sign in with Google</span>
      <span className="sm:hidden font-medium">Google</span>
    </Button>
  );
} 