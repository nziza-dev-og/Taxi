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
      setIsAdmin(null); // Reset admin status on auth change

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
            console.warn(`User ${currentUser.email} attempted admin access but is not authorized. Logging out.`);
            // Log them out immediately as they shouldn't be in the admin section
             await auth.signOut();
             setUser(null); // Clear user state after sign out
             // isAdmin remains false
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false); // Assume not admin on error
          // Log them out on error too
           await auth.signOut();
           setUser(null);
        }
      }
      // No user logged in case handled implicitly
      setLoading(false); // Finish loading after check
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Run only on component mount

  // --- Render Logic ---

  // Initial loading state for the page while auth resolves
  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1"> {/* Use flex-1 */}
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // User NOT Logged In
  if (!user) {
    // Show the Admin Authentication form, ensure it fills space
    return (
      <div className="flex items-center justify-center flex-1">
        <AdminAuth />
      </div>
    );
  }

   // Loading state specifically while verifying admin status AFTER user is confirmed logged in
   if (user && isAdmin === null) {
      return (
           <div className="flex items-center justify-center flex-1">
               <p className="text-muted-foreground mr-2">Verifying admin access...</p> <LoadingSpinner size="md" />
           </div>
      );
   }

   // User logged in but verified NOT to be an admin
   if (user && isAdmin === false) {
      // This state might be brief before the useEffect logs them out and user becomes null
       return (
           <div className="flex items-center justify-center flex-1">
               <p className="text-destructive">Access Denied. Not an authorized administrator.</p>
               {/* Optionally add a button to redirect or retry */}
           </div>
       );
   }


  // User is logged in AND verified to be an admin
  if (user && isAdmin === true) {
    // Show the Admin Dashboard, ensure it fills space
    return <AdminDashboard adminUser={user} />;
  }


  // Fallback case - should ideally not be reached. Defaults to showing the Auth form.
   return (
       <div className="flex items-center justify-center flex-1">
           <AdminAuth />
       </div>
   );
}
