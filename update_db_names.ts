import { supabase } from './src/lib/supabase';

async function updateData() {
    console.log('--- DB 데이터 이름 변경 시작 (SharePost -> 포스트노티) ---');

    try {
        // 1. 지점(companies) 이름 변경
        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('*');

        if (compError) throw compError;

        for (const company of companies || []) {
            if (company.name.toLowerCase().includes('sharepost') || company.name.includes('본사')) {
                const newName = company.name.replace(/SharePost/gi, '포스트노티').replace('본사', '포스트노티 본사');
                console.log(`지점명 변경: ${company.name} -> ${newName}`);
                await supabase.from('companies').update({ name: newName }).eq('id', company.id);
            }
        }

        // 2. 관리자 프로필(profiles) 이름 변경 (필요시)
        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin');

        if (profError) throw profError;

        for (const profile of profiles || []) {
            if (profile.name.toLowerCase().includes('sharepost')) {
                const newName = profile.name.replace(/SharePost/gi, '포스트노티');
                console.log(`관리자명 변경: ${profile.name} -> ${newName}`);
                await supabase.from('profiles').update({ name: newName }).eq('id', profile.id);
            }
        }

        console.log('--- DB 데이터 이름 변경 완료 ---');
    } catch (error) {
        console.error('DB 업데이트 중 오류 발생:', error);
    }
}

updateData();
