// src/app/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth'; // Import the updated hook
import { LoadingSpinner } from '@/components/ui/loading-spinner'; // Import spinner
import PublicLandingPage from '@/components/public-landing-page'; // Import the new landing page component

export default function LandingPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); // Get user, loading state, and role

  useEffect(() => {
    // Only redirect when loading is complete AND user is logged in
    if (!loading && user && role) {
      // User is logged in and has a role, redirect based on role
      console.log(`User logged in. Role: ${role}. Redirecting to /${role === 'driver' ? '' : role}`);
      // Redirect driver to '/' (which is the driver portal), others to their specific path
      router.push(role === 'driver' ? '/' : `/${role}`);
    } else if (!loading && user && !role) {
        // User is logged in but role couldn't be determined (or is null)
        console.warn("User logged in but role is missing/invalid. Redirecting to driver login as fallback.");
        // Fallback: Redirect to driver login page, or show an error/logout
         router.push('/'); // Default to driver portal page which handles auth/registration/pending states
         // Alternatively, sign out:
         // import { auth } from '@/config/firebase';
         // auth.signOut();
    }
    // If !loading and !user, the PublicLandingPage component will be rendered below
  }, [user, loading, role, router]); // Add role to dependency array

  // Show loading indicator while checking auth/role
  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-muted-foreground">Welcome to CurbLink! Loading...</p>
        </div>
    );
  }

  // If not loading and no user is logged in, show the public landing page
  if (!loading && !user) {
      return <PublicLandingPage />;
  }

  // Fallback (e.g., user logged in but redirect hasn't happened yet, or error state)
  // You might want a more specific loading/intermediate state here if needed
   return (
    <div className="flex flex-col items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-muted-foreground">Processing...</p>
    </div>
   );

}
