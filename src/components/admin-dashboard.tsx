
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { User, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, orderBy, limit, Timestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, X, Power, Users, Car, Clock, BarChart } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Driver, RideRequest } from '@/types'; // Import shared types
import { formatDistanceToNow } from 'date-fns';

interface AdminDashboardProps {
  adminUser: User;
}

interface DashboardStats {
    totalDrivers: number;
    pendingDrivers: number;
    approvedDrivers: number;
    activeRides: number;
}

export default function AdminDashboard({ adminUser }: AdminDashboardProps) {
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [approvedDrivers, setApprovedDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingDriverId, setProcessingDriverId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch and listen for pending drivers
  useEffect(() => {
    setLoadingDrivers(true);
    const q = query(collection(db, "drivers"), where("isApproved", "==", false), orderBy("registrationTimestamp", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Driver));
      setPendingDrivers(driversData);
      setLoadingDrivers(false);
    }, (err) => {
      console.error("Error fetching pending drivers:", err);
      setError("Failed to load pending drivers.");
      setLoadingDrivers(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch and listen for approved drivers
  useEffect(() => {
    // Separate loading state if needed, or reuse setLoadingDrivers initially
    const q = query(collection(db, "drivers"), where("isApproved", "==", true), orderBy("name", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Driver));
      setApprovedDrivers(driversData);
       // Consider setting loadingDrivers to false here only if both listeners have run,
       // or manage separate loading states. For simplicity, setting it here.
       setLoadingDrivers(false);
    }, (err) => {
      console.error("Error fetching approved drivers:", err);
      setError("Failed to load approved drivers.");
       setLoadingDrivers(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch dashboard statistics
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
        const driversSnapshot = await getDocs(collection(db, "drivers"));
        const totalDrivers = driversSnapshot.size;
        let pendingCount = 0;
        let approvedCount = 0;
        driversSnapshot.forEach(doc => {
            if (doc.data().isApproved) {
                approvedCount++;
            } else {
                pendingCount++;
            }
        });

        // Get active rides (simplified: 'accepted' or 'ongoing')
        const activeRidesQuery = query(collection(db, "rideRequests"), where("status", "in", ["accepted", "ongoing"]));
        const activeRidesSnapshot = await getDocs(activeRidesQuery);
        const activeRides = activeRidesSnapshot.size;

        setStats({
            totalDrivers,
            pendingDrivers: pendingCount,
            approvedDrivers: approvedCount,
            activeRides
        });
    } catch (err) {
        console.error("Error fetching statistics:", err);
        setError("Failed to load dashboard statistics.");
    } finally {
        setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
      fetchStats();
      // Optionally, set up listeners for stats if real-time updates are crucial
      // For simplicity, fetching once on load and maybe periodically
      const intervalId = setInterval(fetchStats, 60000); // Refresh stats every minute
      return () => clearInterval(intervalId);
  }, [fetchStats]);


  const handleApproveDriver = async (driverId: string) => {
    setProcessingDriverId(driverId);
    setError(null);
    const driverDocRef = doc(db, 'drivers', driverId);
    try {
      await updateDoc(driverDocRef, {
        isApproved: true,
      });
      toast({
        title: "Driver Approved",
        description: "The driver has been approved and can now log in.",
      });
      // Listener will update the lists automatically
    } catch (err) {
      console.error("Error approving driver:", err);
      setError("Failed to approve driver. Please try again.");
      toast({
        title: "Error",
        description: "Failed to approve driver.",
        variant: "destructive",
      });
    } finally {
      setProcessingDriverId(null);
    }
  };

  // Handle Reject (optional: could delete the driver doc or mark as rejected)
  const handleRejectDriver = async (driverId: string) => {
    setProcessingDriverId(driverId);
    setError(null);
    const driverDocRef = doc(db, 'drivers', driverId);
    try {
      // Option 1: Delete the document (use with caution)
      // await deleteDoc(driverDocRef);

      // Option 2: Mark as rejected (add an isRejected field maybe?)
       await updateDoc(driverDocRef, {
           isApproved: false, // Keep it false
           // Add a rejectedReason or rejectedTimestamp if needed
       });
       // For this example, we'll just keep them in pending or remove visually via listener

      toast({
        title: "Driver Rejected",
        description: "The driver's registration has been rejected.",
        variant: "destructive",
      });
      // Listener will update the list (if not deleted)
    } catch (err) {
      console.error("Error rejecting driver:", err);
      setError("Failed to reject driver. Please try again.");
       toast({
        title: "Error",
        description: "Failed to reject driver.",
        variant: "destructive",
      });
    } finally {
      setProcessingDriverId(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    toast({ title: "Logged Out", description: "You have been logged out successfully." });
    // App-level routing might redirect based on auth state
  };

  // Helper to format Firestore Timestamps or Date objects
  const formatRelativeTime = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        console.error("Error formatting date:", e);
        return "Invalid Date";
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b">
        <div className="flex items-center gap-3">
           <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
           <Badge variant="secondary">Admin</Badge>
        </div>
        <div className='flex items-center gap-2'>
             <span className="text-sm text-muted-foreground hidden sm:inline">{adminUser.email}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
              <Power className="h-5 w-5" />
            </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-6 space-y-6">
         {/* Display errors */}
          {error && (
              <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                   <Button onClick={() => setError(null)} variant="ghost" size="sm" className="absolute top-1 right-1">Dismiss</Button>
              </Alert>
          )}

          {/* Statistics Section */}
          <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><BarChart className="h-5 w-5"/> Overview</h2>
              {loadingStats ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card><CardHeader><CardTitle>Loading Stats...</CardTitle></CardHeader><CardContent><LoadingSpinner/></CardContent></Card>
                      <Card><CardHeader><CardTitle>Loading Stats...</CardTitle></CardHeader><CardContent><LoadingSpinner/></CardContent></Card>
                      <Card><CardHeader><CardTitle>Loading Stats...</CardTitle></CardHeader><CardContent><LoadingSpinner/></CardContent></Card>
                      <Card><CardHeader><CardTitle>Loading Stats...</CardTitle></CardHeader><CardContent><LoadingSpinner/></CardContent></Card>
                  </div>
              ) : stats ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalDrivers}</div>
                                {/* <p className="text-xs text-muted-foreground">+2 since last hour</p> */}
                            </CardContent>
                        </Card>
                       <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.pendingDrivers}</div>
                                <p className="text-xs text-muted-foreground">Drivers awaiting review</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Approved Drivers</CardTitle>
                                <Check className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.approvedDrivers}</div>
                                 <p className="text-xs text-muted-foreground">{((stats.approvedDrivers / (stats.totalDrivers || 1)) * 100).toFixed(1)}% of total</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Active Rides</CardTitle>
                                <Car className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.activeRides}</div>
                                <p className="text-xs text-muted-foreground">Rides currently in progress</p>
                            </CardContent>
                        </Card>
                  </div>
              ) : (
                  <p className="text-muted-foreground">Could not load statistics.</p>
              )}
          </section>


        {/* Pending Driver Approvals Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Pending Driver Approvals</h2>
          <Card>
            <CardContent className="pt-6">
              {loadingDrivers ? (
                 <div className="flex justify-center items-center p-6"><LoadingSpinner /></div>
              ) : pendingDrivers.length === 0 ? (
                <p className="text-center text-muted-foreground">No drivers pending approval.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDrivers.map((driver) => (
                      <TableRow key={driver.uid}>
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell>{driver.email}</TableCell>
                        <TableCell>{driver.vehicleDetails}</TableCell>
                        <TableCell>{formatRelativeTime(driver.registrationTimestamp)}</TableCell>
                        <TableCell className="text-right space-x-2">
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => handleApproveDriver(driver.uid)}
                             disabled={processingDriverId === driver.uid}
                             title="Approve Driver"
                             className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                           >
                             {processingDriverId === driver.uid ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                           </Button>
                           <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRejectDriver(driver.uid)} // Implement rejection logic if needed
                              disabled={processingDriverId === driver.uid}
                              title="Reject Driver"
                              className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900"
                            >
                               {processingDriverId === driver.uid ? <LoadingSpinner size="sm" /> : <X className="h-4 w-4" />}
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

         {/* Approved Drivers List Section */}
         <section>
             <h2 className="text-lg font-semibold mb-3">Approved Drivers</h2>
               <Card>
                    <CardContent className="pt-6">
                        {loadingDrivers && approvedDrivers.length === 0 ? ( // Show loading only if list is empty
                            <div className="flex justify-center items-center p-6"><LoadingSpinner /></div>
                        ) : approvedDrivers.length === 0 ? (
                             <p className="text-center text-muted-foreground">No drivers have been approved yet.</p>
                        ) : (
                             <Table>
                                 <TableHeader>
                                     <TableRow>
                                         <TableHead>Name</TableHead>
                                         <TableHead>Email</TableHead>
                                         <TableHead>Vehicle</TableHead>
                                         <TableHead>Status</TableHead>
                                         <TableHead>Last Seen</TableHead>
                                         {/* Add more columns if needed, e.g., Revoke Access button */}
                                     </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                     {approvedDrivers.map((driver) => (
                                         <TableRow key={driver.uid}>
                                             <TableCell className="font-medium">{driver.name}</TableCell>
                                             <TableCell>{driver.email}</TableCell>
                                             <TableCell>{driver.vehicleDetails}</TableCell>
                                             <TableCell>
                                                  <Badge variant={driver.isAvailable ? "default" : "outline"} className={driver.isAvailable ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                                                      {driver.isAvailable ? 'Available' : 'Unavailable'}
                                                  </Badge>
                                             </TableCell>
                                             <TableCell>{formatRelativeTime(driver.lastSeen)}</TableCell>
                                             {/* Add actions like Revoke if needed */}
                                             {/* <TableCell className="text-right">...</TableCell> */}
                                         </TableRow>
                                     ))}
                                 </TableBody>
                             </Table>
                        )}
                    </CardContent>
               </Card>
         </section>

      </main>

       {/* Footer */}
       <footer className="p-4 text-center text-xs text-muted-foreground border-t">
            CurbLink Admin Panel © {new Date().getFullYear()}
       </footer>
    </div>
  );
}

