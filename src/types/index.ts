
import type { GeoPoint, Timestamp } from 'firebase/firestore';

export interface Driver {
  uid: string;
  email: string;
  name: string;
  vehicleDetails: string;
  isApproved: boolean;
  isAvailable: boolean;
  location: GeoPoint | null;
  registrationTimestamp: Timestamp;
  lastSeen: Timestamp;
}

export interface RideRequest {
  id: string; // Document ID from Firestore
  riderId: string; // ID of the user requesting the ride
  riderName: string;
  riderPhone?: string;
  pickupLocation: GeoPoint;
  pickupAddress?: string; // Optional formatted address
  destinationLocation?: GeoPoint; // Optional destination coords
  destinationAddress: string; // Formatted destination address
  status: 'pending' | 'accepted' | 'declined' | 'ongoing' | 'completed' | 'cancelled';
  driverId?: string | null; // ID of the assigned driver
  driverName?: string;
  vehicleDetails?: string;
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  fare?: number; // Optional fare calculation
}

// You can add more shared types here as the application grows
