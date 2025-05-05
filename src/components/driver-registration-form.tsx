
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { LoadingSpinner } from './ui/loading-spinner'; // Assuming LoadingSpinner exists

// Schema for driver registration
const registrationSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  name: z.string().min(2, { message: 'Full name is required' }),
  vehicleDetails: z.string().min(5, { message: 'Vehicle details are required (e.g., Make, Model, Year, Plate)' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'], // Error path
});

// Schema for driver login
const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;
type LoginFormData = z.infer<typeof loginSchema>;

export default function DriverRegistrationForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const registrationForm = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      vehicleDetails: '',
    },
  });

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Helper to map Firebase Auth errors to user-friendly messages
  const handleFirebaseAuthError = (err: AuthError): string => {
    switch (err.code) {
      case 'auth/email-already-in-use':
        return 'This email address is already registered.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential': // Combined common login errors
        return 'Invalid email or password.';
      default:
        console.error("Firebase Auth Error:", err); // Log unexpected errors
        return 'An unexpected error occurred. Please try again.';
    }
  }

  // Handle driver registration
  const onRegisterSubmit = async (data: RegistrationFormData) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Save additional driver info to Firestore 'drivers' collection
      await setDoc(doc(db, 'drivers', user.uid), {
        uid: user.uid,
        email: data.email,
        name: data.name,
        vehicleDetails: data.vehicleDetails,
        isApproved: false, // Default to not approved
        isAvailable: false, // Default to unavailable
        location: null, // Default location to null
        registrationTimestamp: serverTimestamp(), // Record registration time for trial period check
        lastSeen: serverTimestamp(), // Initialize last seen timestamp
      });

      toast({
        title: "Registration Submitted",
        description: "Your account has been created and submitted for admin approval. Enjoy your 1-week free trial!",
        variant: "default",
      });
      // User needs approval, so don't automatically log them in here.
      // Firebase might auto-login, but the app logic should handle the unapproved state.
       registrationForm.reset(); // Clear the form after successful submission

    } catch (err) {
       if (err instanceof Error && 'code' in err) { // Check if it's a Firebase Auth error
           setError(handleFirebaseAuthError(err as AuthError));
       } else {
           setError('An unexpected error occurred during registration.');
           console.error(err);
       }
    } finally {
      setLoading(false);
    }
  };

  // Handle driver login
  const onLoginSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // Successful login, the auth state listener in the main page (e.g., page.tsx)
      // will handle the redirection or UI update based on approval status.
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
       loginForm.reset(); // Clear the form
      // No need to manually redirect here, let the auth listener handle it.
    } catch (err) {
       if (err instanceof Error && 'code' in err) {
           setError(handleFirebaseAuthError(err as AuthError));
       } else {
            setError('An unexpected error occurred during login.');
           console.error(err);
       }
    } finally {
       // Keep loading indicator briefly on success for smoother transition handled by auth listener
       if (error) setLoading(false); // Only stop loading if there's an error to show
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        {/* Login Tab Content */}
        <TabsContent value="login">
          <Card className="shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Driver Login</CardTitle>
              <CardDescription className="text-center text-muted-foreground">Access your CurbLink driver dashboard.</CardDescription>
            </CardHeader>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Login Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="driver@example.com"
                    {...loginForm.register('email')}
                    disabled={loading}
                    aria-required="true"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="********"
                    {...loginForm.register('password')}
                    disabled={loading}
                    aria-required="true"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
                  {loading ? <LoadingSpinner size="sm" /> : 'Login'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Registration Tab Content */}
        <TabsContent value="register">
          <Card className="shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Driver Registration</CardTitle>
              <CardDescription className="text-center text-muted-foreground">Create your account. Includes a 1-week free trial!</CardDescription>
            </CardHeader>
             <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)}>
              <CardContent className="space-y-4">
                 {error && ( // Display registration-specific errors
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Registration Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="register-name">Full Name</Label>
                  <Input
                    id="register-name"
                    placeholder="John Doe"
                    {...registrationForm.register('name')}
                     disabled={loading}
                     aria-required="true"
                  />
                  {registrationForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.name.message}</p>
                  )}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="register-vehicle">Vehicle Details</Label>
                  <Input
                    id="register-vehicle"
                    placeholder="e.g., Toyota Camry 2020, ABC-123"
                    {...registrationForm.register('vehicleDetails')}
                     disabled={loading}
                     aria-required="true"
                  />
                  {registrationForm.formState.errors.vehicleDetails && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.vehicleDetails.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="driver@example.com"
                    {...registrationForm.register('email')}
                     disabled={loading}
                     aria-required="true"
                  />
                   {registrationForm.formState.errors.email && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Min. 6 characters"
                    {...registrationForm.register('password')}
                     disabled={loading}
                     aria-required="true"
                  />
                   {registrationForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.password.message}</p>
                  )}
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">Confirm Password</Label>
                  <Input
                    id="register-confirm-password"
                    type="password"
                    placeholder="Re-enter password"
                    {...registrationForm.register('confirmPassword')}
                     disabled={loading}
                     aria-required="true"
                  />
                   {registrationForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
                   {loading ? <LoadingSpinner size="sm" /> : 'Register'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
