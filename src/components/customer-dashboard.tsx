
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  GeoPoint,
  serverTimestamp,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Map, MapPin, Car, LogOut, Clock, CheckCircle, XCircle, Search, History } from 'lucide-react'; // Added Search, History
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import type { Customer, RideRequest, Driver } from '@/types'; // Import shared types
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting
// Map component placeholder - replace with actual implementation
const MapPlaceholder = () => <div className="h-64 w-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground">Map Placeholder</div>;


interface CustomerDashboardProps {
  customer: Customer;
}

// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      clearTimeout(timeout);
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

export default function CustomerDashboard({ customer }: CustomerDashboardProps) {
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickupLocation, setPickupLocation] = useState<GeoPoint | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<GeoPoint | null>(null);
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null); // Track ongoing or pending ride
  const [rideHistory, setRideHistory] = useState<RideRequest[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]); // Display nearby available drivers
  const [loading, setLoading] = useState(false); // For ride request/cancellation actions
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [findingDriver, setFindingDriver] = useState(false); // Indicator while searching for a driver
  const { toast } = useToast();

  // --- Data Fetching and Listeners ---

   // Fetch and listen for the customer's CURRENT ride (pending or accepted/ongoing)
   useEffect(() => {
    const q = query(
      collection(db, 'rideRequests'),
      where('riderId', '==', customer.uid),
      where('status', 'in', ['pending', 'accepted', 'ongoing']), // Listen for active ride states
      orderBy('createdAt', 'desc'),
      limit(1) // Should only be one active ride per customer
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        if (!querySnapshot.empty) {
            const rideDoc = querySnapshot.docs[0];
            const rideData = { id: rideDoc.id, ...rideDoc.data() } as RideRequest;
            setCurrentRide(rideData);
            setFindingDriver(rideData.status === 'pending'); // Show finding indicator if pending
             // Clear input fields if a ride is active
             if (rideData.status === 'pending' || rideData.status === 'accepted' || rideData.status === 'ongoing') {
                 setPickupAddress(rideData.pickupAddress);
                 setDestinationAddress(rideData.destinationAddress);
                 setPickupLocation(rideData.pickupLocation);
                 setDestinationLocation(rideData.destinationLocation || null); // Handle optional destination
            }
        } else {
            setCurrentRide(null); // No active ride found
            setFindingDriver(false);
             // Optionally clear fields when no active ride, or keep them for re-booking?
             // setPickupAddress('');
             // setDestinationAddress('');
             // setPickupLocation(null);
             // setDestinationLocation(null);
        }
    }, (err) => {
        console.error("Error listening to current ride:", err);
        setError("Failed to get current ride status.");
    });

    return () => unsubscribe();
  }, [customer.uid]);


   // Fetch Ride History (Completed/Cancelled)
   const fetchRideHistory = useCallback(async () => {
       setLoadingHistory(true);
       setError(null);
       try {
           const q = query(
               collection(db, 'rideRequests'),
               where('riderId', '==', customer.uid),
               where('status', 'in', ['completed', 'cancelled']), // Fetch only finished rides
               orderBy('createdAt', 'desc'),
               limit(10) // Limit history for performance
           );
           const querySnapshot = await getDoc(q); // Use getDoc for one-time fetch if real-time isn't needed
           const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideRequest));
           setRideHistory(history);
       } catch (err) {
           console.error("Error fetching ride history:", err);
           setError("Could not load ride history.");
       } finally {
           setLoadingHistory(false);
       }
   }, [customer.uid]);

   useEffect(() => {
       fetchRideHistory();
   }, [fetchRideHistory]); // Fetch history on mount

  // Listen for nearby available drivers (Example - replace with actual GeoQuery)
  useEffect(() => {
    // !! IMPORTANT !!
    // This is a placeholder. Real-time GeoQueries require Firestore extensions (like GeoFirestore)
    // or complex manual querying which is inefficient at scale.
    // This example simulates finding drivers but is NOT scalable.
    const q = query(
      collection(db, 'drivers'),
      where('isAvailable', '==', true),
      where('isApproved', '==', true),
      limit(5) // Simulate finding a few nearby drivers
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const drivers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Driver));
      setNearbyDrivers(drivers);
      // Update map markers based on 'drivers' data here
    }, (err) => {
      console.error("Error fetching nearby drivers:", err);
      // Don't necessarily show a blocking error for this background task
    });

    return () => unsubscribe();
  }, []); // Run only on mount

  // --- Geocoding and Fare Estimation (Placeholders) ---

  // Placeholder for geocoding address to coordinates
  const geocodeAddress = async (address: string): Promise<GeoPoint | null> => {
      if (!address) return null;
      console.log(`Geocoding (placeholder): ${address}`);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      // In a real app, use Google Geocoding API or similar
      // For this example, return slightly varied coordinates based on address length
      const latOffset = (address.length % 10) * 0.001;
      const lngOffset = (address.length % 5) * 0.001;
      // Base coordinates (e.g., center of a city) - Replace with actual base
      const baseLat = 34.0522;
      const baseLng = -118.2437;
      return new GeoPoint(baseLat + latOffset, baseLng + lngOffset);
  };

  // Debounced geocoding function
   const debouncedGeocode = useCallback(debounce(geocodeAddress, 800), []);


  // Update pickup location when address changes (debounced)
  useEffect(() => {
      if (pickupAddress) {
          debouncedGeocode(pickupAddress).then(location => {
              setPickupLocation(location);
              if (location && destinationLocation) estimateFare(location, destinationLocation);
          });
      } else {
          setPickupLocation(null);
          setEstimatedFare(null); // Clear fare if pickup is cleared
      }
  }, [pickupAddress, debouncedGeocode]); // Rerun when pickupAddress or the debounced function changes

  // Update destination location when address changes (debounced)
   useEffect(() => {
       if (destinationAddress) {
           debouncedGeocode(destinationAddress).then(location => {
               setDestinationLocation(location);
                if (pickupLocation && location) estimateFare(pickupLocation, location);
           });
       } else {
           setDestinationLocation(null);
            setEstimatedFare(null); // Clear fare if destination is cleared
       }
   }, [destinationAddress, debouncedGeocode]); // Rerun when destinationAddress or the debounced function changes


  // Placeholder for fare estimation
  const estimateFare = async (pickup: GeoPoint, destination: GeoPoint) => {
    console.log('Estimating fare (placeholder)...');
     // Simulate calculation delay
     await new Promise(resolve => setTimeout(resolve, 200));
    // Basic distance calculation (Haversine formula or simple approximation)
    // Replace with Google Distance Matrix API for real routes and traffic
    const latDiff = Math.abs(pickup.latitude - destination.latitude);
    const lonDiff = Math.abs(pickup.longitude - destination.longitude);
    const distanceApproximation = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 100; // Rough estimate factor

    const baseFare = 5; // $5 base
    const ratePerUnit = 1.5; // $1.5 per distance unit
    const fare = baseFare + distanceApproximation * ratePerUnit;
    setEstimatedFare(parseFloat(fare.toFixed(2))); // Format to 2 decimal places
  };

  // --- Actions ---

  // Handle Ride Request Submission
  const handleRequestRide = async (e: React.FormEvent) => {
      e.preventDefault(); // Prevent default form submission
      if (!pickupAddress || !destinationAddress || !pickupLocation) {
          setError('Please enter both pickup and destination addresses.');
          toast({ title: 'Missing Information', description: 'Enter pickup and destination.', variant: 'destructive' });
          return;
      }
       if (currentRide && currentRide.status !== 'completed' && currentRide.status !== 'cancelled') {
           setError('You already have an active ride request.');
           toast({ title: 'Active Ride Found', description: 'Please wait for your current ride to complete or cancel it.', variant: 'destructive' });
           return;
       }

      setLoading(true);
      setFindingDriver(true);
      setError(null);

      try {
          const newRideRequest: Omit<RideRequest, 'id' | 'createdAt'> = { // Omit fields Firestore will add
              riderId: customer.uid,
              riderName: customer.name,
              riderPhone: customer.phone || undefined, // Include phone if available
              pickupLocation: pickupLocation,
              pickupAddress: pickupAddress,
              destinationLocation: destinationLocation || undefined, // Handle optional destination
              destinationAddress: destinationAddress,
              status: 'pending', // Initial status
              createdAt: serverTimestamp() as Timestamp, // Use serverTimestamp placeholder
               // Other fields like driverId, acceptedAt etc. will be null/undefined initially
          };

          const docRef = await addDoc(collection(db, 'rideRequests'), newRideRequest);
          console.log("Ride request submitted with ID: ", docRef.id);

          toast({ title: 'Ride Requested!', description: 'Searching for a driver near you...' });
          // No need to set currentRide here, the listener will pick it up.
          // Keep loading true while 'pending' (findingDriver state handles this)

      } catch (err) {
          console.error("Error requesting ride:", err);
          setError('Failed to request ride. Please try again.');
          toast({ title: 'Request Failed', description: 'Could not submit your ride request.', variant: 'destructive' });
           setFindingDriver(false); // Stop finding indicator on error
      } finally {
          setLoading(false); // General button loading state
      }
  };


  // Handle Ride Cancellation (by customer)
  const handleCancelRide = async () => {
      if (!currentRide || !['pending', 'accepted'].includes(currentRide.status)) {
          setError('Cannot cancel this ride.');
          toast({ title: 'Cancellation Error', description: 'Ride is not in a cancellable state.', variant: 'destructive' });
          return;
      }

      setLoading(true);
      setError(null);
      const rideDocRef = doc(db, 'rideRequests', currentRide.id);

      try {
          // Option 1: Update status to 'cancelled'
           await updateDoc(rideDocRef, {
               status: 'cancelled',
               cancelledAt: serverTimestamp()
           });

          // Option 2: Delete the request (if you don't need a record of cancellations)
          // await deleteDoc(rideDocRef);

          toast({ title: 'Ride Cancelled', description: 'Your ride request has been cancelled.' });
          setCurrentRide(null); // Clear the ride locally
           setFindingDriver(false);
           setPickupAddress(''); // Clear fields after cancellation
           setDestinationAddress('');
           setPickupLocation(null);
           setDestinationLocation(null);
           setEstimatedFare(null);

      } catch (err) {
          console.error("Error cancelling ride:", err);
          setError('Failed to cancel the ride. Please try again.');
          toast({ title: 'Cancellation Failed', description: 'Could not cancel your ride.', variant: 'destructive' });
      } finally {
          setLoading(false);
      }
  };


  // Handle user logout
  const handleLogout = async () => {
    await signOut(auth);
    toast({ title: "Logged Out", description: "You have been logged out." });
    // Auth state listener in customer/page.tsx will handle redirect
  };

  // --- Render Logic ---

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'CU'; // Default to CU
  };

  // Format Firestore Timestamps or Date objects relatively
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


  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b shadow-sm">
        <div className="flex items-center gap-3">
          <Car className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">CurbLink Customer</h1>
        </div>
        <div className="flex items-center gap-2">
           <Avatar className="h-8 w-8 border">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(customer.name)}`} alt={customer.name} />
                <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
           </Avatar>
          <span className="text-sm text-muted-foreground hidden sm:inline">{customer.email}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Map and Ride Request Form */}
          <div className="lg:col-span-2 space-y-6">
               {/* Display Errors */}
              {error && (
                  <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                      <Button onClick={() => setError(null)} variant="ghost" size="sm" className="absolute top-1 right-1 text-destructive hover:bg-destructive/10">X</Button>
                  </Alert>
              )}

               {/* Map Area */}
               <Card className="shadow-md rounded-lg overflow-hidden">
                   <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5"/> Ride Map</CardTitle>
                        <CardDescription>Enter pickup & destination to see route and estimate fare.</CardDescription>
                   </CardHeader>
                   <CardContent>
                       {/* Replace with your actual Map component */}
                       <MapPlaceholder />
                        {/* Display nearby drivers info (optional) */}
                        <div className="mt-2 text-xs text-muted-foreground">
                            {nearbyDrivers.length > 0 ? `${nearbyDrivers.length} drivers nearby` : "No drivers currently nearby"}
                        </div>
                   </CardContent>
               </Card>


               {/* Ride Request / Status Area */}
              {!currentRide ? (
                  // --- Ride Request Form ---
                  <Card className="shadow-md rounded-lg">
                      <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5"/> Book Your Ride</CardTitle>
                      </CardHeader>
                      <form onSubmit={handleRequestRide}>
                          <CardContent className="space-y-4">
                              <div className="space-y-2">
                                  <Label htmlFor="pickup-address">Pickup Address</Label>
                                  <Input
                                      id="pickup-address"
                                      placeholder="Enter pickup location"
                                      value={pickupAddress}
                                      onChange={(e) => setPickupAddress(e.target.value)}
                                      disabled={loading}
                                      required
                                  />
                                  {/* Display geocoded coords for debugging */}
                                   {/* <p className="text-xs text-muted-foreground">Coords: {pickupLocation ? `${pickupLocation.latitude.toFixed(4)}, ${pickupLocation.longitude.toFixed(4)}` : '...'}</p> */}
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="destination-address">Destination Address</Label>
                                  <Input
                                      id="destination-address"
                                      placeholder="Enter destination"
                                      value={destinationAddress}
                                      onChange={(e) => setDestinationAddress(e.target.value)}
                                      disabled={loading}
                                      required
                                  />
                                   {/* <p className="text-xs text-muted-foreground">Coords: {destinationLocation ? `${destinationLocation.latitude.toFixed(4)}, ${destinationLocation.longitude.toFixed(4)}` : '...'}</p> */}
                              </div>
                              {estimatedFare !== null && (
                                  <p className="text-sm font-medium">Estimated Fare: <span className="text-primary">${estimatedFare.toFixed(2)}</span></p>
                              )}
                          </CardContent>
                          <CardFooter>
                              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || !pickupLocation || !destinationAddress}>
                                  {loading ? <LoadingSpinner size="sm" /> : 'Request Ride'}
                              </Button>
                          </CardFooter>
                      </form>
                  </Card>
              ) : (
                  // --- Current Ride Status Card ---
                  <Card className={`shadow-md rounded-lg border-l-4 ${currentRide.status === 'pending' ? 'border-yellow-500' : currentRide.status === 'accepted' || currentRide.status === 'ongoing' ? 'border-green-500' : 'border-muted'}`}>
                     <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                              {currentRide.status === 'pending' && <><Clock className="h-5 w-5 text-yellow-500 animate-pulse"/> Finding Driver...</>}
                              {(currentRide.status === 'accepted' || currentRide.status === 'ongoing') && <><Car className="h-5 w-5 text-green-500"/> Driver Assigned</>}
                          </CardTitle>
                          <CardDescription>
                              {currentRide.status === 'pending' && 'We are looking for a driver near you.'}
                               {currentRide.status === 'accepted' && `Your driver ${currentRide.driverName || ''} is on the way.`}
                               {currentRide.status === 'ongoing' && `Your ride with ${currentRide.driverName || ''} is in progress.`}
                          </CardDescription>
                     </CardHeader>
                      <CardContent className="space-y-2">
                          <p><span className="font-medium">From:</span> {currentRide.pickupAddress}</p>
                          <p><span className="font-medium">To:</span> {currentRide.destinationAddress}</p>
                           {(currentRide.status === 'accepted' || currentRide.status === 'ongoing') && currentRide.driverName && (
                               <>
                                   <p><span className="font-medium">Driver:</span> {currentRide.driverName}</p>
                                   {currentRide.vehicleDetails && <p><span className="font-medium">Vehicle:</span> {currentRide.vehicleDetails}</p>}
                               </>
                           )}
                           <p><span className="font-medium">Status:</span> <span className="capitalize font-semibold">{currentRide.status}</span></p>
                           {currentRide.acceptedAt && currentRide.status === 'accepted' &&
                             <p className="text-xs text-muted-foreground">Accepted {formatRelativeTime(currentRide.acceptedAt)}</p>
                           }
                           {currentRide.createdAt &&
                             <p className="text-xs text-muted-foreground">Requested {formatRelativeTime(currentRide.createdAt)}</p>
                           }
                      </CardContent>
                      {(currentRide.status === 'pending' || currentRide.status === 'accepted') && ( // Allow cancellation if pending or just accepted
                          <CardFooter className="flex justify-end">
                               <Button
                                   variant="destructive"
                                   onClick={handleCancelRide}
                                   disabled={loading}
                               >
                                   {loading ? <LoadingSpinner size="sm" /> : <><XCircle className="mr-1 h-4 w-4"/> Cancel Ride</>}
                               </Button>
                          </CardFooter>
                      )}
                  </Card>
              )}

          </div>

          {/* Right Column: Ride History */}
          <div className="lg:col-span-1 space-y-6">
               <Card className="shadow-md rounded-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5"/> Ride History</CardTitle>
                        <CardDescription>Your past 10 rides.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                       {loadingHistory ? (
                           <div className="flex justify-center p-4"><LoadingSpinner /></div>
                       ) : rideHistory.length === 0 ? (
                           <p className="text-center text-muted-foreground py-4">No past rides found.</p>
                       ) : (
                           rideHistory.map(ride => (
                               <div key={ride.id} className="border p-3 rounded-md bg-muted/20">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full ${ride.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                           {ride.status}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{formatRelativeTime(ride.completedAt || ride.cancelledAt || ride.createdAt)}</span>
                                   </div>
                                   <p className="text-sm font-medium truncate">To: {ride.destinationAddress}</p>
                                   <p className="text-xs text-muted-foreground truncate">From: {ride.pickupAddress}</p>
                                   {ride.driverName && <p className="text-xs text-muted-foreground">Driver: {ride.driverName}</p>}
                                   {ride.fare && <p className="text-xs text-muted-foreground">Fare: ${ride.fare.toFixed(2)}</p>}
                               </div>
                           ))
                       )}
                    </CardContent>
                     <CardFooter>
                        <Button variant="outline" size="sm" className="w-full" onClick={fetchRideHistory} disabled={loadingHistory}>
                            {loadingHistory ? <LoadingSpinner size="sm" /> : 'Refresh History'}
                        </Button>
                    </CardFooter>
               </Card>
          </div>

      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground border-t mt-auto">
        CurbLink © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
