
"use client"; // This component needs client-side interactivity

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import DriverRegistrationForm from '@/components/driver-registration-form';
import DriverDashboard from '@/components/driver-dashboard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null); // null means loading/unknown
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        // Check approval status only if user is logged in
        const driverDocRef = doc(db, 'drivers', currentUser.uid);
        try {
          const docSnap = await getDoc(driverDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setIsApproved(data.isApproved || false); // Default to false if field doesn't exist
             if (!data.isApproved) {
               // Check for trial period only if not approved
                const registrationDate = data.registrationTimestamp?.toDate();
                if (registrationDate) {
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    if (registrationDate > oneWeekAgo) {
                         // Still within free trial, treat as approved for dashboard access
                        setIsApproved(true);
                    }
                }
             }
          } else {
            setIsApproved(false); // Driver document doesn't exist, not approved
          }
        } catch (error) {
          console.error("Error checking driver approval:", error);
          setIsApproved(false); // Assume not approved on error
        }
      } else {
        setIsApproved(null); // No user, no approval status
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

  if (!user) {
    // User is not logged in, show registration/login
    return <DriverRegistrationForm />;
  }

  if (isApproved === false) {
    // User logged in but not approved (and trial expired)
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Account Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              Your account registration is being reviewed by an administrator.
              You will be notified once your account is approved. If your free trial has expired, please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isApproved === true) {
    // User logged in and approved (or within trial)
    return <DriverDashboard user={user} />;
  }

  // Fallback case (should ideally not be reached if logic is sound)
  return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
  );
}
