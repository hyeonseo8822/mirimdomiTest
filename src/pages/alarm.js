import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/alarm.css';
import { supabase } from '../supabaseClient';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function Alarm({ userInfo }) {
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
    if (diffDays === 1) return '어제';
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('알람 데이터 불러오기 실패:', error);
        setAlarms([]);
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

  // 컴포넌트 마운트 시 알람 가져오기
  useEffect(() => {
    fetchAlarms();
  }, [userInfo]);

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

export default Alarm;
