DO $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
BEGIN
  -- 1. admin@postnoti.com 유저의 ID 찾기
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@postnoti.com';

  IF v_user_id IS NULL THEN
     RAISE EXCEPTION '❌ 에러: Auth 메뉴에서 admin@postnoti.com 계정을 먼저 만들어주세요!';
  END IF;

  -- 2. 연결할 회사 ID 하나 가져오기 (없으면 자동 생성)
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (name, slug) VALUES ('포스트노티 본사', 'postnoti-hq') RETURNING id INTO v_company_id;
  END IF;

  -- 3. 프로필 테이블에 '슈퍼관리자' 권한으로 강제 등록
  INSERT INTO public.profiles (id, company_id, name, role, is_active, phone, room_number)
  VALUES (
    v_user_id, 
    v_company_id, 
    '슈퍼관리자', 
    'admin', 
    true, 
    '010-1234-5678', 
    'ADMIN'
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin', is_active = true, name = '슈퍼관리자';

  RAISE NOTICE '✅ 성공! admin@postnoti.com 슈퍼관리자 권한 부여 완료.';
END $$;
