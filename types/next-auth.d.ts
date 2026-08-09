// next-auth.d.ts - More flexible version
import "next-auth";
import { UserRole, VerificationStatus, BrokerStatus, SubscriptionPlan } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      image?: string | null;
      role: UserRole;
      emailVerified?: boolean;

      isActive: boolean;
      brokerProfile?: {
        id: string;
        displayName: string;
        companyName?: string | null;
        verificationStatus: VerificationStatus;
        brokerStatus: string; // Changed to string for flexibility
        profileSlug: string;
        subscription?: {
          plan: SubscriptionPlan;
          isActive: boolean;
          startDate: Date;
          endDate?: Date | null;
        } | null;
      } | null;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    image?: string | null;
    role: UserRole;
    isActive: boolean;
    emailVerified?: boolean;
    brokerProfile?: {
      id: string;
      displayName: string;
      companyName?: string | null;
      verificationStatus: VerificationStatus;
      brokerStatus: string; // Changed to string for flexibility
      profileSlug: string;
      subscription?: {
        plan: SubscriptionPlan;
        isActive: boolean;
        startDate: Date;
        endDate?: Date | null;
      } | null;
    } | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    phone?: string | null;
    role: UserRole;
    isActive: boolean;
    emailVerified?: boolean;

    brokerProfile?: {
      id: string;
      displayName: string;
      companyName?: string | null;
      verificationStatus: VerificationStatus;
      brokerStatus: string; // Changed to string for flexibility
      profileSlug: string;
      subscription?: {
        plan: SubscriptionPlan;
        isActive: boolean;
        startDate: Date;
        endDate?: Date | null;
      } | null;
    } | null;
  }
}