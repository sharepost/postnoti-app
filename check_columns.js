const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vcrpqxetbrgqtxltbitm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjcnBxeGV0YnJncXR4bHRiaXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzE0MDksImV4cCI6MjA4Mzk0NzQwOX0.UT2VW0Czmen0IET06dAhVk1a-Q5W7tdKgdjx9yBXq9A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndAddColumn() {
    try {
        // Check columns
        const { data, error } = await supabase.from('profiles').select('*').limit(1);
        if (data && data.length > 0) {
            if (!('company_name' in data[0])) {
                console.log('Column company_name missing. Manual SQL might be needed, but I will try to update it via insert as a test.');
                // Unfortunately Supabase JS client doesn't support ALTER TABLE.
                // I'll assume the user might need to run SQL in Supabase dashboard or I can try to use RPC if available.
            } else {
                console.log('Column company_name already exists.');
            }
        }
    } catch (e) {
        console.error(e);
    }
}
checkAndAddColumn();
