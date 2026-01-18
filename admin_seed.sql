-- 1. 기존에 같은 이메일이 있다면 삭제 (테스트 편의를 위해)
-- 주의: 실제 운영 DB에서는 이렇게 삭제하면 안 됩니다!
DELETE FROM auth.users WHERE email = 'admin@postnoti.com';

-- 2. 새 관리자 계정 생성 (Supabase Auth에 직접 삽입)
-- 비밀번호는 '2894'를 해싱한 가짜 값입니다. 실제로는 클라이언트 가입을 통해야 하지만,
-- 여기서는 일단 개발용으로 로직을 우회하거나, 가장 쉬운 방법인 '임의의 유저'를 만들고 연결합니다.

-- [실제 실행 방법]
-- 1. Supabase Dashboard -> Authentication -> Users 메뉴로 이동합니다.
-- 2. [Add User] 버튼을 누르고 'Create New User'를 선택합니다.
-- 3. Email: admin@postnoti.com
-- 4. Password: 2894
-- 5. [Create User]를 눌러 계정을 만듭니다.

-- 6. 계정이 만들어졌으면, 아래 쿼리를 SQL Editor에서 실행하여 '관리자 권한'을 부여합니다.
-- (트리거가 없다면 profiles 테이블에도 직접 넣어줘야 합니다)

-- [프로필 생성 및 권한 부여 쿼리]
-- (위에서 만든 유저의 ID를 알아야 하므로, 이 부분은 자동화가 어렵습니다.
--  대신, 로그인 화면에서 '가입' 기능을 잠시 열어두는 게 가장 빠를 수 있습니다.)
--  하지만, 요청하신 대로 SQL로 처리하려면 아래와 같이 합니다.

-- 만약 Supabase Auth에 이미 'admin@sharedpost.com'이 있다면, 그 유저의 ID를 가져와서 프로필을 만듭니다.
DO $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
BEGIN
  -- 1. 유저 ID 찾기 (Auth 테이블에서)
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@postnoti.com';
  
  -- 2. 첫 번째 회사 ID 찾기 (지점 연결용, 없으면 생성)
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (name, slug) VALUES ('포스트노티 1호점', 'postnoti-1') RETURNING id INTO v_company_id;
  END IF;

  -- 3. profiles 테이블에 관리자 권한으로 넣기 (Upsert)
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, company_id, name, role, is_active, phone, room_number)
    VALUES (
      v_user_id,
      v_company_id,
      '슈퍼관리자',
      'admin',
      true,
      '010-0000-0000',
      'ADMIN'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', is_active = true, name = '슈퍼관리자';
    
    RAISE NOTICE '관리자 계정 세팅 완료: %', v_user_id;
  ELSE
    RAISE NOTICE 'admin@postnoti.com 계정을 먼저 Authentication 메뉴에서 만들어주세요!';
  END IF;
END $$;
