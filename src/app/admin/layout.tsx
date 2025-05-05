
import type { Metadata } from 'next';
// Import fonts if needed, or rely on RootLayout's fonts
// import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono';
import '../globals.css'; // Use the main global styles
import { Toaster } from "@/components/ui/toaster"; // Ensure Toaster is available if not in RootLayout

// Example of applying fonts if specific ones are needed for admin
// const geistSans = GeistSans;
// const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'CurbLink Admin', // Admin-specific title
  description: 'Manage drivers, rides, and platform settings for CurbLink.', // Admin-specific description
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The <html> and <body> tags are provided by the RootLayout (src/app/layout.tsx)
    // This layout component wraps the content specific to the /admin/* routes.
    // No need to repeat <html>, <body>, or global font variables here.
    <>
        {/* The actual page content for /admin/* routes will be rendered here */}
        {children}

        {/* You could include an admin-specific Toaster instance if needed,
            but usually, the one in RootLayout is sufficient. */}
        {/* <Toaster /> */}
    </>
  );
}

