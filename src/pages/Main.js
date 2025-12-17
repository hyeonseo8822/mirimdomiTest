import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/main.css';
import { supabase, ensureValidSession } from '../supabaseClient';
import useAuth from '../hooks/useAuth';
import { getTimetable, getMealMenu } from '../utils/neisApi';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function Main({ userInfo }) {
  console.log('--- Main Component Render ---', { userInfo });
  const navigate = useNavigate();
  const [mealTab, setMealTab] = useState('조식');

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 공지사항 데이터
  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const noticesFetchedRef = useRef(false);
  // 인증 훅 사용 (앱 전역 인증 상태 재사용)
  const { user: authUser, authReady } = useAuth();

  // 부모로부터 전달된 userInfo가 우선. 없으면 auth 훅에서 가져온 user 사용.
  const effectiveUser = userInfo || authUser;

  // 날짜 포맷팅 함수 (created_at을 YYYY.MM.DD 형식으로 변환)
  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }, []);

  // Supabase 요청에 타임아웃을 적용하는 헬퍼
  const callWithTimeout = useCallback(async (fn, ms = 5000) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Supabase request timeout')), ms);
    });
    try {
      const result = await Promise.race([fn(), timeout]);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }, []);
  // SDK가 동작하지 않을 때를 대비한 REST 폴백 헬퍼
  const fallbackRest = useCallback(async (table, queryString = '', extraHeaders = {}) => {
    try {
      const base = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/$/, '');
      const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;
      if (!base || !anon) throw new Error('REST fallback: supabase URL or anon key missing');
      const url = `${base}/rest/v1/${table}${queryString ? '?' + queryString : ''}`;
      console.log('[DEBUG] Main.js: fallbackRest 호출', { url });

      const headers = Object.assign({
        apikey: anon,
        // default Authorization to anon (keeps previous behavior), but allow override via extraHeaders
        Authorization: `Bearer ${anon}`,
      }, extraHeaders || {});

      const res = await fetch(url, {
        headers,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`REST fallback request failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('[DEBUG] Main.js: fallbackRest 오류', e);
      return null;
    }
  }, []);

  // Supabase 호출과 REST 폴백을 병렬로 시작해서 빠른 쪽 결과를 사용하는 헬퍼
  // supabaseFn: () => Promise<{ data, error }>
  // table, queryString: REST 폴백 파라미터
  const fetchPreferFast = useCallback(async (supabaseFn, table, queryString = '', supTimeout = 2500) => {
    const supPromise = (async () => {
      try {
        const res = await callWithTimeout(supabaseFn, supTimeout);
        return { source: 'supabase', data: res?.data, error: res?.error };
      } catch (e) {
        return { source: 'supabase', error: e };
      }
    })();

    const fbPromise = (async () => {
      try {
        const data = await fallbackRest(table, queryString);
        return { source: 'fallback', data };
      } catch (e) {
        return { source: 'fallback', error: e };
      }
    })();

    // 먼저 도착하는 응답을 선택. 도착한 결과에 데이터가 없으면 다른 쪽을 기다려본다.
    const first = await Promise.race([supPromise, fbPromise]);
    if (first && first.data && (!first.error)) return first;
    // first가 오류거나 데이터가 없다면 다른 쪽 결과를 기다림
    const other = (first && first.source === 'supabase') ? await fbPromise : await supPromise;
    return other && other.data ? other : first;
  }, [callWithTimeout, fallbackRest]);

  // 공지사항 데이터 가져오기
  const fetchNotices = useCallback(async () => {
    console.log('[DEBUG] Main.js: fetchNotices - 실행');
    setNoticesLoading(true);
    try {
      console.log('[DEBUG] Main.js: fetchNotices - Supabase "notice" 테이블 조회 시작 (병렬 우선 방식)');
      const best = await fetchPreferFast(() => supabase
        .from('notice')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(4), 'notice', 'select=id,title,created_at&order=created_at.desc&limit=4', 3000);

      let data = best?.data;
      const source = best?.source;
      console.log('[DEBUG] Main.js: fetchNotices - 선택된 소스', { source, length: (data && data.length) || 0 });
      // 만약 supabase에서 테이블명이 다르면 'notices'로 재시도 (supabase 호출 우선 시도했을 경우)
      if ((!data || data.length === 0) && source === 'supabase') {
        const alt = await fetchPreferFast(() => supabase
          .from('notices')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(4), 'notices', 'select=id,title,created_at&order=created_at.desc&limit=4', 3000);
        data = alt?.data;
        console.log('[DEBUG] Main.js: fetchNotices - 대체 소스 조회 완료', { altSource: alt?.source, length: (data && data.length) || 0 });
      }

      // 데이터 포맷 변환
      const formattedNotices = (data || []).map(notice => {
        if (!notice) {
          return null;
        }
        return {
          id: notice.id,
          title: notice.title || '(제목 없음)',
          date: formatDate(notice.created_at),
        };
      }).filter(notice => notice !== null); // null 제거
      
      setNotices(formattedNotices);
      noticesFetchedRef.current = true;
      console.log('[DEBUG] Main.js: fetchNotices - 성공');
    } catch (error) {
      console.error('[DEBUG] Main.js: fetchNotices - 전체 try-catch 오류:', error);
      // SDK 호출이 타임아웃되거나 실패하면 REST 폴백 시도
      try {
        console.log('[DEBUG] Main.js: fetchNotices - supabase-js 실패, REST 폴백 시도');
        const fallbackData = await fallbackRest('notice', 'select=id,title,created_at&order=created_at.desc&limit=4');
        let finalData = fallbackData;
        if ((!finalData || finalData.length === 0)) {
          // 'notice' 테이블이 없을 수 있으므로 'notices'로도 시도
          const alt = await fallbackRest('notices', 'select=id,title,created_at&order=created_at.desc&limit=4');
          if (alt && alt.length > 0) finalData = alt;
        }
        if (finalData && finalData.length > 0) {
          const formattedNotices = finalData.map(notice => ({
            id: notice.id,
            title: notice.title || '(제목 없음)',
            date: formatDate(notice.created_at),
          }));
          setNotices(formattedNotices);
        } else {
          setNotices([]);
        }
      } catch (e) {
        console.error('[DEBUG] Main.js: fetchNotices - REST 폴백도 실패', e);
        setNotices([]);
      }
    } finally {
      console.log('[DEBUG] Main.js: fetchNotices - finally 블록 실행, 로딩 해제');
      setNoticesLoading(false);
    }
  }, [callWithTimeout, fallbackRest, formatDate]);

  // 공지사항 가져오기 (authReady가 완료되고 userInfo가 준비된 후)
  useEffect(() => {
    console.log('[DEBUG] Main.js: useEffect (Notices) - 실행', { authReady, effectiveUserExists: !!effectiveUser?.id, fetched: noticesFetchedRef.current });
    if (!authReady) return; // 인증 초기화 전에는 실행하지 않음
    if (effectiveUser?.id && !noticesFetchedRef.current) {
      fetchNotices();
    }
  }, [authReady, effectiveUser?.id, fetchNotices]); // authReady + effectiveUser.id가 변경될 때만

  // 알람 데이터
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const alarmsFetchedRef = useRef(false);

  // 상대 시간 계산 함수 (예: '방금', '5분 전', '1시간 전' 등)
  const getRelativeTime = useCallback((createdAt) => {
    if (!createdAt) return '방금';
    
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return formatDate(createdAt);
  }, [formatDate]);

  // 알람 데이터 가져오기
  const fetchAlarms = useCallback(async () => {
    if (!effectiveUser?.id) {
      console.log('[DEBUG] Main.js: fetchAlarms - effectiveUser.id 없음, 종료');
      setAlarms([]);
      setAlarmsLoading(false);
      return;
    }

    console.log('[DEBUG] Main.js: fetchAlarms - 실행');
    setAlarmsLoading(true);
    
    // user_id를 문자열로 변환 (alarm 테이블의 user_id는 text 타입)
    const userIdString = String(effectiveUser.id).trim();
    
    console.log(`[DEBUG] Main.js: fetchAlarms - 사용자 ID: ${userIdString} (타입: ${typeof userIdString})`);

    try {
      // 세션 확인 및 갱신
      await ensureValidSession();

      // 알람 데이터 조회
      console.log(`[DEBUG] Main.js: fetchAlarms - Supabase "alarm" 테이블 조회 시작 (user_id: ${userIdString})`);
      const { data, error } = await supabase
        .from('alarm')
        .select('*')
        .eq('user_id', userIdString)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) {
        console.error('[DEBUG] Main.js: fetchAlarms - Supabase 오류:', error);
        throw error;
      }
      
      console.log(`[DEBUG] Main.js: fetchAlarms - 조회 결과: ${data?.length || 0}개 알람`);
      
      const formattedAlarms = (data || []).map(alarm => ({
        id: alarm.id,
        type: alarm.type || '알림',
        message: alarm.message || '',
        time: alarm.created_at ? new Date(alarm.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : getRelativeTime(alarm.created_at),
        detail: alarm.detail || '',
        created_at: alarm.created_at,
        is_read: alarm.is_read || false,
      }));

      if (formattedAlarms.length === 0) {
        console.log('[DEBUG] Main.js: fetchAlarms - 결과가 비어있습니다.');
      }

      setAlarms(formattedAlarms);
      alarmsFetchedRef.current = true;

    } catch (error) {
      console.error('[DEBUG] Main.js: fetchAlarms - 오류:', error);
      setAlarms([]);
    } finally {
      console.log('[DEBUG] Main.js: fetchAlarms - finally 블록 실행, 로딩 해제');
      setAlarmsLoading(false);
    }
  }, [effectiveUser?.id, getRelativeTime]);

    

  // 알람 가져오기 및 실시간 구독 (authReady 완료 및 userInfo 준비된 후)
  useEffect(() => {
    console.log('[DEBUG] Main.js: useEffect (Alarms) - 실행', { authReady, effectiveUserExists: !!effectiveUser?.id, fetched: alarmsFetchedRef.current });
    if (!authReady) return; 
    
    if (effectiveUser?.id && !alarmsFetchedRef.current) {
      fetchAlarms();
    }

    if (!effectiveUser?.id) return;

    const userIdString = String(effectiveUser.id).trim();
    
    const subscription = supabase
      .channel('alarm_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alarm',
          filter: `user_id=eq.${userIdString}`,
        },
        (payload) => {
          console.log('[DEBUG] Main.js: Realtime (alarm) - 변경 감지', payload);
          fetchAlarms();
        }
      )
      .subscribe();
    console.log('[DEBUG] Main.js: Realtime (alarm) - 구독 시작');

    return () => {
      console.log('[DEBUG] Main.js: Realtime (alarm) - 구독 해제');
      try { subscription.unsubscribe(); } catch (e) {}
    };
  }, [authReady, effectiveUser?.id, fetchAlarms]);

  // 커뮤니티 데이터
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const communityFetchedRef = useRef(false);

  // 커뮤니티 게시글 가져오기
  const fetchCommunityPosts = useCallback(async () => {
    console.log('[DEBUG] Main.js: fetchCommunityPosts - 실행');
    setCommunityLoading(true);
    try {
      console.log('[DEBUG] Main.js: fetchCommunityPosts - Supabase "posts" 테이블 조회 시작 (병렬 우선 방식)');
      const best = await fetchPreferFast(() => supabase
        .from('posts')
        .select('id, title, category, created_at')
        .order('created_at', { ascending: false })
        .limit(4), 'posts', 'select=id,title,category,created_at&order=created_at.desc&limit=4', 3000);
      const data = best?.data || [];
      console.log('[DEBUG] Main.js: fetchCommunityPosts - 선택된 소스', { source: best?.source, length: (data && data.length) || 0 });

      // 데이터 포맷 변환 (main.js에서 사용하는 형식으로)
      const formattedPosts = (data || []).map(post => ({
        id: post.id,
        category: post.category === '분실물 게시판' ? '분실' : '자유',
        title: post.title,
        time: new Date(post.created_at).toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
      }));
      setCommunityPosts(formattedPosts);
      communityFetchedRef.current = true;
      console.log('[DEBUG] Main.js: fetchCommunityPosts - 성공');
    } catch (error) {
      console.error('[DEBUG] Main.js: fetchCommunityPosts - 전체 try-catch 오류:', error);
      // SDK 실패 시 REST 폴백
      try {
        console.log('[DEBUG] Main.js: fetchCommunityPosts - supabase-js 실패, REST 폴백 시도');
        const finalData = await fallbackRest('posts', 'select=id,title,category,created_at&order=created_at.desc&limit=4');
        if (finalData && finalData.length > 0) {
          const formattedPosts = (finalData || []).map(post => ({
            id: post.id,
            category: post.category === '분실물 게시판' ? '분실' : '자유',
            title: post.title,
            time: new Date(post.created_at).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
          }));
          setCommunityPosts(formattedPosts);
        } else {
          setCommunityPosts([]);
        }
      } catch (e) {
        console.error('[DEBUG] Main.js: fetchCommunityPosts - REST 폴백도 실패', e);
        setCommunityPosts([]);
      }
    } finally {
      console.log('[DEBUG] Main.js: fetchCommunityPosts - finally 블록 실행, 로딩 해제');
      setCommunityLoading(false);
    }
  }, [callWithTimeout, fallbackRest]);

  // 커뮤니티 게시글 가져오기 (userInfo가 준비된 후)
  useEffect(() => {
    console.log('[DEBUG] Main.js: useEffect (Community) - 실행', { authReady, effectiveUserExists: !!effectiveUser?.id, fetched: communityFetchedRef.current });
    if (!authReady) return; // 인증 초기화 전에는 실행하지 않음
    if (effectiveUser?.id && !communityFetchedRef.current) {
      fetchCommunityPosts();
    }
  }, [authReady, effectiveUser?.id, fetchCommunityPosts]); // authReady + effectiveUser.id가 변경될 때만

  // 시간표 데이터
  const [timetable, setTimetable] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState(null);
  const timetableFetchedRef = useRef(false);

  // 학번에서 학년과 반 추출 (예: 2206 → 2학년 2반)
  const getGradeAndClass = (studentId) => {
    if (!studentId || studentId.length < 2) {
      return { grade: null, class: null };
    }
    const grade = parseInt(studentId[0]); // 첫 번째 자리: 학년
    const classNum = parseInt(studentId[1]); // 두 번째 자리: 반
    return { grade, class: classNum };
  };

  // 요일 이름 배열
  const weekDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  
  // 현재 요일은 `new Date().getDay()`로 바로 사용합니다.

  

  

  

  // 더미 시간표 데이터 (백엔드 서버 없이 사용)
  const getDummyTimetable = useCallback((grade, classNum) => {
    const defaultTimetable = [
      { period: '1교시', subject: '수학' },
      { period: '2교시', subject: '영어' },
      { period: '3교시', subject: '통합과학' },
      { period: '4교시', subject: '국어' },
      { period: '5교시', subject: '디지털디자인' },
      { period: '6교시', subject: 'UIUX엔지니어링' },
      { period: '7교시', subject: '시각디자인' },
    ];
    return defaultTimetable;
  }, []);

  // 시간표 조회 (neisApi.js 통합)
  const fetchTimetable = useCallback(async (grade, classNum, date) => {
    if (!grade || !classNum) {
      setTimetableError(null);
      setTimetable(getDummyTimetable(grade, classNum));
      setTimetableLoading(false);
      return;
    }

    // 이미 호출 중이면 중복 호출 방지
    if (timetableLoading) return;

    setTimetableLoading(true);
    setTimetableError(null);

    try {
      const result = await getTimetable(grade, classNum, date);

      if (result.length > 0) {
        setTimetable(result);
        setTimetableError(null);
      } else {
        setTimetable(getDummyTimetable(grade, classNum));
        setTimetableError(null);
      }

      timetableFetchedRef.current = true;
    } catch (error) {
      console.error("시간표 조회 오류:", error);
      setTimetable(getDummyTimetable(grade, classNum));
      setTimetableError(null);
    } finally {
      setTimetableLoading(false);
    }
  }, [getDummyTimetable, timetableLoading]);


  

  // userInfo.student_id가 변경되면 오늘 날짜의 시간표만 불러오기
  useEffect(() => {
    if (effectiveUser?.student_id && !timetableFetchedRef.current) {
      const { grade, class: classNum } = getGradeAndClass(effectiveUser.student_id);
      if (grade && classNum) {
        // 항상 오늘 날짜만 사용
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateStr = `${year}.${month}.${day}`;
        fetchTimetable(grade, classNum, dateStr);
      }
    }
  }, [effectiveUser?.student_id, fetchTimetable]); // student_id가 변경될 때만

  // 급식 메뉴 데이터
  const [mealMenus, setMealMenus] = useState({
    조식: [],
    중식: [],
    석식: [],
  });
  const [mealLoading, setMealLoading] = useState(false);
  const [mealError, setMealError] = useState(null);
  const mealFetchedRef = useRef(false);


  const getDummyMealMenu = useCallback(() => {
    // 실제 급식 메뉴로 교체 가능
    return {
      조식: ['쌀밥', '시금치두부무침', '계란말이', '된장찌개', '춘천닭갈비'],
      중식: ['쌀밥', '김치찌개', '불고기', '나물무침', '배추김치'],
      석식: ['쌀밥', '미역국', '닭볶음탕', '콩나물무침', '깍두기'],
    };
  }, []);

  const fetchMealMenu = useCallback(async (input = new Date()) => {
    // 이미 호출 중이면 중복 호출 방지
    if (mealLoading) return;
    
    setMealLoading(true);
    setMealError(null);

    try {
      // 날짜를 YYYY.MM.DD 형식으로 변환
      const now = new Date(input);
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}.${month}.${day}`;

      const meals = await getMealMenu(dateStr);

      // 데이터가 있으면 설정, 없으면 더미 데이터
      if (meals.조식.length > 0 || meals.중식.length > 0 || meals.석식.length > 0) {
        setMealMenus(meals);
        setMealError(null);
      } else {
        const dummyMeals = getDummyMealMenu();
        setMealMenus(dummyMeals);
        setMealError(null);
      }
      
      mealFetchedRef.current = true;
    } catch (error) {
      console.error('급식 조회 오류:', error);
      // 에러 발생 시에도 더미 데이터 표시
      const dummyMeals = getDummyMealMenu();
      setMealMenus(dummyMeals);
      setMealError(null);
    } finally {
      setMealLoading(false);
    }
  }, [getDummyMealMenu, mealLoading]);

  

  // 컴포넌트 마운트 시 급식 메뉴 불러오기 (한 번만)
  useEffect(() => {
    if (!mealFetchedRef.current) {
      fetchMealMenu(new Date());
    }
  }, [fetchMealMenu]);

  return (
    <div className="home">
      <div className="home-header">
        <h1 className="home-title">홈</h1>
        <p className="home-date">{getCurrentDate()}</p>
      </div>

      <div className="home-grid">
        {/* 나에 대한 요약 */}
        <div className="home-card user-summary-card" style={{ position: 'absolute' }}>
            <div className="user-summary-content">
            <div className="user-avatar" style={effectiveUser?.profile_image ? { backgroundImage: `url(${effectiveUser.profile_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}></div>
            <div className="user-info">
              <p className="user-room">{effectiveUser?.room_number ? `${effectiveUser.room_number}호` : '호실 없음'}</p>
              <p className="user-name">{effectiveUser?.name || '사용자'}</p>
            </div>
            <div className="user-scores">
              <div className="score-item">
                <p className="score-label">상점</p>
                <p className="score-value positive">{effectiveUser?.merits || 0}</p>
              </div>
              <div className="score-item">
                <p className="score-label">벌점</p>
                <p className="score-value negative">{effectiveUser?.demerits || 0}</p>
              </div>
              <div className="score-item">
                <p className="score-label">총합</p>
                <p className="score-value">{(effectiveUser?.merits || 0) - (effectiveUser?.demerits || 0)}</p>
              </div>
            </div>
          </div>
          <div className="more-link" onClick={() => navigate('/profile')}>
            <span>수정</span>
            <img src={arrowRightIcon} alt="수정" className="arrow-icon" />
          </div>
        </div>

        {/* 공지사항 */}
        <div className="home-card notice-card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/notice')}>
            <h3 className="card-title">공지사항</h3>
            <img src={arrowRightIcon} alt="더보기" className="arrow-icon" />
          </div>
          <div className="notice-list">
            {noticesLoading ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>로딩 중...</div>
            ) : notices.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>공지사항이 없습니다.</div>
            ) : (
              notices.map((notice) => (
                <div key={notice.id} className="notice-item">
                  <div className="notice-content">
                    <div className="notice-dot"></div>
                    <p className="notice-title">{notice.title}</p>
                  </div>
                  <p className="notice-date">{notice.date}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 알람 */}
        <div className="home-card alarm-card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/alarm')}>
            <h3 className="card-title">알람</h3>
            <img src={arrowRightIcon} alt="더보기" className="arrow-icon" />
          </div>
          <div className="alarm-list">
            {alarmsLoading ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>로딩 중...</div>
            ) : alarms.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>알람이 없습니다.</div>
            ) : (
              alarms.map((alarm) => (
                <div key={alarm.id} className="alarm-item">
                  <div className="alarm-content">
                    <span className="alarm-type">{alarm.type}</span>
                    <p className="alarm-message">{alarm.message}</p>
                  </div>
                  <p className="alarm-time">{alarm.time}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 시간표 */}
        <div className="home-card timetable-card">
          <div className="card-header">
            <h3 className="card-title">시간표</h3>
            <div className="day-navigation">
              <span className="current-day">
                {weekDays[new Date().getDay()]} ({getCurrentDate()})
              </span>
            </div>
          </div>
          <div className="timetable-list">
            {timetableLoading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>시간표를 불러오는 중...</div>
            ) : timetableError ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
                {timetableError}
                {(effectiveUser?.student_id || effectiveUser?.studentId) && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                    학번: {effectiveUser.student_id || effectiveUser.studentId} (학년: {getGradeAndClass(effectiveUser.student_id || effectiveUser.studentId).grade}, 반: {getGradeAndClass(effectiveUser.student_id || effectiveUser.studentId).class})
                  </div>
                )}
              </div>
            ) : timetable.length > 0 ? (
              timetable.map((item, index) => (
                <div key={index} className="timetable-item">
                  <p className="timetable-period">{item.period}</p>
                  <p className="timetable-subject">{item.subject}</p>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>시간표가 없습니다.</div>
            )}
          </div>
        </div>

        {/* 커뮤니티 */}
        <div className="home-card community-card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/community')}>
            <h3 className="card-title">커뮤니티</h3>
            <img src={arrowRightIcon} alt="더보기" className="arrow-icon" />
          </div>
          <div className="community-list">
            {communityLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                커뮤니티 게시글을 불러오는 중...
              </div>
            ) : communityPosts.length > 0 ? (
              communityPosts.map((post) => (
                <div key={post.id} className="community-item">
                  <div className="community-content">
                    <span className="community-category">{post.category}</span>
                    <p className="community-title">{post.title}</p>
                  </div>
                  <p className="community-time">{post.time}</p>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                커뮤니티 게시글이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 급식 */}
        <div className="home-card meal-card">
          <div className="card-header">
            <h3 className="card-title">급식</h3>
            <p className="meal-date">{getCurrentDate()}</p>
          </div>
          <div className="meal-tabs">
            <button
              className={`meal-tab ${mealTab === '조식' ? 'active' : ''}`}
              onClick={() => setMealTab('조식')}
            >
              조식
            </button>
            <button
              className={`meal-tab ${mealTab === '중식' ? 'active' : ''}`}
              onClick={() => setMealTab('중식')}
            >
              중식
            </button>
            <button
              className={`meal-tab ${mealTab === '석식' ? 'active' : ''}`}
              onClick={() => setMealTab('석식')}
            >
              석식
            </button>
          </div>
          <div className="meal-menu">
            {mealLoading ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>급식 메뉴를 불러오는 중...</div>
            ) : mealError ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
                {mealError}
              </div>
            ) : mealMenus[mealTab] && mealMenus[mealTab].length > 0 ? (
              mealMenus[mealTab].map((menu, index) => (
                <p key={index} className="meal-item">{menu}</p>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                오늘 {mealTab} 메뉴가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;