import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './css/UserInfoForm.css';

const imgCheck = "/img/check-icon.svg";
const imgCancel = "/img/cancel-icon.svg";

function UserInfoForm({ userInfo, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: userInfo?.name,
    studentId: userInfo?.studentId,
    roomNumber: userInfo?.roomNumber,
    address: userInfo?.address,
  });

  const [focusedField, setFocusedField] = useState('studentId');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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

    const { data, error } = await supabase
      .from('users')
      .update({
        name: formData.name,
        student_id: formData.studentId,
        room_number: formData.roomNumber,
        address: formData.address,
      })
      .eq('id', userInfo.id)
      .select();

    if (error) {
      console.error('Supabase 데이터 업데이트 실패:', error);
      alert('데이터베이스에 사용자 정보를 업데이트하는 중 오류가 발생했습니다.');
    } else {
      console.log('Supabase에 사용자 정보 업데이트 완료:', data);
      onSubmit(formData);
    }
  };

  const handleAddressSearch = () => {
    // 주소 검색 로직
    console.log('주소 검색');
  };

  return (
    <div className="user-info-container">
      <div className="user-info-content">
        <div className="form-section">
          <div className="form-group">
            <label className="form-label">이름</label>
            <div className={`input-wrapper ${formData.name ? 'filled' : ''}`}>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input"
              />
              {formData.name && (
                <div className="input-icon">
                  <img alt="check" src={imgCheck} />
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">학번</label>
            <div className={`input-wrapper ${focusedField === 'studentId' ? 'focused' : ''}`}>
              <input
                type="text"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                onFocus={() => setFocusedField('studentId')}
                onBlur={() => setFocusedField('')}
                className="form-input"
              />
              {focusedField === 'studentId' && <div className="cursor"></div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">호실</label>
            <div className={`input-wrapper ${!formData.roomNumber ? 'empty' : ''}`}>
              <input
                type="text"
                name="roomNumber"
                value={formData.roomNumber}
                onChange={handleChange}
                placeholder="예) 401"
                className="form-input"
              />
              <div className="input-icon" onClick={() => handleClear('roomNumber')}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 16.944L20.328 21.272C20.4524 21.3964 20.6053 21.4631 20.7867 21.472C20.968 21.4809 21.1298 21.4142 21.272 21.272C21.4142 21.1298 21.4853 20.9724 21.4853 20.8C21.4853 20.6276 21.4142 20.4702 21.272 20.328L16.944 16L21.272 11.672C21.3964 11.5476 21.4631 11.3947 21.472 11.2133C21.4809 11.032 21.4142 10.8702 21.272 10.728C21.1298 10.5858 20.9724 10.5147 20.8 10.5147C20.6276 10.5147 20.4702 10.5858 20.328 10.728L16 15.056L11.672 10.728C11.5476 10.6036 11.3947 10.5369 11.2133 10.528C11.032 10.5191 10.8702 10.5858 10.728 10.728C10.5858 10.8702 10.5147 11.0276 10.5147 11.2C10.5147 11.3724 10.5858 11.5298 10.728 11.672L15.056 16L10.728 20.328C10.6036 20.4524 10.5369 20.6058 10.528 20.788C10.5191 20.9684 10.5858 21.1298 10.728 21.272C10.8702 21.4142 11.0276 21.4853 11.2 21.4853C11.3724 21.4853 11.5298 21.4142 11.672 21.272L16 16.944ZM16.004 28C14.3444 28 12.7844 27.6853 11.324 27.056C9.86356 26.4258 8.59289 25.5707 7.512 24.4907C6.43111 23.4107 5.57556 22.1413 4.94533 20.6827C4.31511 19.224 4 17.6644 4 16.004C4 14.3436 4.31511 12.7836 4.94533 11.324C5.57467 9.86355 6.42844 8.59289 7.50667 7.512C8.58489 6.43111 9.85467 5.57556 11.316 4.94533C12.7773 4.31511 14.3373 4 15.996 4C17.6547 4 19.2147 4.31511 20.676 4.94533C22.1364 5.57467 23.4071 6.42889 24.488 7.508C25.5689 8.58711 26.4244 9.85689 27.0547 11.3173C27.6849 12.7778 28 14.3373 28 15.996C28 17.6547 27.6853 19.2147 27.056 20.676C26.4267 22.1373 25.5716 23.408 24.4907 24.488C23.4098 25.568 22.1404 26.4236 20.6827 27.0547C19.2249 27.6858 17.6653 28.0009 16.004 28ZM16 26.6667C18.9778 26.6667 21.5 25.6333 23.5667 23.5667C25.6333 21.5 26.6667 18.9778 26.6667 16C26.6667 13.0222 25.6333 10.5 23.5667 8.43333C21.5 6.36667 18.9778 5.33333 16 5.33333C13.0222 5.33333 10.5 6.36667 8.43333 8.43333C6.36667 10.5 5.33333 13.0222 5.33333 16C5.33333 18.9778 6.36667 21.5 8.43333 23.5667C10.5 25.6333 13.0222 26.6667 16 26.6667Z" fill="#9E9E9E"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">주소</label>
            <div className="address-row">
              <div className={`input-wrapper address-input ${!formData.address ? 'empty' : ''}`}>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="읍, 면, 동으로 검색하세요"
                  className="form-input"
                />
                <div className="input-icon" onClick={() => handleClear('address')}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 16.944L20.328 21.272C20.4524 21.3964 20.6053 21.4631 20.7867 21.472C20.968 21.4809 21.1298 21.4142 21.272 21.272C21.4142 21.1298 21.4853 20.9724 21.4853 20.8C21.4853 20.6276 21.4142 20.4702 21.272 20.328L16.944 16L21.272 11.672C21.3964 11.5476 21.4631 11.3947 21.472 11.2133C21.4809 11.032 21.4142 10.8702 21.272 10.728C21.1298 10.5858 20.9724 10.5147 20.8 10.5147C20.6276 10.5147 20.4702 10.5858 20.328 10.728L16 15.056L11.672 10.728C11.5476 10.6036 11.3947 10.5369 11.2133 10.528C11.032 10.5191 10.8702 10.5858 10.728 10.728C10.5858 10.8702 10.5147 11.0276 10.5147 11.2C10.5147 11.3724 10.5858 11.5298 10.728 11.672L15.056 16L10.728 20.328C10.6036 20.4524 10.5369 20.6058 10.528 20.788C10.5191 20.9684 10.5858 21.1298 10.728 21.272C10.8702 21.4142 11.0276 21.4853 11.2 21.4853C11.3724 21.4853 11.5298 21.4142 11.672 21.272L16 16.944ZM16.004 28C14.3444 28 12.7844 27.6853 11.324 27.056C9.86356 26.4258 8.59289 25.5707 7.512 24.4907C6.43111 23.4107 5.57556 22.1413 4.94533 20.6827C4.31511 19.224 4 17.6644 4 16.004C4 14.3436 4.31511 12.7836 4.94533 11.324C5.57467 9.86355 6.42844 8.59289 7.50667 7.512C8.58489 6.43111 9.85467 5.57556 11.316 4.94533C12.7773 4.31511 14.3373 4 15.996 4C17.6547 4 19.2147 4.31511 20.676 4.94533C22.1364 5.57467 23.4071 6.42889 24.488 7.508C25.5689 8.58711 26.4244 9.85689 27.0547 11.3173C27.6849 12.7778 28 14.3373 28 15.996C28 17.6547 27.6853 19.2147 27.056 20.676C26.4267 22.1373 25.5716 23.408 24.4907 24.488C23.4098 25.568 22.1404 26.4236 20.6827 27.0547C19.2249 27.6858 17.6653 28.0009 16.004 28ZM16 26.6667C18.9778 26.6667 21.5 25.6333 23.5667 23.5667C25.6333 21.5 26.6667 18.9778 26.6667 16C26.6667 13.0222 25.6333 10.5 23.5667 8.43333C21.5 6.36667 18.9778 5.33333 16 5.33333C13.0222 5.33333 10.5 6.36667 8.43333 8.43333C6.36667 10.5 5.33333 13.0222 5.33333 16C5.33333 18.9778 6.36667 21.5 8.43333 23.5667C10.5 25.6333 13.0222 26.6667 16 26.6667Z" fill="#9E9E9E"/>
                  </svg>
                </div>
              </div>
              <button type="button" className="address-search-button" onClick={handleAddressSearch}>
                주소 검색
              </button>
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
  );
}

export default UserInfoForm;
