
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
    const [loadingAuth, setLoadingAuth] = useState(true); // Renamed for clarity
    const [loadingStatus, setLoadingStatus] = useState(false); // For status check after auth

    useEffect(() => {
        setLoadingAuth(true);
        setIsApproved(null); // Reset status on auth change

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false); // Auth check finished

            if (currentUser) {
                setLoadingStatus(true); // Start status check
                setIsApproved(null); // Reset status while checking
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
                                setIsApproved(registrationDate > oneWeekAgo); // True if within trial, false otherwise
                            } else {
                                 // Registration timestamp missing, assume not approved/trial expired
                                 console.warn("Registration timestamp missing for driver:", currentUser.uid);
                                 setIsApproved(false);
                            }
                        }
                    } else {
                        // Driver document doesn't exist in Firestore - this shouldn't happen if registration worked
                        // BUT it could mean user logged in is a customer or admin
                        console.warn("Driver document not found for logged-in user:", currentUser.uid, "Logging out from driver portal.");
                        setIsApproved(false); // Assume not a driver
                         await auth.signOut(); // Log them out from driver portal
                         setUser(null); // Clear user state
                         setIsApproved(null); // Reset approval state
                    }
                } catch (error) {
                    console.error("Error checking driver approval/trial status:", error);
                    setIsApproved(false); // Assume not approved on error
                } finally {
                    setLoadingStatus(false); // Status check finished
                }
            } else {
                // No user logged in, ensure status is null and loading is false
                setIsApproved(null);
                setLoadingStatus(false);
            }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []); // Run only once on mount

    // --- Render Logic ---

    // 1. Initial Auth Loading
    if (loadingAuth) {
        return (
            <div className="flex items-center justify-center flex-1">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // 2. No User Logged In
    if (!user) {
        return (
            <div className="flex items-center justify-center flex-1">
                <DriverRegistrationForm />
            </div>
        );
    }

    // 3. User Logged In, Loading Status Check
    if (user && loadingStatus) {
         return (
             <div className="flex items-center justify-center flex-1">
                 <p className="text-muted-foreground mr-2">Checking account status...</p>
                 <LoadingSpinner size="md"/>
             </div>
         );
    }

    // 4. User Logged In, Status Determined

    // Approved OR In Trial Period
    if (user && isApproved === true) {
        return <DriverDashboard user={user} />;
    }

    // Not Approved / Trial Expired
    if (user && isApproved === false) {
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


    // Fallback: Should not be reached if logic is sound, but good practice to have.
    // This could happen if isApproved is still null after loadingStatus is false (edge case/error).
    return (
         <div className="flex items-center justify-center flex-1">
            <p className="text-muted-foreground">Unexpected state. Please try refreshing.</p>
              <Button variant="outline" onClick={() => auth.signOut()} className="ml-4">
                  Logout
              </Button>
         </div>
    );
}
