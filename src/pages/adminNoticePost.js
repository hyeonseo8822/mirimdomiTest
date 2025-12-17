import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, ensureValidSession } from '../supabaseClient';
import './css/notice.css';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function AdminNoticePost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 공지사항 게시
  const handlePost = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (!content.trim()) {
      alert('공지사항 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      await ensureValidSession();
      
      const insertData = {
        title: title.trim(),
        content: content.trim(),
      };
      
      // author 필드가 있는 경우에만 추가 (테이블에 컬럼이 없을 수 있음)
      // author 필드가 없어도 작동하도록 주석 처리
      // insertData.author = '사감 선생님';
      
      console.log('공지사항 저장 시도:', insertData);
      
      const { data, error } = await supabase
        .from('notice')
        .insert([insertData])
        .select();

      if (error) {
        console.error('공지사항 게시 오류 상세:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: JSON.stringify(error, null, 2),
        });
        
        // 현재 사용자 정보 확인
        const { data: { user } } = await supabase.auth.getUser();
        console.log('현재 로그인한 사용자:', user?.id);
        
        // users 테이블에서 현재 사용자 정보 확인
        if (user?.id) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email, name, role')
            .eq('id', user.id)
            .single();
          
          console.log('users 테이블에서 조회한 사용자 정보:', { userData, userError });
        }
        
        throw error;
      }
      
      console.log('공지사항 저장 성공:', data);
      
      // 모든 학생에게 알람 생성
      try {
        await ensureValidSession();
        
        // role이 'student'인 모든 사용자 조회
        const { data: students, error: studentsError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'student');
        
        if (studentsError) {
          console.error('학생 목록 조회 오류:', studentsError);
        } else if (students && students.length > 0) {
          // 각 학생에게 알람 생성
          const alarmData = students.map(student => ({
            user_id: String(student.id),
            type: '공지',
            message: `새로운 공지사항이 등록되었습니다: ${title.trim()}`,
            detail: `공지사항이 등록되었습니다.\n\n제목: ${title.trim()}\n\n내용을 확인해주세요.`,
            is_read: false,
          }));
          
          const { error: alarmError } = await supabase
            .from('alarm')
            .insert(alarmData);
          
          if (alarmError) {
            console.error('알람 생성 오류:', alarmError);
          } else {
            console.log(`${students.length}명의 학생에게 알람 생성 완료`);
          }
        }
      } catch (alarmErr) {
        console.error('알람 생성 중 오류:', alarmErr);
        // 알람 생성 실패해도 공지사항 게시는 성공으로 처리
      }
      
      alert('공지사항이 성공적으로 게시되었습니다.');
      navigate('/notice'); // 공지사항 목록으로 이동
    } catch (error) {
      console.error('공지사항 게시 중 오류:', error);
      const errorMessage = error.message || error.details || '알 수 없는 오류';
      alert('공지사항 게시 중 오류가 발생했습니다: ' + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="notice">
      <div className="notice-header notice-post-header">
        <button className="back-button" onClick={() => navigate('/notice')}>
          <img src={arrowRightIcon} alt="뒤로가기" className="back-icon" />
        </button>
        <div className="notice-header-content">
          <h1 className="notice-title">공지사항 작성</h1>
          <p className="notice-date">{getCurrentDate()}</p>
        </div>
        <button 
          className="notice-post-button" 
          onClick={handlePost}
          disabled={isSubmitting}
        >
          <span>+</span> 게시
        </button>
      </div>

      <div className="notice-post-container">
        <div className="notice-post-form">
          <input
            type="text"
            className="notice-post-title-input"
            placeholder="제목을 작성해주세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="notice-post-content-input"
            placeholder="공지사항을 작성해주세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
          />
        </div>
      </div>
    </div>
  );
}

export default AdminNoticePost;

