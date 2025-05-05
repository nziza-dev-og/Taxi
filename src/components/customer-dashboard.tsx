
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
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API
      const latOffset = (address.length % 10) * 0.001;
      const lngOffset = (address.length % 5) * 0.001;
      const baseLat = 34.0522; // Example coords
      const baseLng = -118.2437;
      return new GeoPoint(baseLat + latOffset, baseLng + lngOffset);
  };

   const debouncedGeocode = useCallback(debounce(geocodeAddress, 800), []);

  useEffect(() => {
      if (pickupAddress) {
          debouncedGeocode(pickupAddress).then(location => {
              setPickupLocation(location);
              if (location && destinationLocation) estimateFare(location, destinationLocation);
          });
      } else {
          setPickupLocation(null);
          setEstimatedFare(null);
      }
  }, [pickupAddress, destinationLocation, debouncedGeocode]); // Added destinationLocation dependency

   useEffect(() => {
       if (destinationAddress) {
           debouncedGeocode(destinationAddress).then(location => {
               setDestinationLocation(location);
                if (pickupLocation && location) estimateFare(pickupLocation, location);
           });
       } else {
           setDestinationLocation(null);
            setEstimatedFare(null);
       }
   }, [destinationAddress, pickupLocation, debouncedGeocode]); // Added pickupLocation dependency


  const estimateFare = async (pickup: GeoPoint, destination: GeoPoint) => {
    console.log('Estimating fare (placeholder)...');
     await new Promise(resolve => setTimeout(resolve, 200)); // Simulate calc
    const latDiff = Math.abs(pickup.latitude - destination.latitude);
    const lonDiff = Math.abs(pickup.longitude - destination.longitude);
    const distanceApproximation = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 100;
    const baseFare = 5;
    const ratePerUnit = 1.5;
    const fare = baseFare + distanceApproximation * ratePerUnit;
    setEstimatedFare(parseFloat(fare.toFixed(2)));
  };

  // --- Actions ---

  const handleRequestRide = async (e: React.FormEvent) => {
      e.preventDefault();
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
          const newRideRequest: Omit<RideRequest, 'id' | 'createdAt'> = {
              riderId: customer.uid,
              riderName: customer.name,
              riderPhone: customer.phone || undefined,
              pickupLocation: pickupLocation,
              pickupAddress: pickupAddress,
              destinationLocation: destinationLocation || undefined,
              destinationAddress: destinationAddress,
              status: 'pending',
              createdAt: serverTimestamp() as Timestamp,
          };
          const docRef = await addDoc(collection(db, 'rideRequests'), newRideRequest);
          toast({ title: 'Ride Requested!', description: 'Searching for a driver...' });
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
                                  />
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
                                  />
                              </div>
                              {estimatedFare !== null && (
                                  <p className="text-sm font-medium">Estimated Fare: <span className="text-primary">${estimatedFare.toFixed(2)}</span></p>
                              )}
                          </CardContent>
                          <CardFooter>
                              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || findingDriver || !pickupLocation || !destinationAddress}>
                                  {findingDriver ? <><LoadingSpinner size="sm" className="mr-2"/> Finding Driver...</> : loading ? <LoadingSpinner size="sm" /> : 'Request Ride'}
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
                                        <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full ${ride.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'}`}>
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

    </div> // End grid container
  );
}
