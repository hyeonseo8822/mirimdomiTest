import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, ensureValidSession } from '../supabaseClient';
import './css/main.css';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function AdminMain({ userInfo }) {
  const navigate = useNavigate();

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 날짜 포맷팅 함수 (created_at을 YYYY.MM.DD 형식으로 변환)
  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }, []);

  // 공지사항 데이터
  const [notices, setNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(true);

  // 공지사항 데이터 가져오기
  const fetchNotices = useCallback(async () => {
    setNoticesLoading(true);
    try {
      await ensureValidSession();
      
      const { data, error } = await supabase
        .from('notice')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) {
        console.error('공지사항 가져오기 중 오류:', error);
        setNotices([]);
        return;
      }

      const formattedNotices = (data || []).map(notice => ({
        id: notice.id,
        title: notice.title || '(제목 없음)',
        date: formatDate(notice.created_at),
      }));
      
      setNotices(formattedNotices);
    } catch (error) {
      console.error('공지사항 가져오기 중 오류:', error);
      setNotices([]);
    } finally {
      setNoticesLoading(false);
    }
  }, [formatDate]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // 알람 데이터
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);

  // 상대 시간 계산 함수
  const getRelativeTime = useCallback((createdAt) => {
    if (!createdAt) return '방금';
    
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '방금';
    if (diffMins < 60) return `${diffMins}분 전`;
    return formatDate(createdAt);
  }, [formatDate]);

  // 알람 데이터 가져오기 (관리자용: 공지, 벌점, 상점, 외출만)
  const fetchAlarms = useCallback(async () => {
    if (!userInfo?.id) {
      setAlarms([]);
      setAlarmsLoading(false);
      return;
    }

    setAlarmsLoading(true);
    try {
      await ensureValidSession();
      
      const adminIdString = String(userInfo.id).trim();
      
      // 공지사항, 벌점, 상점 알람은 모든 사용자에게 온 것 조회 (관리자가 확인 가능)
      // 외출 알람은 관리자에게 온 것만 조회
      const { data: allAlarms, error: allError } = await supabase
        .from('alarm')
        .select('*')
        .or('type.eq.공지,type.eq.벌점,type.eq.상점')
        .order('created_at', { ascending: false })
        .limit(10); // 더 많이 가져온 후 필터링

      if (allError) {
        console.error('알람 가져오기 중 오류:', allError);
      }

      // 외출 알람은 관리자에게 온 것만 조회
      const { data: exitAlarms, error: exitError } = await supabase
        .from('alarm')
        .select('*')
        .eq('type', '외출')
        .eq('user_id', adminIdString)
        .order('created_at', { ascending: false })
        .limit(10);

      if (exitError) {
        console.error('외출 알람 가져오기 중 오류:', exitError);
      }

      // 두 결과 합치기
      const combinedAlarms = [
        ...(allAlarms || []),
        ...(exitAlarms || [])
      ];

      // 최신순 정렬 및 중복 제거
      const uniqueAlarms = combinedAlarms
        .filter((alarm, index, self) => 
          index === self.findIndex(a => a.id === alarm.id)
        )
        .sort((a, b) => {
          const dateA = new Date(a.created_at);
          const dateB = new Date(b.created_at);
          return dateB - dateA;
        })
        .slice(0, 4); // 최신 4개만

      // 데이터 포맷 변환 및 필터링
      const formattedAlarms = uniqueAlarms
        .map(alarm => ({
          id: alarm.id,
          type: alarm.type || '알림',
          message: alarm.message || '',
          time: getRelativeTime(alarm.created_at),
        }))
        // 외출 타입 알람 중에서 "외출 신청이 승인되었습니다." (이름 없음)는 제외
        .filter(alarm => {
          if (alarm.type === '외출') {
            // "외출 신청이 승인되었습니다:" 뒤에 이름이 있는 것만 표시
            return alarm.message.includes('외출 신청이 승인되었습니다:');
          }
          return true; // 외출이 아닌 알람은 모두 표시
        });
      
      setAlarms(formattedAlarms);
    } catch (error) {
      console.error('알람 가져오기 중 오류:', error);
      setAlarms([]);
    } finally {
      setAlarmsLoading(false);
    }
  }, [getRelativeTime, userInfo?.id]);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  // 규정 위반 데이터
  const [violations, setViolations] = useState([]);
  const [violationsLoading, setViolationsLoading] = useState(true);

  // 규정 위반 데이터 가져오기 (points_history 테이블에서 최신순으로 상위 4개)
  const fetchViolations = useCallback(async () => {
    setViolationsLoading(true);
    try {
      await ensureValidSession();
      
      // points_history에서 벌점(type='demerits') 항목을 최신순으로 조회 (상위 4개)
      const { data, error } = await supabase
        .from('points_history')
        .select(`
          id,
          user_id,
          points,
          reason,
          created_at,
          users:user_id (
            id,
            name,
            room_number,
            student_id
          )
        `)
        .eq('type', 'demerits')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('규정 위반 가져오기 중 오류:', error);
        setViolations([]);
        return;
      }

      const formattedViolations = (data || []).map(history => {
        const user = history.users || {};
        return {
          id: history.id,
          name: user.name || '이름 없음',
          roomNumber: user.room_number ? `${user.room_number}호` : '호실 없음',
          detail: `벌점 ${history.points || 0}점`,
        };
      });
      
      setViolations(formattedViolations);
    } catch (error) {
      console.error('규정 위반 가져오기 중 오류:', error);
      setViolations([]);
    } finally {
      setViolationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  // 신청 관리 데이터
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);

  // 신청 관리 데이터 가져오기 (외출 신청만, 승인되지 않은 것 중 가까운 날짜 4개)
  const fetchApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      await ensureValidSession();
      
      // 외출 신청 가져오기 (승인되지 않은 것만, 날짜가 가까운 순서로)
      const { data: exitData, error: exitError } = await supabase
        .from('temporary_exit')
        .select(`
          id,
          reason,
          date,
          status,
          student_id,
          created_at,
          users:student_id (
            name,
            room_number,
            address
          )
        `)
        .eq('status', 'pending')
        .order('date', { ascending: true }) // 날짜가 가까운 순서로 정렬
        .limit(3); // 상위 4개만

      if (exitError) {
        console.error('외출 신청 가져오기 중 오류:', exitError);
        setApplications([]);
        return;
      }

      // 외출 신청 포맷팅
      const formattedApplications = (exitData || []).map(app => {
        const user = app.users || {};
        // 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
        const dateParts = app.date ? app.date.split('-') : [];
        const formattedDate = dateParts.length === 3 
          ? `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}`
          : app.date;
        
        return {
          id: app.id,
          name: user.name || '이름 없음',
          roomNumber: user.room_number ? `${user.room_number}호` : '호실 없음',
          type: '외출',
          location: formattedDate, // 외출은 날짜를 location에 표시
        };
      });
      
      setApplications(formattedApplications);
    } catch (error) {
      console.error('신청 관리 가져오기 중 오류:', error);
      setApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);


  // 프로필 이미지 초기화
  const profileImage = userInfo?.profile_image?.trim() 
    ? userInfo.profile_image.trim() 
    : process.env.PUBLIC_URL + '/img/default-profile.png';

  return (
    <div className="home">
      <div className="home-header">
        <h1 className="home-title">홈</h1>
        <p className="home-date">{getCurrentDate()}</p>
      </div>

      <div className="home-grid">
        {/* 사감 프로필 카드 */}
        <div className="home-card user-summary-card">
          <div className="user-summary-content">
            <div 
              className="user-avatar" 
              style={{ 
                ...(profileImage ? { backgroundImage: `url(${profileImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
              }}
            >
            </div>
            <div className="user-info">
              <p className="user-room">사감</p>
              <p className="user-name">{userInfo?.name || '홍길동'}</p>
            </div>
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

        {/* 규정 위반 */}
        <div className="home-card violation-card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/management')}>
            <h3 className="card-title">규정 위반</h3>
            <img src={arrowRightIcon} alt="더보기" className="arrow-icon" />
          </div>
          <div className="violation-list">
            {violationsLoading ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>로딩 중...</div>
            ) : violations.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>규정 위반 내역이 없습니다.</div>
            ) : (
              violations.map((violation) => (
                <div key={violation.id} className="violation-item">
                  <div className="violation-avatar"></div>
                  <div className="violation-content">
                    <p className="violation-name">{violation.name}</p>
                    <p className="violation-room">{violation.roomNumber}</p>
                    <p className="violation-detail">{violation.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 신청 관리 */}
        <div className="home-card application-card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/application')}>
            <h3 className="card-title">신청관리</h3>
            <img src={arrowRightIcon} alt="더보기" className="arrow-icon" />
          </div>
          <div className="application-list">
            {applicationsLoading ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>로딩 중...</div>
            ) : applications.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: '14px' }}>신청 내역이 없습니다.</div>
            ) : (
              applications.map((app) => (
                <div key={app.id} className="application-item">
                  <div className="application-avatar"></div>
                  <div className="application-content">
                    <p className="application-name">{app.name}</p>
                    <p className="application-room">{app.roomNumber}</p>
                    <p className="application-location">{app.location}</p>
                  </div>
                  <button className={`application-status ${app.type === '외박' ? 'out' : 'stay'}`}>
                    {app.type}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminMain;

