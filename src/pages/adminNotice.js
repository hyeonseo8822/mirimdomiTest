import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, ensureValidSession } from '../supabaseClient';
import './css/notice.css';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function AdminNotice() {
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


  // 날짜 포맷팅 함수
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
      await ensureValidSession();
      
      const { data, error } = await supabase
        .from('notice')
        .select('id, title, content, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('공지사항 가져오기 중 오류:', error);
        setNotices([]);
        return;
      }

      if (!data) {
        setNotices([]);
        return;
      }

      const formattedNotices = (data || []).map(notice => {
        const content = notice.content || '';
        const description = content.length > 50 ? content.substring(0, 50) + '...' : content;
        
        return {
          id: notice.id,
          title: notice.title || '(제목 없음)',
          date: formatDate(notice.created_at),
          description: description,
          content: content,
          author: '사감 선생님', // notice 테이블에 author 컬럼이 없으므로 기본값 사용
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

  // 공지사항을 날짜별로 섹션 구분
  const categorizeNotices = (notices) => {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const recent = notices.filter(notice => notice.createdAt >= oneMonthAgo);
    const lastMonth = notices.filter(notice => 
      notice.createdAt >= twoMonthsAgo && notice.createdAt < oneMonthAgo
    );
    const lastTwoMonths = notices.filter(notice => notice.createdAt < twoMonthsAgo);

    return { recent, lastMonth, lastTwoMonths };
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
          console.log('[DEBUG] AdminNotice.js: Realtime (notice) - 변경 감지', payload);
          fetchNotices();
        }
      )
      .subscribe();
    console.log('[DEBUG] AdminNotice.js: Realtime (notice) - 구독 시작');

    return () => {
      console.log('[DEBUG] AdminNotice.js: Realtime (notice) - 구독 해제');
      try { subscription.unsubscribe(); } catch (e) {}
    };
  }, []);

  const handleNoticeClick = (notice) => {
    setSelectedNotice(notice);
  };

  // 공지사항 섹션별 분류
  const { recent, lastMonth, lastTwoMonths } = categorizeNotices(notices);

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
            {/* 최근 */}
            {recent.length > 0 && (
              <div className="notice-section">
                <h3 className="notice-section-title">최근</h3>
                {recent.map((notice) => (
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
                          <p className="notice-description">{notice.description}</p>
                        </div>
                      </div>
                      <p className="notice-date-text">{notice.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 지난 한 달 */}
            {lastMonth.length > 0 && (
              <div className="notice-section">
                <h3 className="notice-section-title">지난 한 달</h3>
                {lastMonth.map((notice) => (
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
                          <p className="notice-description">{notice.description}</p>
                        </div>
                      </div>
                      <p className="notice-date-text">{notice.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 지난 두 달 */}
            {lastTwoMonths.length > 0 && (
              <div className="notice-section">
                <h3 className="notice-section-title">지난 두 달</h3>
                {lastTwoMonths.map((notice) => (
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
                          <p className="notice-description">{notice.description}</p>
                        </div>
                      </div>
                      <p className="notice-date-text">{notice.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {notices.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center' }}>공지사항이 없습니다.</div>
            )}
          </div>
        )}
      </div>

      {/* 공지사항 상세 */}
      <div className="notice-detail-container">
        <div className="notice-detail-header">
          <button 
            className="notice-write-button" 
            onClick={() => navigate('/notice/post')}
          >
            <span>+</span> 작성
          </button>
        </div>
        {selectedNotice && (
          <>
            <div className="notice-detail-title-section">
              <h2 className="notice-detail-title">{selectedNotice.title}</h2>
              <div className="notice-detail-meta">
                <p className="notice-detail-author">{selectedNotice.author}</p>
                <p className="notice-detail-date">{selectedNotice.date}</p>
              </div>
            </div>
            <div className="notice-detail-content">
              <p>{selectedNotice.content}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminNotice;

