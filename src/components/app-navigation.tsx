
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, User, ShieldCheck, LogOut, Menu } from 'lucide-react'; // Import icons
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'; // For mobile menu
import { cn } from '@/lib/utils';
import { signOut, User as FirebaseUser } from 'firebase/auth'; // Import Firebase types
import { auth } from '@/config/firebase'; // Import auth instance
import { useToast } from '@/hooks/use-toast';

interface AppNavigationProps {
  user: FirebaseUser | null; // Pass user to conditionally show logout
}

// Navigation links configuration
const navLinks = [
  { href: '/', label: 'Driver Portal', icon: Car, roles: ['driver'] },
  { href: '/customer', label: 'Customer Portal', icon: User, roles: ['customer'] },
  { href: '/admin', label: 'Admin Portal', icon: ShieldCheck, roles: ['admin'] },
];

export default function AppNavigation({ user }: AppNavigationProps) {
  const pathname = usePathname();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been logged out successfully." });
      // Redirecting is handled by the auth state listeners in the respective page components
    } catch (error) {
      console.error("Logout Error:", error);
      toast({ title: "Logout Failed", description: "Could not log you out.", variant: "destructive" });
    }
  };

  // Determine the current section based on pathname
  const getCurrentSection = () => {
    if (pathname === '/') return 'driver';
    if (pathname.startsWith('/customer')) return 'customer';
    if (pathname.startsWith('/admin')) return 'admin';
    return null; // Or a default section
  };
  const currentSection = getCurrentSection();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
             <Link
               href="/"
               className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base" // Logo/Brand Link
             >
                <Car className="h-5 w-5 transition-all group-hover:scale-110" />
               <span className="sr-only">CurbLink</span>
             </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
                  currentSection === link.roles[0] && "text-foreground" // Highlight based on section
                )}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            ))}
            {user && (
               <Button
                 variant="ghost"
                 onClick={handleLogout}
                 className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground justify-start"
               >
                   <LogOut className="h-5 w-5" />
                   Logout
               </Button>
            )}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop Navigation (Simplified for this example) */}
       <div className="flex items-center gap-4 ml-auto"> {/* Use ml-auto to push to the right */}
            {/* Optional: Display current user info */}
            {user && (
                <span className="text-sm text-muted-foreground hidden md:inline">
                    {user.email}
                </span>
            )}

            {/* Logout Button */}
            {user && (
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                    <LogOut className="h-5 w-5" />
                     <span className="sr-only">Logout</span>
                </Button>
            )}
       </div>
    </header>
  );
}
