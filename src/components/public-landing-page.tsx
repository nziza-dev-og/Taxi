// src/components/public-landing-page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, User, ShieldCheck, MapPin, Lock, CreditCard } from 'lucide-react'; // Relevant icons

export default function PublicLandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-gradient-to-r from-primary/10 via-background to-primary/10">
        <div className="container px-4 md:px-6 text-center">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none text-primary">
              CurbLink
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
              Your reliable and secure platform for booking rides. Connect with drivers, manage your trips, and enjoy seamless travel.
            </p>
            <div className="space-x-4 mt-6">
              <Link href="/customer" passHref>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-transform transform hover:scale-105">
                  Book a Ride Now
                </Button>
              </Link>
              <Link href="/" passHref>
                <Button size="lg" variant="outline" className="shadow-md transition-transform transform hover:scale-105">
                  Drive with Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter text-center mb-12 sm:text-4xl md:text-5xl">
            Why Choose CurbLink?
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-lg rounded-lg overflow-hidden transform transition-transform hover:scale-105 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center gap-4 p-6 bg-card">
                 <div className="bg-primary/10 p-3 rounded-full">
                    <MapPin className="w-6 h-6 text-primary" />
                 </div>
                <CardTitle>Real-Time Tracking</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Track your driver's location in real-time on the map for accurate arrival times.</p>
              </CardContent>
            </Card>
             <Card className="shadow-lg rounded-lg overflow-hidden transform transition-transform hover:scale-105 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center gap-4 p-6 bg-card">
                  <div className="bg-accent/10 p-3 rounded-full">
                     <Lock className="w-6 h-6 text-accent" />
                   </div>
                <CardTitle>Secure & Private</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Your data and communications are protected with robust security measures.</p>
              </CardContent>
            </Card>
             <Card className="shadow-lg rounded-lg overflow-hidden transform transition-transform hover:scale-105 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center gap-4 p-6 bg-card">
                   <div className="bg-secondary/10 p-3 rounded-full">
                     <CreditCard className="w-6 h-6 text-secondary-foreground" />
                    </div>
                <CardTitle>Easy Payments</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Simple and secure payment options, including Stripe integration for drivers.</p>
              </CardContent>
            </Card>
             <Card className="shadow-lg rounded-lg overflow-hidden transform transition-transform hover:scale-105 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center gap-4 p-6 bg-card">
                  <div className="bg-green-500/10 p-3 rounded-full">
                     <Car className="w-6 h-6 text-green-600" />
                  </div>
                <CardTitle>Become a Driver</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Join our network of drivers. Easy signup, flexible hours, and a 7-day free trial.</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg rounded-lg overflow-hidden transform transition-transform hover:scale-105 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center gap-4 p-6 bg-card">
                 <div className="bg-blue-500/10 p-3 rounded-full">
                    <User className="w-6 h-6 text-blue-600" />
                 </div>
                <CardTitle>For Customers</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Book rides effortlessly, view ride history, and manage your profile.</p>
              </CardContent>
            </Card>
             <Card className="shadow-lg rounded-lg overflow-hidden transform transition-transform hover:scale-105 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center gap-4 p-6 bg-card">
                 <div className="bg-purple-500/10 p-3 rounded-full">
                    <ShieldCheck className="w-6 h-6 text-purple-600" />
                 </div>
                <CardTitle>Admin Control</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Manage drivers, oversee operations, and view platform statistics.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
       <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
           <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
               <div className="space-y-3">
                   <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                       Ready to Get Started?
                   </h2>
                   <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                       Whether you need a ride or want to drive, CurbLink makes it simple.
                   </p>
               </div>
               <div className="flex flex-col gap-3 min-[400px]:flex-row justify-center">
                   <Link href="/customer" passHref>
                       <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">I Need a Ride</Button>
                   </Link>
                   <Link href="/" passHref>
                       <Button size="lg" variant="secondary" className="shadow-md">I Want to Drive</Button>
                   </Link>
                   <Link href="/admin" passHref>
                        <Button size="lg" variant="outline" className="shadow-md">Admin Portal</Button>
                   </Link>
               </div>
           </div>
       </section>


      {/* Footer */}
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-background">
        <p className="text-xs text-muted-foreground">&copy; 2024 CurbLink. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4 text-muted-foreground" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4 text-muted-foreground" prefetch={false}>
            Privacy Policy
          </Link>
           <Link href="/admin" className="text-xs hover:underline underline-offset-4 text-muted-foreground" prefetch={false}>
             Admin Access
           </Link>
        </nav>
      </footer>
    </div>
  );
}
