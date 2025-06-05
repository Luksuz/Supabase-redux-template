import { configureStore } from '@reduxjs/toolkit'
import userReducer from './features/user/userSlice'
import scriptsReducer from './features/scripts/scriptsSlice'

// This is our Redux store - the single source of truth for our app's state
export const store = configureStore({
  reducer: {
    // User authentication state management
    user: userReducer,
    scripts: scriptsReducer,
  },
  // Redux Toolkit includes good defaults for middleware
  // (like Redux DevTools and thunk for async actions)
})

// These types help TypeScript understand our store structure
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Example of what our state structure looks like:
// {
//   user: { id: 'abc123', email: 'user@example.com', isLoggedIn: true, ... },
//   scripts: { prompt: '...', scripts: [...], hasGeneratedScripts: true, ... }
// } 