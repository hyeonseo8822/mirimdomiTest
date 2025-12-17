/**
 * NEIS API 유틸리티 함수
 * 한국교육정보시스템(NEIS) API를 사용하여 학교 정보를 조회합니다.
 * 
 * 참고: NEIS API는 CORS 제한이 있을 수 있으므로,
 * 필요시 프록시 서버나 백엔드 API를 통해 호출해야 할 수 있습니다.
 */

// NEIS API 기본 URL
const NEIS_API_BASE_URL = 'https://open.neis.go.kr/hub';

// 환경변수에서 NEIS API 키를 안전하게 읽어서 공백 제거
const neisApiKeyRaw = process.env.REACT_APP_NEIS_API_KEY || 'f5d5771e4c464ba287816eb498ff3999';
const NEIS_API_KEY =
  typeof neisApiKeyRaw === 'string' ? neisApiKeyRaw.trim() : neisApiKeyRaw;

if (process.env.NODE_ENV === 'development') {
  // 전체 키는 찍지 않고, 앞 몇 글자만 로그로 확인
  console.log(
    '[NEIS] REACT_APP_NEIS_API_KEY 로드 상태:',
    NEIS_API_KEY ? `설정됨 (앞 4글자: ${String(NEIS_API_KEY).slice(0, 4)}...)` : '미설정'
  );
}

/**
 * 학교 검색
 * @param {string} schoolName - 검색할 학교명
 * @param {string} apiKey - NEIS API 인증키 (환경변수에서 가져옴)
 * @returns {Promise<Array>} 학교 목록 배열
 */
