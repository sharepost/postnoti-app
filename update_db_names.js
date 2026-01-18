const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vcrpqxetbrgqtxltbitm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjcnBxeGV0YnJncXR4bHRiaXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzE0MDksImV4cCI6MjA4Mzk0NzQwOX0.UT2VW0Czmen0IET06dAhVk1a-Q5W7tdKgdjx9yBXq9A';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function nuclearUpdate() {
    console.log('🚀 [포스트노티] DB 데이터 완전 소탕 시작...');

    try {
        // 1. 지점(companies) 테이블 소탕
        const { data: companies } = await supabase.from('companies').select('*');
        for (const company of companies || []) {
            let needsUpdate = false;
            let newName = company.name;
            let newSlug = company.slug;

            if (/sharepost|공유오피스|본사/gi.test(company.name)) {
                newName = company.name.replace(/SharePost/gi, '포스트노티').replace(/공유오피스/g, '포스트노티').replace('본사', '포스트노티 본사');
                needsUpdate = true;
            }
            if (/sharepost|sharedpost|office/gi.test(company.slug)) {
                newSlug = company.slug.replace(/sharepost|sharedpost/gi, 'postnoti').replace(/office/g, 'branch');
                needsUpdate = true;
            }

            if (needsUpdate) {
                console.log(`[지점] ${company.name} -> ${newName} (${newSlug})`);
                await supabase.from('companies').update({ name: newName, slug: newSlug }).eq('id', company.id);
            }
        }

        // 2. 프로필(profiles) 및 이메일 소탕 (Auth 유저는 직접 못 바꿔도 프로필은 바꿈)
        const { data: profiles } = await supabase.from('profiles').select('*');
        for (const profile of profiles || []) {
            if (profile.name && profile.name.includes('SharePost')) {
                const newName = profile.name.replace(/SharePost/gi, '포스트노티');
                console.log(`[프로필] ${profile.name} -> ${newName}`);
                await supabase.from('profiles').update({ name: newName }).eq('id', profile.id);
            }
        }

        console.log('✅ 모든 데이터가 [포스트노티]로 정화되었습니다.');
    } catch (error) {
        console.error('❌ 소탕 작업 중 오류:', error);
    }
}

nuclearUpdate();
