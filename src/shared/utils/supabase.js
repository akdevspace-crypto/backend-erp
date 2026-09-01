import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const uploadToSupabase = async (bucket, file) => {
    try {
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}-${sanitizedName}`;

        const { data, error } = await supabase.storage.from(bucket).upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

        if (error) {
            console.error('Supabase upload error:', error);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
        return publicUrl;
    } catch (err) {
        console.error('Failed to upload to Supabase:', err);
        throw new Error('Failed to upload file to storage');
    }
};
