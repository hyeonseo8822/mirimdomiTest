import React, { useState, useEffect } from 'react';
import { supabase, ensureValidSession } from '../supabaseClient';
import './css/UserInfoForm.css';

// 로컬 이미지 경로
const imgCheck = "/img/check-icon.svg";
const imgCancel = "/img/cancel-icon.svg";

function UserInfoForm({ userInfo, onSubmit, onCancel }) {
  // 주소를 파싱하여 각 필드로 분리 (기존 주소가 있는 경우)
  const parseAddress = (address) => {
    if (!address) return { postcode: '', roadAddress: '', jibunAddress: '', detailAddress: '', extraAddress: '' };
    
    // 주소 형식: 우편번호|도로명주소|지번주소|상세주소|참고항목
    const parts = address.split('|');
    return {
      postcode: parts[0] || '',
      roadAddress: parts[1] || '',
      jibunAddress: parts[2] || '',
      detailAddress: parts[3] || '',
      extraAddress: parts[4] || '',
    };
  };

  // 주소를 하나의 문자열로 합치기 (도로명주소법 시행령 제6조에 따라)
  const combineAddress = (addressParts) => {
    const parts = [
      addressParts.postcode,
      addressParts.roadAddress,
      addressParts.jibunAddress,
      addressParts.detailAddress,
      addressParts.extraAddress
    ];
    return parts.filter(p => p && p.trim()).join('|');
  };

  const initialAddress = parseAddress(userInfo?.address || '');
  
  const [formData, setFormData] = useState({
    name: userInfo?.name || '',
    studentId: userInfo?.student_id || '',
    roomNumber: userInfo?.room_number || '',
    postcode: initialAddress.postcode,
    roadAddress: initialAddress.roadAddress,
    jibunAddress: initialAddress.jibunAddress,
    detailAddress: initialAddress.detailAddress,
    extraAddress: initialAddress.extraAddress,
  });

  const [focusedField, setFocusedField] = useState('studentId');

  // userInfo가 변경될 때 formData 업데이트
  useEffect(() => {
    if (userInfo) {
      const parsedAddress = parseAddress(userInfo.address || '');
      setFormData({
        name: userInfo.name || '',
        studentId: userInfo.student_id || '',
        roomNumber: userInfo.room_number || '',
        postcode: parsedAddress.postcode,
        roadAddress: parsedAddress.roadAddress,
        jibunAddress: parsedAddress.jibunAddress,
        detailAddress: parsedAddress.detailAddress,
        extraAddress: parsedAddress.extraAddress,
      });
    }
  }, [userInfo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // 학번과 호실은 숫자만 입력 가능
    if (name === 'studentId' || name === 'roomNumber') {
      // 숫자가 아닌 문자는 제거
      const numericValue = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleClear = (fieldName) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: ''
    }));
  };

  const handleSubmit = async () => {
    if (!userInfo || !userInfo.id) {
      alert("사용자 정보가 없어 업데이트할 수 없습니다.");
      return;
    }

    // 필수 입력 검증: 이름, 주소, 호실
    if (!formData.name || formData.name.trim() === '') {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!formData.roadAddress || formData.roadAddress.trim() === '') {
      alert("주소를 검색해주세요.");
      return;
    }

    if (!formData.roomNumber || formData.roomNumber.trim() === '') {
      alert("호실을 입력해주세요.");
      return;
    }

    // 숫자 형식 검증: 학번과 호실
    if (formData.studentId && !/^\d+$/.test(formData.studentId)) {
      alert("학번은 숫자만 입력 가능합니다.");
      return;
    }

    if (!/^\d+$/.test(formData.roomNumber)) {
      alert("호실은 숫자만 입력 가능합니다.");
      return;
    }

    let sessionEmail = null;
    try {
      // 세션 확인 및 갱신
      await ensureValidSession();
      
      // 세션에서 이메일 가져오기
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('세션 가져오기 오류:', sessionError);
      } else if (session?.user?.email) {
        sessionEmail = session.user.email;
        console.log('[DEBUG] UserInfoForm: 세션에서 이메일 가져옴:', sessionEmail);
      }
    } catch (sessionError) {
      console.error('세션 오류:', sessionError);
      alert('세션 오류가 발생했습니다. 페이지를 새로고침해주세요: ' + sessionError.message);
      return;
    }

    // 기본 프로필 이미지 URL 생성 (Supabase Storage의 avatars 버킷의 profile_images 폴더)
    // 회원 가입 시(기존 프로필 이미지가 없는 경우)에만 기본 이미지 설정
    let profileImageUrl = userInfo.profile_image;
    if (!profileImageUrl || profileImageUrl.trim() === '') {
      const defaultProfileImagePath = 'profile_images/default-profile.jpg';
      const { data: defaultProfileUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(defaultProfileImagePath);
      profileImageUrl = defaultProfileUrlData.publicUrl;
      console.log('[DEBUG] UserInfoForm: 기본 프로필 이미지 URL 생성:', profileImageUrl);
    } else {
      console.log('[DEBUG] UserInfoForm: 기존 프로필 이미지 유지:', profileImageUrl);
    }

    // 주소를 하나의 문자열로 합치기 (도로명주소법 시행령 제6조에 따라)
    const combinedAddress = combineAddress({
      postcode: formData.postcode,
      roadAddress: formData.roadAddress,
      jibunAddress: formData.jibunAddress,
      detailAddress: formData.detailAddress,
      extraAddress: formData.extraAddress,
    });

    // upsert 사용: 레코드가 있으면 업데이트, 없으면 삽입
    const upsertData = {
      id: userInfo.id,
      name: formData.name,
      student_id: formData.studentId,
      room_number: formData.roomNumber,
      address: combinedAddress,
      infocomplete: true, // 사용자 정보 입력 완료
      profile_image: profileImageUrl, // 기본 프로필 이미지 자동 설정 (없는 경우만)
    };

    // 이메일 설정: userInfo에 있으면 사용, 없으면 세션에서 가져온 이메일 사용
    if (userInfo.email) {
      upsertData.email = userInfo.email;
      console.log('[DEBUG] UserInfoForm: userInfo에서 이메일 사용:', userInfo.email);
    } else if (sessionEmail) {
      upsertData.email = sessionEmail;
      console.log('[DEBUG] UserInfoForm: 세션에서 가져온 이메일 사용:', sessionEmail);
    } else {
      console.warn('[DEBUG] UserInfoForm: 이메일을 찾을 수 없음 (userInfo.email도 없고 세션 이메일도 없음)');
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(upsertData, {
        onConflict: 'id' // id가 중복되면 업데이트
      })
      .select();

    if (error) {
      console.error('Supabase 데이터 저장 실패:', error);
      console.error('에러 코드:', error.code);
      console.error('에러 메시지:', error.message);
      alert('데이터베이스에 사용자 정보를 저장하는 중 오류가 발생했습니다: ' + error.message);
    } else {
      console.log('Supabase에 사용자 정보 저장 완료:', data);
      onSubmit(formData);
    }
  };

  // 카카오 주소 찾기 팝업 열기
  const handleAddressSearch = () => {
    if (typeof window === 'undefined' || !window.daum || !window.daum.Postcode) {
      alert('주소 찾기 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: function(data) {
        // 팝업에서 검색결과 항목을 클릭했을때 실행할 코드를 작성하는 부분.

        // 도로명 주소의 노출 규칙에 따라 주소를 표시한다.
        // 내려오는 변수가 값이 없는 경우엔 공백('')값을 가지므로, 이를 참고하여 분기 한다.
        var roadAddr = data.roadAddress; // 도로명 주소 변수
        var extraRoadAddr = ''; // 참고 항목 변수

        // 법정동명이 있을 경우 추가한다. (법정리는 제외)
        // 법정동의 경우 마지막 문자가 "동/로/가"로 끝난다.
        if(data.bname !== '' && /[동|로|가]$/g.test(data.bname)){
          extraRoadAddr += data.bname;
        }
        // 건물명이 있고, 공동주택일 경우 추가한다.
        if(data.buildingName !== '' && data.apartment === 'Y'){
          extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
        }
        // 표시할 참고항목이 있을 경우, 괄호까지 추가한 최종 문자열을 만든다.
        if(extraRoadAddr !== ''){
          extraRoadAddr = ' (' + extraRoadAddr + ')';
        }

        // 우편번호와 주소 정보를 해당 필드에 넣는다.
        setFormData(prev => ({
          ...prev,
          postcode: data.zonecode,
          roadAddress: roadAddr,
          jibunAddress: data.jibunAddress,
          extraAddress: extraRoadAddr,
        }));
      }
    }).open();
  };

  return (
    <>
      <div className="user-info-container">
        <div className="user-info-content">
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">이름 <span style={{ color: 'red' }}>*</span></label>
              <div className={`input-wrapper ${formData.name ? 'filled' : ''}`}>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
                {formData.name && (
                  <div className="input-icon">
                    <img alt="check" src={imgCheck} />
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">학번 <span style={{ color: 'red' }}>*</span></label>
              <div className={`input-wrapper ${focusedField === 'studentId' ? 'focused' : ''}`}>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId || ''}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('studentId')}
                  onBlur={() => setFocusedField('')}
                  className="form-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                {focusedField === 'studentId' && <div className="cursor"></div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">호실 <span style={{ color: 'red' }}>*</span></label>
              <div className={`input-wrapper ${!formData.roomNumber ? 'empty' : ''}`}>
                <input
                  type="text"
                  name="roomNumber"
                  value={formData.roomNumber || ''}
                  onChange={handleChange}
                  placeholder="예) 401"
                  className="form-input"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <div className="input-icon" onClick={() => handleClear('roomNumber')}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 16.944L20.328 21.272C20.4524 21.3964 20.6053 21.4631 20.7867 21.472C20.968 21.4809 21.1298 21.4142 21.272 21.272C21.4142 21.1298 21.4853 20.9724 21.4853 20.8C21.4853 20.6276 21.4142 20.4702 21.272 20.328L16.944 16L21.272 11.672C21.3964 11.5476 21.4631 11.3947 21.472 11.2133C21.4809 11.032 21.4142 10.8702 21.272 10.728C21.1298 10.5858 20.9724 10.5147 20.8 10.5147C20.6276 10.5147 20.4702 10.5858 20.328 10.728L16 15.056L11.672 10.728C11.5476 10.6036 11.3947 10.5369 11.2133 10.528C11.032 10.5191 10.8702 10.5858 10.728 10.728C10.5858 10.8702 10.5147 11.0276 10.5147 11.2C10.5147 11.3724 10.5858 11.5298 10.728 11.672L15.056 16L10.728 20.328C10.6036 20.4524 10.5369 20.6058 10.528 20.788C10.5191 20.9684 10.5858 21.1298 10.728 21.272C10.8702 21.4142 11.0276 21.4853 11.2 21.4853C11.3724 21.4853 11.5298 21.4142 11.672 21.272L16 16.944ZM16.004 28C14.3444 28 12.7844 27.6853 11.324 27.056C9.86356 26.4258 8.59289 25.5707 7.512 24.4907C6.43111 23.4107 5.57556 22.1413 4.94533 20.6827C4.31511 19.224 4 17.6644 4 16.004C4 14.3436 4.31511 12.7836 4.94533 11.324C5.57467 9.86355 6.42844 8.59289 7.50667 7.512C8.58489 6.43111 9.85467 5.57556 11.316 4.94533C12.7773 4.31511 14.3373 4 15.996 4C17.6547 4 19.2147 4.31511 20.676 4.94533C22.1364 5.57467 23.4071 6.42889 24.488 7.508C25.5689 8.58711 26.4244 9.85689 27.0547 11.3173C27.6849 12.7778 28 14.3373 28 15.996C28 17.6547 27.6853 19.2147 27.056 20.676C26.4267 22.1373 25.5716 23.408 24.4907 24.488C23.4098 25.568 22.1404 26.4236 20.6827 27.0547C19.2249 27.6858 17.6653 28.0009 16.004 28ZM16 26.6667C18.9778 26.6667 21.5 25.6333 23.5667 23.5667C25.6333 21.5 26.6667 18.9778 26.6667 16C26.6667 13.0222 25.6333 10.5 23.5667 8.43333C21.5 6.36667 18.9778 5.33333 16 5.33333C13.0222 5.33333 10.5 6.36667 8.43333 8.43333C6.36667 10.5 5.33333 13.0222 5.33333 16C5.33333 18.9778 6.36667 21.5 8.43333 23.5667C10.5 25.6333 13.0222 26.6667 16 26.6667Z" fill="#9E9E9E"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">주소 <span style={{ color: 'red' }}>*</span></label>
              
              {/* 우편번호 및 주소 검색 버튼 */}
              <div className="address-row">
                <div className={`input-wrapper address-input ${!formData.postcode ? 'empty' : ''} address-readonly`}>
                  <input
                    type="text"
                    name="postcode"
                    value={formData.postcode || ''}
                    readOnly
                    placeholder="우편번호"
                    className="form-input address-input-readonly"
                  />
                </div>
                <button type="button" className="address-search-button" onClick={handleAddressSearch}>
                  주소 검색
                </button>
              </div>

              {/* 도로명주소 */}
              <div className={`input-wrapper ${!formData.roadAddress ? 'empty' : ''} address-readonly`}>
                <input
                  type="text"
                  name="roadAddress"
                  value={formData.roadAddress || ''}
                  readOnly
                  placeholder="도로명주소"
                  className="form-input address-input-readonly"
                  required
                />
                {formData.roadAddress && (
                  <div className="input-icon" onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      postcode: '',
                      roadAddress: '',
                      jibunAddress: '',
                      extraAddress: '',
                    }));
                  }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 16.944L20.328 21.272C20.4524 21.3964 20.6053 21.4631 20.7867 21.472C20.968 21.4809 21.1298 21.4142 21.272 21.272C21.4142 21.1298 21.4853 20.9724 21.4853 20.8C21.4853 20.6276 21.4142 20.4702 21.272 20.328L16.944 16L21.272 11.672C21.3964 11.5476 21.4631 11.3947 21.472 11.2133C21.4809 11.032 21.4142 10.8702 21.272 10.728C21.1298 10.5858 20.9724 10.5147 20.8 10.5147C20.6276 10.5147 20.4702 10.5858 20.328 10.728L16 15.056L11.672 10.728C11.5476 10.6036 11.3947 10.5369 11.2133 10.528C11.032 10.5191 10.8702 10.5858 10.728 10.728C10.5858 10.8702 10.5147 11.0276 10.5147 11.2C10.5147 11.3724 10.5858 11.5298 10.728 11.672L15.056 16L10.728 20.328C10.6036 20.4524 10.5369 20.6058 10.528 20.788C10.5191 20.9684 10.5858 21.1298 10.728 21.272C10.8702 21.4142 11.0276 21.4853 11.2 21.4853C11.3724 21.4853 11.5298 21.4142 11.672 21.272L16 16.944ZM16.004 28C14.3444 28 12.7844 27.6853 11.324 27.056C9.86356 26.4258 8.59289 25.5707 7.512 24.4907C6.43111 23.4107 5.57556 22.1413 4.94533 20.6827C4.31511 19.224 4 17.6644 4 16.004C4 14.3436 4.31511 12.7836 4.94533 11.324C5.57467 9.86355 6.42844 8.59289 7.50667 7.512C8.58489 6.43111 9.85467 5.57556 11.316 4.94533C12.7773 4.31511 14.3373 4 15.996 4C17.6547 4 19.2147 4.31511 20.676 4.94533C22.1364 5.57467 23.4071 6.42889 24.488 7.508C25.5689 8.58711 26.4244 9.85689 27.0547 11.3173C27.6849 12.7778 28 14.3373 28 15.996C28 17.6547 27.6853 19.2147 27.056 20.676C26.4267 22.1373 25.5716 23.408 24.4907 24.488C23.4098 25.568 22.1404 26.4236 20.6827 27.0547C19.2249 27.6858 17.6653 28.0009 16.004 28ZM16 26.6667C18.9778 26.6667 21.5 25.6333 23.5667 23.5667C25.6333 21.5 26.6667 18.9778 26.6667 16C26.6667 13.0222 25.6333 10.5 23.5667 8.43333C21.5 6.36667 18.9778 5.33333 16 5.33333C13.0222 5.33333 10.5 6.36667 8.43333 8.43333C6.36667 10.5 5.33333 13.0222 5.33333 16C5.33333 18.9778 6.36667 21.5 8.43333 23.5667C10.5 25.6333 13.0222 26.6667 16 26.6667Z" fill="#9E9E9E"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* 지번주소 (참고용, 읽기 전용) */}
              {formData.jibunAddress && (
                <div className={`input-wrapper address-readonly`}>
                  <input
                    type="text"
                    name="jibunAddress"
                    value={formData.jibunAddress || ''}
                    readOnly
                    placeholder="지번주소"
                    className="form-input address-input-readonly"
                  />
                </div>
              )}

              {/* 참고항목 (읽기 전용) */}
              {formData.extraAddress && (
                <div className={`input-wrapper address-readonly`}>
                  <input
                    type="text"
                    name="extraAddress"
                    value={formData.extraAddress || ''}
                    readOnly
                    placeholder="참고항목"
                    className="form-input address-input-readonly"
                  />
                </div>
              )}

              {/* 상세주소 (직접 입력 가능) */}
              <div className={`input-wrapper ${!formData.detailAddress ? 'empty' : ''}`}>
                <input
                  type="text"
                  name="detailAddress"
                  value={formData.detailAddress || ''}
                  onChange={handleChange}
                  placeholder="상세주소를 입력하세요 (예: 동/호수)"
                  className="form-input"
                />
                {formData.detailAddress && (
                  <div className="input-icon" onClick={() => handleClear('detailAddress')}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 16.944L20.328 21.272C20.4524 21.3964 20.6053 21.4631 20.7867 21.472C20.968 21.4809 21.1298 21.4142 21.272 21.272C21.4142 21.1298 21.4853 20.9724 21.4853 20.8C21.4853 20.6276 21.4142 20.4702 21.272 20.328L16.944 16L21.272 11.672C21.3964 11.5476 21.4631 11.3947 21.472 11.2133C21.4809 11.032 21.4142 10.8702 21.272 10.728C21.1298 10.5858 20.9724 10.5147 20.8 10.5147C20.6276 10.5147 20.4702 10.5858 20.328 10.728L16 15.056L11.672 10.728C11.5476 10.6036 11.3947 10.5369 11.2133 10.528C11.032 10.5191 10.8702 10.5858 10.728 10.728C10.5858 10.8702 10.5147 11.0276 10.5147 11.2C10.5147 11.3724 10.5858 11.5298 10.728 11.672L15.056 16L10.728 20.328C10.6036 20.4524 10.5369 20.6058 10.528 20.788C10.5191 20.9684 10.5858 21.1298 10.728 21.272C10.8702 21.4142 11.0276 21.4853 11.2 21.4853C11.3724 21.4853 11.5298 21.4142 11.672 21.272L16 16.944ZM16.004 28C14.3444 28 12.7844 27.6853 11.324 27.056C9.86356 26.4258 8.59289 25.5707 7.512 24.4907C6.43111 23.4107 5.57556 22.1413 4.94533 20.6827C4.31511 19.224 4 17.6644 4 16.004C4 14.3436 4.31511 12.7836 4.94533 11.324C5.57467 9.86355 6.42844 8.59289 7.50667 7.512C8.58489 6.43111 9.85467 5.57556 11.316 4.94533C12.7773 4.31511 14.3373 4 15.996 4C17.6547 4 19.2147 4.31511 20.676 4.94533C22.1364 5.57467 23.4071 6.42889 24.488 7.508C25.5689 8.58711 26.4244 9.85689 27.0547 11.3173C27.6849 12.7778 28 14.3373 28 15.996C28 17.6547 27.6853 19.2147 27.056 20.676C26.4267 22.1373 25.5716 23.408 24.4907 24.488C23.4098 25.568 22.1404 26.4236 20.6827 27.0547C19.2249 27.6858 17.6653 28.0009 16.004 28ZM16 26.6667C18.9778 26.6667 21.5 25.6333 23.5667 23.5667C25.6333 21.5 26.6667 18.9778 26.6667 16C26.6667 13.0222 25.6333 10.5 23.5667 8.43333C21.5 6.36667 18.9778 5.33333 16 5.33333C13.0222 5.33333 10.5 6.36667 8.43333 8.43333C6.36667 10.5 5.33333 13.0222 5.33333 16C5.33333 18.9778 6.36667 21.5 8.43333 23.5667C10.5 25.6333 13.0222 26.6667 16 26.6667Z" fill="#9E9E9E"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="button-group">
            <button type="button" className="prev-button" onClick={onCancel}>
              이전
            </button>
            <button type="button" className="confirm-button" onClick={handleSubmit}>
              확인
            </button>
          </div>
        </div>
      </div>

    </>
  );
}

export default UserInfoForm;
