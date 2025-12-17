import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/notice.css';
import { supabase, ensureValidSession } from '../supabaseClient';

// 로컬 이미지 경로
// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function Notice() {
  const navigate = useNavigate();
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // 공지사항 데이터 가져오기
  const fetchNotices = async () => {
    setLoading(true);
    try {
      // 세션 확인 및 갱신
      await ensureValidSession();
      
      const { data, error } = await supabase
        .from('notice')
        .select('id, title, content, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('공지사항 불러오기 실패:', error);
        setNotices([]);
        return;
      }

      if (!data) {
        setNotices([]);
        return;
      }

      // 데이터 포맷 변환
      const formattedNotices = (data || []).map(notice => {
        const content = notice.content || '';
        const description = content.length > 50 ? content.substring(0, 50) + '...' : content;
        
        return {
          id: notice.id,
          title: notice.title || '(제목 없음)',
          date: formatDate(notice.created_at),
          content: content,
          description: description,
          createdAt: notice.created_at ? new Date(notice.created_at) : new Date(),
        };
      });
      
      setNotices(formattedNotices);
    } catch (error) {
      console.error('공지사항 가져오기 중 오류:', error);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 공지사항 가져오기 및 실시간 구독
  useEffect(() => {
    fetchNotices();

    // 실시간 구독 설정
    const subscription = supabase
      .channel('notice_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notice',
        },
        (payload) => {
          console.log('[DEBUG] Notice.js: Realtime (notice) - 변경 감지', payload);
          fetchNotices();
        }
      )
      .subscribe();
    console.log('[DEBUG] Notice.js: Realtime (notice) - 구독 시작');

    return () => {
      console.log('[DEBUG] Notice.js: Realtime (notice) - 구독 해제');
      try { subscription.unsubscribe(); } catch (e) {}
    };
  }, []);

  const handleNoticeClick = (notice) => {
    setSelectedNotice(notice);
  };

  return (
    <div className="notice">
      <div className="notice-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <img src={arrowRightIcon} alt="뒤로가기" className="back-icon" />
        </button>
        <div className="notice-header-content">
          <h1 className="notice-title">공지사항</h1>
          <p className="notice-date">{getCurrentDate()}</p>
        </div>
      </div>

      <div className="notice-list-container">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>
        ) : (
          <div className="notice-list">
            {notices.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>공지사항이 없습니다.</div>
            ) : (
              notices.map((notice) => {
                console.log('공지사항 렌더링:', notice);
                const content = notice.content || '';
                const description = content.length > 50 ? content.substring(0, 50) + '...' : content;
                
                return (
                  <div 
                    key={notice.id} 
                    className="notice-item"
                    onClick={() => handleNoticeClick(notice)}
                  >
                    <div className="notice-item-content">
                      <div className="notice-content">
                        <div className="notice-dot"></div>
                        <div className="notice-text-content">
                          <p className="notice-title-text">{notice.title}</p>
                          {description && (
                            <p className="notice-description">{description}</p>
                          )}
                        </div>
                      </div>
                      <p className="notice-date-text">{notice.date}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 공지사항 상세 */}
      {selectedNotice && (
        <div className="notice-detail-container">
          <div className="notice-detail-header">
            <div className="notice-detail-title-section">
              <div className="notice-detail-title-row">
                <h2 className="notice-detail-title">{selectedNotice.title}</h2>
                <p className="notice-detail-date">{selectedNotice.date}</p>
              </div>
            </div>
          </div>
          <div className="notice-detail-content">
            <p>{selectedNotice.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notice;
