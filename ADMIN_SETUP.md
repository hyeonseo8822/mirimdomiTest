# 관리자(선생님) 계정 설정 가이드

이 가이드는 Supabase에 관리자 계정을 추가하는 방법을 설명합니다.

## 1단계: users 테이블에 role 필드 추가

1. **Supabase Dashboard** 접속
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. `add_admin_role.sql` 파일의 내용을 복사하여 붙여넣기
4. **Run** 버튼 클릭하여 실행

이 스크립트는 다음을 수행합니다:
- `users` 테이블에 `role` 컬럼 추가 (기본값: 'student')
- 관리자로 설정하는 함수 생성
- 기존 사용자들의 role을 'student'로 설정

## 2단계: 관리자 계정 추가 방법

### 방법 1: 이메일로 관리자 설정 (권장)

1. 선생님이 먼저 Google OAuth로 로그인하여 계정 생성
2. Supabase Dashboard > **SQL Editor**에서 다음 쿼리 실행:

```sql
-- 선생님 이메일로 관리자 설정
SELECT set_user_as_admin('teacher@example.com');
```

**주의**: `teacher@example.com`을 실제 선생님의 Google 이메일로 변경하세요.

### 방법 2: 사용자 ID로 관리자 설정

1. Supabase Dashboard > **Authentication** > **Users**에서 선생님 계정 찾기
2. 사용자 ID 복사
3. **SQL Editor**에서 다음 쿼리 실행:

```sql
-- 사용자 ID로 관리자 설정
SELECT set_user_as_admin_by_id('user-id-here');
```

**주의**: `user-id-here`를 실제 사용자 ID로 변경하세요.

### 방법 3: 직접 UPDATE 쿼리 사용

```sql
-- 이메일로 직접 업데이트
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'teacher@example.com';

-- 또는 사용자 ID로 직접 업데이트
UPDATE public.users 
SET role = 'admin' 
WHERE id = 'user-id-here';
```

## 3단계: 관리자 계정 확인

관리자 계정이 제대로 설정되었는지 확인:

```sql
-- 모든 관리자 목록 확인
SELECT id, email, name, role 
FROM public.users 
WHERE role = 'admin';

-- 특정 사용자의 role 확인
SELECT id, email, name, role 
FROM public.users 
WHERE email = 'teacher@example.com';
```

## 4단계: 애플리케이션에서 관리자 구분

애플리케이션 코드에서 관리자를 구분하려면:

```javascript
// App.js에서
const isAdmin = userInfo?.role === 'admin';

// 관리자 라우팅
{isAdmin ? (
  <Route path="/" element={<AdminLayout />}>
    {/* 관리자 페이지 */}
  </Route>
) : (
  <Route path="/user" element={<Layout />}>
    {/* 일반 사용자 페이지 */}
  </Route>
)}
```

## 문제 해결

### 관리자로 설정했는데도 일반 사용자로 보이는 경우

1. 브라우저에서 **로그아웃 후 다시 로그인**
2. `localStorage` 클리어: 브라우저 개발자 도구 > Application > Local Storage > Clear
3. Supabase에서 role이 올바르게 설정되었는지 확인

### role 필드가 없는 경우

`add_admin_role.sql` 스크립트를 다시 실행하세요.

### 여러 명의 관리자 추가

각 관리자마다 위의 방법 중 하나를 사용하여 `role = 'admin'`으로 설정하세요.

## 보안 주의사항

1. **관리자 이메일 보호**: 관리자 이메일을 공개하지 마세요
2. **RLS 정책**: 필요시 관리자만 접근 가능한 데이터에 대한 RLS 정책 추가 고려
3. **정기 확인**: 주기적으로 관리자 목록을 확인하여 권한이 올바르게 설정되어 있는지 확인

