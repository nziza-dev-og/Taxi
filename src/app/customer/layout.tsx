
import type { Metadata } from 'next';
import '../globals.css'; // Use the main global styles
import { Toaster } from "@/components/ui/toaster"; // Ensure Toaster is available

export const metadata: Metadata = {
  title: 'CurbLink Customer', // Customer-specific title
  description: 'Book and manage your taxi rides with CurbLink.', // Customer-specific description
};

export default function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The <html> and <body> tags are provided by the RootLayout (src/app/layout.tsx)
    // This layout component wraps the content specific to the /customer/* routes.
    <>
        {/* The actual page content for /customer/* routes will be rendered here */}
        {children}

        {/* Toaster is already in RootLayout, no need to repeat unless specifically needed here */}
        {/* <Toaster /> */}
    </>
  );
}
