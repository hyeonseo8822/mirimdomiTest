-- users 테이블 DELETE 권한 RLS 정책

-- 옵션 1: 인증된 사용자는 자신의 레코드만 삭제 가능 (권장)
-- users 테이블의 id가 Supabase auth.uid()와 일치하는 경우
CREATE POLICY "Users can delete their own profile"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (id = auth.uid()::text);

-- 옵션 2: 인증된 사용자는 모두 삭제 가능 (덜 안전하지만 간단)
-- 코드에서 이미 사용자 확인을 하고 있다면 이 방법도 가능
CREATE POLICY "Authenticated users can delete profiles"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- 옵션 3: Google OAuth ID를 사용하는 경우
-- users 테이블의 id가 Google OAuth ID이고, 
-- auth.jwt()의 sub나 user_metadata에서 가져올 수 있는 경우
-- (이 경우는 프로젝트 구조에 따라 다를 수 있음)
CREATE POLICY "Users can delete their own profile by OAuth ID"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (
    id = (auth.jwt() ->> 'sub') OR
    id = (auth.jwt() -> 'user_metadata' ->> 'sub') OR
    id = (auth.jwt() -> 'user_metadata' ->> 'google_id')
  );

-- 기존 정책이 있다면 먼저 삭제
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own profile by OAuth ID" ON public.users;

-- 권장: 옵션 2 사용 (코드에서 이미 사용자 확인을 하고 있으므로)
CREATE POLICY "Authenticated users can delete profiles"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

