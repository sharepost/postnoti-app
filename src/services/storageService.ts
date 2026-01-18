import { supabase } from '../lib/supabase';

export const storageService = {
    /**
     * Uploads a local file URI to Supabase Storage and returns the public URL.
     * Uses 'mail_images' bucket by default.
     * @param uri Local file URI (e.g. file://...)
     * @returns Public URL of the uploaded file
     */
    async uploadImage(uri: string): Promise<string | null> {
        if (!uri) return null;
        if (uri.startsWith('http')) return uri; // Already a remote URL

        try {
            // 1. Ensure bucket exists
            const { data: buckets } = await supabase.storage.listBuckets();
            const mailImagesBucket = buckets?.find(b => b.name === 'mail_images');

            if (!mailImagesBucket) {
                // Try to create it (might fail if permissions are missing, but worth a shot)
                await supabase.storage.createBucket('mail_images', { public: true });
            }

            // 2. Prepare file
            const response = await fetch(uri);
            const blob = await response.blob();

            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            // 3. Upload
            const { error: uploadError } = await supabase.storage
                .from('mail_images')
                .upload(filePath, blob, {
                    contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('mail_images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Image upload failed:', error);
            return null;
        }
    }
};
