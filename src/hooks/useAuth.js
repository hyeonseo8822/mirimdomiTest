import { useContext } from 'react';
import AuthContext from '../contexts/AuthContext';

// useAuth: 기존 사용처와 호환되도록 AuthContext에서 값을 반환합니다.
export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) return { user: null, authReady: false };
  return ctx;
}
