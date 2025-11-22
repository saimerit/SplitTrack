import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import useAppStore from '../store/useAppStore';
import { AuthContext } from './AuthContextDef';
import AlertModal from '../components/modals/AlertModal';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  
  // State for the Access Denied Modal
  const [showDeniedModal, setShowDeniedModal] = useState(false);
  
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
              // User Allowed
              setUser(firebaseUser);
              setCurrentUser(firebaseUser);
              setIsAllowed(true);
            } else {
              // User NOT Allowed (Logic Check)
              setShowDeniedModal(true);
              setUser(null);
              setIsAllowed(false);
            }
          }
        } catch (error) {
          console.error("Auth Gate Error:", error);
          
          // FIX: Trigger the modal even if Firestore throws an error (e.g. Permission Denied)
          setShowDeniedModal(true);
          setUser(null);
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

  const handleDeniedConfirm = async () => {
    setShowDeniedModal(false);
    await signOut(auth);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, authLoading, isAllowed, logout }}>
      {children}
      
      <AlertModal 
        isOpen={showDeniedModal}
        title="Access Denied"
        message="You are not allowed/not registered to the application, accessing this without proper legal authorization will lead to consequences. This is a private secure database. If you feel this is wrong, please contact the administrator."
        onConfirm={handleDeniedConfirm}
        confirmText="OK"
        variant="danger"
      />
    </AuthContext.Provider>
  );
};