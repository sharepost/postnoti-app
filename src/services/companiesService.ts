import { supabase } from '../lib/supabase';

export type Company = {
    id: string;
    name: string;
    address?: string;
    slug: string;
};

export const companiesService = {
    async getCompanies() {
        const { data, error } = await supabase
            .from('companies')
            .select('*');
        if (error) throw error;
        return data as Company[];
    },

    async createCompany(name: string, address: string, slug: string) {
        const { data, error } = await supabase
            .from('companies')
            .insert([{ name, address, slug }])
            .select()
            .single();
        if (error) throw error;
        return data as Company;
    },

    async deleteCompany(id: string) {
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
