"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, AuthError } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, UserCog } from "lucide-react"; // Added UserCog icon
import { LoadingSpinner } from './ui/loading-spinner';

// Schema for admin registration (can be simpler than driver registration)
const registrationSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  name: z.string().min(2, { message: 'Admin name is required' }),
  // Add a secret registration code/key if needed for security
  // registrationCode: z.string().min(1, { message: 'Registration code is required' })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Schema for admin login
const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;
type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("login"); // Track active tab to clear errors
  const { toast } = useToast();

  const registrationForm = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', name: '' },
  });

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

   // Clear errors when switching tabs
  const handleTabChange = (value: string) => {
      setActiveTab(value);
      setError(null); // Clear error message
      // Optionally reset forms when switching tabs
      // loginForm.reset();
      // registrationForm.reset();
  }


  const handleFirebaseAuthError = (err: AuthError): string => {
      switch (err.code) {
          case 'auth/email-already-in-use':
              return 'This email address is already registered for an admin account.';
          case 'auth/invalid-email':
              return 'Please enter a valid email address.';
          case 'auth/weak-password':
              return 'Password is too weak. Please choose a stronger password.';
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
              return 'Invalid admin email or password.';
          default:
              console.error("Firebase Admin Auth Error:", err);
              return 'An unexpected error occurred. Please try again.';
      }
  }

  // Handle Admin Registration
  const onRegisterSubmit = async (data: RegistrationFormData) => {
    // Optional: Add validation for a secret registration code here if implemented
    // if (data.registrationCode !== process.env.NEXT_PUBLIC_ADMIN_REGISTRATION_CODE) {
    //      setError("Invalid registration code.");
    //      return;
    // }

    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Save admin info to 'admins' collection in Firestore
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        email: data.email,
        name: data.name,
        isAdmin: true, // Explicitly mark as admin
        registrationTimestamp: serverTimestamp(),
      });

      toast({
        title: "Admin Registration Successful",
        description: "Admin account created. You can now log in using the Login tab.",
      });
      registrationForm.reset(); // Clear the registration form
      setActiveTab("login"); // Switch to login tab after successful registration

    } catch (err) {
       if (err instanceof Error && 'code' in err) {
           setError(handleFirebaseAuthError(err as AuthError));
       } else {
           setError('An unexpected error occurred during admin registration.');
           console.error(err);
       }
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Login
  const onLoginSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError(null);
    try {
       const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
       const user = userCredential.user;

       // CRITICAL: Verify if the logged-in user is actually marked as an admin in Firestore
       const adminDocRef = doc(db, 'admins', user.uid);
       const adminDocSnap = await getDoc(adminDocRef);

       if (!adminDocSnap.exists() || !adminDocSnap.data()?.isAdmin) {
            // If the user exists in Auth but NOT in the 'admins' collection OR isAdmin is false/missing
            await auth.signOut(); // Log them out immediately
            setError('Access Denied. This account is not authorized for admin access.');
            toast({
                title: "Access Denied",
                description: "Provided credentials do not belong to an authorized administrator.",
                variant: "destructive"
            })
            setLoading(false); // Ensure loading stops
            return; // Stop execution
       }

      // User is authenticated AND verified as admin in Firestore
      // The auth state change listener in the admin page (admin/page.tsx) will handle UI update/redirect.
      toast({
        title: "Admin Login Successful",
        description: "Welcome to the CurbLink Admin Dashboard!",
      });
       loginForm.reset(); // Clear the login form
      // Let the listener redirect, don't set loading to false here on success
    } catch (err) {
       if (err instanceof Error && 'code' in err) {
           setError(handleFirebaseAuthError(err as AuthError));
       } else {
            setError('An unexpected error occurred during admin login.');
           console.error(err);
       }
       setLoading(false); // Set loading false only if there was an error during login attempt
    }
    // On successful login, loading remains true until the page transition occurs via the listener
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Admin Login</TabsTrigger>
          <TabsTrigger value="register">Admin Register</TabsTrigger>
        </TabsList>

        {/* Admin Login Tab */}
        <TabsContent value="login">
          <Card className="shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2"> <UserCog className="h-6 w-6"/> Admin Login</CardTitle>
              <CardDescription className="text-center text-muted-foreground">Access the CurbLink administration panel.</CardDescription>
            </CardHeader>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
              <CardContent className="space-y-4">
                {error && activeTab === 'login' && ( // Show error only on the relevant tab
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Login Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-email">Admin Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="admin@curblink.com"
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

        {/* Admin Registration Tab */}
        <TabsContent value="register">
          <Card className="shadow-md rounded-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2"><UserCog className="h-6 w-6"/> Admin Registration</CardTitle>
              <CardDescription className="text-center text-muted-foreground">Create a new administrator account. (For authorized personnel only)</CardDescription>
            </CardHeader>
             <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)}>
              <CardContent className="space-y-4">
                 {error && activeTab === 'register' && ( // Show error only on the relevant tab
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Registration Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="register-name">Admin Full Name</Label>
                  <Input
                    id="register-name"
                    placeholder="Admin User"
                    {...registrationForm.register('name')}
                     disabled={loading}
                     aria-required="true"
                  />
                  {registrationForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Admin Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="admin@curblink.com"
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
                 {/* Optional: Registration Code Input */}
                {/* <div className="space-y-2">
                  <Label htmlFor="register-code">Registration Code</Label>
                  <Input
                    id="register-code"
                    type="password" // Use password type to hide code
                    placeholder="Enter secret code"
                    {...registrationForm.register('registrationCode')}
                    disabled={loading}
                    aria-required="true"
                  />
                  {registrationForm.formState.errors.registrationCode && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.registrationCode.message}</p>
                  )}
                </div> */}
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
                   {loading ? <LoadingSpinner size="sm" /> : 'Register Admin'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

