import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions, Session as NextAuthSession, User as NextAuthUser } from 'next-auth';


// Define custom Session and User types
interface CustomUser extends NextAuthUser {
  // id is inherited from NextAuthUser, no need to redefine
}

interface CustomSession extends NextAuthSession {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  user?: CustomUser;
}


export const authOptions: NextAuthOptions = {
  providers: [
    // Only add Google provider if environment variables are set
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                scope:
                  'openid email profile https://www.googleapis.com/auth/drive',
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      if (profile) {
        token.id = profile.sub;
      }
      return token;
    },
    async session({ session, token }) {
      // Use the custom session type here implicitly through assignment
      const customSession = session as CustomSession;
      customSession.accessToken = token.accessToken as string;
      customSession.refreshToken = token.refreshToken as string;
      customSession.expiresAt = token.expiresAt as number;
      if (customSession.user) {
        customSession.user.id = token.id as string;
      }
      return customSession; // Return the modified session
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-key-replace-in-production',
};