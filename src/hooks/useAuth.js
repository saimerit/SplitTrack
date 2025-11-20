import { useContext } from 'react';
// Update this import path to point to the definition file
import { AuthContext } from '../context/AuthContextDef';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};