"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { User, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, orderBy, limit, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore'; // Added deleteDoc
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, X, Power, Users, Car, Clock, BarChart, AlertCircle as AlertCircleIcon, Trash2, RefreshCw, User as UserIcon, ShieldCheck } from 'lucide-react'; // Renamed AlertCircle, added Trash2, RefreshCw, UserIcon, ShieldCheck
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog" // Import Alert Dialog components
import Link from 'next/link'; // Import Link for navigation

import type { Driver, RideRequest } from '@/types'; // Import shared types
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting

interface AdminDashboardProps {
  adminUser: User;
}

// Structure for dashboard stats
interface DashboardStats {
    totalDrivers: number;
    pendingDrivers: number;
    approvedDrivers: number;
    activeRides: number; // Example stat
    // Add more stats as needed: onlineDrivers, completedRidesToday, etc.
}

export default function AdminDashboard({ adminUser }: AdminDashboardProps) {
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [approvedDrivers, setApprovedDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingDriverId, setProcessingDriverId] = useState<string | null>(null); // Track which driver action is in progress
  const [driverToReject, setDriverToReject] = useState<Driver | null>(null); // Store driver info for rejection confirmation
  const { toast } = useToast();

  // --- Data Fetching & Listeners ---

  // Fetch and listen for PENDING drivers (isApproved == false)
  useEffect(() => {
    setLoadingDrivers(true);
    const q = query(
        collection(db, "drivers"),
        where("isApproved", "==", false),
        orderBy("registrationTimestamp", "desc") // Show newest pending first
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Driver));
      setPendingDrivers(driversData);
      setLoadingDrivers(false); // Stop loading once pending drivers are fetched/updated
    }, (err) => {
      console.error("Error fetching pending drivers:", err);
      setError("Failed to load pending drivers. Real-time updates may be affected.");
      setLoadingDrivers(false);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);

  // Fetch and listen for APPROVED drivers (isApproved == true)
  useEffect(() => {
    // setLoadingDrivers(true); // Can potentially reuse setLoadingDrivers or use a separate state
    const q = query(
        collection(db, "drivers"),
        where("isApproved", "==", true),
        orderBy("name", "asc") // Sort approved drivers by name
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Driver));
      setApprovedDrivers(driversData);
       // Consider setting loading false only when both listeners are ready, or use separate states.
       // Setting here for simplicity assumes pending list might load first.
       // setLoadingDrivers(false); // Moved loading false to pending listener
    }, (err) => {
      console.error("Error fetching approved drivers:", err);
      setError("Failed to load approved drivers. Real-time updates may be affected.");
       // setLoadingDrivers(false);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);

  // Fetch dashboard statistics (run once on load and maybe periodically)
  const fetchStats = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingStats(true);
    setError(null); // Clear previous stat errors
    console.log("Fetching dashboard stats...");
    try {
        // Get all drivers to count total, pending, approved
        const driversSnapshot = await getDocs(collection(db, "drivers"));
        const totalDrivers = driversSnapshot.size;
        let pendingCount = 0;
        let approvedCount = 0;
        driversSnapshot.forEach(doc => {
            if (doc.data().isApproved === true) {
                approvedCount++;
            } else {
                pendingCount++;
            }
        });

        // Get count of active rides (simplified: 'accepted' or 'ongoing')
        // Note: Firestore counts reads per document fetched. For just counts, consider summary documents updated by Cloud Functions for efficiency at scale.
        const activeRidesQuery = query(collection(db, "rideRequests"), where("status", "in", ["accepted", "ongoing"]));
        const activeRidesSnapshot = await getDocs(activeRidesQuery);
        const activeRides = activeRidesSnapshot.size;

        setStats({
            totalDrivers,
            pendingDrivers: pendingCount,
            approvedDrivers: approvedCount,
            activeRides
        });
        console.log("Stats updated:", { totalDrivers, pendingCount, approvedCount, activeRides });
    } catch (err) {
        console.error("Error fetching statistics:", err);
        setError("Failed to load dashboard statistics.");
        setStats(null); // Clear stats on error
    } finally {
        if (showLoading) setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
      fetchStats(true); // Fetch stats with loading indicator on initial mount
      // Set up interval for periodic refresh (e.g., every minute)
      const intervalId = setInterval(() => fetchStats(false), 60000); // Refresh stats every 60 seconds without loading indicator
      return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [fetchStats]);


  // --- Admin Actions ---

  // Approve a pending driver
  const handleApproveDriver = async (driverId: string, driverName: string) => {
    setProcessingDriverId(driverId);
    setError(null);
    const driverDocRef = doc(db, 'drivers', driverId);
    try {
      await updateDoc(driverDocRef, {
        isApproved: true,
        // Optionally add an 'approvedBy' field: approvedBy: adminUser.uid,
        // Optionally add an 'approvalTimestamp': approvalTimestamp: serverTimestamp()
      });
      toast({
        title: "Driver Approved",
        description: `${driverName} has been approved and can now fully use the platform.`,
      });
      // Firestore listener will automatically move the driver from pending to approved list in the UI
    } catch (err) {
      console.error("Error approving driver:", err);
      setError(`Failed to approve driver ${driverName}. Please try again.`);
      toast({
        title: "Approval Error",
        description: `Could not approve driver ${driverName}.`,
        variant: "destructive",
      });
    } finally {
      setProcessingDriverId(null); // Stop showing loading indicator for this driver
    }
  };

  // Reject a pending driver (opens confirmation dialog)
  const openRejectDialog = (driver: Driver) => {
      setDriverToReject(driver);
      // The AlertDialog component handles its own open state via the trigger
  };

  // Confirm and execute driver rejection (called from AlertDialog)
  const confirmRejectDriver = async () => {
    if (!driverToReject) return;

    const driverId = driverToReject.uid;
    const driverName = driverToReject.name;
    setProcessingDriverId(driverId); // Show loading on the button/dialog action
    setError(null);
    const driverDocRef = doc(db, 'drivers', driverId);

    try {
      // Option 1: Delete the driver document (Permanent)
      await deleteDoc(driverDocRef);

      // Option 2: Mark as rejected (Less destructive, keeps record)
      // await updateDoc(driverDocRef, {
      //   isApproved: false, // Keep it false
      //   isRejected: true, // Add a specific rejection flag
      //   rejectionTimestamp: serverTimestamp(),
      //   // Optionally add rejectedBy: adminUser.uid
      // });

      toast({
        title: "Driver Rejected",
        description: `${driverName}'s registration has been rejected and removed.`, // Adjust message based on action (deleted vs marked)
        variant: "destructive", // Use destructive variant for rejection
      });
      // Firestore listener will automatically remove the driver from the pending list.
       setDriverToReject(null); // Close the dialog implicitly by resetting the state

    } catch (err) {
      console.error("Error rejecting driver:", err);
      setError(`Failed to reject driver ${driverName}. Please try again.`);
       toast({
        title: "Rejection Error",
        description: `Could not reject driver ${driverName}.`,
        variant: "destructive",
      });
    } finally {
      setProcessingDriverId(null); // Stop loading indicator
       setDriverToReject(null); // Ensure dialog state is cleared even on error
    }
  };


  // Handle Admin Logout
  const handleLogout = async () => {
    await signOut(auth);
    toast({ title: "Logged Out", description: "You have been logged out successfully." });
    // App-level auth listener (admin/page.tsx) will handle redirecting to login
  };

  // --- Helper Functions ---

  // Format Firestore Timestamps or Date objects relatively
  const formatRelativeTime = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    try {
        // Convert Firestore Timestamp to JS Date if necessary
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        console.error("Error formatting date:", timestamp, e);
        return "Invalid Date";
    }
  };


  // --- Render Logic ---

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b shadow-sm">
        <div className="flex items-center gap-3">
           <ShieldCheck className="h-6 w-6 text-primary" /> {/* Changed Icon */}
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

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-6 space-y-6">
         {/* Display Global Errors */}
          {error && (
              <Alert variant="destructive" className="mb-4">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                   {/* Allow dismissing the error */}
                   <Button onClick={() => setError(null)} variant="ghost" size="sm" className="absolute top-1 right-1 text-destructive hover:bg-destructive/10">X</Button>
              </Alert>
          )}

          {/* Statistics Section */}
          <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart className="h-5 w-5"/> Overview</h2>
                 <Button variant="ghost" size="sm" onClick={() => fetchStats(true)} disabled={loadingStats}>
                      <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`}/>
                      <span className="ml-1">Refresh Stats</span>
                  </Button>
              </div>
              {loadingStats ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[...Array(4)].map((_, i) => ( // Skeleton loaders for stats
                           <Card key={i} className="shadow rounded-lg">
                               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Loading...</CardTitle></CardHeader>
                               <CardContent><LoadingSpinner size="md"/></CardContent>
                           </Card>
                      ))}
                  </div>
              ) : stats ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Total Drivers Stat Card */}
                        <Card className="shadow rounded-lg overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-card">
                                <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="bg-card">
                                <div className="text-2xl font-bold">{stats.totalDrivers}</div>
                                <p className="text-xs text-muted-foreground">All registered drivers</p>
                            </CardContent>
                        </Card>
                        {/* Pending Approval Stat Card */}
                       <Card className="shadow rounded-lg overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-card">
                                <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="bg-card">
                                <div className="text-2xl font-bold">{stats.pendingDrivers}</div>
                                <p className="text-xs text-muted-foreground">Drivers awaiting review</p>
                            </CardContent>
                        </Card>
                        {/* Approved Drivers Stat Card */}
                         <Card className="shadow rounded-lg overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-card">
                                <CardTitle className="text-sm font-medium">Approved Drivers</CardTitle>
                                <Check className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="bg-card">
                                <div className="text-2xl font-bold">{stats.approvedDrivers}</div>
                                 <p className="text-xs text-muted-foreground">{((stats.approvedDrivers / (stats.totalDrivers || 1)) * 100).toFixed(0)}% of total</p>
                            </CardContent>
                        </Card>
                        {/* Active Rides Stat Card */}
                         <Card className="shadow rounded-lg overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-card">
                                <CardTitle className="text-sm font-medium">Active Rides</CardTitle>
                                <Car className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="bg-card">
                                <div className="text-2xl font-bold">{stats.activeRides}</div>
                                <p className="text-xs text-muted-foreground">Rides currently in progress</p>
                            </CardContent>
                        </Card>
                  </div>
              ) : (
                   <Card className="shadow rounded-lg">
                       <CardContent className="pt-6">
                            <p className="text-center text-muted-foreground">Could not load statistics. <Button variant="link" onClick={() => fetchStats(true)}>Retry</Button></p>
                        </CardContent>
                    </Card>
              )}
          </section>


        {/* Pending Driver Approvals Section */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Pending Driver Approvals</h2>
          <Card className="shadow rounded-lg overflow-hidden">
            <CardContent className="pt-0"> {/* Remove top padding */}
              {loadingDrivers && pendingDrivers.length === 0 ? (
                 <div className="flex justify-center items-center p-10"><LoadingSpinner size="lg"/></div>
              ) : pendingDrivers.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No drivers are currently pending approval.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="hidden md:table-cell">Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDrivers.map((driver) => (
                      <TableRow key={driver.uid} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{driver.email}</TableCell>
                        <TableCell>{driver.vehicleDetails}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatRelativeTime(driver.registrationTimestamp)}</TableCell>
                        <TableCell className="text-right space-x-1">
                           {/* Approve Button */}
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => handleApproveDriver(driver.uid, driver.name)}
                             disabled={processingDriverId === driver.uid} // Disable if this driver is being processed
                             title={`Approve ${driver.name}`}
                             className="text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:hover:bg-green-500/20 rounded-full"
                           >
                             {processingDriverId === driver.uid ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                           </Button>
                           {/* Reject Button - Triggers Dialog */}
                            <AlertDialogTrigger asChild>
                               <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openRejectDialog(driver)}
                                  disabled={processingDriverId === driver.uid}
                                  title={`Reject ${driver.name}`}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-full"
                                >
                                   {processingDriverId === driver.uid ? <LoadingSpinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                               </Button>
                             </AlertDialogTrigger>
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
               <Card className="shadow rounded-lg overflow-hidden">
                    <CardContent className="pt-0"> {/* Remove top padding */}
                        {loadingDrivers && approvedDrivers.length === 0 ? ( // Show loading only if list is empty and still loading
                            <div className="flex justify-center items-center p-10"><LoadingSpinner size="lg"/></div>
                        ) : approvedDrivers.length === 0 ? (
                             <p className="text-center text-muted-foreground py-6">No drivers have been approved yet.</p>
                        ) : (
                             <Table>
                                 <TableHeader>
                                     <TableRow>
                                         <TableHead>Name</TableHead>
                                         <TableHead className="hidden sm:table-cell">Email</TableHead>
                                         <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                                         <TableHead>Status</TableHead>
                                         <TableHead className="hidden lg:table-cell">Last Seen</TableHead>
                                         {/* Add more columns if needed: Actions (Suspend, View Details) */}
                                     </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                     {approvedDrivers.map((driver) => (
                                         <TableRow key={driver.uid} className="hover:bg-muted/50">
                                             <TableCell className="font-medium">{driver.name}</TableCell>
                                             <TableCell className="hidden sm:table-cell">{driver.email}</TableCell>
                                             <TableCell className="hidden md:table-cell">{driver.vehicleDetails}</TableCell>
                                             <TableCell>
                                                  {/* Availability Badge */}
                                                  <Badge variant={driver.isAvailable ? "default" : "outline"} className={`capitalize ${driver.isAvailable ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700" : "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700"}`}>
                                                      {driver.isAvailable ? 'Available' : 'Unavailable'}
                                                  </Badge>
                                             </TableCell>
                                             <TableCell className="hidden lg:table-cell">{formatRelativeTime(driver.lastSeen)}</TableCell>
                                             {/* Add actions like Revoke/Suspend/View Details Button here */}
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

       {/* Footer with Navigation Links */}
       <footer className="p-4 text-center text-xs text-muted-foreground border-t mt-auto">
            <div className="flex justify-center gap-4 mb-2">
                <Link href="/" passHref>
                    <Button variant="link" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                        <Car className="mr-1 h-3 w-3" /> Driver Portal
                    </Button>
                </Link>
                <Link href="/customer" passHref>
                    <Button variant="link" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                        <UserIcon className="mr-1 h-3 w-3" /> Customer Portal
                    </Button>
                </Link>
                 <Link href="/admin" passHref>
                     <Button variant="link" size="sm" className="text-xs text-primary font-semibold"> {/* Highlight current page */}
                         <ShieldCheck className="mr-1 h-3 w-3" /> Admin Portal
                     </Button>
                </Link>
            </div>
            CurbLink Admin Panel © {new Date().getFullYear()}
       </footer>

        {/* Rejection Confirmation Dialog */}
        <AlertDialog open={!!driverToReject} onOpenChange={(open) => !open && setDriverToReject(null)}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Rejection</AlertDialogTitle>
                      <AlertDialogDescription>
                          Are you sure you want to reject the registration for driver{' '}
                          <span className="font-semibold">{driverToReject?.name}</span> ({driverToReject?.email})?
                          This action will permanently delete their pending registration data.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel disabled={processingDriverId === driverToReject?.uid}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                          onClick={confirmRejectDriver}
                          disabled={processingDriverId === driverToReject?.uid}
                           className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // Style action button as destructive
                       >
                          {processingDriverId === driverToReject?.uid ? <LoadingSpinner size="sm" /> : "Yes, Reject Driver"}
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
        </AlertDialog>


    </div>
  );
}
