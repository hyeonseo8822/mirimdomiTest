import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './css/main.css';
import { supabase } from '../supabaseClient';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function Main({ userInfo }) {
  const navigate = useNavigate();
  const location = useLocation();
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

  // 날짜 포맷팅 함수 (created_at을 YYYY.MM.DD 형식으로 변환)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 공지사항 데이터 가져오기
  const fetchNotices = async () => {
    setNoticesLoading(true);
    try {
      console.log('공지사항 데이터 가져오기 시작 (main)...');
      
      // 먼저 'notice' 테이블 시도
      let { data, error } = await supabase
        .from('notice')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(4); // 최신 4개만 가져오기

      console.log('공지사항 쿼리 결과 (main, notice):', { data, error, dataLength: data?.length });

      // 에러가 있고 테이블을 찾을 수 없다면 'notices' 시도
      if (error && (error.message?.includes('relation') || error.message?.includes('does not exist'))) {
        console.log('notice 테이블을 찾을 수 없음, notices 테이블 시도...');
        const result = await supabase
          .from('notices')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(4);
        data = result.data;
        error = result.error;
        console.log('공지사항 쿼리 결과 (main, notices):', { data, error, dataLength: data?.length });
      }

      if (error) {
        console.error('공지사항 불러오기 실패:', error);
        console.error('에러 상세:', JSON.stringify(error, null, 2));
        setNotices([]);
        setNoticesLoading(false);
        return;
      }

      if (!data) {
        console.warn('데이터가 null입니다 (main).');
        setNotices([]);
        setNoticesLoading(false);
        return;
      }

      console.log('가져온 공지사항 데이터 (main):', data);
      console.log('데이터 개수 (main):', data.length);

      // 데이터 포맷 변환
      const formattedNotices = (data || []).map(notice => {
        if (!notice) {
          console.warn('null notice 발견 (main)');
          return null;
        }
        return {
          id: notice.id,
          title: notice.title || '(제목 없음)',
          date: formatDate(notice.created_at),
        };
      }).filter(notice => notice !== null); // null 제거

      console.log('포맷팅된 공지사항 (main):', formattedNotices);
      console.log('포맷팅된 공지사항 개수 (main):', formattedNotices.length);
      
      setNotices(formattedNotices);
    } catch (error) {
      console.error('공지사항 가져오기 중 오류:', error);
      console.error('에러 스택:', error.stack);
      setNotices([]);
    } finally {
      setNoticesLoading(false);
    }
  };

  // 컴포넌트 마운트 시 및 페이지 포커스 시 공지사항 가져오기
  useEffect(() => {
    fetchNotices();
  }, [location.pathname]); // location.pathname이 변경될 때마다 다시 가져오기

  // 알람 데이터
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);

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
    setAlarmsLoading(true);
    try {
      if (!userInfo?.id) {
        setAlarms([]);
        setAlarmsLoading(false);
        return;
      }

      const userIdString = String(userInfo.id);

      const { data, error } = await supabase
        .from('alarm')
        .select('*')
        .eq('user_id', userIdString)
        .order('created_at', { ascending: false })
        .limit(4); // 최신 4개만 가져오기

      if (error) {
        console.error('알람 데이터 불러오기 실패:', error);
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
    } catch (error) {
      console.error('알람 가져오기 중 오류:', error);
      setAlarms([]);
    } finally {
      setAlarmsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 및 페이지 포커스 시 알람 가져오기 및 실시간 구독
  useEffect(() => {
    fetchAlarms();

    // Supabase Realtime 구독
    if (userInfo?.id) {
      const userIdString = String(userInfo.id);
      
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
            console.log('알람 변경 감지:', payload);
            fetchAlarms(); // 변경 시 다시 가져오기
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [userInfo, location.pathname]); // location.pathname 추가

  // 커뮤니티 데이터
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(true);

  // 커뮤니티 게시글 가져오기
  const fetchCommunityPosts = async () => {
    setCommunityLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, title, category, created_at')
        .order('created_at', { ascending: false })
        .limit(4); // 최신 4개만 가져오기

      if (error) {
        console.error('커뮤니티 게시글 불러오기 실패:', error);
        setCommunityPosts([]);
        setCommunityLoading(false);
      } else {
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
      }
    } catch (error) {
      console.error('커뮤니티 게시글 가져오기 중 오류:', error);
      setCommunityPosts([]);
    } finally {
      setCommunityLoading(false);
    }
  };

  // 컴포넌트 마운트 시 및 페이지 포커스 시 커뮤니티 게시글 가져오기
  useEffect(() => {
    fetchCommunityPosts();
  }, [location.pathname]); // location.pathname이 변경될 때마다 다시 가져오기

  // 시간표 데이터
  const [timetable, setTimetable] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState(null);

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

    console.log('시간표 API 키 사용:', apiKey.substring(0, 10) + '...');

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
    console.log('시간표 API 요청 URL:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log("시간표 API 응답:", data);

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
      console.warn('시간표 데이터가 없습니다. 더미 데이터 사용');
      setTimetable(getDummyTimetable(grade, classNum));
      setTimetableError(null); // 에러 메시지 숨김
      return;
    }

    const rows = data.hisTimetable[1].row;

    if (!rows || rows.length === 0) {
      console.warn('시간표 항목이 없습니다. 더미 데이터 사용');
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

  // userInfo가 변경되면 오늘 날짜의 시간표만 불러오기
  useEffect(() => {
    if (userInfo?.student_id) { // <-- student_id로 변경
      const { grade, class: classNum } = getGradeAndClass(userInfo.student_id); // <-- student_id로 변경
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
  }, [userInfo]); // currentDay 의존성 제거 - 오늘만 조회

  // 급식 메뉴 데이터
  const [mealMenus, setMealMenus] = useState({
    조식: [],
    중식: [],
    석식: [],
  });
  const [mealLoading, setMealLoading] = useState(false);
  const [mealError, setMealError] = useState(null);

  // NEIS API 직접 호출 (급식) - 사용자 제공 형식
  const getMealInfo = async (dateData) => {
    const API_KEY = process.env.REACT_APP_NEIS_API_KEY || 'f5d5771e4c464ba287816eb498ff3999';
    
    if (!API_KEY) {
      console.error('NEIS API 키가 설정되지 않았습니다.');
      setMealError('API 키가 설정되지 않았습니다.');
      return;
    }

    console.log('급식 API 키 사용:', API_KEY.substring(0, 10) + '...');
    
    const URL = "https://open.neis.go.kr/hub/mealServiceDietInfo";
    const ATPT_OFCDC_SC_CODE = "B10";   // 서울 특별시 교육청
    const SD_SCHUL_CODE = "7011569";
    const TYPE = "json";

    const api_url = `https://open.neis.go.kr/hub/mealServiceDietInfo?ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&KEY=${API_KEY}&MLSV_YMD=${dateData}&Type=${TYPE}`;

    console.log('급식 API 요청 날짜:', dateData);
    console.log('급식 API 요청 URL:', api_url);

    const response = await fetch(api_url, {
      method: 'GET'
    });

    const data = await response.json();
    console.log('급식 API 응답:', data);

    return data;
  };

  const fetchMealMenu = async (input = new Date()) => {
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
        console.warn('NEIS API 오류:', data.RESULT.MESSAGE || data.RESULT.CODE);
        const dummyMeals = getDummyMealMenu();
        setMealMenus(dummyMeals);
        setMealError(null);
        return;
      }

      if (!data.mealServiceDietInfo) {
        console.warn('급식 데이터 구조가 예상과 다릅니다:', data);
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

  // 날짜가 변경되면 급식 메뉴 다시 불러오기
  useEffect(() => {
    fetchMealMenu(new Date());
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
            <div className="user-avatar" style={userInfo?.profile_image ? { backgroundImage: `url(${userInfo.profile_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}></div>
            <div className="user-info">
              <p className="user-room">{userInfo?.room_number ? `${userInfo.room_number}호` : '호실 없음'}</p>
              <p className="user-name">{userInfo?.name || '사용자'}</p>
            </div>
            <div className="user-scores">
              <div className="score-item">
                <p className="score-label">상점</p>
                <p className="score-value positive">{userInfo?.merits || 0}</p>
              </div>
              <div className="score-item">
                <p className="score-label">벌점</p>
                <p className="score-value negative">{userInfo?.demerits || 0}</p>
              </div>
              <div className="score-item">
                <p className="score-label">총합</p>
                <p className="score-value">{(userInfo?.merits || 0) - (userInfo?.demerits || 0)}</p>
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
            {(() => {
              console.log('Main 공지사항 렌더링:', { noticesLoading, noticesCount: notices.length, notices });
              return noticesLoading ? (
                <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>로딩 중...</div>
              ) : notices.length === 0 ? (
                <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>공지사항이 없습니다.</div>
              ) : (
                notices.map((notice) => {
                  console.log('Main 공지사항 아이템 렌더링:', notice);
                  return (
                    <div key={notice.id} className="notice-item">
                      <div className="notice-content">
                        <div className="notice-dot"></div>
                        <p className="notice-title">{notice.title}</p>
                      </div>
                      <p className="notice-date">{notice.date}</p>
                    </div>
                  );
                })
              );
            })()}
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
                {userInfo?.studentId && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                    학번: {userInfo.studentId} (학년: {getGradeAndClass(userInfo.studentId).grade}, 반: {getGradeAndClass(userInfo.studentId).class})
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