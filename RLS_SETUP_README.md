# RLS 정책 설정 가이드

이 문서는 Supabase RLS(Row Level Security) 정책과 Storage 정책을 설정하는 방법을 안내합니다.

## 문제 해결

### 1. Storage 이미지 업로드 오류 해결

**문제**: `StorageApiError: new row violates row-level security policy`

**해결 방법**:
1. Supabase Dashboard에서 **Storage** > **Create bucket** 클릭
2. Bucket 이름: `avatars`
3. **Public bucket**: `true` (체크)
4. `storage_rls_policies.sql` 파일의 내용을 Supabase SQL Editor에서 실행

### 2. 빈 문자열 src 경고 해결

**문제**: `An empty string ("") was passed to the src attribute`

**해결 방법**: 
- `ProfileDetail.js`에서 이미지 URL이 빈 문자열일 때 기본 이미지를 사용하도록 수정 완료

## SQL 스크립트 실행 방법

### Storage RLS 정책 설정

1. Supabase Dashboard 로그인
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. `storage_rls_policies.sql` 파일의 내용을 복사하여 붙여넣기
4. **Run** 버튼 클릭

### RLS 정책 자동 Grant 설정

1. Supabase Dashboard에서 **SQL Editor** 클릭
2. `auto_grant_rls_policies.sql` 파일의 내용을 복사하여 붙여넣기
3. **Run** 버튼 클릭

## 정책 설명

### Storage 정책

- **INSERT**: 인증된 사용자가 `avatars` bucket에 파일 업로드 가능
- **SELECT**: 인증된 사용자와 공개 사용자가 `avatars` bucket의 파일 읽기 가능
- **UPDATE**: 인증된 사용자가 자신이 업로드한 파일만 수정 가능
- **DELETE**: 인증된 사용자가 자신이 업로드한 파일만 삭제 가능

### 테이블 정책

현재 설정된 RLS 정책:
- `alarm`: 인증된 사용자만 모든 작업 가능
- `comments`: 인증된 사용자만 INSERT, 자신의 댓글만 UPDATE/DELETE, 모든 사용자 SELECT
- `laundry_reservations`: 인증된 사용자만 모든 작업 가능
- `notice`: 모든 사용자 SELECT 가능
- `posts`: 인증된 사용자만 INSERT, 자신의 게시글만 UPDATE/DELETE, 모든 사용자 SELECT
- `temporary_exit`, `temporary_leave`: 인증된 사용자만 모든 작업 가능
- `users`: 인증된 사용자만 UPDATE/DELETE, 모든 사용자 INSERT/SELECT

## 주의사항

1. **Storage bucket 생성**: SQL 스크립트 실행 전에 반드시 `avatars` bucket을 생성해야 합니다.
2. **Public bucket**: 이미지를 공개적으로 접근하려면 bucket을 public으로 설정해야 합니다.
3. **정책 중복**: 기존 정책이 있다면 SQL 스크립트에서 `DROP POLICY IF EXISTS`로 먼저 삭제합니다.

## 문제 해결

### 정책이 적용되지 않는 경우

1. Supabase Dashboard > **Storage** > **Policies**에서 정책 확인
2. RLS가 활성화되어 있는지 확인
3. 사용자가 올바르게 인증되었는지 확인

### 여전히 오류가 발생하는 경우

1. 브라우저 콘솔에서 정확한 오류 메시지 확인
2. Supabase Dashboard > **Logs**에서 서버 로그 확인
3. 정책이 올바르게 생성되었는지 SQL Editor에서 확인:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
   ```




