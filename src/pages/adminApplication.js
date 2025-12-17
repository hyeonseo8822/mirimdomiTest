import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, ensureValidSession } from '../supabaseClient';
import './css/application.css';

function AdminApplication({ userInfo }) {
  const navigate = useNavigate();
  const [selectedMainTab, setSelectedMainTab] = useState('외박/잔류');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 현재 날짜 정보
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // 이번 주 토요일 계산 (useMemo로 메모이제이션)
  const thisWeekSaturday = useMemo(() => {
    const todayDayOfWeek = today.getDay(); // 0(일)~6(토)
    const diffToSaturday = 6 - todayDayOfWeek;
    const saturdayDateObj = new Date(currentYear, currentMonth - 1, currentDay + diffToSaturday);
    return saturdayDateObj;
  }, [currentYear, currentMonth, currentDay]);

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const year = currentYear;
    const month = String(currentMonth).padStart(2, '0');
    const day = String(currentDay).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 요일 이름 가져오기
  const getDayName = (date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  };

  // 외박/잔류 신청 데이터 가져오기 (이번 주 토요일만)
  const fetchLeaveApplications = useCallback(async () => {
    setLoading(true);
    try {
      await ensureValidSession();
      
      // 이번 주 토요일 계산 (함수 내부에서 직접 계산)
      const todayDayOfWeek = today.getDay(); // 0(일)~6(토)
      const diffToSaturday = 6 - todayDayOfWeek;
      const saturdayDateObj = new Date(currentYear, currentMonth - 1, currentDay + diffToSaturday);
      const saturdayDateStr = `${saturdayDateObj.getFullYear()}-${String(saturdayDateObj.getMonth() + 1).padStart(2, '0')}-${String(saturdayDateObj.getDate()).padStart(2, '0')}`;
      
      const { data, error } = await supabase
        .from('temporary_leave')
        .select(`
          id,
          type,
          date,
          status,
          student_id,
          users:student_id (
            name,
            room_number,
            address
          )
        `)
        .eq('date', saturdayDateStr)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('외박/잔류 신청 가져오기 중 오류:', error);
        setApplications([]);
        return;
      }

      const formattedApplications = (data || []).map(app => {
        const user = app.users || {};
        const addressParts = user.address ? user.address.split('|') : [];
        return {
          id: app.id,
          name: user.name || '이름 없음',
          roomNumber: user.room_number ? `${user.room_number}호` : '호실 없음',
          address: addressParts[1] || addressParts[0] || user.address || '주소 없음',
          type: app.type === 'out' ? '외박' : '잔류',
          date: app.date,
          status: app.status,
          student_id: app.student_id,
        };
      });
      
      setApplications(formattedApplications);
    } catch (error) {
      console.error('외박/잔류 신청 가져오기 중 오류:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, currentDay]);

  // 외출 신청 데이터 가져오기 (모든 날짜의 신청)
  const fetchExitApplications = useCallback(async () => {
    setLoading(true);
    try {
      await ensureValidSession();
      
      // 날짜 필터 없이 모든 pending 외출 신청 가져오기
      const { data, error } = await supabase
        .from('temporary_exit')
        .select(`
          id,
          reason,
          date,
          status,
          student_id,
          users:student_id (
            name,
            room_number,
            address
          )
        `)
        .eq('status', 'pending')
        .order('date', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('외출 신청 가져오기 중 오류:', error);
        setApplications([]);
        return;
      }

      const formattedApplications = (data || []).map(app => {
        const user = app.users || {};
        const addressParts = user.address ? user.address.split('|') : [];
        // 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
        const dateParts = app.date ? app.date.split('-') : [];
        const formattedDate = dateParts.length === 3 
          ? `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}`
          : app.date;
        
        return {
          id: app.id,
          name: user.name || '이름 없음',
          roomNumber: user.room_number ? `${user.room_number}호` : '호실 없음',
          address: addressParts[1] || addressParts[0] || user.address || '주소 없음',
          reason: app.reason || '사유 없음',
          date: formattedDate,
          dateRaw: app.date, // 원본 날짜 (정렬용)
          status: app.status,
          student_id: app.student_id,
        };
      });
      
      setApplications(formattedApplications);
    } catch (error) {
      console.error('외출 신청 가져오기 중 오류:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 외출 신청 승인 처리
  const handleApproveExit = async (applicationId) => {
    if (!window.confirm('이 외출 신청을 승인하시겠습니까?')) {
      return;
    }

    try {
      await ensureValidSession();
      
      // 먼저 신청 정보 가져오기 (학생 정보 포함)
      const { data: applicationData, error: fetchError } = await supabase
        .from('temporary_exit')
        .select(`
          id,
          date,
          reason,
          student_id,
          users:student_id (
            id,
            name
          )
        `)
        .eq('id', applicationId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!applicationData) {
        throw new Error('신청 정보를 찾을 수 없습니다.');
      }

      // 승인 상태로 업데이트
      const { error: updateError } = await supabase
        .from('temporary_exit')
        .update({ status: 'approved' })
        .eq('id', applicationId);

      if (updateError) {
        throw updateError;
      }

      // 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
      const dateParts = applicationData.date ? applicationData.date.split('-') : [];
      const formattedDate = dateParts.length === 3 
        ? `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}`
        : applicationData.date;

      const studentName = applicationData.users?.name || '학생';
      const studentUserId = applicationData.users?.id; // users 테이블의 id (실제 user_id)
      const reason = applicationData.reason || '사유 없음';

      // 알람 생성 (학생과 관리자 모두)
      try {
        await ensureValidSession();
        
        const alarmData = [];
        
        // 학생에게 알람 생성
        if (studentUserId) {
          alarmData.push({
            user_id: String(studentUserId), // users 테이블의 id 사용
            type: '외출',
            message: `외출 신청이 승인되었습니다.`,
            detail: `외출 신청이 승인되었습니다.\n\n날짜: ${formattedDate}\n사유: ${reason}\n\n외출 시 주의사항을 준수해주세요.`,
            is_read: false,
          });
        }

        // 관리자에게 알람 생성 (학생 이름 포함)
        if (userInfo?.id) {
          alarmData.push({
            user_id: String(userInfo.id),
            type: '외출',
            message: `외출 신청이 승인되었습니다: ${studentName}`,
            detail: `외출 신청이 승인되었습니다.\n\n학생: ${studentName}\n날짜: ${formattedDate}\n사유: ${reason}`,
            is_read: false,
          });
        }

        if (alarmData.length > 0) {
          const { error: alarmError } = await supabase
            .from('alarm')
            .insert(alarmData);

          if (alarmError) {
            console.error('알람 생성 오류:', alarmError);
            // 알람 생성 실패해도 승인은 성공으로 처리
          } else {
            console.log('알람 생성 완료:', alarmData.length, '개');
          }
        }
      } catch (alarmErr) {
        console.error('알람 생성 중 오류:', alarmErr);
        // 알람 생성 실패해도 승인은 성공으로 처리
      }

      // 목록에서 제거
      setApplications(prev => prev.filter(app => app.id !== applicationId));
      alert('외출 신청이 승인되었습니다.');
    } catch (error) {
      console.error('외출 신청 승인 중 오류:', error);
      alert('승인 처리 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  };

  // 탭 변경 시 데이터 가져오기
  useEffect(() => {
    if (selectedMainTab === '외박/잔류') {
      fetchLeaveApplications();
    } else {
      fetchExitApplications();
    }
  }, [selectedMainTab, fetchLeaveApplications, fetchExitApplications]);

  return (
    <div className="application">
      <div className="application-header">
        <h1 className="application-title">신청 관리</h1>
        <p className="application-date">{getCurrentDate()}</p>
      </div>

      {/* 날짜 네비게이션 (외박/잔류일 때만 이번 주 토요일 표시) */}
      {selectedMainTab === '외박/잔류' && (
        <div className="date-navigation">
          <span className="date-display">
            {thisWeekSaturday.getFullYear()}.{String(thisWeekSaturday.getMonth() + 1).padStart(2, '0')}.{String(thisWeekSaturday.getDate()).padStart(2, '0')} {getDayName(thisWeekSaturday)}
          </span>
        </div>
      )}

      {/* 상단 탭 */}
      <div className="main-tabs">
        <button
          className={`main-tab ${selectedMainTab === '외박/잔류' ? 'active' : ''}`}
          onClick={() => setSelectedMainTab('외박/잔류')}
        >
          외박/잔류
        </button>
        <button
          className={`main-tab ${selectedMainTab === '외출' ? 'active' : ''}`}
          onClick={() => setSelectedMainTab('외출')}
        >
          외출
        </button>
      </div>

      {/* 신청 목록 */}
      <div className="application-list-container">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>
        ) : applications.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>신청 내역이 없습니다.</div>
        ) : (
          <div className="application-list">
            {selectedMainTab === '외출' ? (
              // 외출: 날짜별로 그룹화하여 표시
              (() => {
                const groupedByDate = {};
                applications.forEach(app => {
                  if (!groupedByDate[app.dateRaw]) {
                    groupedByDate[app.dateRaw] = [];
                  }
                  groupedByDate[app.dateRaw].push(app);
                });
                
                const sortedDates = Object.keys(groupedByDate).sort();
                
                return sortedDates.map(dateKey => (
                  <div key={dateKey} style={{ marginBottom: '24px' }}>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: '500', 
                      marginBottom: '12px',
                      color: '#212121'
                    }}>
                      {groupedByDate[dateKey][0].date}
                    </h3>
                    {groupedByDate[dateKey].map((app) => (
                      <div key={app.id} className="application-list-item">
                        <div className="application-avatar"></div>
                        <div className="application-info">
                          <p className="application-name">{app.name}</p>
                          <p className="application-room">{app.roomNumber}</p>
                          <p className="application-address">{app.address}</p>
                          {app.reason && (
                            <p className="application-reason">{app.reason}</p>
                          )}
                        </div>
                        <button 
                          className="application-check-btn"
                          onClick={() => handleApproveExit(app.id)}
                          title="승인"
                        >
                          <img src="/img/check-icon.svg" alt="승인" />
                        </button>
                      </div>
                    ))}
                  </div>
                ));
              })()
            ) : (
              // 외박/잔류: 일반 목록
              applications.map((app) => (
                <div key={app.id} className="application-list-item">
                  <div className="application-avatar"></div>
                  <div className="application-info">
                    <p className="application-name">{app.name}</p>
                    <p className="application-room">{app.roomNumber}</p>
                    <p className="application-address">{app.address}</p>
                  </div>
                  <button className={`application-status-btn ${app.type === '외박' ? 'out' : 'stay'}`}>
                    {app.type}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminApplication;

