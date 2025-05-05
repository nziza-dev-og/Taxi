
'use client'; // Required for hooks like useState, useEffect, usePathname

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/config/firebase';
import AppNavigation from '@/components/app-navigation'; // Import the new navigation component
import '../globals.css';

// Metadata should ideally be defined outside the component if static,
// or dynamically generated if needed. For simplicity, we keep it here.
// export const metadata: Metadata = { ... }; // Keep metadata if needed

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);

  // Optional: Add a loading state for the layout itself if needed
  // if (loading) {
  //   return <div>Loading admin section...</div>;
  // }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      {/* Include the AppNavigation component here */}
      <AppNavigation user={user} />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children} {/* The actual admin page content */}
      </main>
      {/* Remove the footer navigation if it was previously here */}
    </div>
  );
}
