
'use client'; // Required for hooks like useState, useEffect

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/config/firebase';
import AppNavigation from '@/components/app-navigation'; // Import the shared navigation
import '../globals.css'; // Import global styles

// No specific metadata needed here unless overriding RootLayout

export default function DriverLayout({
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

  // Optional: Add a loading state specifically for the layout
  // if (loading) {
  //   return <div>Loading driver portal...</div>;
  // }

  return (
    <div className="flex min-h-screen w-full flex-col"> {/* Changed bg-muted/40 to default */}
      {/* Include the AppNavigation component */}
      <AppNavigation user={user} />
      {/* Main content area for driver pages */}
      <main className="flex flex-1 flex-col"> {/* Removed padding/gap, let page decide */}
        {children} {/* The actual driver page content (e.g., DriverHomePage or DriverDashboard) */}
      </main>
       {/* Remove the footer navigation if it was previously in DriverDashboard */}
    </div>
  );
}
