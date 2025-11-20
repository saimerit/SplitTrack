import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import useAppStore from '../store/useAppStore';
// Import the context definition from the new file
import { AuthContext } from './AuthContextDef';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  
  const setCurrentUser = useAppStore(state => state.setCurrentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const ledgerRef = doc(db, 'ledgers', 'main-ledger');
          const ledgerSnap = await getDoc(ledgerRef);
          
          if (ledgerSnap.exists()) {
            const data = ledgerSnap.data();
            const allowedEmails = data.allowed_emails || [];
            
            if (allowedEmails.includes(firebaseUser.email)) {
              setUser(firebaseUser);
              setCurrentUser(firebaseUser);
              setIsAllowed(true);
            } else {
              alert("Access Denied: You are not on the allowed list.");
              await signOut(auth);
              setUser(null);
              setIsAllowed(false);
            }
          }
        } catch (error) {
          console.error("Auth Gate Error:", error);
          setIsAllowed(false);
        }
      } else {
        setUser(null);
        setCurrentUser(null);
        setIsAllowed(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [setCurrentUser]);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, authLoading, isAllowed, logout }}>
      {children}
    </AuthContext.Provider>
  );
};