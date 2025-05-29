'use client'

import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store } from '../store'
import { initializeAuth, syncAuthState } from '../features/user/userSlice'
import { createClient } from '../supabase/client'

// This component wraps our app and provides the Redux store to all child components
// We need 'use client' because Redux Provider needs to run on the client side
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>
        {children}
      </AuthInitializer>
    </Provider>
  )
}

// Separate component to handle auth initialization and listening
function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient()
    
    // Initialize authentication state when the app loads
    store.dispatch(initializeAuth())
    
    // Set up auth state listener to sync with Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Supabase auth event:', event, session?.user?.email)
        
        // Sync Redux state with Supabase auth state
        store.dispatch(syncAuthState(session?.user || null))
      }
    )
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return <>{children}</>
} 