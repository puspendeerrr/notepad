import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Notepad | Minimal, Private Plain-Text Notes",
  description:
    "A distraction-free, ultra-fast online plain-text notepad with instant autosave and end-to-end user privacy.",
  metadataBase: new URL("https://notepad.puspender.in"),
  keywords: ["notepad", "notes", "minimalist editor", "plain text", "codemirror", "private notes"],
  authors: [{ name: "Puspender" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#121214" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <ThemeProvider>
          <TooltipProvider delayDuration={0} skipDelayDuration={0} disableHoverableContent>
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
