// app/api/auth/[...nextauth]/route.ts
import { authOptions } from '@/lib/auth-options';
import NextAuth from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

// Create the handler
const handler = NextAuth(authOptions);

// Wrap the handler with error handling
async function authHandler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  try {
    return await handler(req, context);
  } catch (error) {
    console.error('NextAuth handler error:', error);
    
    // Return a proper JSON error response instead of crashing
    return NextResponse.json(
      { 
        error: 'Authentication service temporarily unavailable',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }, 
      { status: 500 }
    );
  }
}

export { authHandler as GET, authHandler as POST };
