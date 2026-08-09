// /* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import { revalidatePath } from "next/cache";
// import { signIn, signOut } from "../auth";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import {  comparePassword } from "@/lib/aes";
import prisma from "@/lib/prisma";
import { brokerLoginRateLimit as loginRateLimit } from "@/lib/rateLimit";
import { signIn, signOut } from "@/lib/auth";
import { postLoginRedirect, sanitizeCallbackUrl } from '@/lib/auth-redirect'


interface LoginSuccess {
  success: true;
  message: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    slug?:string | undefined
  };
}

interface LoginFail {
  success: false;
  message: string;
  errorType?: string;
}

type LoginActionState = {
  error?: string
} | undefined

export const AdminLogin = async (provider: string) => {
  await signIn(provider, { redirectTo: "/admin/ads" });
  revalidatePath("/admin/ads");
};

export const UserLogin = async (provider: string) => {
  await signIn(provider, { redirectTo: "/" });
  revalidatePath("/");
};

export const Logout = async () => {
  await signOut({ redirectTo: "/auth/signin" });
  revalidatePath("/auth/signin");
};

export const LoginWithCredential = async (_previousState: LoginActionState, formData: FormData): Promise<LoginActionState> => {
  // Server-side throttling of repeated credential attempts. Fail-open when the
  // rate-limit store is unavailable so a Redis outage does not cause an
  // authentication outage. The response stays generic (no account existence).
  try {
    const hdrs = await headers()
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip')?.trim() || 'unknown'
    const rateResult = await loginRateLimit.limit(`login:${ip}`)
    if (!rateResult.success) {
      return { error: 'Too many login attempts. Please try again later.' }
    }
  } catch {
    // fail open: rate-limit infrastructure unavailable; proceed with login
  }

  const email = String(formData.get("email") || '').trim().toLowerCase()
  const password = String(formData.get("password") || '')
  const callbackUrl = String(formData.get('callbackUrl') || '')
  const configuredBaseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000'
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  })
  const redirectTo = postLoginRedirect(user?.role, sanitizeCallbackUrl(callbackUrl, configuredBaseUrl), configuredBaseUrl)

  try {
    await signIn("credentials", { email, password, redirectTo });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.type === "CredentialsSignin" ? "Invalid credentials!" : "Something went wrong!" };
    }
    throw error;
  }
};


export async function loginCheckUser(
  email: string, 
  password: string, 
  ip: string
): Promise<LoginSuccess | LoginFail> {
  try {
    // Rate limiting check
    const rateLimitResult = await loginRateLimit.limit(`login:${ip}`);
    if (!rateLimitResult.success) {
      return {
        success: false,
        message: "Too many login attempts. Please try again later.",
        errorType: "TooManyRequests"
      };
    }

    if (!email || !password) {
      return { 
        success: false, 
        message: "Invalid email or password.",
        errorType: "InvalidCredentials"
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { 
        success: false, 
        message: "Invalid email or password.",
        errorType: "InvalidCredentials"
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        password: true,
        emailVerified: true,
        
      },
    });

    if (!user || !user.password) {
      return { 
        success: false, 
        message: "Invalid email or password.",
        errorType: "InvalidCredentials"
      };
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return { 
        success: false, 
        message: "Invalid email or password.",
        errorType: "InvalidCredentials"
      };
    }

    // Check if email is verified
    if (!user.emailVerified && user.role === "BROKER") {
      return {
        success: false,
        message: "Invalid email or password.",
        errorType: "InvalidCredentials"
      };
    }

    // Check if account is active
    if (!user.isActive) {
      return {
        success: false,
        message: "Invalid email or password.",
        errorType: "InvalidCredentials"
      };
    }

    // Additional check for vendors
    if (user.role === "BROKER" && !user.emailVerified) {
      return {
        success: false,
        message: "Invalid email or password.",
        errorType: "InvalidCredentials"
      };
    }

    return {
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email as string ,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        // slug: user.role === "VENDOR" ? user.vendor?.slug : ''
      },
    };
  } catch (error) {
    console.error("Login check error:", error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("rate limit") || error.message.includes("Too many")) {
        return {
          success: false,
          message: "Too many login attempts. Please try again later.",
          errorType: "TooManyRequests"
        };
      }
      
      if (error.message.includes("network") || error.message.includes("ECONNREFUSED")) {
        return {
          success: false,
          message: "Unable to connect to the server. Please check your connection.",
          errorType: "NetworkError"
        };
      }
    }
    
    return { 
      success: false, 
      message: "An unexpected error occurred. Please try again.",
      errorType: "Default"
    };
  }
}
// export async function loginCheckUser(email: string, password: string): Promise<LoginSuccess | LoginFail> {
//   try {
//     if (!email || !password) return { success: false, message: "Missing credentials" };

//     const user = await prisma.user.findUnique({
//       where: { email },
//       select: {
//         id: true,
//         email: true,
//         name: true,
//         role: true,
//         isActive: true,
//         password: true,
//       },
//     });

//     if (!user || !user.password) {
//       return { success: false, message: "Invalid email or password" };
//     }

//     const isValid = await compare(password, user.password);
//     if (!isValid) {
//       return { success: false, message: "Invalid email or password" };
//     }

//     if (!user.isActive) {
//       // use role-specific wording if desired
//       return { success: false, message: "Your account is not active. Please verify your email or contact support." };
//     }

//     return {
//       success: true,
//       message: "Login successful",
//       user: {
//         id: user.id,
//         email: user.email,
//         name: user.name,
//         role: (user.role || "CUSTOMER").toString().toUpperCase(),
//         isActive: !!user.isActive,
//       },
//     };
//   } catch (error) {
//     console.error("Login check error:", error);
//     return { success: false, message: "An error occurred during login" };
//   }
// }

// export const loginCheckUser = async (email: string, password: string) => {
//   try {
//     const user = await prisma.user.findUnique({ where: { email } });
//     if (!user) return { message: "Username or password wrong.", success: false };
//     if (!user.isActive) return { message: "Please verify  before logging in.", success: false };
//     const decryptPass = await decryptPassword(user?.password as string);
//     if (decryptPass !== password) return { message: "Username or password wrong.", success: false };
//     return { message: "Successfully logged in.", success: true, user };
//   } catch (error) {
//     console.error("Login error:", error);
//     return { message: "Something went wrong.", success: false };
//   }
// };


// export async function verifyEmail(token: string) {
//     try {
//         const user = await prisma.user.findFirst({
//             where: {
//                 verificationToken: token,
//                 verificationExpires: { gt: new Date() },
//             },
//         });

//         if (!user) {
//             return {
//                 success: false,
//                 message: "Invalid or expired verification token",
//             };
//         }

//         await prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 emailVerified: new Date(),
//                 verificationToken: null,
//                 verificationExpires: null,
//                 isActive: true,
//             },
//         });

//         return {
//             success: true,
//             message: "Email verified successfully",
//         };
//     } catch (error: any) {
//         return {
//             success: false,
//             message: "Verification failed: " + error.message,
//         };
//     }
// }
