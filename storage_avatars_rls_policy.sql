-- Supabase Storage avatars 버킷 RLS 정책 설정
-- 프로필 이미지 업로드를 위한 Storage 정책

-- 1. Storage 버킷 정책 확인
-- Supabase Dashboard → Storage → avatars 버킷 → Policies에서 확인 가능

-- 2. 기존 정책 삭제 (있다면)
-- Storage 정책은 Dashboard에서 직접 삭제해야 합니다.

-- 3. Storage 버킷 정책 생성 (Supabase Dashboard에서 설정)
-- Storage → avatars → Policies → New Policy

-- 정책 1: 파일 업로드 (INSERT)
-- Policy Name: "Allow authenticated users to upload files"
-- Allowed operation: INSERT
-- Policy definition:
-- (bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)

-- 정책 2: 파일 조회 (SELECT)
-- Policy Name: "Allow authenticated users to view files"
-- Allowed operation: SELECT
-- Policy definition:
-- (bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)

-- 정책 3: 파일 업데이트 (UPDATE)
-- Policy Name: "Allow authenticated users to update files"
-- Allowed operation: UPDATE
-- Policy definition:
-- (bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)

-- 정책 4: 파일 삭제 (DELETE)
-- Policy Name: "Allow authenticated users to delete files"
-- Allowed operation: DELETE
-- Policy definition:
-- (bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)

-- 참고: Storage 정책은 SQL로 직접 생성할 수 없고, Dashboard에서 설정해야 합니다.
-- 또는 Storage 버킷을 Public으로 설정하면 RLS를 우회할 수 있습니다 (보안상 권장하지 않음)

