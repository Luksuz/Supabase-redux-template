// app/api/auth/[...nextauth]/route.ts
import { authOptions } from '@/lib/auth-options';
import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';

// Create the handler
const handler = NextAuth(authOptions);

// Export the handler directly with proper Next.js App Router types
export async function GET(request: NextRequest, context: any) {
  return handler(request, context);
}

export async function POST(request: NextRequest, context: any) {
  return handler(request, context);
}
