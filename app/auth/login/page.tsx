'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from "@/components/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

function LoginContent() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  
  return (
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
  )
}

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Suspense fallback={
        <div className="w-full max-w-sm space-y-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
          </div>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </div>
  );
}
