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

// Check if we're in production and have required env vars
const isProduction = process.env.NODE_ENV === 'production';
const hasGoogleOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (isProduction && !process.env.NEXTAUTH_SECRET) {
  console.warn('⚠️ NEXTAUTH_SECRET is required in production');
}

if (isProduction && !process.env.NEXTAUTH_URL) {
  console.warn('⚠️ NEXTAUTH_URL should be set in production for proper redirects');
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Only add Google provider if environment variables are set
    ...(hasGoogleOAuth
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                scope:
                  'openid email profile https://www.googleapis.com/auth/drive',
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
            // Ensure proper profile handling
            profile(profile) {
              return {
                id: profile.sub,
                email: profile.email,
                name: profile.name,
                image: profile.picture,
              };
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
    // Add redirect callback to handle post-auth redirects properly
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || (isProduction ? undefined : 'dev-secret-key-replace-in-production'),
  debug: process.env.NODE_ENV === 'development',
  useSecureCookies: isProduction,
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        // Only set domain in production and if NEXTAUTH_URL is provided
        domain: isProduction && process.env.NEXTAUTH_URL 
          ? `.${process.env.NEXTAUTH_URL.replace(/https?:\/\//, '').split('/')[0]}` 
          : undefined,
      },
    },
  },
};