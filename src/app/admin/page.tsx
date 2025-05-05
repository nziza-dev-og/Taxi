
"use client"; // This component needs client-side interactivity for auth state and data fetching

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import AdminAuth from '@/components/admin-auth'; // Component for admin login/registration
import AdminDashboard from '@/components/admin-dashboard'; // Component for the admin dashboard view
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null: loading, true: is admin, false: not admin
  const [loading, setLoading] = useState(true); // Overall loading state for the page

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true); // Start loading on auth change
      setUser(currentUser);

      if (currentUser) {
        // User is logged in, check if they are an admin in Firestore
        const adminDocRef = doc(db, 'admins', currentUser.uid); // Look in 'admins' collection
        try {
          const docSnap = await getDoc(adminDocRef);
          if (docSnap.exists() && docSnap.data()?.isAdmin === true) {
            // User document exists in 'admins' and isAdmin field is true
            setIsAdmin(true);
          } else {
            // User document doesn't exist in 'admins' or isAdmin is not true
            setIsAdmin(false);
            console.warn(`User ${currentUser.email} attempted admin access but is not authorized.`);
            // Optionally sign them out immediately if they somehow reached this page without being admin
             await auth.signOut();
             setUser(null); // Clear user state after sign out
             setIsAdmin(null); // Reset admin status
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false); // Assume not admin on error
          // Optionally sign out on error too
           await auth.signOut();
           setUser(null);
           setIsAdmin(null);
        }
      } else {
        // No user is logged in
        setIsAdmin(null); // Reset admin status
      }
      setLoading(false); // Finish loading after check
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Run only on component mount

  // --- Render Logic ---

  // Initial loading state for the page
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If user is not logged in OR they are logged in but verified NOT to be an admin
  if (!user || isAdmin === false) {
    // Show the Admin Authentication form (Login/Register for Admins)
    return <AdminAuth />;
  }

  // If user is logged in AND verified to be an admin
  if (isAdmin === true && user) {
    // Show the Admin Dashboard
    return <AdminDashboard adminUser={user} />; // Pass the admin user object to the dashboard
  }

   // Loading state specifically while verifying admin status after user is confirmed logged in
   if (user && isAdmin === null) {
      return (
           <div className="flex items-center justify-center min-h-screen">
               <p className="text-muted-foreground mr-2">Verifying admin access...</p> <LoadingSpinner size="md" />
           </div>
      );
   }

  // Fallback case - should ideally not be reached if logic is sound.
  // Defaults to showing the Auth form.
   return <AdminAuth />;
}
