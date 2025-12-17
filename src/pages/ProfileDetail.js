import React, { useState, useRef, useEffect } from 'react';
import { supabase, ensureValidSession } from '../supabaseClient';
import './css/profiledetail.css';

function ProfileDetail({ userInfo, onUserInfoUpdate, onUserProfileUpdate }) {
  const handleUserUpdate = onUserProfileUpdate || onUserInfoUpdate;
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}.${month}.${day}`;

  const [profileImage, setProfileImage] = useState('');
  const [points, setPoints] = useState({ merits: 0, demerits: 0 });
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({
    name: '',
    room_number: '',
    student_id: '',
  });

  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const roomNumberInputRef = useRef(null);
  const studentIdInputRef = useRef(null);
  const editIconPath = process.env.PUBLIC_URL + '/img/edit.svg';


  // 사용자 정보가 변경될 때마다 상태 업데이트
  useEffect(() => {
    if (userInfo) {
      // null/undefined 안전하게 처리
      setPoints({
        merits: userInfo.merits != null ? Number(userInfo.merits) : 0,
        demerits: userInfo.demerits != null ? Number(userInfo.demerits) : 0,
      });
      // 빈 문자열 체크 추가
      const imageUrl = userInfo.profile_image?.trim();
      setProfileImage(imageUrl && imageUrl !== '' ? imageUrl : process.env.PUBLIC_URL + '/img/default-profile.png');
      setEditValues({
        name: userInfo.name != null ? String(userInfo.name) : '',
        room_number: userInfo.room_number != null ? String(userInfo.room_number) : '',
        student_id: userInfo.student_id != null ? String(userInfo.student_id) : '',
      });
    } else {
      // userInfo가 null인 경우 기본값 설정
      setPoints({ merits: 0, demerits: 0 });
      setProfileImage(process.env.PUBLIC_URL + '/img/default-profile.png');
      setEditValues({ name: '', room_number: '', student_id: '' });
    }
  }, [userInfo]);

  // 프로필 이미지 변경 핸들러
  const handleImageChange = async (event) => {
    const file = event.target.files[0];

    if (!file || !userInfo?.id) {
      alert("파일을 선택하거나 사용자 ID를 찾을 수 없습니다.");
      return;
    }

    // 세션 확인 및 갱신
    try {
      await ensureValidSession();
    } catch (sessionError) {
      console.error('[이미지 업로드] 세션 오류:', sessionError);
      alert('세션 오류가 발생했습니다. 페이지를 새로고침해주세요: ' + sessionError.message);
      return;
    }

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 제한 (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 파일 확장자 추출
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${userInfo.id}-${Date.now()}.${fileExt}`;
    const filePath = `profile_images/${fileName}`;

    // 전송되는 타입 확인을 위한 로깅
    console.log('=== 파일 정보 확인 ===');
    console.log('원본 File 객체:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      constructor: file.constructor.name
    });
    console.log('File instanceof File:', file instanceof File);
    console.log('File instanceof Blob:', file instanceof Blob);
    console.log('업로드 옵션:', {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600'
    });
    console.log('업로드 경로:', filePath);

    try {
      // avatars bucket에 이미지 업로드
      console.log('=== 업로드 요청 전송 ===');
      console.log('경로:', filePath);
      console.log('파일 타입:', file.type);
      console.log('파일 크기:', file.size);
      console.log('파일 객체:', file);
      
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(
          filePath,
          file,
          {
            contentType: file.type,
            upsert: true,
            cacheControl: '3600'
          }
        );
      
      console.log('=== 업로드 응답 ===');
      console.log('data:', data);
      console.log('error:', error);

      if (error) {
        throw error;
      }

      // Public URL 가져오기
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const publicUrl = publicUrlData.publicUrl;

      // users 테이블에 프로필 이미지 URL 업데이트
      await ensureValidSession();
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ profile_image: publicUrl })
        .eq('id', userInfo.id)
        .select();

      if (updateError) {
        throw updateError;
      }

      // 상태 업데이트
      setProfileImage(publicUrl);
      
      if (handleUserUpdate) {
        const updatedUserInfo = { ...userInfo, profile_image: publicUrl };
        handleUserUpdate(updatedUserInfo);
      }
      
      alert("프로필 이미지가 성공적으로 업데이트되었습니다.");
      
      // 파일 input 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('=== 프로필 이미지 업로드 실패 ===');
      console.error('[오류] 전체 오류 객체:', error);
      console.error('[오류] 오류 메시지:', error.message);
      console.error('[오류] 오류 스택:', error.stack);
      
      if (error.message && error.message.includes('policy')) {
        console.error('[오류 타입] RLS 정책 오류');
        console.error('[RLS 정책 오류 상세]');
        console.error('오류 메시지:', error.message);
        console.error('상태 코드:', error.statusCode);
        console.error('해결 방법:');
        console.error('1. Supabase Dashboard > SQL Editor에서 fix_storage_rls_policies.sql 실행');
        console.error('2. Storage > Policies에서 정책 확인');
        console.error('3. Storage > Buckets > avatars > Settings에서 RLS 활성화 확인');
        alert('RLS 정책 오류가 발생했습니다.\n\n해결 방법:\n\n방법 1 (권장):\n1. Supabase Dashboard > SQL Editor 열기\n2. fix_storage_rls_safe.sql 파일 내용 복사\n3. SQL Editor에 붙여넣고 Run 버튼 클릭\n4. Storage > Policies에서 정책 확인\n\n방법 2 (UI 사용):\n1. Supabase Dashboard > Storage > Policies\n2. avatars bucket 선택\n3. "New Policy" 클릭\n4. Policy name: "Allow authenticated uploads"\n5. Allowed operation: INSERT\n6. Target roles: authenticated\n7. USING expression: bucket_id = \'avatars\'\n8. WITH CHECK expression: bucket_id = \'avatars\'\n9. Save\n\n방법 3 (임시 테스트):\nStorage > Buckets > avatars > Settings에서\nRLS를 일시적으로 비활성화하여 테스트');
      } else if (error.message && error.message.includes('Bucket not found')) {
        console.error('[오류 타입] Bucket 없음 오류');
        alert('avatars bucket을 찾을 수 없습니다.\n\nSupabase 대시보드에서:\n1. Storage > Create bucket 클릭\n2. Bucket 이름: avatars\n3. Public bucket: true로 설정');
      } else {
        console.error('[오류 타입] 기타 오류');
        alert('프로필 이미지 업데이트 중 오류가 발생했습니다:\n' + (error.message || error));
      }
      console.error('=== 프로필 이미지 업로드 종료 (실패) ===');
    }
  };

  const handleDoubleClick = (field) => {
    setEditingField(field);
    setTimeout(() => {
      if (field === 'name' && nameInputRef.current) nameInputRef.current.focus();
      else if (field === 'room_number' && roomNumberInputRef.current) roomNumberInputRef.current.focus();
      else if (field === 'student_id' && studentIdInputRef.current) studentIdInputRef.current.focus();
    }, 10);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    if (userInfo) {
      setEditValues({
        name: userInfo.name != null ? String(userInfo.name) : '',
        room_number: userInfo.room_number != null ? String(userInfo.room_number) : '',
        student_id: userInfo.student_id != null ? String(userInfo.student_id) : '',
      });
    }
  };

  // 정보 저장 핸들러
  const handleSaveEdit = async (field) => {
    if (!userInfo?.id) {
      alert("사용자 ID를 찾을 수 없어 정보를 업데이트할 수 없습니다.");
      handleCancelEdit();
      return;
    }

    // 0단계: 요청 전 세션 확인 및 갱신
    try {
      await ensureValidSession();
      console.log('[세션 확인 완료] 요청 진행');
    } catch (sessionError) {
      console.error('[세션 오류]', sessionError);
      alert('세션 오류가 발생했습니다. 페이지를 새로고침해주세요: ' + sessionError.message);
      handleCancelEdit();
      return;
    }

    // 1단계: input에서 나오기 전에 input 안에 있는 요소(값)를 가져오기
    const inputValue = editValues[field];
    const changeValue = inputValue?.trim() || null; // 빈 문자열은 null로 저장 (텍스트 필드)
    
    // 유효성 검사 (텍스트 필드이지만 숫자만 입력 가능)
    if (field === 'room_number' && changeValue && !/^\d+$/.test(changeValue)) {
      alert('호실은 숫자만 입력 가능합니다.');
      return;
    }
    
    if (field === 'student_id' && changeValue && !/^\d+$/.test(changeValue)) {
      alert('학번은 숫자만 입력 가능합니다.');
      return;
    }

    // 2단계: input 태그에서 나오기 (편집 모드 종료)
    setEditingField(null);

    try {
      const oldStudentId = field === 'student_id' ? userInfo.student_id : null;
      
      // 3단계: student_id를 업데이트하는 경우, 외래 키 제약 조건 처리
      if (field === 'student_id' && changeValue && oldStudentId) {
        console.log(`[외래 키 처리] student_id 변경: ${oldStudentId} -> ${changeValue}`);
        
        // Step 1: 모든 관련 테이블에서 이전 student_id를 가진 레코드의 ID를 먼저 조회
        await ensureValidSession();
        
        // temporary_leave 테이블 조회
        console.log(`[외래 키 처리 Step 1-1] temporary_leave 테이블에서 이전 student_id를 가진 레코드 조회`);
        const { data: tempLeaveRecords, error: findLeaveError } = await supabase
          .from('temporary_leave')
          .select('id')
          .eq('student_id', oldStudentId);
        
        let tempLeaveIds = [];
        if (!findLeaveError && tempLeaveRecords && tempLeaveRecords.length > 0) {
          tempLeaveIds = tempLeaveRecords.map(record => record.id);
          console.log(`[외래 키 처리 Step 1-1 성공] temporary_leave 레코드 ${tempLeaveIds.length}개 발견:`, tempLeaveIds);
        } else {
          console.log(`[외래 키 처리 Step 1-1] temporary_leave 레코드 없음 (정상)`);
        }
        
        // temporary_exit 테이블 조회
        console.log(`[외래 키 처리 Step 1-2] temporary_exit 테이블에서 이전 student_id를 가진 레코드 조회`);
        const { data: tempExitRecords, error: findExitError } = await supabase
          .from('temporary_exit')
          .select('id')
          .eq('student_id', oldStudentId);
        
        let tempExitIds = [];
        if (!findExitError && tempExitRecords && tempExitRecords.length > 0) {
          tempExitIds = tempExitRecords.map(record => record.id);
          console.log(`[외래 키 처리 Step 1-2 성공] temporary_exit 레코드 ${tempExitIds.length}개 발견:`, tempExitIds);
        } else {
          console.log(`[외래 키 처리 Step 1-2] temporary_exit 레코드 없음 (정상)`);
        }
        
        // Step 2: 세션 확인 후 모든 관련 테이블의 student_id를 NULL로 설정 (외래 키 제약 조건 해제)
        await ensureValidSession();
        
        // temporary_leave 테이블 업데이트
        if (tempLeaveIds.length > 0) {
          console.log(`[외래 키 처리 Step 2-1] temporary_leave 테이블의 student_id를 NULL로 설정`);
          const { error: tempLeaveNullError } = await supabase
            .from('temporary_leave')
            .update({ student_id: null })
            .in('id', tempLeaveIds);
          
          if (tempLeaveNullError) {
            console.error(`[외래 키 처리 Step 2-1 실패] temporary_leave NULL 설정 실패:`, tempLeaveNullError);
            throw new Error(`관련 데이터 업데이트 실패: ${tempLeaveNullError.message}`);
          } else {
            console.log(`[외래 키 처리 Step 2-1 성공] temporary_leave 테이블의 student_id를 NULL로 설정 완료`);
          }
        }
        
        // temporary_exit 테이블 업데이트
        if (tempExitIds.length > 0) {
          console.log(`[외래 키 처리 Step 2-2] temporary_exit 테이블의 student_id를 NULL로 설정`);
          const { error: tempExitNullError } = await supabase
            .from('temporary_exit')
            .update({ student_id: null })
            .in('id', tempExitIds);
          
          if (tempExitNullError) {
            console.error(`[외래 키 처리 Step 2-2 실패] temporary_exit NULL 설정 실패:`, tempExitNullError);
            throw new Error(`관련 데이터 업데이트 실패: ${tempExitNullError.message}`);
          } else {
            console.log(`[외래 키 처리 Step 2-2 성공] temporary_exit 테이블의 student_id를 NULL로 설정 완료`);
          }
        }
        
        // Step 3: 세션 확인 후 users 테이블의 student_id 업데이트
        await ensureValidSession();
        console.log(`[외래 키 처리 Step 3] users 테이블의 student_id 업데이트`);
        const updateData = { [field]: changeValue || null };
        
        console.log(`[DB 저장 시도] 필드: ${field}, 값: ${changeValue}, 사용자 ID: ${userInfo.id}`);
        console.log(`[DB 저장 시도] 업데이트 데이터:`, updateData);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userInfo.id)
          .select();

        if (updateError) {
          console.error(`[DB 저장 실패] 필드: ${field}`, updateError);
          throw updateError;
        }

        console.log(`[DB 저장 성공] 필드: ${field}`, updateResult);
        
        // Step 4: 세션 확인 후 users 테이블 업데이트 후, 모든 관련 테이블의 student_id를 새 값으로 업데이트
        await ensureValidSession();
        
        // temporary_leave 테이블 업데이트
        if (tempLeaveIds.length > 0) {
          console.log(`[외래 키 처리 Step 4-1] temporary_leave 테이블의 student_id를 새 값으로 업데이트`);
          const { error: tempLeaveFinalError } = await supabase
            .from('temporary_leave')
            .update({ student_id: changeValue })
            .in('id', tempLeaveIds);
          
          if (tempLeaveFinalError) {
            console.error(`[외래 키 처리 Step 4-1 실패] temporary_leave 최종 업데이트 실패:`, tempLeaveFinalError);
            // 외래 키 오류가 아니면 계속 진행
            if (!tempLeaveFinalError.message.includes('foreign key')) {
              throw new Error(`관련 데이터 업데이트 실패: ${tempLeaveFinalError.message}`);
            } else {
              console.warn(`[외래 키 처리] temporary_leave 최종 업데이트 실패했지만 계속 진행`);
            }
          } else {
            console.log(`[외래 키 처리 Step 4-1 성공] temporary_leave 테이블의 student_id를 새 값으로 업데이트 완료`);
          }
        }
        
        // temporary_exit 테이블 업데이트
        if (tempExitIds.length > 0) {
          console.log(`[외래 키 처리 Step 4-2] temporary_exit 테이블의 student_id를 새 값으로 업데이트`);
          const { error: tempExitFinalError } = await supabase
            .from('temporary_exit')
            .update({ student_id: changeValue })
            .in('id', tempExitIds);
          
          if (tempExitFinalError) {
            console.error(`[외래 키 처리 Step 4-2 실패] temporary_exit 최종 업데이트 실패:`, tempExitFinalError);
            // 외래 키 오류가 아니면 계속 진행
            if (!tempExitFinalError.message.includes('foreign key')) {
              throw new Error(`관련 데이터 업데이트 실패: ${tempExitFinalError.message}`);
            } else {
              console.warn(`[외래 키 처리] temporary_exit 최종 업데이트 실패했지만 계속 진행`);
            }
          } else {
            console.log(`[외래 키 처리 Step 4-2 성공] temporary_exit 테이블의 student_id를 새 값으로 업데이트 완료`);
          }
        }
      } else if (field === 'student_id' && changeValue) {
        // oldStudentId가 없는 경우 (처음 student_id 설정)
        const updateData = { [field]: changeValue || null };
        
        console.log(`[DB 저장 시도] 필드: ${field}, 값: ${changeValue}, 사용자 ID: ${userInfo.id}`);
        console.log(`[DB 저장 시도] 업데이트 데이터:`, updateData);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userInfo.id)
          .select();

        if (updateError) {
          console.error(`[DB 저장 실패] 필드: ${field}`, updateError);
          throw updateError;
        }

        console.log(`[DB 저장 성공] 필드: ${field}`, updateResult);
      } else {
        // student_id가 아닌 다른 필드 업데이트 - 세션 확인 후 진행
        await ensureValidSession();
        const updateData = { [field]: changeValue || null };
        
        console.log(`[DB 저장 시도] 필드: ${field}, 값: ${changeValue}, 사용자 ID: ${userInfo.id}`);
        console.log(`[DB 저장 시도] 업데이트 데이터:`, updateData);
        
        const { data: updateResult, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userInfo.id)
          .select();

        if (updateError) {
          console.error(`[DB 저장 실패] 필드: ${field}`, updateError);
          throw updateError;
        }

        console.log(`[DB 저장 성공] 필드: ${field}`, updateResult);
      }

      // 5단계: 세션 확인 후 저장한 필드만 DB에서 다시 불러오기
      await ensureValidSession();
      const { data: fieldData, error: selectError } = await supabase
        .from('users')
        .select(field) // 해당 필드만 선택
        .eq('id', userInfo.id)
        .single();

      if (selectError) {
        console.error(`[DB 조회 실패] 필드: ${field}`, selectError);
        throw selectError;
      }

      console.log(`[DB 조회 성공] 필드: ${field}, 값:`, fieldData[field]);

      // 6단계: 세션 확인 후 전체 사용자 정보를 DB에서 다시 불러와서 화면 업데이트
      await ensureValidSession();
      console.log(`[화면 업데이트] 전체 사용자 정보 다시 불러오기 시작`);
      const { data: fullUserData, error: fullSelectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userInfo.id)
        .single();

      if (fullSelectError) {
        console.error(`[화면 업데이트 실패] 전체 사용자 정보 조회 실패:`, fullSelectError);
        // 전체 조회 실패해도 필드 데이터로 업데이트 시도
        const dbValue = fieldData[field];
        const partialUpdatedUserInfo = { ...userInfo, [field]: dbValue };
        if (handleUserUpdate) {
          handleUserUpdate(partialUpdatedUserInfo);
        }
        setEditValues(prev => ({
          ...prev,
          [field]: dbValue != null ? String(dbValue) : ''
        }));
        console.log(`[화면 업데이트 완료] 부분 업데이트 (필드: ${field}, DB 값: ${dbValue})`);
      } else {
        // 전체 사용자 정보로 업데이트
        console.log(`[화면 업데이트] 전체 사용자 정보 조회 성공:`, fullUserData);
        
        // null 값들을 안전하게 처리한 userInfo 생성
        const safeUpdatedUserInfo = {
          ...fullUserData,
          student_id: fullUserData.student_id != null ? fullUserData.student_id : null,
          room_number: fullUserData.room_number != null ? fullUserData.room_number : null,
          address: fullUserData.address != null ? fullUserData.address : null,
          merits: fullUserData.merits != null ? Number(fullUserData.merits) : 0,
          demerits: fullUserData.demerits != null ? Number(fullUserData.demerits) : 0,
          infocomplete: fullUserData.infocomplete != null ? Boolean(fullUserData.infocomplete) : false,
          name: fullUserData.name != null ? fullUserData.name : null,
          profile_image: fullUserData.profile_image != null ? fullUserData.profile_image : null,
        };
        
        // 부모 컴포넌트에 전체 업데이트된 정보 전달
        if (handleUserUpdate) {
          console.log(`[화면 업데이트] handleUserUpdate 호출:`, safeUpdatedUserInfo);
          handleUserUpdate(safeUpdatedUserInfo);
          console.log(`[화면 업데이트] handleUserUpdate 완료`);
        }
        
        // editValues도 DB에서 가져온 값으로 업데이트
        setEditValues(prev => ({
          ...prev,
          name: safeUpdatedUserInfo.name != null ? String(safeUpdatedUserInfo.name) : '',
          room_number: safeUpdatedUserInfo.room_number != null ? String(safeUpdatedUserInfo.room_number) : '',
          student_id: safeUpdatedUserInfo.student_id != null ? String(safeUpdatedUserInfo.student_id) : '',
        }));
        
        console.log(`[화면 업데이트 완료] 전체 업데이트 (필드: ${field}, DB 값: ${fieldData[field]})`);
      }
    } catch (error) {
      console.error(`[오류] 정보 업데이트 실패 (${field}):`, error);
      console.error(`[오류 상세]`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      if (error.message && error.message.includes('policy')) {
        alert('프로필 업데이트 권한이 없습니다. Supabase 대시보드에서 `users` 테이블의 RLS(Row Level Security) UPDATE 정책을 확인해주세요.');
      } else {
        alert(`정보 업데이트 중 오류가 발생했습니다: ${error.message || error}`);
      }
      // 오류 발생 시 편집 모드로 다시 돌아가기
      setEditingField(field);
      // 오류 발생 시 이전 값으로 롤백
      if (handleUserUpdate) {
        handleUserUpdate(userInfo);
      }
    }
  };

  const handleKeyDown = async (e, field) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();
      // Enter 키를 누르면 저장하고 input 모드에서 나옴
      await handleSaveEdit(field);
    } else if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
      // Escape 키를 누르면 취소하고 input 모드에서 나옴
      handleCancelEdit();
    }
  };

  // 배경 클릭 시 저장 처리
  const handleContainerClick = (e) => {
    // input 필드나 그 자식 요소를 클릭한 경우는 무시
    if (e.target.tagName === 'INPUT' || e.target.closest('input')) {
      return;
    }
    
    // 편집 중인 필드가 있으면 저장
    if (editingField) {
      handleSaveEdit(editingField);
    }
  };

  const handlePointChange = async (field, amount) => {
    if (!userInfo?.id) {
      alert("사용자 ID를 찾을 수 없어 포인트를 업데이트할 수 없습니다.");
      return;
    }

    // 세션 확인 및 갱신
    try {
      await ensureValidSession();
    } catch (sessionError) {
      console.error('[포인트 변경] 세션 오류:', sessionError);
      alert('세션 오류가 발생했습니다. 페이지를 새로고침해주세요: ' + sessionError.message);
      return;
    }

    const newAmount = Math.max(0, (points[field] || 0) + amount);
    const updatedPoints = {
      ...points,
      [field]: newAmount
    };

    setPoints(updatedPoints);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ [field]: newAmount })
        .eq('id', userInfo.id)
        .select();

      if (error) throw error;

      // 부모 컴포넌트에 업데이트 알림
      if (handleUserUpdate && data && data.length > 0) {
        const updatedUserInfo = { ...userInfo, ...data[0] };
        handleUserUpdate(updatedUserInfo);
      } else if (handleUserUpdate) {
        handleUserUpdate({ ...userInfo, [field]: newAmount });
      }

      console.log(`${field}가 성공적으로 업데이트되었습니다.`);
    } catch (error) {
      console.error(`포인트 업데이트 실패 (${field}):`, error);
      alert(`포인트 업데이트 중 오류가 발생했습니다: ${error.message || error}`);
      // 오류 발생 시 로컬 상태 롤백
      setPoints(prev => ({
        ...prev,
        [field]: (prev[field] || 0) - amount
      }));
    }
  };

  return (
    <div className="container" onClick={handleContainerClick}>
      <div className="profile-header">
        <h1 className="profile-title">마이페이지</h1>
        <p className="profile-date">{formattedDate}</p>
      </div>
      <div className='whiteBox'>
        <div className='profileBox'>
          <img src={profileImage || process.env.PUBLIC_URL + '/img/default-profile.png'} alt="프로필" className="profileImage" />
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageChange} />
        </div>
        <div className="editIconContainer" onClick={() => fileInputRef.current?.click()}>
          <img src={editIconPath} alt="Edit" className="editIcon" />
        </div>
        <div className='nameBox'>
          <div className='nameText'>이름</div>
          {editingField === 'name' ? (
            <input
              ref={nameInputRef}
              type="text"
              className='name'
              value={editValues.name}
              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
              onBlur={() => handleSaveEdit('name')}
              onKeyDown={(e) => handleKeyDown(e, 'name')}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className='name' onDoubleClick={() => handleDoubleClick('name')} title="더블클릭하여 수정">
              {userInfo?.name != null ? String(userInfo.name) : '사용자'}
            </div>
          )}
        </div>
        <div className='studentInfoBox'>
          <div className='numberBox'>
            <div className='numberText'>학번</div>
            {editingField === 'student_id' ? (
              <input
                ref={studentIdInputRef}
                type="text"
                className='number'
                value={editValues.student_id}
                onChange={(e) => setEditValues({ ...editValues, student_id: e.target.value })}
                onBlur={() => handleSaveEdit('student_id')}
                onKeyDown={(e) => handleKeyDown(e, 'student_id')}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className='number' onDoubleClick={() => handleDoubleClick('student_id')} title="더블클릭하여 수정">
                {userInfo?.student_id != null ? String(userInfo.student_id) : '학번 없음'}
              </div>
            )}
          </div>
          <div className='roomBox'>
            <div className='roomText'>호실</div>
            {editingField === 'room_number' ? (
              <input
                ref={roomNumberInputRef}
                type="text"
                className='roomNum'
                value={editValues.room_number}
                onChange={(e) => setEditValues({ ...editValues, room_number: e.target.value })}
                onBlur={() => handleSaveEdit('room_number')}
                onKeyDown={(e) => handleKeyDown(e, 'room_number')}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className='roomNum' onDoubleClick={() => handleDoubleClick('room_number')} title="더블클릭하여 수정">
                {userInfo?.room_number != null ? String(userInfo.room_number) : '호실 없음'}
              </div>
            )}
          </div>
        </div>
        <div className='pointBox'>
          <div className='bonus'>
            <div className='pointText'>상점</div>
            <div className='bonusPoints'>{points.merits}</div>
          </div>
          <div className='penalty'>
            <div className='pointText'>벌점</div>
              <div className='penaltyPoints'>{points.demerits}</div>
          </div>
          <div className='total'>
            <div className='pointText'>총합</div>
            <div className='totalPoints'>{points.merits - points.demerits}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileDetail;