
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { User, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, GeoPoint, serverTimestamp, collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Power, MapPin, PhoneCall, CheckCircle, XCircle, Car, LogOut } from 'lucide-react'; // Added LogOut
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Driver, RideRequest } from '@/types'; // Import shared types

// Interface for Driver Data fetched from Firestore (matches src/types/index.ts Driver)
interface DriverData extends Driver {}

interface DriverDashboardProps {
  user: User;
}

export default function DriverDashboard({ user }: DriverDashboardProps) {
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeoPoint | null>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null); // Handle one request at a time
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const { toast } = useToast();

  // --- Data Fetching and Listeners ---

  // Fetch initial driver data
  const fetchDriverData = useCallback(async () => {
      setError(null);
      const driverDocRef = doc(db, 'drivers', user.uid);
      try {
          const docSnap = await getDoc(driverDocRef);
          if (docSnap.exists()) {
              const data = { uid: docSnap.id, ...docSnap.data() } as DriverData; // Ensure uid is included
              setDriverData(data);
              if (data.location) {
                  setCurrentLocation(data.location); // Set initial location from DB
              }
          } else {
              setError("Driver data not found. Please contact support.");
              console.error("Driver document missing for UID:", user.uid);
              await signOut(auth); // Log out if critical data is missing
          }
      } catch (err) {
          console.error("Error fetching driver data:", err);
          setError("Failed to load driver data. Please check your connection and try again.");
      } finally {
          setLoading(false);
      }
  }, [user.uid]);

  // Effect for initial fetch and setting up Firestore listener for driver data
  useEffect(() => {
      setLoading(true);
      fetchDriverData(); // Initial fetch

      const driverDocRef = doc(db, 'drivers', user.uid);
      const unsubscribeDriver = onSnapshot(driverDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const updatedData = { uid: docSnap.id, ...docSnap.data() } as DriverData;
              setDriverData(updatedData);
              // Optionally update local location state if needed, but primary update is via handleLocationUpdate
              // Avoid direct state update here based on snapshot if handleLocationUpdate also updates Firestore, to prevent loops.
          } else {
              setError("Driver data sync lost. Logging out.");
              console.error("Driver document disappeared for UID:", user.uid);
              signOut(auth);
          }
      }, (err) => {
          console.error("Error listening to driver data:", err);
          setError("Connection error monitoring your data. Please check internet.");
          // Consider if logout is appropriate here or just show error
      });

      return () => unsubscribeDriver(); // Cleanup listener on unmount
  }, [fetchDriverData, user.uid]);

 // Effect for listening to relevant ride requests
 useEffect(() => {
    if (!driverData || !driverData.isAvailable) {
        setRideRequest(null); // Clear requests if driver goes unavailable
        return; // Don't listen if unavailable
    }

    console.log("Setting up ride request listener...");

    // Listen for new PENDING requests.
    // Simple approach: Listen to all pending requests and let driver choose.
    // Advanced: Could filter by region, driver assignment, etc.
    const requestsRef = collection(db, "rideRequests");
    const q = query(
        requestsRef,
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'), // Get the latest pending requests first
        limit(5) // Limit the number of pending requests listened to for performance
    );

    const unsubscribeRequests = onSnapshot(q, (querySnapshot) => {
        console.log(`Received ${querySnapshot.docs.length} pending requests snapshot.`);
        let latestRequest: RideRequest | null = null;

        // Find the first suitable pending request (usually the latest)
        // In this simple model, we just take the first one if we don't have an active accepted ride.
        if (!rideRequest || rideRequest.status !== 'accepted') {
            if (!querySnapshot.empty) {
                 const docSnap = querySnapshot.docs[0]; // Get the latest one based on query order
                 latestRequest = { id: docSnap.id, ...docSnap.data() } as RideRequest;
                 console.log("Potential new request found:", latestRequest.id);
            }
        }

        // Update state only if the found request is different from the current one,
        // or if no requests are found and we need to clear the existing one.
        if (latestRequest?.id !== rideRequest?.id) {
            setRideRequest(latestRequest);
             if (latestRequest) {
                 toast({ title: "New Ride Request!", description: `From: ${latestRequest.pickupAddress || 'Near specified location'}`});
             }
        } else if (!latestRequest && rideRequest?.status === 'pending') {
            // If no pending requests are found by the listener, clear the current *pending* request display
            setRideRequest(null);
            console.log("No pending requests found, clearing displayed request.");
        }

    }, (err) => {
        console.error("Error listening to ride requests:", err);
        setError("Failed to fetch nearby ride requests.");
    });

    return () => {
        console.log("Cleaning up ride request listener.");
        unsubscribeRequests();
    };

}, [driverData?.isAvailable, user.uid, rideRequest?.status]); // Re-run listener if availability or current ride status changes


  // --- Location Handling ---

  // Update location in Firestore and local state
  const handleLocationUpdate = useCallback(async (isAvailable: boolean) => {
    if (!isAvailable) return; // Only update location if driver is available

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      toast({ title: "Location Error", description: "Geolocation not supported.", variant: "destructive" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLocation = new GeoPoint(position.coords.latitude, position.coords.longitude);

        // Check if location has actually changed to avoid unnecessary Firestore writes
        if (!currentLocation || !newLocation.isEqual(currentLocation)) {
          setCurrentLocation(newLocation); // Update local state first for responsiveness
          const driverDocRef = doc(db, 'drivers', user.uid);
          try {
            await updateDoc(driverDocRef, {
              location: newLocation,
              lastSeen: serverTimestamp(), // Update last seen timestamp whenever location is updated
            });
            console.log("Location updated in Firestore:", newLocation.latitude, newLocation.longitude);
          } catch (err) {
            console.error("Error updating location in Firestore:", err);
            // Don't show toast for every background update failure, just log
          }
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        let message = "Could not get your current location.";
        if (error.code === error.PERMISSION_DENIED) {
            message = "Location permission denied. Please enable location services in your browser/OS settings.";
        }
        setError(message);
        toast({
            title: "Location Error",
            description: message,
            variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options for accuracy
    );
  }, [user.uid, currentLocation, toast]); // Include currentLocation in dependencies

  // Effect for periodic location updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (driverData?.isAvailable) {
      // Update immediately when becoming available
      handleLocationUpdate(true);
      // Set interval for periodic updates
      intervalId = setInterval(() => handleLocationUpdate(true), 30000); // Update every 30 seconds
    } else {
      // Clear interval if driver becomes unavailable
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    // Cleanup interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [driverData?.isAvailable, handleLocationUpdate]); // Depend on availability and the update function itself


  // --- UI Event Handlers ---

  // Toggle driver availability status
  const handleAvailabilityToggle = async (checked: boolean) => {
    if (!driverData) return; // Should not happen if component is rendered

    setIsUpdatingAvailability(true);
    setError(null);
    const driverDocRef = doc(db, 'drivers', user.uid);
    try {
      await updateDoc(driverDocRef, {
        isAvailable: checked,
        lastSeen: serverTimestamp(), // Update last seen on toggle
      });
      // Firestore listener (useEffect above) will update the driverData state automatically.
      toast({
        title: `Status Updated`,
        description: `You are now ${checked ? 'Available for rides' : 'Unavailable'}.`,
      });
      if (checked) {
        // If becoming available, trigger immediate location update
        handleLocationUpdate(true);
      } else {
          // If becoming unavailable, clear any displayed pending request
          setRideRequest(null);
      }
    } catch (err) {
      console.error("Error updating availability:", err);
      setError("Failed to update status. Please try again.");
      // Revert UI optimistically? Listener should correct it eventually.
      // setDriverData(prev => prev ? {...prev, isAvailable: !checked} : null);
      toast({ title: "Error", description: "Could not update availability.", variant: "destructive" });
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

   // Accept a pending ride request
   const handleAcceptRequest = async (requestId: string) => {
        if (!driverData || !driverData.isAvailable) {
            toast({ title: "Cannot Accept", description: "You must be available to accept requests.", variant: "destructive" });
            return;
        }
        if (!rideRequest || rideRequest.id !== requestId || rideRequest.status !== 'pending') {
            toast({ title: "Request Unavailable", description: "This request is no longer available.", variant: "destructive" });
            setRideRequest(null); // Clear potentially stale request
            return;
        }

        setIsProcessingRequest(true);
        setError(null);
        const requestDocRef = doc(db, 'rideRequests', requestId);
        try {
            await updateDoc(requestDocRef, {
                status: 'accepted',
                driverId: user.uid, // Assign this driver
                driverName: driverData.name, // Add driver name for rider app
                vehicleDetails: driverData.vehicleDetails, // Add vehicle details for rider app
                acceptedAt: serverTimestamp() // Record acceptance time
            });
            // Update local state immediately for responsiveness (listener might take a moment)
            setRideRequest(prev => prev ? { ...prev, status: 'accepted', driverId: user.uid } : null);
            toast({ title: "Request Accepted!", description: "Proceed to the pickup location.", variant:"default" });
            // Future: Trigger navigation/map update
        } catch (err) {
            console.error("Error accepting request:", err);
            setError("Failed to accept the request. It might have been taken by another driver or cancelled.");
            setRideRequest(null); // Clear the request as it failed
            toast({ title: "Error Accepting", description: "Could not accept the request.", variant: "destructive" });
        } finally {
            setIsProcessingRequest(false);
        }
    };

    // Decline a pending ride request
    const handleDeclineRequest = async (requestId: string) => {
       // Simple approach: Just clear the request from this driver's view.
       // The request remains 'pending' in Firestore for other drivers.
       // A more complex system could mark it 'declined_by_driver_X' or remove the driver from potential assignees.
       setRideRequest(null); // Remove from UI
       toast({ title: "Request Declined", description: "You have skipped this request." });
       // No Firestore update needed in this simple model
    };

     // Mark an accepted ride as completed
     const handleCompleteRide = async (requestId: string) => {
        if (!rideRequest || rideRequest.id !== requestId || rideRequest.status !== 'accepted') {
            toast({ title: "Cannot Complete", description: "This ride is not in an accepted state.", variant: "destructive" });
            return;
        }

        setIsProcessingRequest(true);
        setError(null);
        const requestDocRef = doc(db, 'rideRequests', requestId);
         try {
            await updateDoc(requestDocRef, {
                status: 'completed',
                completedAt: serverTimestamp() // Record completion time
            });
             setRideRequest(null); // Clear the completed request from the dashboard
             toast({ title: "Ride Completed", description: "Ride marked as completed successfully." });
         } catch (err) {
             console.error("Error completing ride:", err);
             setError("Failed to mark ride as completed. Please try again.");
             toast({ title: "Error Completing", description: "Could not complete the ride.", variant: "destructive" });
         } finally {
             setIsProcessingRequest(false);
         }
     };


  // Handle user logout
  const handleLogout = async () => {
    toast({ title: "Logging out..." });
    // Attempt to mark driver as unavailable before logging out
    if (driverData?.isAvailable) {
        setIsUpdatingAvailability(true); // Show spinner while updating
        const driverDocRef = doc(db, 'drivers', user.uid);
        try {
            await updateDoc(driverDocRef, { isAvailable: false, lastSeen: serverTimestamp() });
        } catch (err) {
            console.error("Error setting driver unavailable on logout:", err);
            // Proceed with logout even if update fails
        } finally {
             setIsUpdatingAvailability(false);
        }
    }
    await signOut(auth); // Sign out from Firebase Auth
    // Auth state listener in page.tsx will handle redirecting to login screen
  };

  // --- Render Logic ---

  // Loading state
  if (loading || !driverData) { // Show loading if loading state is true OR driverData is not yet available
    return (
        <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" />
        </div>
    );
  }

   // Error state (show potentially recoverable errors)
   if (error && driverData) { // Show error overlay if driver data *is* loaded but there's another issue
      // This allows the driver to potentially still use the dashboard if the error is temporary (e.g., location)
      // A full-screen error might be too disruptive. We'll use an Alert component within the layout.
   }
   // If error occurred *before* driverData loaded (handled in fetchDriverData), a full screen error might be shown by page.tsx logic or the loading block above.


  // Helper for Avatar Fallback
  const getInitials = (name: string) => {
    return name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'DR'; // Default to DR if name is missing
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b shadow-sm">
        <div className="flex items-center gap-3">
           <Car className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">CurbLink Driver</h1>
        </div>
         <div className="flex items-center gap-2">
             <span className="text-sm text-muted-foreground hidden sm:inline">{driverData.email}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" disabled={isUpdatingAvailability}>
                 {isUpdatingAvailability ? <LoadingSpinner size="sm" /> : <LogOut className="h-5 w-5" />}
            </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-6 space-y-6">
         {/* Display Errors (non-blocking) */}
          {error && (
              <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                   {/* Allow dismissing temporary errors */}
                   <Button onClick={() => setError(null)} variant="ghost" size="sm" className="absolute top-1 right-1 text-destructive hover:bg-destructive/10">X</Button>
              </Alert>
          )}

        {/* Driver Info and Availability Toggle */}
        <Card className="shadow-md rounded-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4 bg-card">
            <div className="flex items-center gap-3">
               <Avatar className="h-12 w-12 border-2 border-primary/20">
                    {/* Using a placeholder API, replace with actual image upload/URL if implemented */}
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driverData.name)}`} alt={driverData.name} />
                    <AvatarFallback>{getInitials(driverData.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-lg font-medium">{driverData.name}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">{driverData.vehicleDetails}</CardDescription>
                </div>
            </div>
             <div className="flex items-center space-x-2">
                <Label
                    htmlFor="availability-switch"
                    className={`text-sm font-medium transition-colors ${driverData.isAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                   {isUpdatingAvailability ? 'Updating...' : (driverData.isAvailable ? 'Available' : 'Unavailable')}
                </Label>
                <Switch
                    id="availability-switch"
                    checked={driverData.isAvailable}
                    onCheckedChange={handleAvailabilityToggle}
                    disabled={isUpdatingAvailability}
                    aria-label="Toggle Availability"
                    className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                />
             </div>
          </CardHeader>
           <CardContent className="px-4 pb-4 pt-2 bg-card">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3"/>
                    Location: {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Tracking...'}
                    {driverData.isAvailable && !currentLocation && <span className='text-yellow-600 ml-1'>(Waiting for location)</span>}
                    {!driverData.isAvailable && <span className='ml-1'>(Offline)</span>}
              </div>
          </CardContent>
        </Card>

        {/* Placeholder for Map Integration */}
        {/* <Card className="h-64 flex items-center justify-center bg-muted/50 shadow-inner rounded-lg">
            <p className="text-muted-foreground">[Map Placeholder]</p>
             Add Google Maps component here later
        </Card> */}


        {/* Ride Request Display Area */}
         <div className="space-y-4">
            {/* --- Display Pending Request --- */}
             {driverData.isAvailable && rideRequest && rideRequest.status === 'pending' && (
                 <Card className="border-accent shadow-lg animate-pulse-border">
                     <CardHeader className="pb-2 pt-3">
                         <CardTitle className="flex items-center gap-2 text-accent text-lg"><PhoneCall className="h-5 w-5"/> New Ride Request!</CardTitle>
                          <CardDescription>A customer is requesting a ride near you.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-1 pb-3">
                          {/* Display basic request info - Enhance with pickup/destination address later */}
                         <p><span className="font-medium">From:</span> {rideRequest.pickupAddress || `Near (${rideRequest.pickupLocation.latitude.toFixed(3)}, ${rideRequest.pickupLocation.longitude.toFixed(3)})`}</p>
                         <p><span className="font-medium">To:</span> {rideRequest.destinationAddress || 'Not specified'}</p>
                          <p><span className="font-medium">Rider:</span> {rideRequest.riderName || 'Customer'}</p>
                     </CardContent>
                     <CardFooter className="flex justify-end gap-3 pb-3 pt-0">
                        <Button variant="outline" onClick={() => handleDeclineRequest(rideRequest.id)} disabled={isProcessingRequest}>
                            <XCircle className="mr-1 h-4 w-4" /> Decline
                        </Button>
                        <Button onClick={() => handleAcceptRequest(rideRequest.id)} disabled={isProcessingRequest} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                             {isProcessingRequest ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                             Accept Ride
                        </Button>
                     </CardFooter>
                 </Card>
             )}

              {/* --- Display Accepted Ride --- */}
             {driverData.isAvailable && rideRequest && rideRequest.status === 'accepted' && rideRequest.driverId === user.uid && (
                 <Card className="border-green-500 dark:border-green-400 shadow-md">
                     <CardHeader className="pb-2 pt-3">
                         <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400 text-lg"><Car className="h-5 w-5"/> Ride In Progress</CardTitle>
                          <CardDescription>You have accepted this ride. Proceed to pickup.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-1 pb-3">
                         <p><span className="font-medium">Pickup:</span> {rideRequest.pickupAddress || `(${rideRequest.pickupLocation.latitude.toFixed(4)}, ${rideRequest.pickupLocation.longitude.toFixed(4)})`}</p>
                         <p><span className="font-medium">Destination:</span> {rideRequest.destinationAddress || 'Not specified'}</p>
                          <p><span className="font-medium">Rider:</span> {rideRequest.riderName || 'Customer'}</p>
                          {rideRequest.riderPhone && <p><span className="font-medium">Phone:</span> <a href={`tel:${rideRequest.riderPhone}`} className="text-accent underline hover:text-accent/80">{rideRequest.riderPhone}</a></p>}
                           {/* Add Map/Navigation Button Here */}
                          <Button variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${rideRequest.pickupLocation.latitude},${rideRequest.pickupLocation.longitude}`, "_blank")} className="mt-2">
                              <MapPin className="mr-2 h-4 w-4" /> Navigate to Pickup
                          </Button>
                     </CardContent>
                     <CardFooter className="flex justify-end gap-3 pb-3 pt-0">
                        {/* Add Cancel Ride button later if needed (requires complex logic) */}
                        <Button onClick={() => handleCompleteRide(rideRequest.id)} disabled={isProcessingRequest} className="bg-green-600 hover:bg-green-700 text-white">
                             {isProcessingRequest ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                             Mark Completed
                        </Button>
                     </CardFooter>
                 </Card>
             )}


             {/* --- Status Messages --- */}
             {driverData.isAvailable && !rideRequest && (
                 <Card className="bg-muted/30 shadow-inner rounded-lg">
                     <CardContent className="pt-6 pb-6">
                         <p className="text-center text-muted-foreground italic">Waiting for the next ride request...</p>
                     </CardContent>
                 </Card>
             )}

             {!driverData.isAvailable && (
                 <Card className="bg-muted/30 shadow-inner rounded-lg">
                     <CardContent className="pt-6 pb-6">
                         <p className="text-center text-muted-foreground">You are currently offline. Toggle the switch above to become available.</p>
                     </CardContent>
                 </Card>
             )}
         </div>

      </main>

       {/* Footer */}
       <footer className="p-4 text-center text-xs text-muted-foreground border-t mt-auto">
            CurbLink Driver App © {new Date().getFullYear()}
       </footer>
    </div>
  );
}
