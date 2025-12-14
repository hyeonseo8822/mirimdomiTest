import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import UserInfoForm from './pages/UserInfoForm';
import Layout from './components/Layout/Layout';
import Main from './pages/Main';
import Application from './pages/application';
import Community from './pages/community';
import Laundry from './pages/laundryResv';
import Profile from './pages/ProfileDetail';
import Notice from './pages/notice';
import Alarm from './pages/alarm';
import { supabase } from './supabaseClient'; // Supabase 클라이언트 임포트

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
        setUserInfo(parsed);
        setIsNewUser(!parsed.infocomplete);
        setIsLoggedIn(true);
        return parsed;
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', googleUserId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116은 row not found, 새 사용자일 수 있음
        console.error('[DEBUG] App.js: fetchUserProfile - Supabase 오류 발생', error);
        throw error;
      }

      if (data) {
        console.log('[DEBUG] App.js: fetchUserProfile - 사용자 프로필 데이터 발견', data);
        setUserInfo(data);
        saveUserInfoToStorage(data); // localStorage에 저장
        setIsNewUser(!data.infocomplete); // 'infocomplete' 컬럼으로 새 사용자인지 판단
      } else {
        console.log('[DEBUG] App.js: fetchUserProfile - Supabase에 정보 없음 (새 사용자)');
        const tempUserInfo = { id: googleUserId };
        setUserInfo(tempUserInfo);
        saveUserInfoToStorage(tempUserInfo); // localStorage에 저장
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('[DEBUG] App.js: 사용자 프로필 불러오기 실패:', error);
      const tempUserInfo = { id: googleUserId };
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
        const restoredUserInfo = restoreUserInfoFromStorage();
        if (restoredUserInfo) {
          console.log('[DEBUG] App.js: initializeAuth - localStorage에서 사용자 정보 복원 성공');
        }

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
                setIsLoggedIn(true);
                if (!userInfo || !userInfo.id) {
                   console.log(`[DEBUG] App.js: onAuthStateChange - ${event}. userInfo 없음, 프로필 로드 실행`);
                  await loadUserProfile(session);
                }
              } else {
                console.log(`[DEBUG] App.js: onAuthStateChange - ${event}. 세션 없음, 상태 유지`);
              }
              return;
            }
          }
        );
        authListener = listenerData;
        console.log('[DEBUG] App.js: initializeAuth - onAuthStateChange 리스너 설정 완료');

        console.log('[DEBUG] App.js: initializeAuth - getSession 호출 시작');
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('[DEBUG] App.js: initializeAuth - getSession 호출 완료', { hasSession: !!session, error: error });
        
        if (!mounted) return;
        
        if (error) {
          console.error('[DEBUG] App.js: initializeAuth - getSession 오류:', error);
          console.log('[DEBUG] App.js: initializeAuth - getSession 오류로 로딩 해제 시도');
          setIsLoading(false);
          return;
        }

        if (session && session.user) {
          console.log('[DEBUG] App.js: initializeAuth - 세션 있음, 프로필 로드 실행');
          await loadUserProfile(session);
        } else {
          console.log('[DEBUG] App.js: initializeAuth - 세션 없음');
          const restored = restoreUserInfoFromStorage();
          if (restored) {
            console.log('[DEBUG] App.js: initializeAuth - localStorage 복원 성공. 로딩 해제 시도');
            setIsLoggedIn(true);
            setIsLoading(false);
            const googleUserId = localStorage.getItem('googleUserId');
            if (googleUserId) {
              console.log('[DEBUG] App.js: initializeAuth - 백그라운드에서 사용자 정보 업데이트 시도');
              fetchUserProfile(googleUserId).catch(err => {
                console.error('[DEBUG] App.js: 백그라운드 사용자 정보 로드 실패:', err);
              });
            }
          } else {
            console.log('[DEBUG] App.js: initializeAuth - 세션 및 localStorage 모두 없음. 로딩 해제 시도');
            setIsLoggedIn(false);
            setUserInfo(null);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('[DEBUG] App.js: initializeAuth - 치명적 오류:', error);
        if (mounted) {
          console.log('[DEBUG] App.js: initializeAuth - catch 블록에서 로딩 해제 시도');
          setIsLoading(false);
          setIsLoggedIn(false);
          setUserInfo(null);
        }
      }
    };

    const timeoutId = setTimeout(async () => {
      console.log('[DEBUG] App.js: 5초 타임아웃 실행');
      if (mounted && isLoading) {
        console.warn('[DEBUG] App.js: 세션 확인 타임아웃 - 로딩 상태 강제 해제');
        setIsLoading(false);
      }
    }, 5000);

    initializeAuth();

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
    // ... (rest of the function)
  };

  const handleLogout = async () => {
    // ... (rest of the function)
  };

  const handleUserProfileUpdate = async (updatedUserInfo) => {
    // ... (rest of the function)
  };

  console.log(`[DEBUG] App.js: 렌더링 직전 상태 - isLoading: ${isLoading}, isLoggedIn: ${isLoggedIn}`);
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
          ) : (
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