export const searchSchools = async (schoolName) => {
  if (!schoolName || schoolName.trim() === '') {
    return [];
  }

  // API 키는 환경변수에서 가져옴
  const apiKey = NEIS_API_KEY || '';
  
  if (!apiKey) {
    console.warn('NEIS API 키가 설정되지 않았습니다. REACT_APP_NEIS_API_KEY 환경변수를 설정해주세요.');
    throw new Error('NEIS API 키가 설정되지 않았습니다.');
  }

  try {
    const url = `${NEIS_API_BASE_URL}/schoolInfo?Type=json&pIndex=1&pSize=100&KEY=${apiKey}&SCHUL_NM=${encodeURIComponent(schoolName)}`;
    console.log('[NEIS][searchSchools] 요청 URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    
    // NEIS API 응답 구조 처리
    if (data.schoolInfo && data.schoolInfo[1] && data.schoolInfo[1].row) {
      return data.schoolInfo[1].row.map(school => ({
        code: school.SD_SCHUL_CODE, // 학교 코드
        officeCode: school.ATPT_OFCDC_SC_CODE, // 시도교육청코드
        name: school.SCHUL_NM, // 학교명
        address: school.ORG_RDNMA || school.ORG_TELNO, // 도로명주소
        type: school.SCHUL_KND_SC_NM, // 학교종류명
        location: school.LCTN_SC_NM, // 소재지명
      }));
    }
    
    return [];
  } catch (error) {
    console.error('학교 검색 오류:', error);
    throw error;
  }
};

/**
 * 학교 상세 정보 조회 (주소 포함)
 * @param {string} officeCode - 시도교육청코드
 * @param {string} schoolCode - 학교 코드
 * @param {string} apiKey - NEIS API 인증키
 * @returns {Promise<Object>} 학교 상세 정보
 */
export const getSchoolAddress = async (officeCode, schoolCode) => {
  if (!officeCode || !schoolCode) {
    throw new Error('교육청 코드와 학교 코드가 필요합니다.');
  }

  const apiKey = NEIS_API_KEY || '';
  
  if (!apiKey) {
    console.warn('NEIS API 키가 설정되지 않았습니다.');
    throw new Error('NEIS API 키가 설정되지 않았습니다.');
  }

  try {
    const url = `${NEIS_API_BASE_URL}/schoolInfo?Type=json&pIndex=1&pSize=1&KEY=${apiKey}&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}`;
    console.log('[NEIS][getSchoolAddress] 요청 URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.schoolInfo && data.schoolInfo[1] && data.schoolInfo[1].row && data.schoolInfo[1].row.length > 0) {
      const school = data.schoolInfo[1].row[0];
      return {
        address: school.ORG_RDNMA || school.ORG_TELNO || '', // 도로명주소
        zipCode: school.ORG_RDNZIP || '', // 우편번호
        name: school.SCHUL_NM, // 학교명
      };
    }
    
    throw new Error('학교 정보를 찾을 수 없습니다.');
  } catch (error) {
    console.error('학교 주소 조회 오류:', error);
    throw error;
  }
};

/**
 * 시간표 조회 (날짜 기반 캐싱 포함)
 * @param {number} grade - 학년
 * @param {number} classNum - 반
 * @param {string} date - 날짜 (YYYY.MM.DD 형식)
 * @returns {Promise<Array>} 시간표 배열
 */
export const getTimetable = async (grade, classNum, date) => {
  if (!grade || !classNum) {
    return [];
  }

  const apiKey = NEIS_API_KEY || '';
  
  if (!apiKey) {
    console.warn('NEIS API 키가 설정되지 않았습니다.');
    return [];
  }

  // 오늘 날짜 계산 (YYYYMMDD)
  const today = new Date();
  const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  
  // 요청 날짜 (YYYYMMDD)
  const dateStr = date.replace(/\./g, '').replace(/\s/g, '');
  
  // 캐시 키
  const cacheKey = `neis_timetable_${dateStr}_${grade}_${classNum}`;
  
  // 오늘 날짜인 경우 캐시 확인
  if (dateStr === todayStr) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        const cachedDate = cachedData.date;
        
        // 캐시된 날짜가 오늘과 같으면 캐시 사용
        if (cachedDate === todayStr) {
          console.log('[NEIS] 시간표 캐시 사용:', cacheKey);
          return cachedData.data;
        }
      }
    } catch (e) {
      console.warn('[NEIS] 캐시 읽기 실패:', e);
    }
  }

  try {
    const params = new URLSearchParams({
      KEY: apiKey,
      Type: 'json',
      pIndex: '1',
      pSize: '100',
      ATPT_OFCDC_SC_CODE: 'B10',     // 서울시교육청
      SD_SCHUL_CODE: '7011569',      // 미림마이스터고
      GRADE: grade,
      CLASS_NM: classNum,
      ALL_TI_YMD: dateStr,
    });

    const url = `https://open.neis.go.kr/hub/hisTimetable?${params.toString()}`;
    console.log('[NEIS][getTimetable] 요청 URL:', url);
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();

    // API 오류 체크
    if (data.RESULT && data.RESULT.CODE && data.RESULT.CODE !== 'INFO-000') {
      console.warn('NEIS API 오류:', data.RESULT.MESSAGE || data.RESULT.CODE);
      return [];
    }

    // 시간표 데이터 확인
    if (!data.hisTimetable || !data.hisTimetable[1] || !data.hisTimetable[1].row) {
      return [];
    }

    const rows = data.hisTimetable[1].row;

    if (!rows || rows.length === 0) {
      return [];
    }

    // 정렬 + 표시 형식 통일
    const result = rows
      .filter(item => item.PERIO && (item.ITRT_CNTNT || item.SUBJECT_NM))
      .sort((a, b) => parseInt(a.PERIO) - parseInt(b.PERIO))
      .map(item => ({
        period: `${item.PERIO}교시`,
        subject: item.ITRT_CNTNT || item.SUBJECT_NM || "수업 정보 없음",
      }));

    // 오늘 날짜인 경우에만 캐시 저장
    if (dateStr === todayStr && result.length > 0) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          date: todayStr,
          data: result,
        }));
        console.log('[NEIS] 시간표 캐시 저장:', cacheKey);
      } catch (e) {
        console.warn('[NEIS] 캐시 저장 실패:', e);
      }
    }

    return result;
  } catch (error) {
    console.error('시간표 조회 오류:', error);
    return [];
  }
};

/**
 * 급식 메뉴 조회 (날짜 기반 캐싱 포함)
 * @param {string} date - 날짜 (YYYY.MM.DD 형식 또는 Date 객체)
 * @returns {Promise<Object>} 급식 메뉴 객체 { 조식: [], 중식: [], 석식: [] }
 */
