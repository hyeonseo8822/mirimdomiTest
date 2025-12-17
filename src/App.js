import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import UserInfoForm from './pages/UserInfoForm';
import Layout from './components/Layout/Layout';
import AdminLayout from './components/Layout/AdminLayout';
import Main from './pages/Main';
import AdminMain from './pages/adminMain';
import AdminApplication from './pages/adminApplication';
import AdminNotice from './pages/adminNotice';
import AdminNoticePost from './pages/adminNoticePost';
import AdminStudentInfo from './pages/adminStudentInfo';
import AdminAlarm from './pages/adminAlarm';
import Application from './pages/application';
import Community from './pages/community';
import Laundry from './pages/laundryResv';
import Profile from './pages/ProfileDetail';
import Notice from './pages/notice';
import Alarm from './pages/alarm';
import { supabase, ensureValidSession } from './supabaseClient'; // Supabase 클라이언트 임포트

import './App.css';

function App() {
  console.log('--- App Component Render ---');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // 초기 로딩 상태 추가

  // localStorage에서 사용자 정보 복원
  const restoreUserInfoFromStorage = () => {
    console.log('[DEBUG] App.js: restoreUserInfoFromStorage - 실행');
    try {
      const storedUserInfo = localStorage.getItem('userInfo');
      if (storedUserInfo) {
        console.log('[DEBUG] App.js: restoreUserInfoFromStorage - 저장된 사용자 정보 발견');
        const parsed = JSON.parse(storedUserInfo);
        // null 값들을 안전하게 처리
        const safeUserInfo = {
          ...parsed,
          student_id: parsed.student_id != null ? parsed.student_id : null,
          room_number: parsed.room_number != null ? parsed.room_number : null,
          address: parsed.address != null ? parsed.address : null,
          merits: parsed.merits != null ? Number(parsed.merits) : 0,
          demerits: parsed.demerits != null ? Number(parsed.demerits) : 0,
          infocomplete: parsed.infocomplete != null ? Boolean(parsed.infocomplete) : false,
          name: parsed.name != null ? parsed.name : null,
          profile_image: parsed.profile_image != null ? parsed.profile_image : null,
          role: parsed.role || 'student', // role 필드 추가 (기본값: 'student')
        };
        setUserInfo(safeUserInfo);
        setIsNewUser(!safeUserInfo.infocomplete);
        setIsLoggedIn(true);
        return safeUserInfo;
      }
    } catch (error) {
      console.error('[DEBUG] App.js: localStorage에서 사용자 정보 복원 실패:', error);
    }
    console.log('[DEBUG] App.js: restoreUserInfoFromStorage - 저장된 사용자 정보 없음');
    return null;
  };

  // 사용자 정보를 localStorage에 저장
  const saveUserInfoToStorage = (userInfo) => {
    try {
      if (userInfo) {
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
      } else {
        localStorage.removeItem('userInfo');
      }
    } catch (error) {
      console.error('localStorage에 사용자 정보 저장 실패:', error);
    }
  };

  // Supabase에서 사용자 프로필 정보 가져오기
  const fetchUserProfile = async (googleUserId) => {
    console.log(`[DEBUG] App.js: fetchUserProfile - 실행 (ID: ${googleUserId})`);
    if (!googleUserId) {
      console.log('[DEBUG] App.js: fetchUserProfile - googleUserId 없음, 종료');
      setUserInfo(null);
      saveUserInfoToStorage(null);
      return;
    }
    try {
      // 세션 확인 및 갱신
      await ensureValidSession();
      
      // 세션에서 이메일 가져오기 (새 사용자일 경우를 위해)
      const { data: { session } } = await supabase.auth.getSession();
      const sessionEmail = session?.user?.email || null;
      
      // single() 대신 maybeSingle() 사용: 결과가 없을 때 406 에러 대신 null 반환
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', googleUserId)
        .maybeSingle();

      if (error) {
        // 406 에러 처리: Not Acceptable - 헤더 문제일 수 있음
        if (error.status === 406 || error.code === '406') {
          console.error('[DEBUG] App.js: fetchUserProfile - 406 에러 발생 (헤더 문제 가능성)', error);
          // 406 에러는 새 사용자로 처리하고 계속 진행
          console.log('[DEBUG] App.js: fetchUserProfile - 406 에러를 새 사용자로 처리');
          const tempUserInfo = { 
            id: googleUserId,
            email: sessionEmail // 세션에서 이메일 포함
          };
          setUserInfo(tempUserInfo);
          saveUserInfoToStorage(tempUserInfo);
          setIsNewUser(true);
          return;
        }
        
        // PGRST116은 row not found, 새 사용자일 수 있음
        if (error.code === 'PGRST116') {
          console.log('[DEBUG] App.js: fetchUserProfile - PGRST116 (row not found) - 새 사용자');
          const tempUserInfo = { 
            id: googleUserId,
            email: sessionEmail // 세션에서 이메일 포함
          };
          setUserInfo(tempUserInfo);
          saveUserInfoToStorage(tempUserInfo);
          setIsNewUser(true);
          return;
        }
        
        console.error('[DEBUG] App.js: fetchUserProfile - Supabase 오류 발생', error);
        throw error;
      }

      if (data) {
        console.log('[DEBUG] App.js: fetchUserProfile - 사용자 프로필 데이터 발견', data);
        // null 값들을 안전하게 처리한 userInfo 생성
        const safeUserInfo = {
          ...data,
          student_id: data.student_id != null ? data.student_id : null,
          room_number: data.room_number != null ? data.room_number : null,
          address: data.address != null ? data.address : null,
          merits: data.merits != null ? Number(data.merits) : 0,
          demerits: data.demerits != null ? Number(data.demerits) : 0,
          infocomplete: data.infocomplete != null ? Boolean(data.infocomplete) : false,
          name: data.name != null ? data.name : null,
          profile_image: data.profile_image != null ? data.profile_image : null,
          email: data.email || sessionEmail, // DB에 이메일이 없으면 세션에서 가져온 이메일 사용
          role: data.role || 'student', // role 필드 추가 (기본값: 'student')
        };
        setUserInfo(safeUserInfo);
        saveUserInfoToStorage(safeUserInfo); // localStorage에 저장
        // infocomplete가 null이거나 false면 새 사용자로 간주
        setIsNewUser(!safeUserInfo.infocomplete);
      } else {
        console.log('[DEBUG] App.js: fetchUserProfile - Supabase에 정보 없음 (새 사용자)');
        const tempUserInfo = { 
          id: googleUserId,
          email: sessionEmail // 세션에서 이메일 포함
        };
        setUserInfo(tempUserInfo);
        saveUserInfoToStorage(tempUserInfo); // localStorage에 저장
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('[DEBUG] App.js: 사용자 프로필 불러오기 실패:', error);
      // 세션에서 이메일 가져오기 시도
      let sessionEmail = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        sessionEmail = session?.user?.email || null;
      } catch (e) {
        console.error('[DEBUG] App.js: 세션에서 이메일 가져오기 실패:', e);
      }
      const tempUserInfo = { 
        id: googleUserId,
        email: sessionEmail // 세션에서 이메일 포함
      };
      setUserInfo(tempUserInfo);
      saveUserInfoToStorage(tempUserInfo);
      setIsNewUser(true);
    }
    console.log('[DEBUG] App.js: fetchUserProfile - 완료');
  };

  // 페이지 로드 시 로그인 상태 확인 및 사용자 정보 로드
  useEffect(() => {
    console.log('[DEBUG] App.js: useEffect - 마운트');
    let mounted = true;
    let authListener = null;

    const loadUserProfile = async (session, forceReload = false) => {
      console.log(`[DEBUG] App.js: loadUserProfile - 실행 (forceReload: ${forceReload})`);
      if (!mounted) {
        console.log('[DEBUG] App.js: loadUserProfile - 컴포넌트 unmount됨, 종료');
        return;
      }
      
      if (!session || !session.user) {
        console.log('[DEBUG] App.js: loadUserProfile - 세션 또는 유저 없음. 로딩 해제 시도');
        setIsLoading(false);
        return;
      }

      setIsLoggedIn(true);
      
      try {
        const googleUserId = session.user.user_metadata?.sub || 
                            session.user.user_metadata?.google_id || 
                            session.user.id;
        
        localStorage.setItem('googleUserId', googleUserId);

        const userIdToFetch = googleUserId;
        console.log(`[DEBUG] App.js: loadUserProfile - 가져올 사용자 ID: ${userIdToFetch}`);
        
        if (!forceReload && userInfo && userInfo.id === userIdToFetch) {
          console.log('[DEBUG] App.js: loadUserProfile - 사용자 정보 이미 로드됨, 스킵. 로딩 해제 시도.');
          setIsLoading(false);
          return;
        }

        if (userIdToFetch) {
          await fetchUserProfile(userIdToFetch);
        } else {
          console.warn("[DEBUG] App.js: loadUserProfile - Google User ID를 찾을 수 없음");
          await fetchUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('[DEBUG] App.js: loadUserProfile - 오류 발생:', error);
      } finally {
        if (mounted) {
          console.log('[DEBUG] App.js: loadUserProfile - finally 블록 실행. 로딩 해제 시도');
          setIsLoading(false);
        }
      }
    };

    const initializeAuth = async () => {
      console.log('[DEBUG] App.js: initializeAuth - 실행');
      try {
        // 먼저 실제 Supabase 세션 확인
        console.log('[DEBUG] App.js: initializeAuth - getSession 호출 시작');
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[DEBUG] App.js: initializeAuth - getSession 호출 완료', { hasSession: !!session, error: error });
        
        if (!mounted) return;
        
        if (error) {
          console.error('[DEBUG] App.js: initializeAuth - getSession 오류:', error);
          console.log('[DEBUG] App.js: initializeAuth - getSession 오류로 localStorage 클리어 및 로딩 해제');
          localStorage.clear();
          setIsLoading(false);
          setIsLoggedIn(false);
          setUserInfo(null);
          return;
        }

        // 세션이 없으면 localStorage도 클리어 (이전 세션 정보 제거)
        if (!session || !session.user) {
          console.log('[DEBUG] App.js: initializeAuth - 세션 없음, localStorage 클리어');
          localStorage.clear();
          setIsLoggedIn(false);
          setUserInfo(null);
          setIsLoading(false);
          return;
        }

        // 세션이 있으면, localStorage의 userInfo와 실제 세션의 user ID 비교
        const googleUserId = session.user.user_metadata?.sub || 
                            session.user.user_metadata?.google_id || 
                            session.user.id;
        
        const storedUserInfo = localStorage.getItem('userInfo');
        const storedGoogleUserId = localStorage.getItem('googleUserId');
        
        // localStorage의 userInfo와 실제 세션의 user ID가 일치하는지 확인
        if (storedUserInfo && storedGoogleUserId) {
          try {
            const parsedUserInfo = JSON.parse(storedUserInfo);
            // 세션의 user ID와 localStorage의 user ID가 다르면 클리어
            if (parsedUserInfo.id !== googleUserId || storedGoogleUserId !== googleUserId) {
              console.log('[DEBUG] App.js: initializeAuth - 세션 ID와 localStorage ID 불일치, 클리어');
              console.log(`[DEBUG] 세션 ID: ${googleUserId}, localStorage ID: ${parsedUserInfo.id || storedGoogleUserId}`);
              localStorage.clear();
            }
          } catch (parseError) {
            console.error('[DEBUG] App.js: initializeAuth - localStorage 파싱 오류, 클리어:', parseError);
            localStorage.clear();
          }
        }

        // 세션이 있으면 프로필 로드
        console.log('[DEBUG] App.js: initializeAuth - 세션 있음, 프로필 로드 실행');
        await loadUserProfile(session);

        // onAuthStateChange 리스너 설정 (세션 확인 후)
        const { data: listenerData } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log(`[DEBUG] App.js: onAuthStateChange - 이벤트: ${event}`, session);

            if (!mounted) return;

            if (event === 'SIGNED_OUT') {
              console.log('[DEBUG] App.js: onAuthStateChange - SIGNED_OUT. 상태 초기화 및 로딩 해제 시도');
              setIsLoggedIn(false);
              setUserInfo(null);
              setIsLoading(false);
              localStorage.clear();
              return;
            }

            if (event === 'SIGNED_IN') {
              console.log('[DEBUG] App.js: onAuthStateChange - SIGNED_IN. 프로필 강제 리로드');
              if (session && session.user) {
                await loadUserProfile(session, true);
              }
              return;
            }
            
            if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
              console.log(`[DEBUG] App.js: onAuthStateChange - ${event}.`);
              if (session && session.user) {
                // 세션의 user ID와 localStorage의 user ID 비교
                const currentGoogleUserId = session.user.user_metadata?.sub || 
                                          session.user.user_metadata?.google_id || 
                                          session.user.id;
                const storedUserId = localStorage.getItem('googleUserId');
                
                if (storedUserId && storedUserId !== currentGoogleUserId) {
                  console.log('[DEBUG] App.js: onAuthStateChange - 세션 ID 변경 감지, localStorage 클리어');
                  localStorage.clear();
                }
                
                setIsLoggedIn(true);
                if (!userInfo || !userInfo.id || userInfo.id !== currentGoogleUserId) {
                  console.log(`[DEBUG] App.js: onAuthStateChange - ${event}. userInfo 없음 또는 ID 불일치, 프로필 로드 실행`);
                  await loadUserProfile(session);
                }
              } else {
                console.log(`[DEBUG] App.js: onAuthStateChange - ${event}. 세션 없음, localStorage 클리어`);
                localStorage.clear();
                setIsLoggedIn(false);
                setUserInfo(null);
              }
              return;
            }
          }
        );
        authListener = listenerData;
        console.log('[DEBUG] App.js: initializeAuth - onAuthStateChange 리스너 설정 완료');
        
      } catch (error) {
        console.error('[DEBUG] App.js: initializeAuth - 치명적 오류:', error);
        if (mounted) {
          console.log('[DEBUG] App.js: initializeAuth - catch 블록에서 로딩 해제 시도');
          localStorage.clear();
          setIsLoading(false);
          setIsLoggedIn(false);
          setUserInfo(null);
        }
      }
    };

    initializeAuth();

    // 안전 장치: getSession()가 어떤 환경에서 영원히 대기하는 경우를 방지하기 위해
    // 10초 후에도 인증이 완료되지 않으면 로딩을 해제하고 로그를 남깁니다.
    const timeoutId = setTimeout(() => {
      console.warn('[DEBUG] App.js: 인증 대기 타임아웃(10s) 발생 - 강제 로딩 해제');
      if (mounted && isLoading) {
        // 만약 localStorage로 복원된 사용자 정보가 있다면 로그인 상태로 처리
        const restored = restoreUserInfoFromStorage();
        if (restored) {
          setIsLoggedIn(true);
        }
        setIsLoading(false);
      }
    }, 10000);

    return () => {
      console.log('[DEBUG] App.js: useEffect - 클린업');
      mounted = false;
      clearTimeout(timeoutId);
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);


  const handleUserInfoSubmit = async (formData) => {
    console.log('[DEBUG] App.js: handleUserInfoSubmit - 실행', formData);
    try {
      // UserInfoForm에서 이미 DB에 저장했으므로, 여기서는 최신 정보를 다시 가져옴
      if (!userInfo || !userInfo.id) {
        console.error('[DEBUG] App.js: handleUserInfoSubmit - userInfo 없음');
        return;
      }

      // 세션 확인 및 갱신
      await ensureValidSession();

      // 최신 사용자 정보 다시 가져오기
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userInfo.id)
        .maybeSingle();

      if (error) {
        console.error('[DEBUG] App.js: handleUserInfoSubmit - 사용자 정보 가져오기 실패:', error);
        alert('사용자 정보를 가져오는 중 오류가 발생했습니다: ' + error.message);
        return;
      }

      if (data) {
        // null 값들을 안전하게 처리한 userInfo 생성
        const safeUserInfo = {
          ...data,
          student_id: data.student_id != null ? data.student_id : null,
          room_number: data.room_number != null ? data.room_number : null,
          address: data.address != null ? data.address : null,
          merits: data.merits != null ? Number(data.merits) : 0,
          demerits: data.demerits != null ? Number(data.demerits) : 0,
          infocomplete: data.infocomplete != null ? Boolean(data.infocomplete) : false,
          name: data.name != null ? data.name : null,
          profile_image: data.profile_image != null ? data.profile_image : null,
          role: data.role || 'student', // role 필드 추가 (기본값: 'student')
        };
        
        console.log('[DEBUG] App.js: handleUserInfoSubmit - 사용자 정보 업데이트 완료', safeUserInfo);
        setUserInfo(safeUserInfo);
        saveUserInfoToStorage(safeUserInfo);
        setIsNewUser(false); // 정보 입력 완료로 표시하여 메인 페이지로 이동
      } else {
        console.error('[DEBUG] App.js: handleUserInfoSubmit - 사용자 정보를 찾을 수 없음');
        alert('사용자 정보를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('[DEBUG] App.js: handleUserInfoSubmit - 오류 발생:', error);
      alert('사용자 정보 제출 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleLogout = async () => {
    console.log('[DEBUG] App.js: handleLogout - 실행');
    try {
      // Supabase 세션 종료
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[DEBUG] App.js: handleLogout - 로그아웃 오류:', error);
        // 오류가 있어도 로컬 상태는 초기화
      }
      
      // 로컬 상태 초기화
      setIsLoggedIn(false);
      setUserInfo(null);
      setIsNewUser(false);
      setIsLoading(false);
      
      // localStorage 클리어
      localStorage.clear();
      
      console.log('[DEBUG] App.js: handleLogout - 로그아웃 완료');
    } catch (error) {
      console.error('[DEBUG] App.js: handleLogout - 예외 발생:', error);
      // 예외가 발생해도 로컬 상태는 초기화
      setIsLoggedIn(false);
      setUserInfo(null);
      setIsNewUser(false);
      setIsLoading(false);
      localStorage.clear();
    }
  };

  const handleUserProfileUpdate = (updatedUserInfo) => {
    console.log('[DEBUG] App.js: handleUserProfileUpdate - 수신된 데이터:', updatedUserInfo);
    setUserInfo(updatedUserInfo);
    saveUserInfoToStorage(updatedUserInfo);
  };

  // 관리자 여부 확인
  const isAdmin = userInfo?.role === 'admin';

  console.log(`[DEBUG] App.js: 렌더링 직전 상태 - isLoading: ${isLoading}, isLoggedIn: ${isLoggedIn}, isAdmin: ${isAdmin}`);
  if (isLoading) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {!isLoggedIn ? (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : isNewUser ? (
            <>
              <Route path="/user-info" element={<UserInfoForm userInfo={userInfo} onSubmit={handleUserInfoSubmit} onCancel={() => handleLogout()} />} />
              <Route path="*" element={<Navigate to="/user-info" replace />} />
            </>
          ) : isAdmin ? (
            // 관리자 라우팅
            <>
              <Route path="/" element={<AdminLayout userInfo={userInfo} onLogout={handleLogout} />}>
                <Route index element={<AdminMain userInfo={userInfo} onUserProfileUpdate={handleUserProfileUpdate} />} />
                <Route path="application" element={<AdminApplication userInfo={userInfo} />} />
                <Route path="notice" element={<AdminNotice />} />
                <Route path="notice/post" element={<AdminNoticePost />} />
                <Route path="alarm" element={<AdminAlarm userInfo={userInfo} />} />
                <Route path="management" element={<AdminStudentInfo userInfo={userInfo} />} />
                <Route path="community" element={<Navigate to="/" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            // 일반 사용자 라우팅
            <>
              <Route path="/" element={<Layout userInfo={userInfo} onLogout={handleLogout} />}>
                <Route index element={<Navigate to="/main" replace />} />
                <Route path="main" element={<Main userInfo={userInfo} />} />
                <Route path="application" element={<Application userInfo={userInfo} />} />
                <Route path="community" element={<Community userInfo={userInfo} />} />
                <Route path="laundry" element={<Laundry userInfo={userInfo} />} />
                <Route path="profile" element={<Profile userInfo={userInfo} onUserProfileUpdate={handleUserProfileUpdate} />} />
                <Route path="notice" element={<Notice />} />
                <Route path="alarm" element={<Alarm userInfo={userInfo} />} />
              </Route>
              <Route path="*" element={<Navigate to="/main" replace />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;