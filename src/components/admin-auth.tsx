
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
import { AlertCircle } from "lucide-react";
import { LoadingSpinner } from './ui/loading-spinner';

// Schema for admin registration (simplified)
const registrationSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  name: z.string().min(2, { message: 'Name is required' }),
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
  const { toast } = useToast();

  const registrationForm = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
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

      // Save admin info to 'admins' collection in Firestore
      await setDoc(doc(db, 'admins', user.uid), {
        uid: user.uid,
        email: data.email,
        name: data.name,
        isAdmin: true, // Mark as admin
        registrationTimestamp: serverTimestamp(),
      });

      toast({
        title: "Admin Registration Successful",
        description: "Admin account created successfully. You can now log in.",
      });
      registrationForm.reset();

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
       const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
       const user = userCredential.user;

       // Verify if the logged-in user is actually an admin
       const adminDocRef = doc(db, 'admins', user.uid);
       const adminDocSnap = await getDoc(adminDocRef);

       if (!adminDocSnap.exists() || !adminDocSnap.data()?.isAdmin) {
            // Not found in admins collection or isAdmin is not true
            await auth.signOut(); // Log them out
            setError('Access denied. This account is not authorized for admin access.');
            setLoading(false);
            return;
       }

      // Auth state change listener in the admin page will handle UI update
      toast({
        title: "Admin Login Successful",
        description: "Welcome to the Admin Dashboard!",
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
      // Don't set loading to false immediately if successful, let the page transition handle it
       if (error) setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Admin Login</TabsTrigger>
          <TabsTrigger value="register">Admin Register</TabsTrigger>
        </TabsList>

        {/* Login Tab */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>Access the CurbLink administration panel.</CardDescription>
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
                    placeholder="admin@example.com"
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
                  {loading ? <LoadingSpinner size="sm" /> : 'Login'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Registration Tab */}
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Admin Registration</CardTitle>
              <CardDescription>Create a new administrator account.</CardDescription>
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
                    placeholder="Admin User"
                    {...registrationForm.register('name')}
                     disabled={loading}
                  />
                  {registrationForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{registrationForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="admin@example.com"
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
