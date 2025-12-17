import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, ensureValidSession } from '../supabaseClient';
import './css/main.css';

function AdminStudentInfo({ userInfo }) {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('학생 정보');
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 규정 위반 관련 상태
  const [violations, setViolations] = useState([]);
  const [filteredViolations, setFilteredViolations] = useState([]);
  const [violationsLoading, setViolationsLoading] = useState(true);
  const [selectedViolations, setSelectedViolations] = useState(new Set());

  // 필터 상태
  const [searchName, setSearchName] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedMajor, setSelectedMajor] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);

  // 상벌점 관리 모달 상태
  const [showPointModal, setShowPointModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [pointType, setPointType] = useState('merits'); // 'merits' or 'demerits'
  const [pointAmount, setPointAmount] = useState('');
  const [pointReason, setPointReason] = useState(''); // 상벌점 부여 이유

  // 현재 날짜 포맷팅 (렌더링용)
  const getCurrentDate = () => {
    return getCurrentDateMemo();
  };

  // 학번에서 학년과 반 추출 (예: 2501 → 2학년 5반)
  const getGradeAndClass = useCallback((studentId) => {
    if (!studentId || studentId.length < 2) {
      return { grade: null, class: null };
    }
    const grade = parseInt(studentId[0]); // 첫 번째 자리: 학년
    const classNum = parseInt(studentId[1]); // 두 번째 자리: 반
    return { grade, class: classNum };
  }, []);

  // 주소에서 지역 분류
  const getRegionCategory = useCallback((address) => {
    if (!address) return '지방';
    const seoulGyeonggi = ['서울', '경기', '인천'];
    const isSeoulGyeonggi = seoulGyeonggi.some(region => address.includes(region));
    return isSeoulGyeonggi ? '서울/경기' : '지방';
  }, []);

  // 현재 날짜 포맷팅 (useCallback으로 감싸서 안정화)
  const getCurrentDateMemo = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }, []);

  // 학생 데이터 가져오기
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      await ensureValidSession();
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, room_number, student_id, address, profile_image, merits, demerits')
        .eq('role', 'student')
        .not('student_id', 'is', null)
        .order('student_id', { ascending: true });

      if (error) {
        console.error('학생 정보 가져오기 중 오류:', error);
        setStudents([]);
        setFilteredStudents([]);
        return;
      }

      const formattedStudents = (data || []).map(user => {
        const { grade, class: classNum } = getGradeAndClass(user.student_id);
        const addressParts = user.address ? user.address.split('|') : [];
        const fullAddress = addressParts[1] || addressParts[0] || user.address || '';
        const region = getRegionCategory(fullAddress);
        
        // 주소에서 학과 추출 (실제로는 별도 필드가 필요할 수 있음)
        // 임시로 주소에 포함된 정보로 판단하거나, 기본값 사용
        const major = '개발과'; // TODO: users 테이블에 major 필드 추가 필요
        
        return {
          id: user.id,
          name: user.name || '이름 없음',
          roomNumber: user.room_number ? `${user.room_number}호` : '호실 없음',
          studentId: user.student_id,
          grade: grade || null,
          class: classNum || null,
          major: major,
          region: region,
          address: fullAddress,
          profileImage: user.profile_image,
        };
      });
      
      setStudents(formattedStudents);
      setFilteredStudents(formattedStudents);
    } catch (error) {
      console.error('학생 정보 가져오기 중 오류:', error);
      setStudents([]);
      setFilteredStudents([]);
    } finally {
      setLoading(false);
    }
  }, [getGradeAndClass, getRegionCategory]); // getGradeAndClass와 getRegionCategory는 useCallback으로 안정화됨

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // 필터 적용
  useEffect(() => {
    let filtered = [...students];

    // 이름 검색
    if (searchName.trim()) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // 학년 필터
    if (selectedGrade !== null) {
      filtered = filtered.filter(student => student.grade === selectedGrade);
    }

    // 반 필터
    if (selectedClass !== null) {
      filtered = filtered.filter(student => student.class === selectedClass);
    }

    // 학과 필터
    if (selectedMajor) {
      filtered = filtered.filter(student => student.major === selectedMajor);
    }

    // 지역 필터
    if (selectedRegion) {
      filtered = filtered.filter(student => student.region === selectedRegion);
    }

    setFilteredStudents(filtered);
  }, [students, searchName, selectedGrade, selectedClass, selectedMajor, selectedRegion]);

  // 규정 위반 데이터 가져오기 (points_history에서 벌점 이력 가져오기)
  const fetchViolations = useCallback(async () => {
    setViolationsLoading(true);
    try {
      await ensureValidSession();
      
      // points_history 테이블에서 벌점 이력 가져오기 (users 테이블과 조인)
      const { data, error } = await supabase
        .from('points_history')
        .select(`
          id,
          user_id,
          points,
          reason,
          created_at,
          created_by,
          users:user_id (
            id,
            name,
            room_number,
            student_id,
            address,
            profile_image
          )
        `)
        .eq('type', 'demerits')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('규정 위반 가져오기 중 오류:', error);
        setViolations([]);
        setFilteredViolations([]);
        return;
      }

      const formattedViolations = (data || []).map(history => {
        const user = history.users || {};
        const { grade, class: classNum } = getGradeAndClass(user.student_id);
        const addressParts = user.address ? user.address.split('|') : [];
        const fullAddress = addressParts[1] || addressParts[0] || user.address || '';
        const region = getRegionCategory(fullAddress);
        const major = '개발과'; // TODO: users 테이블에 major 필드 추가 필요
        
        // 날짜 포맷팅
        const violationDate = history.created_at 
          ? new Date(history.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\./g, '.').replace(/\s/g, '')
          : getCurrentDateMemo();
        
        return {
          id: history.id, // points_history의 id 사용
          userId: user.id, // users 테이블의 id (모달용)
          studentId: user.student_id,
          name: user.name || '이름 없음',
          roomNumber: user.room_number ? String(user.room_number) : '401',
          profileImage: user.profile_image,
          grade: grade || null,
          class: classNum || null,
          major: major,
          region: region,
          address: fullAddress,
          violationDate: violationDate,
          violationDescription: `벌점 ${history.points || 0}점 - ${history.reason || '사유 없음'}`,
          points: history.points || 0,
          reason: history.reason || '',
          createdBy: history.created_by || '',
        };
      });
      
      setViolations(formattedViolations);
      setFilteredViolations(formattedViolations);
    } catch (error) {
      console.error('규정 위반 가져오기 중 오류:', error);
      setViolations([]);
      setFilteredViolations([]);
    } finally {
      setViolationsLoading(false);
    }
  }, [getGradeAndClass, getRegionCategory, getCurrentDateMemo]); // 모든 함수가 useCallback으로 안정화됨

  useEffect(() => {
    if (selectedTab === '규정 위반') {
      fetchViolations();
    }
  }, [selectedTab, fetchViolations]);

  // 규정 위반 필터 적용
  useEffect(() => {
    if (selectedTab !== '규정 위반') return;

    let filtered = [...violations];

    // 이름 검색
    if (searchName.trim()) {
      filtered = filtered.filter(violation =>
        violation.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // 학년 필터
    if (selectedGrade !== null) {
      filtered = filtered.filter(violation => violation.grade === selectedGrade);
    }

    // 반 필터
    if (selectedClass !== null) {
      filtered = filtered.filter(violation => violation.class === selectedClass);
    }

    // 학과 필터
    if (selectedMajor) {
      filtered = filtered.filter(violation => violation.major === selectedMajor);
    }

    // 지역 필터
    if (selectedRegion) {
      filtered = filtered.filter(violation => violation.region === selectedRegion);
    }

    setFilteredViolations(filtered);
  }, [violations, selectedTab, searchName, selectedGrade, selectedClass, selectedMajor, selectedRegion]);

  // 체크박스 선택/해제 (points_history의 id 사용)
  const handleViolationCheck = (violationId) => {
    setSelectedViolations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(violationId)) {
        newSet.delete(violationId);
      } else {
        newSet.add(violationId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedViolations.size === filteredViolations.length) {
      setSelectedViolations(new Set());
    } else {
      setSelectedViolations(new Set(filteredViolations.map(v => v.id)));
    }
  };

  // 엑셀 다운로드
  const handleExcelDownload = () => {
    const dataToExport = filteredViolations.map(v => ({
      이름: v.name,
      호실: v.roomNumber,
      학번: v.studentId,
      위반일자: v.violationDate,
      벌점: `${v.points}점`,
      위반내용: v.reason || '사유 없음',
      부여자: v.createdBy || '',
    }));

    // CSV 형식으로 변환
    const headers = Object.keys(dataToExport[0] || {});
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => headers.map(header => row[header] || '').join(','))
    ].join('\n');

    // BOM 추가 (한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `규정위반_${getCurrentDate().replace(/\./g, '')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setSearchName('');
    setSelectedGrade(null);
    setSelectedClass(null);
    setSelectedMajor(null);
    setSelectedRegion(null);
  };

  // 학생 클릭 시 상벌점 관리 모달 열기
  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setPointType('merits');
    setPointAmount('');
    setPointReason('');
    setShowPointModal(true);
  };

  // 상벌점 모달 닫기
  const handleClosePointModal = () => {
    setShowPointModal(false);
    setSelectedStudent(null);
    setPointType('merits');
    setPointAmount('');
    setPointReason('');
  };

  // 상벌점 업데이트
  const handleUpdatePoints = async () => {
    if (!selectedStudent || !pointAmount || isNaN(pointAmount) || parseInt(pointAmount) <= 0) {
      alert('올바른 점수를 입력해주세요.');
      return;
    }

    if (!pointReason || pointReason.trim() === '') {
      alert('상벌점 부여 이유를 입력해주세요.');
      return;
    }

    const points = parseInt(pointAmount);
    const isMerits = pointType === 'merits';
    const reason = pointReason.trim();

    try {
      await ensureValidSession();

      // 현재 관리자 정보 조회 (이름만 사용)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        throw new Error('관리자 정보를 찾을 수 없습니다.');
      }
      
      // 관리자 이름 가져오기
      const { data: adminUserData } = await supabase
        .from('users')
        .select('name')
        .eq('id', String(authUser.id))
        .maybeSingle();
      
      const adminName = adminUserData?.name || userInfo?.name || '관리자';
      const createdAt = new Date().toISOString();

      // 현재 상벌점 조회
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('merits, demerits')
        .eq('id', selectedStudent.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // 새로운 상벌점 계산 (합산)
      const currentMerits = currentUser.merits || 0;
      const currentDemerits = currentUser.demerits || 0;
      
      const updateData = {};
      if (isMerits) {
        updateData.merits = currentMerits + points;
      } else {
        updateData.demerits = currentDemerits + points;
      }

      // users 테이블 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', selectedStudent.id);

      if (updateError) {
        throw updateError;
      }

      // points_history 테이블에 이력 저장
      await ensureValidSession();
      
      console.log('[상벌점 이력 저장] 시도:', {
        user_id: String(selectedStudent.id),
        type: pointType,
        points: points,
        reason: reason,
        created_by: adminName,
        created_at: createdAt,
      });
      
      const { data: historyData, error: historyError } = await supabase
        .from('points_history')
        .insert([
          {
            user_id: String(selectedStudent.id),
            type: pointType,
            points: points,
            reason: reason,
            created_by: `${adminName} (${createdAt})`, // 관리자 이름과 시간 저장
          },
        ])
        .select();

      if (historyError) {
        console.error('[상벌점 이력 저장 오류] 상세:', {
          error: historyError,
          message: historyError.message,
          details: historyError.details,
          hint: historyError.hint,
          code: historyError.code,
          statusCode: historyError.statusCode,
        });
        console.error('[상벌점 이력 저장 오류] 입력 데이터:', {
          user_id: String(selectedStudent.id),
          type: pointType,
          points: points,
          reason: reason,
          created_by: `${adminName} (${createdAt})`,
        });
        
        // 409 에러는 외래 키 제약 조건 문제일 수 있음
        if (historyError.code === '23503' || historyError.statusCode === 409) {
          console.error('[상벌점 이력 저장 오류] 외래 키 제약 조건 문제 가능성');
          // user_id가 users 테이블에 존재하는지 확인
          const { data: checkUser, error: checkUserError } = await supabase
            .from('users')
            .select('id')
            .eq('id', String(selectedStudent.id))
            .maybeSingle();
          
          console.error('[상벌점 이력 저장 오류] 사용자 확인:', {
            studentExists: !!checkUser,
            studentId: String(selectedStudent.id),
            checkUserError,
          });
        }
        
        // 이력 저장 실패해도 상벌점 업데이트는 성공으로 처리하되, 사용자에게 알림
        alert(`상벌점은 부여되었지만 이력 저장에 실패했습니다.\n오류: ${historyError.message || '알 수 없는 오류'}\n\n콘솔을 확인해주세요.`);
      } else {
        console.log('[상벌점 이력 저장 성공]', historyData);
      }

      // 해당 학생에게 알람 생성
      const alarmMessage = isMerits 
        ? `상점 ${points}점이 부여되었습니다.`
        : `벌점 ${points}점이 부여되었습니다.`;
      
      const alarmDetail = isMerits
        ? `상점 ${points}점이 부여되었습니다.\n\n사유: ${reason}\n\n현재 상점: ${currentMerits + points}점\n현재 벌점: ${currentDemerits}점`
        : `벌점 ${points}점이 부여되었습니다.\n\n사유: ${reason}\n\n현재 상점: ${currentMerits}점\n현재 벌점: ${currentDemerits + points}점`;

      const alarmData = {
        user_id: String(selectedStudent.id),
        type: isMerits ? '상점' : '벌점',
        message: alarmMessage,
        detail: alarmDetail,
        is_read: false,
      };

      await ensureValidSession();
      const { error: alarmError } = await supabase
        .from('alarm')
        .insert([alarmData]);

      if (alarmError) {
        console.error('알람 생성 오류:', alarmError);
        // 알람 생성 실패해도 상벌점 업데이트는 성공으로 처리
      }

      alert(`${isMerits ? '상점' : '벌점'} ${points}점이 성공적으로 부여되었습니다.`);
      
      // 학생 목록 새로고침
      await fetchStudents();
      if (selectedTab === '규정 위반') {
        await fetchViolations();
      }
      
      handleClosePointModal();
    } catch (error) {
      console.error('상벌점 업데이트 오류:', error);
      alert(`${isMerits ? '상점' : '벌점'} 업데이트 중 오류가 발생했습니다:\n` + (error.message || error));
    }
  };

  return (
    <div className="student-info">
      <div className="student-info-header">
        <h1 className="student-info-title">{selectedTab === '학생 정보' ? '학생 정보' : '규정 위반'}</h1>
        <p className="student-info-date">{getCurrentDate()}</p>
      </div>

      {/* 탭 */}
      <div className="student-info-tabs">
        <button
          className={`student-info-tab ${selectedTab === '학생 정보' ? 'active' : ''}`}
          onClick={() => setSelectedTab('학생 정보')}
        >
          학생 정보
        </button>
        <button
          className={`student-info-tab ${selectedTab === '규정 위반' ? 'active' : ''}`}
          onClick={() => setSelectedTab('규정 위반')}
        >
          규정 위반
        </button>
      </div>

      {selectedTab === '학생 정보' ? (
        <div className="student-info-content">
          {/* 메인 콘텐츠 영역 */}
          <div className="student-info-main">
            <div className="student-count">
              학생 {filteredStudents.length}명
            </div>

            {/* 학생 목록 */}
            <div className="student-list-container">
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>
              ) : filteredStudents.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>학생 정보가 없습니다.</div>
              ) : (
                <div className="student-list">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="student-item">
                      <div 
                        className="student-avatar"
                        style={student.profileImage ? {
                          backgroundImage: `url(${student.profileImage})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        } : {}}
                      ></div>
                      <div className="student-details">
                        <p 
                          className="student-name" 
                          onClick={() => handleStudentClick(student)}
                          style={{ cursor: 'pointer', fontWeight: 'bold' }}
                          title="클릭하여 상벌점 관리"
                        >
                          {student.name}
                        </p>
                        <p className="student-room">{student.roomNumber}</p>
                        <p className="student-id">{student.studentId}</p>
                        <p className="student-major">{student.major}</p>
                      </div>
                      <button className={`student-region-btn ${student.region === '서울/경기' ? 'seoul' : 'local'}`}>
                        {student.region === '서울/경기' ? '서울/경기' : '지방'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 필터 패널 */}
          <div className="student-info-filter">
            <div className="filter-header">
              <h3 className="filter-title">필터</h3>
              <button className="filter-reset-btn" onClick={handleResetFilters}>
                초기화
              </button>
            </div>

            {/* 이름 검색 */}
            <div className="filter-section">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="이름을 입력해주세요"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
                <img src="/img/Vector.svg" alt="검색" className="search-icon" />
              </div>
            </div>

            {/* 학년 필터 */}
            <div className="filter-section">
              <label className="filter-label">학년</label>
              <div className="filter-buttons">
                {[1, 2, 3].map((grade) => (
                  <button
                    key={grade}
                    className={`filter-btn ${selectedGrade === grade ? 'active' : ''}`}
                    onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* 반 필터 */}
            <div className="filter-section">
              <label className="filter-label">반</label>
              <div className="filter-buttons">
                {[1, 2, 3, 4, 5, 6].map((classNum) => (
                  <button
                    key={classNum}
                    className={`filter-btn ${selectedClass === classNum ? 'active' : ''}`}
                    onClick={() => setSelectedClass(selectedClass === classNum ? null : classNum)}
                  >
                    {classNum}
                  </button>
                ))}
              </div>
            </div>

            {/* 학과 필터 */}
            <div className="filter-section">
              <label className="filter-label">학과</label>
              <div className="filter-buttons">
                {['디자인과', '개발과'].map((major) => (
                  <button
                    key={major}
                    className={`filter-btn ${selectedMajor === major ? 'active' : ''}`}
                    onClick={() => setSelectedMajor(selectedMajor === major ? null : major)}
                  >
                    {major}
                  </button>
                ))}
              </div>
            </div>

            {/* 지역 필터 */}
            <div className="filter-section">
              <label className="filter-label">지역</label>
              <div className="filter-buttons">
                {['서울/경기', '지방'].map((region) => (
                  <button
                    key={region}
                    className={`filter-btn ${selectedRegion === region ? 'active' : ''}`}
                    onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="violation-tab-content">
          <div className="violation-main">
            <div className="student-count">
              벌점 이력 {filteredViolations.length}건
            </div>

            {/* 위반 목록 */}
            <div className="violation-list-container">
              {violationsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>
              ) : filteredViolations.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>규정 위반 내역이 없습니다.</div>
              ) : (
                <div className="violation-list">
                  {filteredViolations.map((violation) => {
                    // 규정 위반 항목을 학생 정보 형식으로 변환
                    const studentForModal = {
                      id: violation.userId || violation.id, // users 테이블의 id 사용
                      name: violation.name,
                      studentId: violation.studentId,
                      roomNumber: violation.roomNumber,
                    };
                    
                    return (
                      <div 
                        key={violation.id} 
                        className="violation-item"
                        onClick={() => handleViolationCheck(violation.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          className="violation-checkbox"
                          checked={selectedViolations.has(violation.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleViolationCheck(violation.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div 
                          className="violation-avatar"
                          style={violation.profileImage ? {
                            backgroundImage: `url(${violation.profileImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          } : {}}
                          onClick={(e) => e.stopPropagation()}
                        ></div>
                        <div className="violation-details">
                          <p 
                            className="violation-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStudentClick(studentForModal);
                            }}
                            style={{ cursor: 'pointer', fontWeight: 'bold' }}
                            title="클릭하여 상벌점 관리"
                          >
                            {violation.name}
                          </p>
                          <p className="violation-room">{violation.roomNumber}</p>
                          <p className="violation-id">{violation.studentId}</p>
                          <p className="violation-major">{violation.major}</p>
                          <div className="violation-description">
                            <span className="violation-text">
                              {violation.violationDate} - 벌점 {violation.points}점: {violation.reason}
                            </span>
                            <span className="violation-info-icon">ℹ️</span>
                          </div>
                        </div>
                        <button 
                          className="violation-add-btn" 
                          title="상벌점 관리"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStudentClick(studentForModal);
                          }}
                        >
                          <span>+</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 필터 패널 */}
          <div className="student-info-filter">
            <div className="filter-header">
              <h3 className="filter-title">필터</h3>
              <button className="filter-reset-btn" onClick={handleResetFilters}>
                초기화
              </button>
            </div>

            {/* 이름 검색 */}
            <div className="filter-section">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder="이름을 입력해주세요"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
                <img src="/img/Vector.svg" alt="검색" className="search-icon" />
              </div>
            </div>

            {/* 학년 필터 */}
            <div className="filter-section">
              <label className="filter-label">학년</label>
              <div className="filter-buttons">
                {[1, 2, 3].map((grade) => (
                  <button
                    key={grade}
                    className={`filter-btn ${selectedGrade === grade ? 'active' : ''}`}
                    onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* 반 필터 */}
            <div className="filter-section">
              <label className="filter-label">반</label>
              <div className="filter-buttons">
                {[1, 2, 3, 4, 5, 6].map((classNum) => (
                  <button
                    key={classNum}
                    className={`filter-btn ${selectedClass === classNum ? 'active' : ''}`}
                    onClick={() => setSelectedClass(selectedClass === classNum ? null : classNum)}
                  >
                    {classNum}
                  </button>
                ))}
              </div>
            </div>

            {/* 학과 필터 */}
            <div className="filter-section">
              <label className="filter-label">학과</label>
              <div className="filter-buttons">
                {['디자인과', '개발과'].map((major) => (
                  <button
                    key={major}
                    className={`filter-btn ${selectedMajor === major ? 'active' : ''}`}
                    onClick={() => setSelectedMajor(selectedMajor === major ? null : major)}
                  >
                    {major}
                  </button>
                ))}
              </div>
            </div>

            {/* 지역 필터 */}
            <div className="filter-section">
              <label className="filter-label">지역</label>
              <div className="filter-buttons">
                {['서울/경기', '지방'].map((region) => (
                  <button
                    key={region}
                    className={`filter-btn ${selectedRegion === region ? 'active' : ''}`}
                    onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* 내보내기 섹션 */}
            <div className="filter-section">
              <label className="filter-label">내보내기</label>
              <button className="excel-download-btn" onClick={handleExcelDownload}>
                엑셀 다운로드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상벌점 관리 모달 */}
      {showPointModal && selectedStudent && (
        <div 
          className="point-modal-overlay" 
          onClick={handleClosePointModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div 
            className="point-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '32px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '24px', fontWeight: 'bold' }}>
              상벌점 관리
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '8px 0', fontSize: '16px' }}>
                <strong>학생:</strong> {selectedStudent.name}
              </p>
              <p style={{ margin: '8px 0', fontSize: '16px' }}>
                <strong>학번:</strong> {selectedStudent.studentId}
              </p>
              <p style={{ margin: '8px 0', fontSize: '16px' }}>
                <strong>호실:</strong> {selectedStudent.roomNumber}
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '16px', fontWeight: '500' }}>
                유형 선택
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setPointType('merits')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid',
                    borderColor: pointType === 'merits' ? '#007bff' : '#ddd',
                    backgroundColor: pointType === 'merits' ? '#e7f3ff' : 'white',
                    color: pointType === 'merits' ? '#007bff' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: pointType === 'merits' ? 'bold' : 'normal',
                  }}
                >
                  상점
                </button>
                <button
                  onClick={() => setPointType('demerits')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid',
                    borderColor: pointType === 'demerits' ? '#dc3545' : '#ddd',
                    backgroundColor: pointType === 'demerits' ? '#ffe7e7' : 'white',
                    color: pointType === 'demerits' ? '#dc3545' : '#333',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: pointType === 'demerits' ? 'bold' : 'normal',
                  }}
                >
                  벌점
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '500' }}>
                점수 입력 <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                value={pointAmount}
                onChange={(e) => setPointAmount(e.target.value)}
                placeholder="점수를 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '500' }}>
                부여 이유 <span style={{ color: 'red' }}>*</span>
              </label>
              <textarea
                value={pointReason}
                onChange={(e) => setPointReason(e.target.value)}
                placeholder="상벌점 부여 이유를 입력하세요"
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleClosePointModal}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid #ddd',
                  backgroundColor: 'white',
                  color: '#333',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleUpdatePoints}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  border: 'none',
                  backgroundColor: pointType === 'merits' ? '#007bff' : '#dc3545',
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminStudentInfo;

