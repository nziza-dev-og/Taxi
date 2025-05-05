
"use client"; // This component needs client-side interactivity for auth state and potential location access

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import DriverRegistrationForm from '@/components/driver-registration-form';
import DriverDashboard from '@/components/driver-dashboard'; // Assuming this will be created
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Correct import for Button


export default function DriverHomePage() { // Renamed component slightly for clarity
  const [user, setUser] = useState<User | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null); // null = loading, false = not approved/trial expired, true = approved/trial active
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); // Start loading whenever auth state might change

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // User is logged in, check their status in Firestore
        const driverDocRef = doc(db, 'drivers', currentUser.uid);
        try {
          const docSnap = await getDoc(driverDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Explicitly check if approved
            if (data.isApproved === true) {
                setIsApproved(true);
            } else {
                // Not approved, check for trial period
                const registrationDate = data.registrationTimestamp?.toDate(); // Convert Firestore Timestamp to JS Date
                if (registrationDate) {
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7); // Calculate date 7 days ago

                    // Check if registration date is within the last 7 days
                    if (registrationDate > oneWeekAgo) {
                        // Still within the free trial period
                        setIsApproved(true); // Treat as approved for dashboard access during trial
                    } else {
                        // Trial period expired and not approved
                        setIsApproved(false);
                    }
                } else {
                     // Registration timestamp missing, assume not approved
                     console.warn("Registration timestamp missing for driver:", currentUser.uid);
                     setIsApproved(false);
                }
            }
          } else {
            // Driver document doesn't exist in Firestore - this shouldn't happen if registration worked
            console.error("Driver document not found for logged-in user:", currentUser.uid);
            // Check if user might be a customer or admin instead before marking as not approved
            const customerDocRef = doc(db, 'customers', currentUser.uid);
            const adminDocRef = doc(db, 'admins', currentUser.uid);
            const [customerSnap, adminSnap] = await Promise.all([getDoc(customerDocRef), getDoc(adminDocRef)]);

            if (customerSnap.exists() || adminSnap.exists()) {
                 // User is likely logged in as customer/admin, deny access to driver portal
                 console.warn(`User ${currentUser.email} is not a driver. Logging out from driver portal.`);
                 await auth.signOut(); // Log them out from this portal
                 setUser(null);
                 setIsApproved(null);
            } else {
                // Truly not found anywhere, treat as not approved driver
                setIsApproved(false);
            }
          }
        } catch (error) {
          console.error("Error checking driver approval/trial status:", error);
          setIsApproved(false); // Assume not approved on error
        }
      } else {
        // No user logged in
        setIsApproved(null); // Reset approval state
      }
      setLoading(false); // Finish loading after checking status
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Run only once on mount

  // --- Render Logic ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(space.14))]"> {/* Adjust height based on header */}
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    // User is not logged in, show the registration/login form
    // Adjust container to fit within layout
    return (
        <div className="flex items-center justify-center flex-1">
             <DriverRegistrationForm />
        </div>
    );
  }

  // User is logged in, check approval/trial status
  if (isApproved === false) {
    // User logged in but is not approved AND trial period has expired
    return (
      <div className="flex items-center justify-center flex-1 p-4">
        <Card className="w-full max-w-md shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="text-center text-lg font-semibold">Account Pending / Trial Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              Your account is either pending administrator review or your 1-week free trial has expired.
            </p>
            <p className="text-center text-muted-foreground mt-2">
                Please wait for approval or contact support to activate your subscription.
            </p>
             <Button variant="outline" onClick={() => auth.signOut()} className="mt-4 w-full">
                 Logout
             </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isApproved === true) {
    // User logged in and is approved OR is within the trial period
    // Pass the user object to the dashboard - Dashboard should fill available space
    return <DriverDashboard user={user} />;
  }

  // Fallback/Initial loading state while isApproved is still null (after user is confirmed)
   if (user && isApproved === null) {
      return (
           <div className="flex items-center justify-center flex-1">
                <LoadingSpinner size="lg"/>
           </div>
      );
   }

  // Should ideally not be reached if logic is sound, but acts as a safety net
   return (
       <div className="flex items-center justify-center flex-1">
           <DriverRegistrationForm />
       </div>
   );
}
