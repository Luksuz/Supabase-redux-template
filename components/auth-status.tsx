'use client'

import { useAppSelector } from '../lib/hooks'

export function AuthStatus() {
  const user = useAppSelector(state => state.user)

  if (!user.initialized) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        <span>Checking auth...</span>
      </div>
    )
  }

  if (user.isLoggedIn) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span>Email: {user.email}</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full text-sm">
      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
      <span>Error: Not logged in</span>
    </div>
  )
} 