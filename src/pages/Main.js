import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/main.css';
import { supabase } from '../supabaseClient';
import useAuth from '../hooks/useAuth';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function Main({ userInfo }) {
  console.log('--- Main Component Render ---', { userInfo });
  const navigate = useNavigate();
  const [mealTab, setMealTab] = useState('조식');
  const [currentDay, setCurrentDay] = useState('화요일');

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
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // Supabase 요청에 타임아웃을 적용하는 헬퍼
  const callWithTimeout = async (fn, ms = 5000) => {
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
  };

  // 공지사항 데이터 가져오기
  const fetchNotices = async () => {
    console.log('[DEBUG] Main.js: fetchNotices - 실행');
    setNoticesLoading(true);
    try {
      console.log('[DEBUG] Main.js: fetchNotices - Supabase "notice" 테이블 조회 시작');
      const res = await callWithTimeout(() => supabase
        .from('notice')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(4), 7000); // 최신 4개만 가져오기
      let { data, error } = res || {};
      console.log('[DEBUG] Main.js: fetchNotices - Supabase "notice" 테이블 조회 완료', { data, error });
      console.log('[DEBUG] Main.js: fetchNotices - Supabase "notice" 테이블 조회 완료', { data, error });

      // 에러가 있고 테이블을 찾을 수 없다면 'notices' 시도
      if (error && (error.message?.includes('relation') || error.message?.includes('does not exist'))) {
        console.log('[DEBUG] Main.js: fetchNotices - "notice" 테이블 없음, "notices"로 재시도');
        const result = await callWithTimeout(() => supabase
          .from('notices')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(4), 7000);
        data = result?.data;
        error = result?.error;
        console.log('[DEBUG] Main.js: fetchNotices - "notices" 테이블 조회 완료', { data, error });
      }

      if (error) {
        // 인증 오류인 경우
        if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth') || error.message?.includes('permission')) {
          console.error('[DEBUG] Main.js: fetchNotices - 인증 오류:', error);
          setNotices([]);
          setNoticesLoading(false);
          return;
        }
        console.error('[DEBUG] Main.js: fetchNotices - Supabase 오류:', error);
        setNotices([]);
        setNoticesLoading(false);
        return;
      }

      if (!data) {
        console.log('[DEBUG] Main.js: fetchNotices - 데이터 없음');
        setNotices([]);
        setNoticesLoading(false);
        return;
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
      setNotices([]);
    } finally {
      console.log('[DEBUG] Main.js: fetchNotices - finally 블록 실행, 로딩 해제');
      setNoticesLoading(false);
    }
  };

  // 공지사항 가져오기 (authReady가 완료되고 userInfo가 준비된 후)
  useEffect(() => {
    console.log('[DEBUG] Main.js: useEffect (Notices) - 실행', { authReady, effectiveUserExists: !!effectiveUser?.id, fetched: noticesFetchedRef.current });
    if (!authReady) return; // 인증 초기화 전에는 실행하지 않음
    if (effectiveUser?.id && !noticesFetchedRef.current) {
      fetchNotices();
    }
  }, [authReady, effectiveUser?.id]); // authReady + effectiveUser.id가 변경될 때만

  // 알람 데이터
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const alarmsFetchedRef = useRef(false);

  // 상대 시간 계산 함수 (예: '방금', '5분 전', '1시간 전' 등)
  const getRelativeTime = (createdAt) => {
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
  };

  // 알람 데이터 가져오기
  const fetchAlarms = async () => {
    console.log('[DEBUG] Main.js: fetchAlarms - 실행');
    setAlarmsLoading(true);
    try {
      if (!effectiveUser?.id) {
        console.log('[DEBUG] Main.js: fetchAlarms - effectiveUser 없음, 종료');
        setAlarms([]);
        setAlarmsLoading(false); // 로딩 상태를 false로 설정
        return;
      }

      const userIdString = String(effectiveUser.id);
      console.log(`[DEBUG] Main.js: fetchAlarms - Supabase "alarm" 테이블 조회 시작 (user_id: ${userIdString})`);

      const res = await callWithTimeout(() => supabase
        .from('alarm')
        .select('*')
        .eq('user_id', userIdString)
        .order('created_at', { ascending: false })
        .limit(4), 7000); // 최신 4개만 가져오기
      const { data, error } = res || {};
      console.log('[DEBUG] Main.js: fetchAlarms - Supabase "alarm" 테이블 조회 완료', { data, error });

      if (error) {
        // 인증 오류인 경우
        if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth') || error.message?.includes('permission')) {
          console.error('[DEBUG] Main.js: fetchAlarms - 인증 오류:', error);
          setAlarms([]);
          setAlarmsLoading(false);
          return;
        }
        console.error('[DEBUG] Main.js: fetchAlarms - Supabase 오류:', error);
        setAlarms([]);
        setAlarmsLoading(false);
        return;
      }

      // 데이터 포맷 변환
      const formattedAlarms = (data || []).map(alarm => ({
        id: alarm.id,
        type: alarm.type || '알림',
        message: alarm.message || '',
        time: alarm.time || getRelativeTime(alarm.created_at),
        detail: alarm.detail || '',
        created_at: alarm.created_at,
        is_read: alarm.is_read || false,
      }));

      setAlarms(formattedAlarms);
      alarmsFetchedRef.current = true;
      console.log('[DEBUG] Main.js: fetchAlarms - 성공');
    } catch (error) {
      console.error('[DEBUG] Main.js: fetchAlarms - 전체 try-catch 오류:', error);
      setAlarms([]);
    } finally {
      console.log('[DEBUG] Main.js: fetchAlarms - finally 블록 실행, 로딩 해제');
      setAlarmsLoading(false);
    }
  };

  // 알람 가져오기 및 실시간 구독 (authReady 완료 및 userInfo 준비된 후)
  useEffect(() => {
    console.log('[DEBUG] Main.js: useEffect (Alarms) - 실행', { authReady, effectiveUserExists: !!effectiveUser?.id, fetched: alarmsFetchedRef.current });
    if (!authReady) return; // 인증 초기화 전에는 실행하지 않음
    if (!effectiveUser?.id) {
      // userInfo가 아직 준비되지 않았으면 빈 배열로 설정하고 로딩 해제
      console.log('[DEBUG] Main.js: useEffect (Alarms) - effectiveUser 없음, 로딩 해제');
      setAlarms([]);
      setAlarmsLoading(false);
      return;
    }

    // 이미 가져왔으면 다시 가져오지 않음 (실시간 구독은 계속)
    if (!alarmsFetchedRef.current) {
      fetchAlarms();
    }

    // Supabase Realtime 구독
    const userIdString = String(effectiveUser.id);
    
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
          fetchAlarms(); // 변경 시 다시 가져오기
        }
      )
      .subscribe();
    console.log('[DEBUG] Main.js: Realtime (alarm) - 구독 시작');

    return () => {
      console.log('[DEBUG] Main.js: Realtime (alarm) - 구독 해제');
      try { subscription.unsubscribe(); } catch (e) {}
    };
  }, [authReady, effectiveUser?.id]); // authReady + effectiveUser.id가 변경될 때만

  // 커뮤니티 데이터
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const communityFetchedRef = useRef(false);

  // 커뮤니티 게시글 가져오기
  const fetchCommunityPosts = async () => {
    console.log('[DEBUG] Main.js: fetchCommunityPosts - 실행');
    setCommunityLoading(true);
    try {
      console.log('[DEBUG] Main.js: fetchCommunityPosts - Supabase "posts" 테이블 조회 시작');
      const res = await callWithTimeout(() => supabase
        .from('posts')
        .select('id, title, category, created_at')
        .order('created_at', { ascending: false })
        .limit(4), 7000); // 최신 4개만 가져오기
      const { data, error } = res || {};
      console.log('[DEBUG] Main.js: fetchCommunityPosts - Supabase "posts" 테이블 조회 완료', { data, error });

      if (error) {
        // 인증 오류인 경우
        if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth') || error.message?.includes('permission')) {
          console.error('[DEBUG] Main.js: fetchCommunityPosts - 인증 오류:', error);
          setCommunityPosts([]);
          setCommunityLoading(false);
          return;
        }
        console.error('[DEBUG] Main.js: fetchCommunityPosts - Supabase 오류:', error);
        setCommunityPosts([]);
        setCommunityLoading(false);
        return;
      }

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
      setCommunityPosts([]);
    } finally {
      console.log('[DEBUG] Main.js: fetchCommunityPosts - finally 블록 실행, 로딩 해제');
      setCommunityLoading(false);
    }
  };

  // 커뮤니티 게시글 가져오기 (userInfo가 준비된 후)
  useEffect(() => {
    console.log('[DEBUG] Main.js: useEffect (Community) - 실행', { authReady, effectiveUserExists: !!effectiveUser?.id, fetched: communityFetchedRef.current });
    if (!authReady) return; // 인증 초기화 전에는 실행하지 않음
    if (effectiveUser?.id && !communityFetchedRef.current) {
      fetchCommunityPosts();
    }
  }, [authReady, effectiveUser?.id]); // authReady + effectiveUser.id가 변경될 때만

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
  
  // 현재 요일 인덱스 계산
  const getCurrentDayIndex = () => {
    const dayName = currentDay;
    return weekDays.indexOf(dayName);
  };

  // NEIS API 직접 호출 (시간표)
  // NEIS 시간표 API 호출 (필수: KEY 필요)
