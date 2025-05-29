import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Define the shape of our user state
interface UserState {
  id: string | null
  email: string | null
  // Optional user metadata from Supabase
  userMetadata: {
    name?: string
    avatar_url?: string
    [key: string]: any
  }
  isLoggedIn: boolean
  loading: boolean
  error: string | null
  initialized: boolean // Track if we've checked initial auth state
}

// Initial state - what the user starts with
const initialState: UserState = {
  id: null,
  email: null,
  userMetadata: {},
  isLoggedIn: false,
  loading: false,
  error: null,
  initialized: false,
}

// Async thunk for checking initial auth state
export const initializeAuth = createAsyncThunk(
  'user/initializeAuth',
  async () => {
    const supabase = createClient()
    
    // Get current session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      throw new Error(sessionError.message)
    }
    
    // If we have a session, return the user
    if (session?.user) {
      return session.user
    }
    
    // If no session, try getUser as fallback
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      // Don't throw error for "no user" cases
      if (error.message.includes('session_not_found') || error.message.includes('invalid_token')) {
        return null
      }
      throw new Error(error.message)
    }
    
    return user
  }
)

// Async thunk for login
export const loginUser = createAsyncThunk(
  'user/loginUser',
  async ({ email, password }: { email: string; password: string }) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      throw new Error(error.message)
    }
    
    return data.user
  }
)

// Async thunk for logout
export const logoutUser = createAsyncThunk(
  'user/logoutUser',
  async () => {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      throw new Error(error.message)
    }
    
    return null
  }
)

// Async thunk for sign up
export const signUpUser = createAsyncThunk(
  'user/signUpUser',
  async ({ email, password }: { email: string; password: string }) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    if (error) {
      throw new Error(error.message)
    }
    
    return data.user
  }
)

// Helper function to map Supabase user to our state
const mapSupabaseUser = (user: User | null) => {
  if (!user) {
    return {
      id: null,
      email: null,
      userMetadata: {},
      isLoggedIn: false,
    }
  }
  
  return {
    id: user.id,
    email: user.email || null,
    userMetadata: user.user_metadata || {},
    isLoggedIn: true,
  }
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    // Clear any errors
    clearError: (state) => {
      state.error = null
    },
    
    // Update user metadata (for profile updates)
    updateUserMetadata: (state, action: PayloadAction<Partial<UserState['userMetadata']>>) => {
      state.userMetadata = { ...state.userMetadata, ...action.payload }
    },
    
    // Manual state reset (useful for testing)
    resetUser: (state) => {
      return { ...initialState, initialized: true }
    },
    
    // Manual sync with Supabase auth state (called by auth listener)
    syncAuthState: (state, action: PayloadAction<User | null>) => {
      const userData = mapSupabaseUser(action.payload)
      state.id = userData.id
      state.email = userData.email
      state.userMetadata = userData.userMetadata
      state.isLoggedIn = userData.isLoggedIn
      state.initialized = true
      state.loading = false
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // Initialize auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        const userData = mapSupabaseUser(action.payload)
        state.id = userData.id
        state.email = userData.email
        state.userMetadata = userData.userMetadata
        state.isLoggedIn = userData.isLoggedIn
        state.loading = false
        state.error = null
        state.initialized = true
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Failed to check authentication'
        state.initialized = true
      })
    
    // Login user
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        const userData = mapSupabaseUser(action.payload)
        state.id = userData.id
        state.email = userData.email
        state.userMetadata = userData.userMetadata
        state.isLoggedIn = userData.isLoggedIn
        state.loading = false
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Login failed'
        state.isLoggedIn = false
      })
    
    // Logout user
    builder
      .addCase(logoutUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.id = null
        state.email = null
        state.userMetadata = {}
        state.isLoggedIn = false
        state.loading = false
        state.error = null
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Logout failed'
      })
    
    // Sign up user
    builder
      .addCase(signUpUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(signUpUser.fulfilled, (state, action) => {
        // Note: For signup, user might not be immediately logged in if email confirmation is required
        if (action.payload) {
          const userData = mapSupabaseUser(action.payload)
          state.id = userData.id
          state.email = userData.email
          state.userMetadata = userData.userMetadata
          state.isLoggedIn = userData.isLoggedIn
        }
        state.loading = false
        state.error = null
      })
      .addCase(signUpUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || 'Sign up failed'
        state.isLoggedIn = false
      })
  },
})

// Export action creators
export const { 
  clearError, 
  updateUserMetadata, 
  resetUser,
  syncAuthState 
} = userSlice.actions

// Export the reducer
export default userSlice.reducer 