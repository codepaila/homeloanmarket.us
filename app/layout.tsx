import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "./providers/SessionProvider";
import { Toaster } from "react-hot-toast";
import { getSiteUrl } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site/settings";
import { AnalyticsProvider } from "@/lib/analytics/provider";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: settings.seoTitle,
      template: `%s | ${settings.siteName}`,
    },
    description: settings.seoDescription,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: settings.siteName,
      title: settings.seoTitle,
      description: settings.seoDescription,
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seoTitle,
      description: settings.seoDescription,
    },
    icons: settings.siteFavicon ? { icon: settings.siteFavicon, shortcut: settings.siteFavicon } : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${jakarta.variable} ${inter.variable} min-h-screen `}>
        <Toaster />
        <AnalyticsProvider>
          <SessionProvider>{children}</SessionProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
