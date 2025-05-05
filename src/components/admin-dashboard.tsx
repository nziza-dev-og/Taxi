
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth'; // Removed signOut as it's handled by AppNavigation
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, orderBy, limit, Timestamp, writeBatch, deleteDoc } from 'firebase/firestore'; // Added deleteDoc
import { db } from '@/config/firebase'; // Removed auth as it's not directly used for logout here anymore
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, X, Users, Car, Clock, BarChart, AlertCircle as AlertCircleIcon, Trash2, RefreshCw, ShieldCheck } from 'lucide-react'; // Removed Power, UserIcon as they are in AppNavigation now
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
// Removed Link import as footer nav is gone

import type { Driver, RideRequest } from '@/types'; // Import shared types
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting

interface AdminDashboardProps {
  adminUser: User; // Renamed from 'user' for clarity in this context
}

// Structure for dashboard stats
interface DashboardStats {
    totalDrivers: number;
    pendingDrivers: number;
    approvedDrivers: number;
    activeRides: number; // Example stat
}

export default function AdminDashboard({ adminUser }: AdminDashboardProps) {
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [approvedDrivers, setApprovedDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingDriverId, setProcessingDriverId] = useState<string | null>(null);
  const [driverToReject, setDriverToReject] = useState<Driver | null>(null); // State holds the driver object to reject
  const { toast } = useToast();

  // --- Data Fetching & Listeners ---

  useEffect(() => {
    setLoadingDrivers(true);
    const q = query(
        collection(db, "drivers"),
        where("isApproved", "==", false),
        orderBy("registrationTimestamp", "desc")
    );
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

  useEffect(() => {
    const q = query(
        collection(db, "drivers"),
        where("isApproved", "==", true),
        orderBy("name", "asc")
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Driver));
      setApprovedDrivers(driversData);
    }, (err) => {
      console.error("Error fetching approved drivers:", err);
      setError("Failed to load approved drivers.");
    });
    return () => unsubscribe();
  }, []);

  const fetchStats = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingStats(true);
    setError(null);
    try {
        const driversSnapshot = await getDocs(collection(db, "drivers"));
        const totalDrivers = driversSnapshot.size;
        let pendingCount = 0;
        let approvedCount = 0;
        driversSnapshot.forEach(doc => {
            if (doc.data().isApproved === true) approvedCount++;
            else pendingCount++;
        });
        const activeRidesQuery = query(collection(db, "rideRequests"), where("status", "in", ["accepted", "ongoing"]));
        const activeRidesSnapshot = await getDocs(activeRidesQuery);
        const activeRides = activeRidesSnapshot.size;
        setStats({ totalDrivers, pendingDrivers: pendingCount, approvedDrivers: approvedCount, activeRides });
    } catch (err) {
        console.error("Error fetching statistics:", err);
        setError("Failed to load dashboard statistics.");
        setStats(null);
    } finally {
        if (showLoading) setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
      fetchStats(true);
      const intervalId = setInterval(() => fetchStats(false), 60000);
      return () => clearInterval(intervalId);
  }, [fetchStats]);


  // --- Admin Actions ---

  const handleApproveDriver = async (driverId: string, driverName: string) => {
    setProcessingDriverId(driverId);
    setError(null);
    const driverDocRef = doc(db, 'drivers', driverId);
    try {
      await updateDoc(driverDocRef, { isApproved: true });
      toast({
        title: "Driver Approved",
        description: `${driverName} has been approved.`,
      });
    } catch (err) {
      console.error("Error approving driver:", err);
      setError(`Failed to approve driver ${driverName}.`);
      toast({ title: "Approval Error", description: `Could not approve driver ${driverName}.`, variant: "destructive" });
    } finally {
      setProcessingDriverId(null);
    }
  };

  const openRejectDialog = (driver: Driver) => {
      setDriverToReject(driver); // Set the driver object to state
  };

  const confirmRejectDriver = async () => {
    if (!driverToReject) return; // Ensure driverToReject state is set
    const driverId = driverToReject.uid;
    const driverName = driverToReject.name;
    setProcessingDriverId(driverId);
    setError(null);
    const driverDocRef = doc(db, 'drivers', driverId);
    try {
      await deleteDoc(driverDocRef); // Permanently delete
      toast({ title: "Driver Rejected", description: `${driverName}'s registration has been rejected and removed.`, variant: "destructive" });
      setDriverToReject(null); // Close the dialog by resetting state
    } catch (err) {
      console.error("Error rejecting driver:", err);
      setError(`Failed to reject driver ${driverName}.`);
      toast({ title: "Rejection Error", description: `Could not reject driver ${driverName}.`, variant: "destructive" });
    } finally {
      setProcessingDriverId(null);
       // Reset state even on error to potentially close dialog
       // setDriverToReject(null);
    }
  };

  // Removed handleLogout - now handled by AppNavigation

  // --- Helper Functions ---

  const formatRelativeTime = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        console.error("Error formatting date:", timestamp, e);
        return "Invalid Date";
    }
  };


  // --- Render Logic ---

  return (
    // This component now directly returns the content that should fill the space within AdminLayout
    <div className="space-y-6"> {/* Use a div to wrap sections and control spacing */}
         {/* Display Global Errors */}
          {error && (
              <Alert variant="destructive" className="mb-4">
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
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
                      {[...Array(4)].map((_, i) => (
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
            <CardContent className="pt-0">
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
                             disabled={processingDriverId === driver.uid}
                             title={`Approve ${driver.name}`}
                             className="text-green-600 hover:text-green-700 hover:bg-green-500/10 dark:hover:bg-green-500/20 rounded-full"
                           >
                             {processingDriverId === driver.uid ? <LoadingSpinner size="sm" /> : <Check className="h-4 w-4" />}
                           </Button>
                           {/* Reject Button with AlertDialog */}
                           <AlertDialog>
                               <AlertDialogTrigger asChild>
                                   <Button
                                      variant="ghost"
                                      size="icon"
                                      // No onClick needed here, just opens the dialog
                                      disabled={processingDriverId === driver.uid}
                                      title={`Reject ${driver.name}`}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-full"
                                    >
                                       {processingDriverId === driver.uid ? <LoadingSpinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                                   </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Confirm Rejection</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          Are you sure you want to reject the registration for driver{' '}
                                          <span className="font-semibold">{driver.name}</span> ({driver.email})?
                                          This action will permanently delete their pending registration data.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel disabled={processingDriverId === driver.uid}>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                          // Call confirmRejectDriver with the specific driver when clicked
                                          onClick={async () => {
                                            setDriverToReject(driver); // Set the driver to reject
                                            await confirmRejectDriver(); // Call the rejection logic
                                          }}
                                          disabled={processingDriverId === driver.uid}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                          {processingDriverId === driver.uid ? <LoadingSpinner size="sm" /> : "Yes, Reject Driver"}
                                      </AlertDialogAction>
                                  </AlertDialogFooter>
                               </AlertDialogContent>
                           </AlertDialog>
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
                    <CardContent className="pt-0">
                        {loadingDrivers && approvedDrivers.length === 0 && pendingDrivers.length > 0 ? ( // Show loading only if there are no pending either
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
                                     </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                     {approvedDrivers.map((driver) => (
                                         <TableRow key={driver.uid} className="hover:bg-muted/50">
                                             <TableCell className="font-medium">{driver.name}</TableCell>
                                             <TableCell className="hidden sm:table-cell">{driver.email}</TableCell>
                                             <TableCell className="hidden md:table-cell">{driver.vehicleDetails}</TableCell>
                                             <TableCell>
                                                  <Badge variant={driver.isAvailable ? "default" : "outline"} className={`capitalize ${driver.isAvailable ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700" : "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700"}`}>
                                                      {driver.isAvailable ? 'Available' : 'Unavailable'}
                                                  </Badge>
                                             </TableCell>
                                             <TableCell className="hidden lg:table-cell">{formatRelativeTime(driver.lastSeen)}</TableCell>
                                         </TableRow>
                                     ))}
                                 </TableBody>
                             </Table>
                        )}
                    </CardContent>
               </Card>
         </section>

        {/*
          Remove the standalone AlertDialog. The dialog is now generated
          inside the map loop for each pending driver row.
        */}


    </div> // End wrapping div
  );
}
