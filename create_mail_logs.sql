-- 우편물 로그(mail_logs) 테이블 생성 스크립트
-- Supabase SQL Editor에서 실행해 주세요.

DROP TABLE IF EXISTS public.mail_logs;

CREATE TABLE public.mail_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mail_type TEXT NOT NULL,
    ocr_content TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'sent', -- 'sent', 'received', 'spam' 등
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS(Row Level Security) 설정
ALTER TABLE public.mail_logs ENABLE ROW LEVEL SECURITY;

-- 1. 관리자는 자기 지점의 모든 우편물 기록을 볼 수 있음
CREATE POLICY "Admins can see all mail logs of their company"
ON public.mail_logs
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin' 
        AND profiles.company_id = mail_logs.company_id
    )
);

-- 2. 입주사는 자기 자신에게 온 우편물만 볼 수 있음
CREATE POLICY "Tenants can see their own mail logs"
ON public.mail_logs
FOR SELECT
USING (
    profile_id = auth.uid()
);

-- 3. (임시) 개발 중에는 모든 익명 사용자의 읽기/쓰기를 허용하고 싶다면 아래 주석을 해제하세요. (운영시 비권장)
-- CREATE POLICY "Allow public insert for dev" ON public.mail_logs FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public select for dev" ON public.mail_logs FOR SELECT USING (true);