const fetchTimetable = async (grade, classNum, date) => {
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
    // 날짜 : YYYYMMDD
    const dateStr = date.replace(/\./g, '').replace(/\s/g, '');

    const apiKey = process.env.REACT_APP_NEIS_API_KEY || 'f5d5771e4c464ba287816eb498ff3999';
    
    if (!apiKey) {
      console.error('NEIS API 키가 설정되지 않았습니다.');
      setTimetableError('API 키가 설정되지 않았습니다.');
      setTimetable(getDummyTimetable(grade, classNum));
      setTimetableLoading(false);
      return;
    }

    const params = new URLSearchParams({
      KEY: apiKey,
      Type: 'json',
      pIndex: '1',
      pSize: '100',
      ATPT_OFCDC_SC_CODE: 'B10',     // 서울시교육청
      SD_SCHUL_CODE: '7011569',      // 미림마이스터고
      GRADE: grade,
      CLASS_NM: classNum,
      ALL_TI_YMD: dateStr,           // 하루만 조회
    });

    const url = `https://open.neis.go.kr/hub/hisTimetable?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();

    // API 오류 체크
    if (data.RESULT && data.RESULT.CODE && data.RESULT.CODE !== 'INFO-000') {
      console.warn('NEIS API 오류:', data.RESULT.MESSAGE || data.RESULT.CODE);
      // API 오류가 있어도 더미 데이터로 표시
      setTimetable(getDummyTimetable(grade, classNum));
      setTimetableError(null); // 에러 메시지 숨김
      return;
    }

    // 시간표 데이터 확인
    if (!data.hisTimetable || !data.hisTimetable[1] || !data.hisTimetable[1].row) {
      setTimetable(getDummyTimetable(grade, classNum));
      setTimetableError(null); // 에러 메시지 숨김
      return;
    }

    const rows = data.hisTimetable[1].row;

    if (!rows || rows.length === 0) {
      setTimetable(getDummyTimetable(grade, classNum));
      setTimetableError(null); // 에러 메시지 숨김
      return;
    }

    // 정렬 + 표시 형식 통일
    const result = rows
      .filter(item => item.PERIO && (item.ITRT_CNTNT || item.SUBJECT_NM)) // 유효한 데이터만
      .sort((a, b) => parseInt(a.PERIO) - parseInt(b.PERIO))
      .map(item => ({
        period: `${item.PERIO}교시`,
        subject: item.ITRT_CNTNT || item.SUBJECT_NM || "수업 정보 없음",
      }));

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
    // 에러 발생 시에도 더미 데이터로 표시하고 에러 메시지 숨김
    setTimetable(getDummyTimetable(grade, classNum));
    setTimetableError(null);
  } finally {
    setTimetableLoading(false);
  }
};


  // 더미 시간표 데이터 (백엔드 서버 없이 사용)
  const getDummyTimetable = (grade, classNum) => {
    // 학년/반별 기본 시간표 (실제 시간표로 교체 가능)
    const defaultTimetable = [
      { period: '1교시', subject: '수학' },
      { period: '2교시', subject: '영어' },
      { period: '3교시', subject: '통합과학' },
      { period: '4교시', subject: '국어' },
      { period: '5교시', subject: '디지털디자인' },
      { period: '6교시', subject: 'UIUX엔지니어링' },
      { period: '7교시', subject: '시각디자인' },
    ];
    
    // 여기서 학년/반별로 다른 시간표를 반환할 수 있습니다
    // 예: if (grade === 2 && classNum === 2) { return [...]; }
    
    return defaultTimetable;
  };

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
  }, [effectiveUser?.student_id]); // student_id가 변경될 때만

  // 급식 메뉴 데이터
  const [mealMenus, setMealMenus] = useState({
    조식: [],
    중식: [],
    석식: [],
  });
  const [mealLoading, setMealLoading] = useState(false);
  const [mealError, setMealError] = useState(null);
  const mealFetchedRef = useRef(false);

  // NEIS API 직접 호출 (급식) - 사용자 제공 형식
  const getMealInfo = async (dateData) => {
    const API_KEY = process.env.REACT_APP_NEIS_API_KEY || 'f5d5771e4c464ba287816eb498ff3999';
    
    if (!API_KEY) {
      console.error('NEIS API 키가 설정되지 않았습니다.');
      setMealError('API 키가 설정되지 않았습니다.');
      return;
    }

    const URL = "https://open.neis.go.kr/hub/mealServiceDietInfo";
    const ATPT_OFCDC_SC_CODE = "B10";   // 서울 특별시 교육청
    const SD_SCHUL_CODE = "7011569";
    const TYPE = "json";

    const api_url = `https://open.neis.go.kr/hub/mealServiceDietInfo?ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&KEY=${API_KEY}&MLSV_YMD=${dateData}&Type=${TYPE}`;

    const response = await fetch(api_url, {
      method: 'GET'
    });

    const data = await response.json();

    return data;
  };

  const fetchMealMenu = async (input = new Date()) => {
    // 이미 호출 중이면 중복 호출 방지
    if (mealLoading) return;
    
    setMealLoading(true);
    setMealError(null);

    try {
      // Date 객체를 YYYYMMDD 형식으로 변환
      const now = new Date(input);
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const date = now.getDate();
      const dateData = `${year}${month >= 10 ? month : '0' + month}${date >= 10 ? date : '0' + date}`;

      const data = await getMealInfo(dateData);

      // 에러 체크
      if (data.RESULT && data.RESULT.CODE && data.RESULT.CODE !== 'INFO-000') {
        const dummyMeals = getDummyMealMenu();
        setMealMenus(dummyMeals);
        setMealError(null);
        return;
      }

      if (!data.mealServiceDietInfo) {
        const dummyMeals = getDummyMealMenu();
        setMealMenus(dummyMeals);
        setMealError(null);
        return;
      }

      // 급식 데이터 추출
      const mealInfoArray = data.mealServiceDietInfo[1]?.row || [];
      const meals = {
        조식: [],
        중식: [],
        석식: [],
      };

      mealInfoArray.forEach(element => {
        const mealType = element.MMEAL_SC_NM; // 조식, 중식, 석식
        const dishName = element.DDISH_NM; // 메뉴 문자열
        
        if (dishName) {
          // 메뉴 파싱 (HTML 태그 제거 및 분리)
          const menuList = dishName
            .replace(/<br\/?>/gi, '\n')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .split('\n')
            .map(menu => menu.trim())
            .filter(menu => menu.length > 0 && !menu.match(/^\d+\./)); // 번호 제거
          
          if (mealType === '조식' || mealType?.includes('조식')) {
            meals.조식 = menuList;
          } else if (mealType === '중식' || mealType?.includes('중식')) {
            meals.중식 = menuList;
          } else if (mealType === '석식' || mealType?.includes('석식')) {
            meals.석식 = menuList;
          }
        }
      });

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
  };

  // 더미 급식 메뉴 데이터 (백엔드 서버 없이 사용)
  const getDummyMealMenu = () => {
    // 실제 급식 메뉴로 교체 가능
    return {
      조식: ['쌀밥', '시금치두부무침', '계란말이', '된장찌개', '춘천닭갈비'],
      중식: ['쌀밥', '김치찌개', '불고기', '나물무침', '배추김치'],
      석식: ['쌀밥', '미역국', '닭볶음탕', '콩나물무침', '깍두기'],
    };
  };

  // 컴포넌트 마운트 시 급식 메뉴 불러오기 (한 번만)
  useEffect(() => {
    if (!mealFetchedRef.current) {
      fetchMealMenu(new Date());
    }
  }, []);

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