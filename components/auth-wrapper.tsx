'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { initializeAuth } from '@/lib/features/user/userSlice'

interface AuthWrapperProps {
  children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  
  // Authentication check
  const user = useAppSelector(state => state.user)
  
  // Initialize auth state if not already initialized
  useEffect(() => {
    if (!user.initialized) {
      dispatch(initializeAuth())
    }
  }, [dispatch, user.initialized])
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (user.initialized && !user.isLoggedIn) {
      router.push('/auth/login?redirect=home')
    }
  }, [user.initialized, user.isLoggedIn, router])
  
  // Show loading while checking authentication
  if (!user.initialized) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Checking authentication...</p>
        </div>
      </main>
    )
  }
  
  // Show nothing while redirecting
  if (!user.isLoggedIn) {
    return null
  }
  
  // Render children when authenticated
  return <>{children}</>
} 