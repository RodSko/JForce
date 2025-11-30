import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qculdqqttqcvipccaxwb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjdWxkcXF0dHFjdmlwY2NheHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzU1NDYsImV4cCI6MjA4MDExMTU0Nn0.oVvyZSEmEqC_reA0N7Klt1laFoHDBxxXNBDZqE9OhW4';

export const supabase = createClient(supabaseUrl, supabaseKey);