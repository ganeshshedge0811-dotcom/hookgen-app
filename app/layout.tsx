import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://hookgen.in"),
  title: "HookGen — AI Hook Video Generator",
  description:
    "Turn any idea into a viral hook video in 60 seconds. AI writes your hook, AI creates your video. ₹99 per video.",
  keywords: [
    "hook generator",
    "viral video",
    "content creation",
    "AI video",
    "short-form content",
    "Instagram Reels",
    "YouTube Shorts",
  ],
  openGraph: {
    title: "HookGen — AI Hook Video Generator",
    description:
      "Turn any idea into a viral hook video in 60 seconds. AI writes your hook, AI creates your video. ₹99 per video.",
    type: "website",
    locale: "en_IN",
    siteName: "HookGen",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "HookGen — Turn your idea into a viral hook video",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HookGen — AI Hook Video Generator",
    description:
      "Turn any idea into a viral hook video in 60 seconds. AI writes your hook, AI creates your video.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
