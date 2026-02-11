import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button 
            variant="outline" 
            render={<Link href="/dashboard" />}
            nativeButton={false}
          >
            <ArrowLeft className="size-4" />
            <span>Go Back</span>
          </Button>
          <Button 
            render={<Link href="/" />}
            nativeButton={false}
          >
            <Home className="size-4" />
            <span>Home</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
