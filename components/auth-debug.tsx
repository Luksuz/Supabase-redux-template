'use client'

import { useEffect, useState } from 'react'
import { useAppSelector, useAppDispatch } from '../lib/hooks'
import { createClient } from '../lib/supabase/client'
import { initializeAuth } from '../lib/features/user/userSlice'
import type { User } from '@supabase/supabase-js'

export function AuthDebug() {
  const dispatch = useAppDispatch()
  const reduxUser = useAppSelector(state => state.user)
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null)
  const [supabaseLoading, setSupabaseLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    
    // Get initial Supabase auth state
    const getSupabaseUser = async () => {
      setSupabaseLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      setSupabaseUser(user)
      setSupabaseLoading(false)
    }
    
    getSupabaseUser()
    
    // Listen to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSupabaseUser(session?.user || null)
      }
    )
    
    return () => subscription.unsubscribe()
  }, [])

  const handleRefresh = () => {
    dispatch(initializeAuth())
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">Auth Debug Panel</h3>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Refresh Redux
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supabase State */}
        <div className="bg-white p-3 rounded border">
          <h4 className="font-semibold text-green-600 mb-2">Supabase Auth State</h4>
          {supabaseLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : supabaseUser ? (
            <div className="text-sm space-y-1">
              <p><strong>Status:</strong> <span className="text-green-600">✅ Logged In</span></p>
              <p><strong>ID:</strong> <code className="text-xs bg-gray-100 px-1 rounded">{supabaseUser.id}</code></p>
              <p><strong>Email:</strong> {supabaseUser.email}</p>
              <p><strong>Created:</strong> {new Date(supabaseUser.created_at).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-sm"><strong>Status:</strong> <span className="text-red-600">❌ Not Logged In</span></p>
          )}
        </div>
        
        {/* Redux State */}
        <div className="bg-white p-3 rounded border">
          <h4 className="font-semibold text-blue-600 mb-2">Redux Auth State</h4>
          {!reduxUser.initialized ? (
            <p className="text-sm text-gray-500">Initializing...</p>
          ) : reduxUser.isLoggedIn ? (
            <div className="text-sm space-y-1">
              <p><strong>Status:</strong> <span className="text-green-600">✅ Logged In</span></p>
              <p><strong>ID:</strong> <code className="text-xs bg-gray-100 px-1 rounded">{reduxUser.id}</code></p>
              <p><strong>Email:</strong> {reduxUser.email}</p>
              <p><strong>Loading:</strong> {reduxUser.loading ? 'Yes' : 'No'}</p>
              {reduxUser.error && <p><strong>Error:</strong> <span className="text-red-600">{reduxUser.error}</span></p>}
            </div>
          ) : (
            <div className="text-sm space-y-1">
              <p><strong>Status:</strong> <span className="text-red-600">❌ Not Logged In</span></p>
              <p><strong>Loading:</strong> {reduxUser.loading ? 'Yes' : 'No'}</p>
              {reduxUser.error && <p><strong>Error:</strong> <span className="text-red-600">{reduxUser.error}</span></p>}
            </div>
          )}
        </div>
      </div>
      
      {/* Sync Status */}
      <div className="bg-white p-3 rounded border">
        <h4 className="font-semibold mb-2">Sync Status</h4>
        {supabaseLoading || !reduxUser.initialized ? (
          <p className="text-sm text-gray-500">Checking...</p>
        ) : (
          <div className="text-sm">
            {(supabaseUser?.id === reduxUser.id) && (supabaseUser?.email === reduxUser.email) ? (
              <p className="text-green-600">✅ Redux and Supabase are in sync</p>
            ) : (
              <div className="text-red-600">
                <p>❌ Redux and Supabase are out of sync</p>
                <p className="text-xs mt-1">
                  Supabase: {supabaseUser?.email || 'Not logged in'} | 
                  Redux: {reduxUser.email || 'Not logged in'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 