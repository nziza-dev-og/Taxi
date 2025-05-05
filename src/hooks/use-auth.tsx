// src/hooks/use-auth.tsx
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase'; // Your Firebase auth and db instances

export type UserRole = 'driver' | 'customer' | 'admin' | null;

interface AuthResult {
  user: User | null;
  loading: boolean;
  role: UserRole; // Add role state
}

export const useAuth = (): AuthResult => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true); // Ensure loading is true at the start
    setRole(null); // Reset role on auth change

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // User is logged in, determine their role
        try {
          const driverDocRef = doc(db, 'drivers', currentUser.uid);
          const customerDocRef = doc(db, 'customers', currentUser.uid);
          const adminDocRef = doc(db, 'admins', currentUser.uid);

          const [driverSnap, customerSnap, adminSnap] = await Promise.all([
            getDoc(driverDocRef),
            getDoc(customerDocRef),
            getDoc(adminDocRef),
          ]);

          if (adminSnap.exists() && adminSnap.data()?.isAdmin === true) {
            setRole('admin');
          } else if (driverSnap.exists()) {
             // Add check for approval if needed for redirection logic later
            setRole('driver');
          } else if (customerSnap.exists()) {
            setRole('customer');
          } else {
            // User exists in Auth but not in any role collection
            console.warn(`User ${currentUser.email} authenticated but has no defined role in Firestore.`);
            setRole(null); // Or handle as needed, maybe redirect to error/signup completion page
             // Optionally sign out user if they should not be authenticated without a role
             // await auth.signOut();
             // setUser(null); // Clear user state
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole(null); // Assume no role on error
        }
      } else {
        // No user logged in
        setRole(null);
      }
      setLoading(false); // Finish loading after role check (or lack thereof)
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []); // Run only on mount

  return { user, loading, role };
};
