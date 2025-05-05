
'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Removed signOut as it's handled by AppNavigation
import {
  doc,
  getDocs, // Changed from getDoc
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
import { db } from '@/config/firebase'; // Removed auth as it's not directly used here anymore
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Removed Avatar components, LogOut, UserIcon, ShieldCheck as they are in AppNavigation or not needed directly
import { Map, MapPin, Car, Clock, CheckCircle, XCircle, Search, History } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import type { Customer, RideRequest, Driver } from '@/types'; // Import shared types
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting
// Removed Link import as footer nav is gone
// Map component placeholder - replace with actual implementation
const MapPlaceholder = () => <div data-ai-hint="map wireframe" className="h-64 w-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground">Map Placeholder</div>;


interface CustomerDashboardProps {
  customer: Customer;
}

// Corrected debounce function for async functions
// Adjusted return type and error handling based on user feedback to resolve TS error
function debounce<F extends (...args: any[]) => Promise<any>>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout;
  // Adjust return type to match the expected Promise<GeoPoint | null>
  return (...args: Parameters<F>): ReturnType<F> => {
    return new Promise((resolve) => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result); // Resolve with the actual result (GeoPoint | null)
        } catch (error) {
          console.error("Error in debounced function:", error);
          // Resolve with null on error to maintain the expected return type
          resolve(null as any); // Use 'as any' to fit the generic structure, result is effectively Promise<null> here
        }
      }, waitFor);
    }) as ReturnType<F>; // Assert the return type matches the original function's promise type
  };
}


