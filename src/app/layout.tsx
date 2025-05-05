
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
// Removed Geist font imports as they caused issues previously

export const metadata: Metadata = {
  title: 'CurbLink', // General title for the app
  description: 'Your reliable taxi booking platform.', // General description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased font-sans`}> {/* Apply sans-serif font globally via globals.css */}
        {children} {/* Child layouts or pages will be rendered here */}
        <Toaster /> {/* Global Toaster */}
      </body>
    </html>
  );
}
