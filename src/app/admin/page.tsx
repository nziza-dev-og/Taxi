
"use client"; // This component needs client-side interactivity for auth state

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import AdminAuth from '@/components/admin-auth';
import AdminDashboard from '@/components/admin-dashboard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null means loading/unknown
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        // Check if the logged-in user is an admin
        const adminDocRef = doc(db, 'admins', currentUser.uid);
        try {
          const docSnap = await getDoc(adminDocRef);
          if (docSnap.exists() && docSnap.data()?.isAdmin === true) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false); // User exists but is not marked as admin in the DB
            // Optionally log them out automatically if they somehow got here without being an admin
             await auth.signOut();
             setUser(null); // Clear user state after sign out
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false); // Assume not admin on error
           await auth.signOut(); // Log out on error as well
           setUser(null);
        }
      } else {
        setIsAdmin(null); // No user, no admin status
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || isAdmin === false) {
    // User is not logged in, or is logged in but not an admin
    return <AdminAuth />;
  }

  if (isAdmin === true && user) {
    // User is logged in and confirmed as admin
    return <AdminDashboard adminUser={user} />;
  }

   // Fallback/initial loading case before isAdmin state is determined
   // This helps prevent briefly showing the Auth form if the user is already logged in
   if (user && isAdmin === null) {
      return (
           <div className="flex items-center justify-center min-h-screen">
                <LoadingSpinner />
           </div>
      );
   }

  // Default case (should ideally not be reached if logic is sound)
   return <AdminAuth />;
}
