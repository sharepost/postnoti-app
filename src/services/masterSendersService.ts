import { supabase } from '../lib/supabase';

export interface KnownSender {
    id: string;
    name: string;
    category: string;
}

export const masterSendersService = {
    async getAllSenders() {
        const { data, error } = await supabase
            .from('known_senders')
            .select('*')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async createSender(name: string) {
        const { data, error } = await supabase
            .from('known_senders')
            .insert([{ name, category: 'general' }])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteSender(id: string) {
        const { error } = await supabase
            .from('known_senders')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
