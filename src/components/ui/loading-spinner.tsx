
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react"; // Use lucide-react for icons

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'; // Define size options
  className?: string; // Allow custom classes
}

/**
 * A simple loading spinner component using Lucide icons and Tailwind animation.
 */
export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <Loader2 className={cn(
        "animate-spin text-primary", // Apply spinning animation and primary color
        sizeClasses[size], // Apply size class based on prop
        className // Allow overriding or adding classes
        )}
     />
  );
}
