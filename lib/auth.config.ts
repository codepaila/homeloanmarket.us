/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "./prisma";
import { UserRole } from "@prisma/client";
import { sanitizeCallbackUrl } from './auth-redirect';
import { headers } from 'next/headers';
import { brokerLoginRateLimit } from './rateLimit';

export const authOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // AUTH_SECRET is the single canonical authentication secret. It is shared by
  // Auth.js (cookie signing), proxy.ts, and claim-context.ts so every layer
  // decodes the exact same JWE session. NEXTAUTH_SECRET is intentionally NOT
  // used as an alternative source of truth.
  secret: process.env.AUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: "USER", // Default role for Google signups
          isActive: true,
        };
      },
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        verificationToken: { label: "Verification token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        // Normalize email consistently before any lookup (same rule used by
        // registration, password reset, and email verification) so login does
        // not fail merely because of differing case, e.g. "Admin@X.com" vs
        // "admin@x.com". Stored emails are written lowercase at registration
        // and are never modified here.
        const email = String(credentials.email).trim().toLowerCase();
        const password = typeof credentials.password === 'string' ? credentials.password : '';
        const verificationToken = typeof credentials.verificationToken === 'string'
          ? credentials.verificationToken
          : '';

        // This is the shared credential boundary, including direct signIn
        // callers such as the claim flow. The server derives the IP and fails
        // open if rate-limit infrastructure is unavailable.
        try {
          const requestHeaders = await headers()
          const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
            || requestHeaders.get('x-real-ip')?.trim()
            || 'unknown'
          const rateResult = await brokerLoginRateLimit.limit(`login:${ip}`)
          if (!rateResult.success) return null
        } catch {
          // Preserve authentication availability if Redis is unavailable.
        }

        // Get user with related profiles. The shared CredentialsProvider
        // authenticates ADMIN, BROKER, and USER. The login limiter below is a
        // per-IP brute-force guard (not broker-only in effect); it is applied
        // to every role at this single shared credential boundary.
        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          include: {
            brokerProfile: {
              take: 1,
              include: {
                subscription: true
              }
            },
            accounts: true,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        // Check if user is active
        if (!user.isActive) {
          return null;
        }

        if (user.role === 'BROKER' && !user.emailVerified && !verificationToken) {
          return null;
        }

        if (verificationToken) {
          const verificationHash = crypto
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex');
          if (
            user.emailVerified !== true ||
            user.emailVerificationToken !== verificationHash ||
            !user.emailVerificationTokenExpiresAt ||
            user.emailVerificationTokenExpiresAt <= new Date()
          ) return null;

          const consumed = await prisma.user.updateMany({
            where: { id: user.id, emailVerificationToken: verificationHash },
            data: { emailVerificationToken: null, emailVerificationTokenExpiresAt: null },
          });
          if (consumed.count !== 1) return null;
        } else if (!password) {
          return null;
        }

        // Verify password
        const isValid = verificationToken || await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        // Get subscription details from broker profile
        const subscription = user.brokerProfile[0]?.subscription;
        
        // Return user object
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          image: user.image,
          isActive: user.isActive,
          brokerProfile: user.brokerProfile[0]
            ? {
                id: user.brokerProfile[0].id,
                displayName: user.brokerProfile[0].displayName,
                companyName: user.brokerProfile[0].companyName,
                verificationStatus: user.brokerProfile[0].verificationStatus,
                brokerStatus: user.brokerProfile[0].brokerStatus,
                profileSlug: user.brokerProfile[0].profileSlug,
                subscription: subscription ? {
                  plan: subscription.plan,
                  isActive: subscription.isActive,
                  startDate: subscription.startDate,
                  endDate: subscription.endDate,
                } : null
              }
            : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.emailVerified = user.emailVerified as boolean;
        token.phone = user.phone;
        token.image = user.image;
        token.role = user.role;
        token.isActive = user.isActive;
        token.brokerProfile = user.brokerProfile;
        token.isCompany = false;
      }

      // Identity claims are NEVER taken from the client. Auth.js fires this
      // callback with trigger === "update" when the client calls
      // useSession().update(); every in-app caller invokes it with no arguments
      // purely to re-sync the JWT with the database. Merging a client-supplied
      // session.user here would let a caller overwrite token.email/role and
      // redirect the database refresh below to another account (privilege
      // escalation). The refresh below re-derives every identity claim from
      // the trusted database state.

      // Refresh user data from database
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          include: {
            brokerProfile: {
              take: 1,
              include: {
                subscription: true
              }
            },
            companyMemberships: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.image = dbUser.image;
          token.phone = dbUser.phone;
          token.role = dbUser.role;
        token.emailVerified = dbUser.emailVerified as boolean;

          token.isActive = dbUser.isActive;
          token.isCompany = Boolean(dbUser.companyMemberships?.length);
          
          token.brokerProfile = null
          if (dbUser.brokerProfile[0]) {
            const subscription = dbUser.brokerProfile[0].subscription;
            token.brokerProfile = {
              id: dbUser.brokerProfile[0].id,
              displayName: dbUser.brokerProfile[0].displayName,
              companyName: dbUser.brokerProfile[0].companyName,
              verificationStatus: dbUser.brokerProfile[0].verificationStatus,
              brokerStatus: dbUser.brokerProfile[0].brokerStatus,
              profileSlug: dbUser.brokerProfile[0].profileSlug,
              subscription: subscription ? {
                plan: subscription.plan,
                isActive: subscription.isActive,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
              } : null
            };
          }
        } else {
          // The account no longer exists in the database (it was deleted).
          // Clear the token so any stale session is invalidated server-side on
          // its next use — the client-side signOut clears the cookie, this is
          // defense-in-depth for sessions that survive on other devices.
          return {} as any;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          name: token.name as string,
          email: token.email as string,
          image: token.image as string,
          phone: token.phone as string,
          role: token.role as UserRole,
          isActive: token.isActive as boolean,
          brokerProfile: token.brokerProfile,
          isCompany: token.isCompany as boolean,
          emailVerified: token.emailVerified as any,
        };
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Check if user is allowed to sign in
      if (user && "isActive" in user && !user.isActive) {
        throw new Error("Account is deactivated");
      }

      // Handle Google sign up - create profile if doesn't exist
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // Create user with Google profile. Google verifies the email address
          // via OAuth, so the account is treated as email-verified.
          const created = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              role: "USER", // Default role
              isActive: true,
              emailVerified: true,
            },
          });

          // Link the Google OAuth identity to the newly created user so claim
          // reauthentication (which checks user.accounts) can recognize it.
          if (account.providerAccountId) {
            await prisma.account
              .create({
                data: {
                  userId: created.id,
                  type: account.type || "oauth",
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                },
              })
              .catch((error: { code?: string }) => {
                // If the provider account already exists (e.g. the provider
                // email changed), leave the existing linkage untouched — never
                // reassign an Account to a different user.
                if (error?.code !== "P2002") throw error;
              });
          }
        }
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      // Returning users who log in via OAuth land on /auth/signin?callbackUrl=...
      // (the signin page's Google entry). Let that path through — after the
      // inner callbackUrl is sanitized — so the proxy can route the now-
      // authenticated user to their canonical product resume destination. The
      // proxy re-sanitizes the inner callbackUrl before redirecting, so an open
      // redirect is still impossible. All other paths keep the existing rules.
      try {
        const parsed = new URL(url, baseUrl)
        if (parsed.pathname === '/auth/signin') {
          const inner = parsed.searchParams.get('callbackUrl')
          const safeInner = inner ? sanitizeCallbackUrl(inner, baseUrl) : null
          return safeInner ? `${baseUrl}/auth/signin?callbackUrl=${encodeURIComponent(safeInner)}` : baseUrl
        }
      } catch {
        return baseUrl
      }
      const safePath = sanitizeCallbackUrl(url, baseUrl)
      if (!safePath) return baseUrl
      if (safePath === '/admin' || safePath === '/admin/dashboard') return `${baseUrl}/admin/ads`
      if (safePath === '/dashboard') return baseUrl
      return `${baseUrl}${safePath}`
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    newUser: "/",
  },
  events: {
    async createUser({ user }) {
      console.log("User created:", user.email);
    },
    async linkAccount({ user, account, profile }) {
      console.log("Account linked:", user.email);
    },
  },
  debug: process.env.NODE_ENV === "development",
} satisfies NextAuthConfig;
