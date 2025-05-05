
import type { GeoPoint, Timestamp } from 'firebase/firestore';

export interface Driver {
  uid: string;
  email: string;
  name: string;
  vehicleDetails: string; // e.g., "Toyota Camry 2020, Plate ABC-123"
  isApproved: boolean; // Admin approval status
  isAvailable: boolean; // Driver's current availability toggle
  location: GeoPoint | null; // Last known location
  registrationTimestamp: Timestamp; // Timestamp of initial registration
  lastSeen: Timestamp; // Timestamp of last activity/location update
  // Add other fields as needed, e.g., rating, totalRides, etc.
}

export interface RideRequest {
  id: string; // Document ID from Firestore
  riderId: string; // ID of the user requesting the ride
  riderName: string; // Name of the rider
  riderPhone?: string; // Optional rider phone number (consider privacy/masking)
  pickupLocation: GeoPoint; // Coordinates for pickup
  pickupAddress?: string; // Optional formatted pickup address
  destinationLocation?: GeoPoint; // Optional destination coordinates
  destinationAddress: string; // Formatted destination address (required)
  status: 'pending' | 'accepted' | 'declined' | 'ongoing' | 'completed' | 'cancelled'; // Ride status lifecycle
  driverId?: string | null; // ID of the assigned driver (null if pending/unassigned)
  driverName?: string; // Name of the assigned driver
  vehicleDetails?: string; // Vehicle details of the assigned driver
  createdAt: Timestamp; // Timestamp when the request was created
  acceptedAt?: Timestamp; // Timestamp when a driver accepted
  completedAt?: Timestamp; // Timestamp when the ride was completed
  cancelledAt?: Timestamp; // Timestamp if cancelled
  fare?: number; // Optional fare calculation
  // Add other fields like estimatedTime, distance, etc.
}

export interface Admin {
    uid: string;
    email: string;
    name: string; // Admins might also have names
    isAdmin: true; // Flag to identify admin role
    registrationTimestamp: Timestamp;
    // Add other admin-specific fields if necessary
}

// You can add more shared types here as the application grows, e.g., Customer, Payment, etc.

