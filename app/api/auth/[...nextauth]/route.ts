// app/api/auth/[...nextauth]/route.ts
import { authOptions } from '@/lib/auth-options';
import NextAuth from 'next-auth';

// Add error handling for missing configuration
let handler;

try {
  handler = NextAuth(authOptions);
} catch (error) {
  console.error('NextAuth initialization error:', error);
  
  // Create a fallback handler that returns an error
  handler = () => {
    return new Response('Authentication configuration error', { status: 500 });
  };
}

export { handler as GET, handler as POST };
