import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
console.log(supabaseUrl, supabaseAnonKey)
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const { data, error } = await supabase.from('profiles').select('*')

console.log(data)