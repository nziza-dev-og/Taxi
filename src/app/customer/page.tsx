
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
      setCustomerData(null); // Reset customer data on auth change
      setIsCustomerVerified(null); // Reset verification status

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
            console.warn(`User ${currentUser.email} logged in but not found in 'customers' collection. Logging out from customer portal.`);
            setIsCustomerVerified(false);
            // Log them out as they shouldn't be accessing the customer section
             await auth.signOut();
             setUser(null); // Clear user state after sign out
             // customerData and isCustomerVerified are already reset
          }
        } catch (error) {
          console.error("Error verifying customer status:", error);
          setIsCustomerVerified(false); // Assume not a verified customer on error
          // Log them out on error too
           await auth.signOut();
           setUser(null);
           // customerData and isCustomerVerified are already reset
        }
      }
      // No user is logged in case is handled implicitly as currentUser will be null
      setLoading(false); // Set loading to false after checks are complete
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Run only on component mount

  // --- Render Logic ---

  // Initial loading state or while auth state is resolving
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If user is not logged in OR they were logged in but found not to be a customer (and logged out)
   if (!user) {
      // Show the Customer Authentication form (Login/Register)
      // Ensure it fills the available space within the layout
       return (
           <div className="flex items-center justify-center flex-1">
                <CustomerAuth />
           </div>
       );
   }

   // Loading state specifically while verifying customer status AFTER user is confirmed logged in
   // (but before isCustomerVerified is set to true or false)
   if (user && isCustomerVerified === null) {
       return (
           <div className="flex items-center justify-center flex-1">
               <p className="text-muted-foreground mr-2">Verifying customer account...</p> <LoadingSpinner size="md" />
           </div>
       );
   }

  // If user is logged in AND verified to be a customer
  if (user && isCustomerVerified === true && customerData) {
    // Show the Customer Dashboard, ensure it fills the space
    return <CustomerDashboard customer={customerData} />;
  }

  // Fallback case: If user is logged in but verification determined they are not a customer
  // (This state might be brief before the useEffect logs them out and user becomes null)
  if (user && isCustomerVerified === false) {
       return (
           <div className="flex items-center justify-center flex-1">
               <p className="text-destructive">Access Denied. Not a valid customer account.</p>
               {/* Optionally add a button to redirect or retry */}
           </div>
       );
   }


  // Default fallback - show auth form if none of the above conditions are met (should be rare)
   return (
       <div className="flex items-center justify-center flex-1">
            <CustomerAuth />
       </div>
   );
}
