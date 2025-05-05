
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { User, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, GeoPoint, serverTimestamp, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Power, MapPin, PhoneCall, CheckCircle, XCircle, Car } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface DriverData {
    name: string;
    email: string;
    vehicleDetails: string;
    isAvailable: boolean;
    isApproved: boolean;
    location: GeoPoint | null;
    lastSeen: any; // Firestore Timestamp or ServerTimestamp
}

interface RideRequest {
    id: string;
    pickupLocation: GeoPoint;
    destinationAddress: string; // Keeping simple for now
    riderName: string; // Simple name display
    riderPhone?: string; // Optional phone number
    status: 'pending' | 'accepted' | 'declined' | 'completed';
    driverId?: string; // Driver who accepted
    createdAt: any;
}


interface DriverDashboardProps {
  user: User;
}

export default function DriverDashboard({ user }: DriverDashboardProps) {
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeoPoint | null>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null); // Only handle one request at a time for simplicity
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const { toast } = useToast();

  const fetchDriverData = useCallback(async () => {
      setLoading(true);
      setError(null);
      const driverDocRef = doc(db, 'drivers', user.uid);
      try {
          const docSnap = await getDoc(driverDocRef);
          if (docSnap.exists()) {
              const data = docSnap.data() as DriverData;
              setDriverData(data);
              setCurrentLocation(data.location); // Set initial location from DB
          } else {
              setError("Driver data not found. Please contact support.");
              await signOut(auth); // Log out if data is missing
          }
      } catch (err) {
          console.error("Error fetching driver data:", err);
          setError("Failed to load driver data. Please try again.");
      } finally {
          setLoading(false);
      }
  }, [user.uid]);


  // Fetch initial data and set up listener for driver data changes
  useEffect(() => {
      fetchDriverData();

      const driverDocRef = doc(db, 'drivers', user.uid);
      const unsubscribeDriver = onSnapshot(driverDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as DriverData;
              setDriverData(data);
              // Only update currentLocation if it's different from DB to avoid loops with location updates
              if (data.location && (!currentLocation || !data.location.isEqual(currentLocation))) {
                 // Potentially update location state if needed, but primary update is via handleLocationUpdate
              }
          } else {
              setError("Driver data stream lost. Logging out.");
              signOut(auth);
          }
      }, (err) => {
          console.error("Error listening to driver data:", err);
          setError("Connection error. Please check your internet.");
      });

      return () => unsubscribeDriver();
  }, [fetchDriverData, user.uid, currentLocation]);


 // Set up listener for relevant ride requests
 useEffect(() => {
    if (!driverData || !driverData.isAvailable) {
        setRideRequest(null); // Clear requests if driver is unavailable
        return; // Don't listen if unavailable
    }

    // Listen for new PENDING requests assigned to this driver OR unassigned requests
    const requestsRef = collection(db, "rideRequests");
    const q = query(
        requestsRef,
        where('status', '==', 'pending'),
        // where('assignedDriverId', 'in', [null, user.uid]), // Check if assigned to this driver OR unassigned (if using assignment logic)
        // For simplicity: listen to *all* pending requests initially. Driver accepts one.
        orderBy('createdAt', 'desc'),
        limit(10) // Limit to avoid fetching too many old requests
    );

    const unsubscribeRequests = onSnapshot(q, (querySnapshot) => {
        let latestRequest: RideRequest | null = null;
        querySnapshot.forEach((docSnap) => {
            // Basic filtering: only show requests not already handled by *this* driver
            // More complex logic might involve distance or zones
            if (!rideRequest || rideRequest.status !== 'accepted') { // Only show new if current isn't accepted
                const requestData = { id: docSnap.id, ...docSnap.data() } as RideRequest;
                 // Find the *first* pending request (latest by query order)
                if (!latestRequest) {
                    latestRequest = requestData;
                }
            }
        });
         // Only update if the incoming request is different from the current one or if current is null
         if (latestRequest?.id !== rideRequest?.id) {
            setRideRequest(latestRequest);
         } else if (!latestRequest && rideRequest) {
            // If no pending requests found, clear the current one if it exists
            setRideRequest(null);
         }
    }, (err) => {
        console.error("Error listening to ride requests:", err);
        setError("Failed to fetch ride requests.");
    });

    return () => unsubscribeRequests();

}, [driverData?.isAvailable, user.uid, rideRequest]); // Re-run if availability changes


  // Update location periodically and on availability change
  const handleLocationUpdate = useCallback(async () => {
    if (!driverData?.isAvailable) return; // Only update if available

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLocation = new GeoPoint(position.coords.latitude, position.coords.longitude);
        // Only update if location actually changed significantly (optional check)
        if (!currentLocation || !newLocation.isEqual(currentLocation)) {
            setCurrentLocation(newLocation);
            const driverDocRef = doc(db, 'drivers', user.uid);
            try {
                await updateDoc(driverDocRef, {
                    location: newLocation,
                    lastSeen: serverTimestamp(), // Update last seen timestamp
                });
            } catch (err) {
                console.error("Error updating location:", err);
                // Don't show toast for frequent location updates, just log
            }
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
            title: "Location Error",
            description: "Could not get your current location. Please enable location services.",
            variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options for better accuracy
    );
  }, [user.uid, driverData?.isAvailable, currentLocation, toast]);

  useEffect(() => {
    // Initial location update
    handleLocationUpdate();

    // Set interval for periodic updates only when available
    let intervalId: NodeJS.Timeout | null = null;
    if (driverData?.isAvailable) {
      intervalId = setInterval(handleLocationUpdate, 30000); // Update every 30 seconds when available
    }

    // Clear interval on unmount or when becoming unavailable
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [driverData?.isAvailable, handleLocationUpdate]);


  const handleAvailabilityToggle = async (checked: boolean) => {
    setIsUpdatingAvailability(true);
    setError(null);
    const driverDocRef = doc(db, 'drivers', user.uid);
    try {
      await updateDoc(driverDocRef, {
        isAvailable: checked,
        lastSeen: serverTimestamp(), // Update last seen on toggle too
         // Update location immediately when toggling availability
        location: checked ? currentLocation : null // Clear location if becoming unavailable? Or keep last known? Decide based on app logic. Keeping it for now.
      });
      // No need to call setDriverData here, the listener will pick up the change
       if (checked) {
           handleLocationUpdate(); // Update location immediately when going available
       } else {
           setRideRequest(null); // Clear any displayed request when going offline
       }
       toast({
        title: `Status Updated`,
        description: `You are now ${checked ? 'Available' : 'Unavailable'}.`,
       });
    } catch (err) {
      console.error("Error updating availability:", err);
      setError("Failed to update status. Please try again.");
      // Revert UI optimistically if needed, though listener should correct it
       setDriverData(prev => prev ? {...prev, isAvailable: !checked} : null);
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

   const handleAcceptRequest = async (requestId: string) => {
        if (!driverData || !driverData.isAvailable) {
            toast({ title: "Cannot Accept", description: "You must be available to accept requests.", variant: "destructive" });
            return;
        }
        setIsProcessingRequest(true);
        setError(null);
        const requestDocRef = doc(db, 'rideRequests', requestId);
        try {
            await updateDoc(requestDocRef, {
                status: 'accepted',
                driverId: user.uid, // Assign driver to the request
                driverName: driverData.name, // Add driver name for rider app
                vehicleDetails: driverData.vehicleDetails // Add vehicle details
            });
            // Update local state immediately for responsiveness
            setRideRequest(prev => prev ? { ...prev, status: 'accepted', driverId: user.uid } : null);
            toast({ title: "Request Accepted", description: "Proceed to the pickup location." });

            // Potentially start navigation or show directions here

        } catch (err) {
            console.error("Error accepting request:", err);
            setError("Failed to accept the request. It might have been taken by another driver.");
             // Refetch to ensure UI consistency
            // fetchRideRequests(); // Or rely on listener to update
        } finally {
            setIsProcessingRequest(false);
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
       // In this simplified model, declining just removes it from view
       // A more complex system might mark it as declined by this driver
       setRideRequest(null);
       toast({ title: "Request Declined", description: "You have declined the current request." });
       // Optionally, update the request status to 'declined_by_[driverId]' in Firestore
       // For simplicity, we're just clearing it locally. New requests might appear via the listener.
    };

     const handleCompleteRide = async (requestId: string) => {
        setIsProcessingRequest(true);
        setError(null);
        const requestDocRef = doc(db, 'rideRequests', requestId);
         try {
            await updateDoc(requestDocRef, {
                status: 'completed',
                completedAt: serverTimestamp()
            });
             setRideRequest(null); // Clear the completed request
             toast({ title: "Ride Completed", description: "Ride marked as completed successfully." });
             // Maybe trigger fetching new requests or just wait for listener
         } catch (err) {
             console.error("Error completing ride:", err);
             setError("Failed to mark ride as completed. Please try again.");
         } finally {
             setIsProcessingRequest(false);
         }
     };


  const handleLogout = async () => {
    // Ensure driver is marked as unavailable on logout
    if (driverData?.isAvailable) {
        await handleAvailabilityToggle(false); // Attempt to set unavailable
    }
    await signOut(auth);
    toast({ title: "Logged Out", description: "You have been logged out successfully." });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner /></div>;
  }

   if (error && !driverData) { // Show blocking error only if driver data failed completely
      return (
         <div className="flex items-center justify-center min-h-screen p-4">
             <Card className="w-full max-w-md">
                 <CardHeader>
                     <CardTitle className="text-center text-destructive">Error</CardTitle>
                 </CardHeader>
                 <CardContent>
                     <p className="text-center text-destructive">{error}</p>
                     <Button onClick={fetchDriverData} className="mt-4 w-full">Retry</Button>
                     <Button variant="outline" onClick={handleLogout} className="mt-2 w-full">Logout</Button>
                 </CardContent>
             </Card>
         </div>
      );
   }


  if (!driverData) {
      // This case should ideally be handled by the error block above or loading state
      return <div className="flex items-center justify-center min-h-screen"><p>Loading driver data...</p></div>;
  }


  // Calculate initials for Avatar Fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b">
        <div className="flex items-center gap-3">
           <Car className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">CurbLink Driver</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <Power className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-6 space-y-6">
         {/* Display non-blocking errors */}
          {error && (
              <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                   <Button onClick={() => setError(null)} variant="ghost" size="sm" className="absolute top-1 right-1">Dismiss</Button>
              </Alert>
          )}

        {/* Driver Info and Availability */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
               <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${driverData.name}`} alt={driverData.name} />
                    <AvatarFallback>{getInitials(driverData.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-lg">{driverData.name}</CardTitle>
                    <CardDescription>{driverData.email}</CardDescription>
                     <CardDescription className="text-xs">{driverData.vehicleDetails}</CardDescription>
                </div>

            </div>
             <div className="flex items-center space-x-2">
                <Label htmlFor="availability-switch" className={`text-sm font-medium ${driverData.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                   {driverData.isAvailable ? 'Available' : 'Unavailable'}
                </Label>
                <Switch
                    id="availability-switch"
                    checked={driverData.isAvailable}
                    onCheckedChange={handleAvailabilityToggle}
                    disabled={isUpdatingAvailability}
                    aria-label="Toggle Availability"
                />
             </div>
          </CardHeader>
           <CardContent>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                    <MapPin className="h-3 w-3"/>
                    Location: {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Not available'}
                    {driverData.isAvailable && !currentLocation && <span className='text-destructive ml-1'>(Enable location!)</span>}
              </div>
          </CardContent>
        </Card>

        {/* Customer Request Section */}
         {driverData.isAvailable && rideRequest && rideRequest.status === 'pending' && (
             <Card className="border-accent animate-pulse-border"> {/* Highlight pending requests */}
                 <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-accent"><PhoneCall className="h-5 w-5"/> New Ride Request!</CardTitle>
                      <CardDescription>A customer needs a ride.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-2">
                     <p><span className="font-medium">From:</span> Near {rideRequest.pickupLocation.latitude.toFixed(3)}, {rideRequest.pickupLocation.longitude.toFixed(3)}</p>
                     <p><span className="font-medium">To:</span> {rideRequest.destinationAddress || 'Not specified'}</p>
                      <p><span className="font-medium">Rider:</span> {rideRequest.riderName || 'Customer'}</p>
                 </CardContent>
                 <CardFooter className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => handleDeclineRequest(rideRequest.id)} disabled={isProcessingRequest}>
                        <XCircle className="mr-2 h-4 w-4" /> Decline
                    </Button>
                    <Button onClick={() => handleAcceptRequest(rideRequest.id)} disabled={isProcessingRequest} className="bg-accent hover:bg-accent/90">
                         {isProcessingRequest ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                         Accept
                    </Button>
                 </CardFooter>
             </Card>
         )}

          {/* Accepted Ride Section */}
         {driverData.isAvailable && rideRequest && rideRequest.status === 'accepted' && rideRequest.driverId === user.uid && (
             <Card className="border-green-500">
                 <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-green-600"><Car className="h-5 w-5"/> Ride Accepted</CardTitle>
                      <CardDescription>Proceed to pickup the customer.</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-2">
                     <p><span className="font-medium">Pickup:</span> Near {rideRequest.pickupLocation.latitude.toFixed(4)}, {rideRequest.pickupLocation.longitude.toFixed(4)}</p>
                     <p><span className="font-medium">Destination:</span> {rideRequest.destinationAddress || 'Not specified'}</p>
                      <p><span className="font-medium">Rider:</span> {rideRequest.riderName || 'Customer'}</p>
                      {rideRequest.riderPhone && <p><span className="font-medium">Phone:</span> <a href={`tel:${rideRequest.riderPhone}`} className="text-accent underline">{rideRequest.riderPhone}</a></p>}
                      {/* Add Map/Navigation Button Here */}
                      <Button variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${rideRequest.pickupLocation.latitude},${rideRequest.pickupLocation.longitude}`, "_blank")} className="mt-2">
                          <MapPin className="mr-2 h-4 w-4" /> Navigate to Pickup
                      </Button>
                 </CardContent>
                 <CardFooter className="flex justify-end gap-3">
                    {/* Option to Cancel (more complex logic needed) */}
                    {/* <Button variant="destructive" onClick={() => handleCancelRide(rideRequest.id)} disabled={isProcessingRequest}>Cancel Ride</Button> */}
                    <Button onClick={() => handleCompleteRide(rideRequest.id)} disabled={isProcessingRequest} className="bg-green-600 hover:bg-green-700">
                         {isProcessingRequest ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                         Mark as Completed
                    </Button>
                 </CardFooter>
             </Card>
         )}


         {/* Placeholder when available but no requests */}
         {driverData.isAvailable && !rideRequest && (
             <Card>
                 <CardContent className="pt-6">
                     <p className="text-center text-muted-foreground">Waiting for ride requests...</p>
                 </CardContent>
             </Card>
         )}

         {/* Placeholder when unavailable */}
         {!driverData.isAvailable && (
             <Card>
                 <CardContent className="pt-6">
                     <p className="text-center text-muted-foreground">You are currently unavailable. Toggle the switch above to start receiving requests.</p>
                 </CardContent>
             </Card>
         )}

      </main>

       {/* Footer (Optional) */}
       <footer className="p-4 text-center text-xs text-muted-foreground border-t">
            CurbLink Driver App © {new Date().getFullYear()}
       </footer>
    </div>
  );
}