export const getMealMenu = async (date) => {
  const apiKey = NEIS_API_KEY || '';
  
  if (!apiKey) {
    console.warn('NEIS API 키가 설정되지 않았습니다.');
    return { 조식: [], 중식: [], 석식: [] };
  }

  // 날짜를 YYYYMMDD 형식으로 변환
  let dateData;
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    dateData = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  } else {
    dateData = date.replace(/\./g, '').replace(/\s/g, '');
  }

  // 오늘 날짜 계산 (YYYYMMDD)
  const today = new Date();
  const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  
  // 캐시 키
  const cacheKey = `neis_meal_${dateData}`;
  
  // 오늘 날짜인 경우 캐시 확인
  if (dateData === todayStr) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        const cachedDate = cachedData.date;
        
        // 캐시된 날짜가 오늘과 같으면 캐시 사용
        if (cachedDate === todayStr) {
          console.log('[NEIS] 급식 캐시 사용:', cacheKey);
          return cachedData.data;
        }
      }
    } catch (e) {
      console.warn('[NEIS] 캐시 읽기 실패:', e);
    }
  }

  try {
    const ATPT_OFCDC_SC_CODE = "B10";   // 서울 특별시 교육청
    const SD_SCHUL_CODE = "7011569";
    const TYPE = "json";

    const api_url = `https://open.neis.go.kr/hub/mealServiceDietInfo?ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&KEY=${apiKey}&MLSV_YMD=${dateData}&Type=${TYPE}`;
    console.log('[NEIS][getMealMenu] 요청 URL:', api_url);

    const response = await fetch(api_url, {
      method: 'GET'
    });

    const data = await response.json();

    // 에러 체크
    if (!data || (data.RESULT && data.RESULT.CODE && data.RESULT.CODE !== 'INFO-000')) {
      return { 조식: [], 중식: [], 석식: [] };
    }

    if (!data.mealServiceDietInfo) {
      return { 조식: [], 중식: [], 석식: [] };
    }

    // 급식 데이터 추출
    const mealInfoArray = data.mealServiceDietInfo[1]?.row || [];
    const meals = {
      조식: [],
      중식: [],
      석식: [],
    };

    mealInfoArray.forEach(element => {
      const mealType = element.MMEAL_SC_NM; // 조식, 중식, 석식
      const dishName = element.DDISH_NM; // 메뉴 문자열
      
      if (dishName) {
        // 메뉴 파싱 (HTML 태그 제거 및 분리)
        const menuList = dishName
          .replace(/<br\/?>/gi, '\n')
          .replace(/<\/?[^>]+(>|$)/g, '')
          .split('\n')
          .map(menu => menu.trim())
          .filter(menu => menu.length > 0 && !menu.match(/^\d+\./)); // 번호 제거
        
        if (mealType === '조식' || mealType?.includes('조식')) {
          meals.조식 = menuList;
        } else if (mealType === '중식' || mealType?.includes('중식')) {
          meals.중식 = menuList;
        } else if (mealType === '석식' || mealType?.includes('석식')) {
          meals.석식 = menuList;
        }
      }
    });

    // 오늘 날짜인 경우에만 캐시 저장
    if (dateData === todayStr && (meals.조식.length > 0 || meals.중식.length > 0 || meals.석식.length > 0)) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          date: todayStr,
          data: meals,
        }));
        console.log('[NEIS] 급식 캐시 저장:', cacheKey);
      } catch (e) {
        console.warn('[NEIS] 캐시 저장 실패:', e);
      }
    }

    return meals;
  } catch (error) {
    console.error('급식 조회 오류:', error);
    return { 조식: [], 중식: [], 석식: [] };
  }
};

/**
 * 개발 환경용 모의 데이터
 */
const getMockSchoolData = (schoolName) => {
  const mockSchools = [
    {
      code: 'B100000123',
      officeCode: 'B10',
      name: `${schoolName}초등학교`,
      address: '서울특별시 강남구 테헤란로 123',
      type: '초등학교',
      location: '서울',
    },
    {
      code: 'B100000456',
      officeCode: 'B10',
      name: `${schoolName}중학교`,
      address: '서울특별시 강남구 테헤란로 456',
      type: '중학교',
      location: '서울',
    },
    {
      code: 'B100000789',
      officeCode: 'B10',
      name: `${schoolName}고등학교`,
      address: '서울특별시 강남구 테헤란로 789',
      type: '고등학교',
      location: '서울',
    },
  ];
  
  return mockSchools.filter(school => 
    school.name.toLowerCase().includes(schoolName.toLowerCase())
  );
};

