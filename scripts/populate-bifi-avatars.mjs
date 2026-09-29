import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co";
// Service role key or anon key - using anon key with direct update
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYml2aXBxaWV3a2ZuaGt0bXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0NzY4NDgsImV4cCI6MjA1NDA1Mjg0OH0.2TnLj4lriG7eoPQWDo0mV8u8YHor6bd5ItZCHYhkym0";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Ready to populate Bifi avatars...");
