'use client'

import { useSearchParams } from 'next/navigation'
import { LoginForm } from "@/components/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export default function Page() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        {redirect === 'home' && (
          <Alert className="border-blue-200 bg-blue-50">
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              You need to be logged in to access the application. Please sign in to continue.
            </AlertDescription>
          </Alert>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
