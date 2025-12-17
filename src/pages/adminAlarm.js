import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/alarm.css';
import { supabase, ensureValidSession } from '../supabaseClient';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function AdminAlarm({ userInfo }) {
  const navigate = useNavigate();
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 날짜 포맷팅 함수 (created_at을 YYYY.MM.DD 형식으로 변환)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 시간:분 형식으로 변환하는 함수
  const getTimeFormat = (createdAt) => {
    if (!createdAt) return '';
    
    const date = new Date(createdAt);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // 알람 데이터 가져오기 (관리자용: 공지, 벌점, 상점, 외출만)
  const fetchAlarms = async () => {
    setAlarmsLoading(true);

    try {
      // 세션 확인 및 갱신
      await ensureValidSession();

      // 공지사항, 벌점, 상점, 외출 관련 알람만 조회
      // type 필드에 '공지', '벌점', '상점', '외출'이 포함된 알람만 조회
      const { data, error } = await supabase
        .from('alarm')
        .select('*')
        .or('type.eq.공지,type.eq.벌점,type.eq.상점,type.eq.외출')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('알람 데이터 불러오기 실패:', error);
        setAlarms([]);
        return;
      }

      // 데이터 포맷 변환 및 필터링
      const formattedAlarms = (data || [])
        .map(alarm => ({
          id: alarm.id,
          type: alarm.type || '알림',
          message: alarm.message || '',
          time: alarm.created_at ? new Date(alarm.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : getTimeFormat(alarm.created_at),
          detail: alarm.detail || '',
          created_at: alarm.created_at,
          is_read: alarm.is_read || false,
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
  };

  // 컴포넌트 마운트 시 알람 가져오기 및 실시간 구독
  useEffect(() => {
    fetchAlarms();

    // 실시간 구독 설정 (공지, 벌점, 상점 관련 알람만)
    const subscription = supabase
      .channel('admin_alarm_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alarm',
        },
        (payload) => {
          // 공지, 벌점, 상점, 외출 관련 알람만 처리
          if (payload.new && ['공지', '벌점', '상점', '외출'].includes(payload.new.type)) {
            console.log('[DEBUG] AdminAlarm.js: Realtime (alarm) - 변경 감지', payload);
            fetchAlarms();
          }
        }
      )
      .subscribe();
    console.log('[DEBUG] AdminAlarm.js: Realtime (alarm) - 구독 시작');

    return () => {
      console.log('[DEBUG] AdminAlarm.js: Realtime (alarm) - 구독 해제');
      try { subscription.unsubscribe(); } catch (e) {}
    };
  }, []);

  const handleAlarmClick = (alarm) => {
    setSelectedAlarm(alarm);
  };

  return (
    <div className="alarm">
      <div className="alarm-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <img src={arrowRightIcon} alt="뒤로가기" className="back-icon" />
        </button>
        <div className="alarm-header-content">
          <h1 className="alarm-title">알람</h1>
          <p className="alarm-date">{getCurrentDate()}</p>
        </div>
      </div>

      <div className="alarm-list-container">
        <div className="alarm-list">
          {alarmsLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: '#999' }}>
              알람을 불러오는 중...
            </div>
          ) : alarms.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: '#999' }}>
              알람이 없습니다.
            </div>
          ) : (
            alarms.map((alarm) => (
              <div 
                key={alarm.id} 
                className="alarm-item"
                onClick={() => handleAlarmClick(alarm)}
              >
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

      {/* 알람 상세 */}
      {selectedAlarm && (
        <div className="alarm-detail-container">
          <div className="alarm-detail-header">
            <div className="alarm-detail-title-section">
              <div className="alarm-detail-title-row">
                <div className="alarm-detail-type-time">
                  <span className="alarm-detail-type">{selectedAlarm.type}</span>
                  <p className="alarm-detail-time">{selectedAlarm.time}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="alarm-detail-content">
            <h3 className="alarm-detail-message">{selectedAlarm.message}</h3>
            <div className="alarm-detail-text">
              <p>{selectedAlarm.detail}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAlarm;

