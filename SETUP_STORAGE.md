# Supabase Storage 자동 설정 가이드

이 가이드는 프로필 이미지를 Supabase Storage의 `avatars` bucket에 자동으로 업로드하고 저장하는 설정 방법입니다.

## 1단계: Supabase Dashboard에서 Bucket 생성

1. **Supabase Dashboard** 접속
2. 왼쪽 메뉴에서 **Storage** 클릭
3. **New bucket** 버튼 클릭
4. 다음 설정 입력:
   - **Name**: `avatars`
   - **Public bucket**: ✅ 체크 (이미지를 공개적으로 접근 가능하게)
   - **File size limit**: `10 MB`
   - **Allowed MIME types**: `image/*`
5. **Create bucket** 클릭

## 2단계: RLS 정책 설정

1. Supabase Dashboard에서 **SQL Editor** 클릭
2. `storage_rls_policies.sql` 파일의 내용을 복사하여 붙여넣기
3. **Run** 버튼 클릭하여 실행

이 스크립트는 다음 정책을 생성합니다:
- ✅ 인증된 사용자가 `avatars` bucket에 파일 업로드 가능
- ✅ 인증된 사용자가 `avatars` bucket의 파일 읽기 가능
- ✅ 인증된 사용자가 자신이 업로드한 파일만 수정/삭제 가능
- ✅ 공개 사용자가 `avatars` bucket의 파일 읽기 가능

## 3단계: 테스트

1. 애플리케이션 실행
2. 프로필 페이지에서 이미지 업로드 시도
3. 브라우저 콘솔(F12)에서 업로드 과정 확인
4. Supabase Dashboard > Storage > avatars에서 업로드된 파일 확인

## 문제 해결

### 업로드가 실패하는 경우

1. **Bucket이 생성되었는지 확인**
   - Storage > Buckets에서 `avatars` bucket 존재 확인

2. **RLS 정책이 설정되었는지 확인**
   - Storage > Policies에서 정책 확인
   - 또는 SQL Editor에서 다음 쿼리 실행:
     ```sql
     SELECT * FROM pg_policies 
     WHERE tablename = 'objects' AND schemaname = 'storage';
     ```

3. **사용자 인증 확인**
   - 사용자가 올바르게 로그인되어 있는지 확인
   - Supabase Auth에서 세션 확인

4. **콘솔 로그 확인**
   - 브라우저 콘솔에서 오류 메시지 확인
   - 8-5 단계 이후의 로그 확인

### 파일이 업로드되었지만 보이지 않는 경우

1. **Public URL 확인**
   - 콘솔에서 9-3 단계의 Public URL 확인
   - URL을 브라우저에서 직접 열어보기

2. **Bucket Public 설정 확인**
   - Storage > Buckets > avatars > Settings
   - Public bucket이 활성화되어 있는지 확인

## 파일 구조

업로드된 파일은 다음 경로에 저장됩니다:
- **Bucket**: `avatars`
- **경로**: `images/{user_id}-{timestamp}.{확장자}`
- **예시**: `images/107827926647536626368-1765842880784.jpg`

## 자동화된 기능

✅ 파일 타입 검증 (이미지만 허용)
✅ 파일 크기 제한 (5MB)
✅ 자동 파일명 생성 (중복 방지)
✅ 기존 이미지 자동 삭제
✅ Public URL 자동 생성
✅ users 테이블 자동 업데이트
✅ 상세한 콘솔 로깅




