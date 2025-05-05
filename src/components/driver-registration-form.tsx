
"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

const registrationSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  name: z.string().min(2, { message: 'Name is required' }),
  vehicleDetails: z.string().min(5, { message: 'Vehicle details are required (e.g., Make, Model, Year, Plate)' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'], // path of error
});

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

  const handleFirebaseAuthError = (err: AuthError) => {
      switch (err.code) {
          case 'auth/email-already-in-use':
              return 'This email address is already registered.';
          case 'auth/invalid-email':
              return 'Please enter a valid email address.';
          case 'auth/weak-password':
              return 'Password is too weak. Please choose a stronger password.';
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
              return 'Invalid email or password.';
          default:
              console.error("Firebase Auth Error:", err);
              return 'An unexpected error occurred. Please try again.';
      }
  }

  const onRegisterSubmit = async (data: RegistrationFormData) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Save additional driver info to Firestore
      await setDoc(doc(db, 'drivers', user.uid), {
        uid: user.uid,
        email: data.email,
        name: data.name,
        vehicleDetails: data.vehicleDetails,
        isApproved: false, // Default to not approved
        isAvailable: false, // Default to unavailable
        location: null, // Default location
        registrationTimestamp: serverTimestamp(), // Record registration time for trial
        lastSeen: serverTimestamp(),
      });

      toast({
        title: "Registration Successful",
        description: "Your account has been created. Please wait for admin approval.",
      });
      // No automatic sign-in after registration, user waits for approval.
      // Optionally, sign the user out if Firebase auto-signs in: await signOut(auth);
       registrationForm.reset(); // Clear the form

    } catch (err) {
       if (err instanceof Error && 'code' in err) {
           setError(handleFirebaseAuthError(err as AuthError));
       } else {
           setError('An unexpected error occurred during registration.');
           console.error(err);
       }
    } finally {
      setLoading(false);
    }
  };

  const onLoginSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      // Auth state change listener in Home component will handle redirect/UI update
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
       loginForm.reset(); // Clear the form
    } catch (err) {
       if (err instanceof Error && 'code' in err) {
           setError(handleFirebaseAuthError(err as AuthError));
       } else {
            setError('An unexpected error occurred during login.');
           console.error(err);
       }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        {/* Login Tab */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Driver Login</CardTitle>
              <CardDescription>Access your CurbLink driver dashboard.</CardDescription>
            </CardHeader>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
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
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Logging In...' : 'Login'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Registration Tab */}
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Driver Registration</CardTitle>
              <CardDescription>Create your CurbLink driver account. Enjoy a 1-week free trial!</CardDescription>
            </CardHeader>
             <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)}>
              <CardContent className="space-y-4">
                 {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
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
                    placeholder="********"
                    {...registrationForm.register('password')}
                     disabled={loading}
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
                    placeholder="********"
                    {...registrationForm.register('confirmPassword')}
                     disabled={loading}
                  />
                   {registrationForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={loading}>
                   {loading ? 'Registering...' : 'Register'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
