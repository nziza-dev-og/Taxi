// src/app/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth'; // Import the updated hook
import { LoadingSpinner } from '@/components/ui/loading-spinner'; // Import spinner

export default function LandingPage() {
  const router = useRouter();
  const { user, loading, role } = useAuth(); // Get user, loading state, and role

  useEffect(() => {
    // Only redirect when loading is complete
    if (!loading) {
      if (user && role) {
        // User is logged in and has a role, redirect based on role
        console.log(`User logged in. Role: ${role}. Redirecting to /${role === 'driver' ? '' : role}`);
        // Redirect driver to '/' (which is the driver portal), others to their specific path
        router.push(role === 'driver' ? '/' : `/${role}`);
      } else if (user && !role) {
         // User is logged in but role couldn't be determined (or is null)
         console.warn("User logged in but role is missing/invalid. Redirecting to driver login as fallback.");
         // Fallback: Redirect to driver login page, or show an error/logout
          router.push('/'); // Default to driver portal page which handles auth/registration/pending states
          // Alternatively, sign out:
          // import { auth } from '@/config/firebase';
          // auth.signOut();
      } else {
        // No user logged in, redirect to driver signup/login page
        console.log("No user logged in. Redirecting to driver portal.");
        router.push('/'); // The driver portal page handles the login/registration form
      }
    }
  }, [user, loading, role, router]); // Add role to dependency array

  // Show loading indicator while checking auth/role
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-muted-foreground">Welcome to CurbLink! Loading...</p>
    </div>
  );
}