export default function CustomerDashboard({ customer }: CustomerDashboardProps) {
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickupLocation, setPickupLocation] = useState<GeoPoint | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<GeoPoint | null>(null);
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [rideHistory, setRideHistory] = useState<RideRequest[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [findingDriver, setFindingDriver] = useState(false);
  const { toast } = useToast();

  // --- Data Fetching and Listeners ---

   useEffect(() => {
    const q = query(
      collection(db, 'rideRequests'),
      where('riderId', '==', customer.uid),
      where('status', 'in', ['pending', 'accepted', 'ongoing']),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        if (!querySnapshot.empty) {
            const rideDoc = querySnapshot.docs[0];
            const rideData = { id: rideDoc.id, ...rideDoc.data() } as RideRequest;
            setCurrentRide(rideData);
            setFindingDriver(rideData.status === 'pending');
             if (rideData.status === 'pending' || rideData.status === 'accepted' || rideData.status === 'ongoing') {
                 setPickupAddress(rideData.pickupAddress);
                 setDestinationAddress(rideData.destinationAddress);
                 setPickupLocation(rideData.pickupLocation);
                 setDestinationLocation(rideData.destinationLocation || null);
            }
        } else {
            setCurrentRide(null);
            setFindingDriver(false);
        }
    }, (err) => {
        console.error("Error listening to current ride:", err);
        setError("Failed to get current ride status.");
    });

    return () => unsubscribe();
  }, [customer.uid]);


   const fetchRideHistory = useCallback(async () => {
       setLoadingHistory(true);
       setError(null);
       try {
           const q = query(
               collection(db, 'rideRequests'),
               where('riderId', '==', customer.uid),
               where('status', 'in', ['completed', 'cancelled']),
               orderBy('createdAt', 'desc'),
               limit(10)
           );
           // *** FIX: Use getDocs for a query ***
           const querySnapshot = await getDocs(q); // Changed from getDoc(q)
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
   }, [fetchRideHistory]);

  useEffect(() => {
    // Placeholder GeoQuery
    const q = query(
      collection(db, 'drivers'),
      where('isAvailable', '==', true),
      where('isApproved', '==', true),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const drivers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Driver));
      setNearbyDrivers(drivers);
    }, (err) => {
      console.error("Error fetching nearby drivers:", err);
    });
    return () => unsubscribe();
  }, []);

  // --- Geocoding and Fare Estimation (Placeholders) ---

  const geocodeAddress = async (address: string): Promise<GeoPoint | null> => {
      if (!address) return null;
      console.log(`Geocoding (placeholder): ${address}`);
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API
      // Simple pseudo-random location based on address length for testing
      const latOffset = (address.length % 10) * 0.001 * (Math.random() > 0.5 ? 1 : -1);
      const lngOffset = (address.length % 5) * 0.001 * (Math.random() > 0.5 ? 1 : -1);
      const baseLat = 34.0522; // Example coords (Los Angeles)
      const baseLng = -118.2437;
      return new GeoPoint(baseLat + latOffset, baseLng + lngOffset);
  };

   // Use useCallback to memoize the debounced function itself
   const debouncedGeocode = useCallback(debounce(geocodeAddress, 800), []); // Empty dependency array means it's created once

  useEffect(() => {
      if (pickupAddress) {
          // .then() now correctly receives GeoPoint | null because debouncedGeocode returns Promise<GeoPoint | null>
          debouncedGeocode(pickupAddress).then((location: GeoPoint | null) => { // Explicitly type location
              setPickupLocation(location);
              if (location && destinationLocation) estimateFare(location, destinationLocation);
          });
      } else {
          setPickupLocation(null);
          setEstimatedFare(null);
      }
      // Dependency array only includes pickupAddress and destinationLocation
      // as debouncedGeocode itself is stable due to useCallback.
  }, [pickupAddress, destinationLocation, debouncedGeocode]);

   useEffect(() => {
       if (destinationAddress) {
           // .then() now correctly receives GeoPoint | null
           debouncedGeocode(destinationAddress).then((location: GeoPoint | null) => { // Explicitly type location
               setDestinationLocation(location);
                if (pickupLocation && location) estimateFare(pickupLocation, location);
           });
       } else {
           setDestinationLocation(null);
            setEstimatedFare(null);
       }
       // Dependency array only includes destinationAddress and pickupLocation.
   }, [destinationAddress, pickupLocation, debouncedGeocode]);


  const estimateFare = async (pickup: GeoPoint, destination: GeoPoint) => {
    console.log('Estimating fare (placeholder)...');
     await new Promise(resolve => setTimeout(resolve, 200)); // Simulate calc
    // Very basic distance approximation (Haversine formula would be better)
    const latDiff = Math.abs(pickup.latitude - destination.latitude);
    const lonDiff = Math.abs(pickup.longitude - destination.longitude);
    const distanceApproximation = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111; // Approx km per degree
    const baseFare = 5;
    const ratePerKm = 1.5;
    const fare = baseFare + distanceApproximation * ratePerKm;
    setEstimatedFare(parseFloat(fare.toFixed(2)));
  };

  // --- Actions ---

  const handleRequestRide = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!pickupAddress || !destinationAddress || !pickupLocation) {
          setError('Please enter both pickup and destination addresses.');
          toast({ title: 'Missing Information', description: 'Enter valid pickup and destination.', variant: 'destructive' });
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
         // Define the data to be added, excluding 'id'
          const rideDataToAdd = {
              riderId: customer.uid,
              riderName: customer.name,
              riderPhone: customer.phone || undefined,
              pickupLocation: pickupLocation,
              pickupAddress: pickupAddress,
              destinationLocation: destinationLocation || undefined,
              destinationAddress: destinationAddress,
              status: 'pending' as const, // Use 'as const' for literal type
              // Let Firestore handle createdAt automatically with serverTimestamp()
              driverId: null,
              driverName: undefined,
              vehicleDetails: undefined,
              acceptedAt: undefined,
              completedAt: undefined,
              cancelledAt: undefined,
              fare: estimatedFare ?? undefined,
          };

          // Add the document, including serverTimestamp for createdAt
          const docRef = await addDoc(collection(db, 'rideRequests'), {
              ...rideDataToAdd,
              createdAt: serverTimestamp(), // Apply serverTimestamp during the addDoc call
          });

          toast({ title: 'Ride Requested!', description: 'Searching for a driver...' });
          // No need to manually set state here, listener will pick it up
      } catch (err) {
          console.error("Error requesting ride:", err);
          setError('Failed to request ride.');
          toast({ title: 'Request Failed', description: 'Could not submit your ride request.', variant: 'destructive' });
           setFindingDriver(false);
      } finally {
          setLoading(false);
      }
  };

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
           await updateDoc(rideDocRef, { status: 'cancelled', cancelledAt: serverTimestamp() });
          toast({ title: 'Ride Cancelled', description: 'Your ride request has been cancelled.' });
          // Clear local state immediately for better UX, listener will confirm
           setCurrentRide(null);
           setFindingDriver(false);
           setPickupAddress('');
           setDestinationAddress('');
           setPickupLocation(null);
           setDestinationLocation(null);
           setEstimatedFare(null);

      } catch (err) {
          console.error("Error cancelling ride:", err);
          setError('Failed to cancel the ride.');
          toast({ title: 'Cancellation Failed', description: 'Could not cancel your ride.', variant: 'destructive' });
      } finally {
          setLoading(false);
      }
  };

  // Removed handleLogout - handled by AppNavigation

  // --- Render Logic ---

  // Removed getInitials - handled by AppNavigation or can be local if needed elsewhere

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
    // Removed outer div, header, and footer - Handled by Layout
     <div className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6"> {/* Ensure it fills space and apply grid */}

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
                       <MapPlaceholder />
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
                                      disabled={loading || findingDriver} // Disable when finding too
                                      required
                                      aria-invalid={!pickupLocation && pickupAddress.length > 0 ? "true" : "false"}
                                      aria-describedby="pickup-location-status"
                                  />
                                  <p id="pickup-location-status" className="text-xs text-muted-foreground">
                                     {pickupAddress && !pickupLocation ? 'Geocoding...' : pickupLocation ? 'Location confirmed.' : 'Enter address.'}
                                  </p>
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="destination-address">Destination Address</Label>
                                  <Input
                                      id="destination-address"
                                      placeholder="Enter destination"
                                      value={destinationAddress}
                                      onChange={(e) => setDestinationAddress(e.target.value)}
                                      disabled={loading || findingDriver} // Disable when finding too
                                      required
                                      aria-invalid={!destinationLocation && destinationAddress.length > 0 ? "true" : "false"}
                                      aria-describedby="destination-location-status"
                                  />
                                   <p id="destination-location-status" className="text-xs text-muted-foreground">
                                      {destinationAddress && !destinationLocation ? 'Geocoding...' : destinationLocation ? 'Location confirmed.' : 'Enter address.'}
                                  </p>
                              </div>
                              {estimatedFare !== null && (
                                  <p className="text-sm font-medium">Estimated Fare: <span className="text-primary">${estimatedFare.toFixed(2)}</span></p>
                              )}
                          </CardContent>
                          <CardFooter>
                              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || findingDriver || !pickupLocation || !destinationAddress || !destinationLocation}>
                                  {findingDriver ? <><LoadingSpinner size="sm" className="mr-2"/> Finding Driver...</> : loading ? <LoadingSpinner size="sm" /> : 'Request Ride'}
                              </Button>
                          </CardFooter>
                      </form>
                  </Card>
              ) : (
                  // --- Current Ride Status Card ---
                  <Card className={`shadow-md rounded-lg border-l-4 ${
                     currentRide.status === 'pending' ? 'border-yellow-500' :
                     currentRide.status === 'accepted' || currentRide.status === 'ongoing' ? 'border-green-500' :
                     currentRide.status === 'cancelled' ? 'border-red-500' :
                     currentRide.status === 'completed' ? 'border-blue-500' :
                     'border-muted'
                    }`}>
                     <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                              {currentRide.status === 'pending' && <><Clock className="h-5 w-5 text-yellow-500 animate-pulse"/> Finding Driver...</>}
                              {(currentRide.status === 'accepted' || currentRide.status === 'ongoing') && <><Car className="h-5 w-5 text-green-500"/> Driver Assigned</>}
                              {currentRide.status === 'cancelled' && <><XCircle className="h-5 w-5 text-red-500"/> Ride Cancelled</>}
                              {currentRide.status === 'completed' && <><CheckCircle className="h-5 w-5 text-blue-500"/> Ride Completed</>}
                          </CardTitle>
                          <CardDescription>
                              {currentRide.status === 'pending' && 'We are looking for a driver near you.'}
                               {currentRide.status === 'accepted' && `Your driver ${currentRide.driverName || '...'} is on the way.`}
                               {currentRide.status === 'ongoing' && `Your ride with ${currentRide.driverName || '...'} is in progress.`}
                               {currentRide.status === 'cancelled' && 'This ride request was cancelled.'}
                               {currentRide.status === 'completed' && 'This ride has been completed.'}
                          </CardDescription>
                     </CardHeader>
                      <CardContent className="space-y-2">
                          <p><span className="font-medium">From:</span> {currentRide.pickupAddress}</p>
                          <p><span className="font-medium">To:</span> {currentRide.destinationAddress}</p>
                           {(currentRide.status === 'accepted' || currentRide.status === 'ongoing' || currentRide.status === 'completed') && currentRide.driverName && (
                               <>
                                   <p><span className="font-medium">Driver:</span> {currentRide.driverName}</p>
                                   {currentRide.vehicleDetails && <p><span className="font-medium">Vehicle:</span> {currentRide.vehicleDetails}</p>}
                               </>
                           )}
                           <p><span className="font-medium">Status:</span> <span className="capitalize font-semibold">{currentRide.status}</span></p>
                           {currentRide.fare && currentRide.status === 'completed' &&
                               <p className="font-medium">Final Fare: <span className="text-primary">${currentRide.fare.toFixed(2)}</span></p>
                            }
                           {currentRide.acceptedAt && currentRide.status === 'accepted' &&
                             <p className="text-xs text-muted-foreground">Accepted {formatRelativeTime(currentRide.acceptedAt)}</p>
                           }
                           {currentRide.createdAt &&
                             <p className="text-xs text-muted-foreground">Requested {formatRelativeTime(currentRide.createdAt)}</p>
                           }
                            {currentRide.cancelledAt && currentRide.status === 'cancelled' &&
                             <p className="text-xs text-muted-foreground">Cancelled {formatRelativeTime(currentRide.cancelledAt)}</p>
                           }
                           {currentRide.completedAt && currentRide.status === 'completed' &&
                             <p className="text-xs text-muted-foreground">Completed {formatRelativeTime(currentRide.completedAt)}</p>
                           }
                      </CardContent>
                      {/* Show cancel button only if pending or accepted */}
                      {(currentRide.status === 'pending' || currentRide.status === 'accepted') && (
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
                      {/* Optionally add a "Book Again" button for completed/cancelled rides */}
                       {(currentRide.status === 'completed' || currentRide.status === 'cancelled') && (
                           <CardFooter className="flex justify-end">
                               <Button
                                   variant="outline"
                                   onClick={() => {
                                       setCurrentRide(null); // Clear the completed/cancelled ride
                                       // Optionally pre-fill addresses for re-booking
                                       // setPickupAddress(currentRide.pickupAddress);
                                       // setDestinationAddress(currentRide.destinationAddress);
                                   }}
                               >
                                  Book New Ride
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
                               <div key={ride.id} className="border p-3 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full ${
                                            ride.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' :
                                            ride.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' // Fallback for other potential statuses
                                            }`}>
                                           {ride.status}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{formatRelativeTime(ride.completedAt || ride.cancelledAt || ride.createdAt)}</span>
                                   </div>
                                   <p className="text-sm font-medium truncate" title={ride.destinationAddress}>To: {ride.destinationAddress}</p>
                                   <p className="text-xs text-muted-foreground truncate" title={ride.pickupAddress}>From: {ride.pickupAddress}</p>
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

    </div> // End grid container
  );
}
