import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-slate-100">
      <Server className="w-16 h-16 text-blue-500 mb-4 opacity-60" />
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">404 - Page Not Found</h1>
      <p className="text-slate-400 text-sm max-w-md mb-6">The monitoring diagnostic view or endpoint path you requested could not be found.</p>
      <Link href="/">
        <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
          Return to Fleet Overview
        </Button>
      </Link>
    </div>
  );
}
