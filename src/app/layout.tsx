import type { Metadata } from 'next';
// import { GeistSans } from 'geist/font/sans'; // Import Geist Sans - Removed as causing issues
// import { GeistMono } from 'geist/font/mono'; // Import Geist Mono - Removed as not used
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

// Apply fonts using CSS variables approach recommended by Geist
// const geistSans = GeistSans; // Remove unused variable
// const geistMono = GeistMono; // Remove unused variable

export const metadata: Metadata = {
  title: 'CurbLink Driver App', // Updated title
  description: 'Manage your taxi service efficiently with CurbLink.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">{/* Add font variables to HTML tag */}
      <body className={`antialiased`}> {/* Removed font classes from body, handled by html tag */}
        {children}
        <Toaster /> {/* Add Toaster for notifications */}
      </body>
    </html>
  );
}
