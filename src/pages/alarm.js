import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/alarm.css';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function Alarm() {
  const navigate = useNavigate();
  const [selectedAlarm, setSelectedAlarm] = useState(null);

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 알람 데이터
  const alarms = [
    { 
      id: 1, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '방금',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
    { 
      id: 2, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '방금',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
    { 
      id: 3, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '5분 전',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
    { 
      id: 4, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '10분 전',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
    { 
      id: 5, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '1시간 전',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
    { 
      id: 6, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '2시간 전',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
    { 
      id: 7, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '어제',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
    { 
      id: 8, 
      type: '세탁', 
      message: '오늘 9:20 세탁 예약이 있어요!', 
      time: '어제',
      detail: '세탁 예약이 확인되었습니다.\n\n예약 시간: 오늘 오전 9:20\n세탁실: 1층 세탁실\n기계 번호: 3번\n\n세탁이 완료되면 알림을 드리겠습니다.'
    },
  ];

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
          {alarms.map((alarm) => (
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
          ))}
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
