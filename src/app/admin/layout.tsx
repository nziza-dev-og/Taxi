
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../globals.css'; // Use the main global styles
import { Toaster } from "@/components/ui/toaster";

// You can reuse fonts or define admin-specific ones if needed
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CurbLink Admin', // Admin-specific title
  description: 'Manage drivers and operations for CurbLink.', // Admin-specific description
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The <html> and <body> tags are already in the root layout (src/app/layout.tsx)
    // We just provide the content wrapper for the admin section.
    // The RootLayout's body className will still apply here.
    <>
        {children}
        {/* Toaster can be included here or rely on the root layout's toaster */}
        {/* <Toaster /> */}
    </>
  );
}

