/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import prisma from "./prisma";
import { authOptions } from "./auth.config";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authOptions,
  adapter: PrismaAdapter(prisma) as any,
  // Critical for Vercel / production
  trustHost: true, // Required when behind proxy (Vercel, etc.)
});