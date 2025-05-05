
'use client';

import React, {useState, useEffect, useCallback} from 'react';
import {User} from 'firebase/auth'; // Removed signOut as it's handled by AppNavigation
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  GeoPoint,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import {db} from '@/config/firebase'; // Removed auth as it's not directly used here anymore
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Switch} from '@/components/ui/switch';
import {Label} from '@/components/ui/label';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
// Removed Power, LogOut, UserIcon, ShieldCheck as they are in AppNavigation or handled by Layout
import {MapPin, PhoneCall, CheckCircle, XCircle, Car } from 'lucide-react';
import {LoadingSpinner} from '@/components/ui/loading-spinner';
import {useToast} from '@/hooks/use-toast';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {AlertCircle} from 'lucide-react';
import type {Driver, RideRequest} from '@/types'; // Import shared types
// Removed Link import as footer nav is gone


interface DriverData extends Driver {}

interface DriverDashboardProps {
  user: User;
}

export default function DriverDashboard({user}: DriverDashboardProps) {
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GeoPoint | null>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true); // Keep this for initial data load
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const {toast} = useToast();

  // --- Data Fetching and Listeners ---

  const fetchDriverData = useCallback(async () => {
    setError(null);
    const driverDocRef = doc(db, 'drivers', user.uid);
    try {
      const docSnap = await getDoc(driverDocRef);
      if (docSnap.exists()) {
        const data = {uid: docSnap.id, ...docSnap.data()} as DriverData;
        setDriverData(data);
        if (data.location) setCurrentLocation(data.location);
      } else {
        setError('Driver data not found.'); // Handled by page.tsx logic mostly
      }
    } catch (err) {
      console.error('Error fetching driver data:', err);
      setError('Failed to load driver data.');
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    setLoading(true); // Ensure loading is true on mount/user change
    fetchDriverData();

    const driverDocRef = doc(db, 'drivers', user.uid);
    const unsubscribeDriver = onSnapshot(driverDocRef, docSnap => {
      if (docSnap.exists()) {
        const updatedData = {uid: docSnap.id, ...docSnap.data()} as DriverData;
        setDriverData(updatedData);
        // Clear ride request if driver becomes unavailable
        if (!updatedData.isAvailable) {
            setRideRequest(null);
        }
      } else {
        // Handled by page.tsx logout/redirect logic
      }
    }, err => {
      console.error('Error listening to driver data:', err);
      setError('Connection error monitoring your data.');
    });

    return () => unsubscribeDriver();
  }, [fetchDriverData, user.uid]);


  useEffect(() => {
    if (!driverData?.isAvailable) {
      setRideRequest(null); // Ensure request is cleared if not available
      return; // Stop listening if unavailable
    }
    const requestsRef = collection(db, 'rideRequests');
    const q = query(
      requestsRef,
      where('status', '==', 'pending'),
      // Add geographical query here if using GeoFirestore/Geohashes
      orderBy('createdAt', 'desc'), // Order by time to get newest
      limit(5) // Limit potential requests shown
    );
    const unsubscribeRequests = onSnapshot(q, querySnapshot => {
        let latestRequest: RideRequest | null = null;
        // Only show new request if not currently processing one or if current one is completed/cancelled
        if (!rideRequest || rideRequest.status === 'completed' || rideRequest.status === 'cancelled') {
             if (!querySnapshot.empty) {
               // Basic logic: Show the newest pending request
               // TODO: Add more sophisticated matching (closest driver, etc.)
               const docSnap = querySnapshot.docs[0];
               latestRequest = {id: docSnap.id, ...docSnap.data()} as RideRequest;
             }
        } else {
            // Keep showing the currently accepted ride
            latestRequest = rideRequest;
        }

       // Update state only if the found request is different or if clearing needed
        if (latestRequest?.id !== rideRequest?.id) {
          setRideRequest(latestRequest);
          // Notify only if it's a genuinely *new* pending request
          if (latestRequest && latestRequest.status === 'pending' && latestRequest.id !== rideRequest?.id) {
             toast({ title: 'New Ride Request!', description: `From: ${latestRequest.pickupAddress}` });
          }
       } else if (!latestRequest && rideRequest && rideRequest.status === 'pending') {
           setRideRequest(null); // Clear pending if no longer exists or matched
       }

    }, err => {
      console.error('Error listening to ride requests:', err);
      setError('Failed to fetch nearby ride requests.');
    });

    return () => unsubscribeRequests();
  }, [driverData?.isAvailable, user.uid, rideRequest, toast]); // Refined dependencies


  // --- Location Handling ---

  const handleLocationUpdate = useCallback(
    async (isAvailable: boolean) => {
      if (!isAvailable || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        async position => {
          const newLocation = new GeoPoint(position.coords.latitude, position.coords.longitude);
          // Update only if location has changed significantly (optional optimization)
          const locationChanged = !currentLocation ||
             Math.abs(newLocation.latitude - currentLocation.latitude) > 0.0001 ||
             Math.abs(newLocation.longitude - currentLocation.longitude) > 0.0001;

          if (locationChanged) {
              setCurrentLocation(newLocation);
              const driverDocRef = doc(db, 'drivers', user.uid);
              try {
                  await updateDoc(driverDocRef, { location: newLocation, lastSeen: serverTimestamp() });
              } catch (err) { console.error('Error updating location:', err); }
          } else {
             // Update lastSeen timestamp even if location is the same
             const driverDocRef = doc(db, 'drivers', user.uid);
             try {
                 await updateDoc(driverDocRef, { lastSeen: serverTimestamp() });
             } catch (err) { console.error('Error updating lastSeen:', err); }
          }
        },
        error => {
          console.error('Geolocation error:', error);
          let message = 'Could not get location.';
          if (error.code === error.PERMISSION_DENIED) message = 'Location permission denied.';
          setError(message);
          toast({ title: 'Location Error', description: message, variant: 'destructive' });
           // Consider turning driver offline if location fails repeatedly
           // handleAvailabilityToggle(false);
        },
        {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}
      );
    },
    [user.uid, currentLocation, toast] // Removed handleAvailabilityToggle from deps
  );

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (driverData?.isAvailable) {
      handleLocationUpdate(true); // Update immediately when becoming available
      intervalId = setInterval(() => handleLocationUpdate(true), 30000); // Then update every 30s
    } else if (intervalId) {
      clearInterval(intervalId); // Clear interval if becoming unavailable
    }
    return () => { if (intervalId) clearInterval(intervalId); }; // Cleanup on unmount
  }, [driverData?.isAvailable, handleLocationUpdate]);

  // --- UI Event Handlers ---

  const handleAvailabilityToggle = async (checked: boolean) => {
    if (!driverData) return;
    setIsUpdatingAvailability(true);
    setError(null);
    const driverDocRef = doc(db, 'drivers', user.uid);
    try {
      await updateDoc(driverDocRef, { isAvailable: checked, lastSeen: serverTimestamp() });
      toast({ title: `Status Updated`, description: `You are now ${checked ? 'Available' : 'Unavailable'}.` });
      if (checked) {
         handleLocationUpdate(true); // Attempt location update immediately
      } else {
         setRideRequest(null); // Clear any pending/accepted request if going offline
      }
    } catch (err) {
      console.error('Error updating availability:', err);
      setError('Failed to update status.');
      toast({title: 'Error', description: 'Could not update availability.', variant: 'destructive'});
      // Revert UI state if Firebase update failed (optional)
       setDriverData(prev => prev ? {...prev, isAvailable: !checked} : null);
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!driverData?.isAvailable || !rideRequest || rideRequest.id !== requestId || rideRequest.status !== 'pending') {
      toast({title: 'Request Unavailable', description: 'This request might have been taken or cancelled.', variant: 'destructive'});
      setRideRequest(null); // Clear the stale request
      return;
    }
    setIsProcessingRequest(true);
    setError(null);
    const requestDocRef = doc(db, 'rideRequests', requestId);
    try {
      // Check request status again before updating (prevent race conditions)
       const freshRequestSnap = await getDoc(requestDocRef);
       if (!freshRequestSnap.exists() || freshRequestSnap.data()?.status !== 'pending') {
           throw new Error('Request is no longer pending.');
       }

      await updateDoc(requestDocRef, {
        status: 'accepted',
        driverId: user.uid,
        driverName: driverData.name,
        vehicleDetails: driverData.vehicleDetails,
        acceptedAt: serverTimestamp(),
      });
      // State will be updated by the Firestore listener
      toast({title: 'Request Accepted!', description: 'Proceed to pickup.'});
    } catch (err: any) {
      console.error('Error accepting request:', err);
      setError(`Failed to accept request: ${err.message || 'Please refresh.'}`);
      setRideRequest(null); // Clear failed request
      toast({title: 'Error Accepting', description: 'Could not accept the request.', variant: 'destructive'});
    } finally {
      setIsProcessingRequest(false);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
     // Simply remove the request from the UI for this driver
    setRideRequest(null);
    toast({title: 'Request Declined'});
    // Note: The request remains 'pending' in Firestore for other drivers to potentially accept.
  };

  const handleCompleteRide = async (requestId: string) => {
    // Allow completion only if the status is 'accepted' or 'ongoing' (if you add 'ongoing' state)
    if (!rideRequest || rideRequest.id !== requestId || rideRequest.status !== 'accepted') return;
    setIsProcessingRequest(true);
    setError(null);
    const requestDocRef = doc(db, 'rideRequests', requestId);
    try {
      await updateDoc(requestDocRef, { status: 'completed', completedAt: serverTimestamp() });
      // State will be updated by the listener to null or next pending request
      toast({title: 'Ride Completed'});
    } catch (err) {
      console.error('Error completing ride:', err);
      setError('Failed to mark ride as completed.');
      toast({title: 'Error Completing', description: 'Could not complete ride.', variant: 'destructive'});
    } finally {
      setIsProcessingRequest(false);
    }
  };

 // Removed handleLogout - handled by AppNavigation

  // --- Render Logic ---

  if (loading) { // Show loader only during initial fetch
    return (
      <div className="flex items-center justify-center flex-1"> {/* Use flex-1 */}
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Handle case where driver data somehow didn't load but loading is finished
   if (!driverData && !loading) {
       return (
           <div className="flex items-center justify-center flex-1 p-4 text-center">
                <Alert variant="destructive">
                   <AlertCircle className="h-4 w-4" />
                   <AlertTitle>Error Loading Data</AlertTitle>
                   <AlertDescription>{error || "Could not load driver information. Please try logging out and back in."}</AlertDescription>
                 </Alert>
           </div>
       );
   }


  const getInitials = (name: string | undefined) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'DR';
  };

  return (
    // Ensure this component fills the space within DriverLayout
     <div className="flex-1 p-4 md:p-6 space-y-6"> {/* Use flex-1 and add padding */}
        {/* Display Global Errors */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
             <Button onClick={() => setError(null)} variant="ghost" size="sm" className="absolute top-1 right-1 text-destructive hover:bg-destructive/10">X</Button>
          </Alert>
        )}

        {/* Driver Info and Availability */}
        {driverData && (
            <Card className="shadow-md rounded-lg overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4 bg-card">
                <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driverData.name)}`} alt={driverData.name} />
                    <AvatarFallback>{getInitials(driverData.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-lg font-medium">{driverData.name}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">{driverData.vehicleDetails}</CardDescription>
                </div>
                </div>
                <div className="flex items-center space-x-2">
                <Label htmlFor="availability-switch" className={`text-sm font-medium ${driverData.isAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isUpdatingAvailability ? 'Updating...' : driverData.isAvailable ? 'Available' : 'Unavailable'}
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
                <MapPin className="h-3 w-3" />
                Location:{' '}
                {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Tracking...'}
                {driverData.isAvailable && !currentLocation && <span className="text-yellow-600 dark:text-yellow-400 ml-1">(Acquiring)</span>}
                {!driverData.isAvailable && <span className="ml-1">(Offline)</span>}
                </div>
            </CardContent>
            </Card>
        )}


        {/* Ride Request Display Area */}
         {driverData && (
             <div className="space-y-4">
              {/* Pending Request */}
              {driverData.isAvailable && rideRequest && rideRequest.status === 'pending' && (
                <Card className="border-accent shadow-lg animate-pulse-border">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="flex items-center gap-2 text-accent text-lg"><PhoneCall className="h-5 w-5" /> New Ride Request!</CardTitle>
                    <CardDescription>A customer needs a ride.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 pb-3">
                    <p><span className="font-medium">From:</span> {rideRequest.pickupAddress || `Near (${rideRequest.pickupLocation.latitude.toFixed(3)}, ${rideRequest.pickupLocation.longitude.toFixed(3)})`}</p>
                    <p><span className="font-medium">To:</span> {rideRequest.destinationAddress || 'Not specified'}</p>
                    <p><span className="font-medium">Rider:</span> {rideRequest.riderName || 'Customer'}</p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-3 pb-3 pt-0">
                    <Button variant="outline" onClick={() => handleDeclineRequest(rideRequest.id)} disabled={isProcessingRequest}><XCircle className="mr-1 h-4 w-4" /> Decline</Button>
                    <Button onClick={() => handleAcceptRequest(rideRequest.id)} disabled={isProcessingRequest} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                      {isProcessingRequest ? <LoadingSpinner size="sm" /> : <><CheckCircle className="mr-1 h-4 w-4" /> Accept</>}
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {/* Accepted/Ongoing Request */}
               {driverData.isAvailable && rideRequest && rideRequest.status === 'accepted' && rideRequest.driverId === user.uid && (
                  <Card className="border-green-500 dark:border-green-400 shadow-md">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400 text-lg"><Car className="h-5 w-5" /> Ride In Progress</CardTitle>
                      <CardDescription>Proceed to pickup location.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1 pb-3">
                      <p><span className="font-medium">Pickup:</span> {rideRequest.pickupAddress || `(${rideRequest.pickupLocation.latitude.toFixed(4)}, ${rideRequest.pickupLocation.longitude.toFixed(4)})`}</p>
                      <p><span className="font-medium">Destination:</span> {rideRequest.destinationAddress || 'Not specified'}</p>
                      <p><span className="font-medium">Rider:</span> {rideRequest.riderName || 'Customer'}</p>
                      {rideRequest.riderPhone && <p><span className="font-medium">Phone:</span> <a href={`tel:${rideRequest.riderPhone}`} className="text-accent underline hover:text-accent/80">{rideRequest.riderPhone}</a></p>}
                       {/* Basic Navigation Button */}
                       <Button variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${rideRequest.pickupLocation.latitude},${rideRequest.pickupLocation.longitude}`, '_blank')} className="mt-2">
                        <MapPin className="mr-2 h-4 w-4" /> Navigate to Pickup
                      </Button>
                       {/* TODO: Add button to navigate to destination once picked up */}
                    </CardContent>
                    <CardFooter className="flex justify-end gap-3 pb-3 pt-0">
                      {/* Add Cancel Ride Button (Optional, with rules) */}
                      {/* <Button variant="destructive" onClick={() => handleCancelAcceptedRide(rideRequest.id)} disabled={isProcessingRequest}>Cancel Ride</Button> */}
                      <Button onClick={() => handleCompleteRide(rideRequest.id)} disabled={isProcessingRequest} className="bg-green-600 hover:bg-green-700 text-white">
                        {isProcessingRequest ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-1 h-4 w-4" />} Mark Completed
                      </Button>
                    </CardFooter>
                  </Card>
                )}

              {/* Status Messages */}
               {driverData.isAvailable && !rideRequest && (
                <Card className="bg-muted/30 shadow-inner rounded-lg"><CardContent className="pt-6 pb-6"><p className="text-center text-muted-foreground italic">Waiting for the next ride request...</p></CardContent></Card>
              )}
              {!driverData.isAvailable && (
                <Card className="bg-muted/30 shadow-inner rounded-lg"><CardContent className="pt-6 pb-6"><p className="text-center text-muted-foreground">You are offline. Toggle the switch above to become available.</p></CardContent></Card>
              )}
            </div>
         )}
     </div> // End wrapping div
  );
}
