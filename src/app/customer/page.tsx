
"use client";

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import CustomerAuth from '@/components/customer-auth'; // Component for customer login/registration
import CustomerDashboard from '@/components/customer-dashboard'; // Component for customer dashboard view
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { Customer } from '@/types'; // Import Customer type

export default function CustomerPage() {
  const [user, setUser] = useState<User | null>(null);
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCustomerVerified, setIsCustomerVerified] = useState<boolean | null>(null); // Tracks if the logged-in user is in the 'customers' collection

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        // User is logged in, check if they exist in the 'customers' collection
        const customerDocRef = doc(db, 'customers', currentUser.uid);
        try {
          const docSnap = await getDoc(customerDocRef);
          if (docSnap.exists()) {
            // User document exists in 'customers'
            setCustomerData({ uid: docSnap.id, ...docSnap.data() } as Customer);
            setIsCustomerVerified(true);
          } else {
            // User exists in Auth but NOT in 'customers' collection.
            // This could happen if they signed up as a driver/admin or if there was an error during signup.
            console.warn(`User ${currentUser.email} logged in but not found in 'customers' collection.`);
            setIsCustomerVerified(false);
            // Log them out as they shouldn't be accessing the customer section
             await auth.signOut();
             setUser(null);
             setCustomerData(null);
             setIsCustomerVerified(null); // Reset verification status
          }
        } catch (error) {
          console.error("Error verifying customer status:", error);
          setIsCustomerVerified(false); // Assume not a verified customer on error
          // Log them out on error too
           await auth.signOut();
           setUser(null);
           setCustomerData(null);
           setIsCustomerVerified(null);
        }
      } else {
        // No user is logged in
        setCustomerData(null);
        setIsCustomerVerified(null); // Reset verification status
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Run only on component mount

  // --- Render Logic ---

  // Initial loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If user is not logged in OR they are logged in but verified NOT to be a customer
   if (!user || isCustomerVerified === false) {
      // Show the Customer Authentication form (Login/Register)
      return <CustomerAuth />;
   }


  // If user is logged in AND verified to be a customer
  if (user && isCustomerVerified === true && customerData) {
    // Show the Customer Dashboard
    return <CustomerDashboard customer={customerData} />; // Pass customer data to the dashboard
  }

  // Loading state specifically while verifying customer status after user is confirmed logged in
   if (user && isCustomerVerified === null) {
       return (
           <div className="flex items-center justify-center min-h-screen">
               <p className="text-muted-foreground mr-2">Verifying customer account...</p> <LoadingSpinner size="md" />
           </div>
       );
   }


  // Fallback case - should ideally not be reached. Defaults to showing the Auth form.
  return <CustomerAuth />;
}
