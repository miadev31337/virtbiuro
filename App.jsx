import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  Plus, 
  CheckCircle, 
  XCircle, 
  RefreshCcw, 
  Clock, 
  ArrowRightLeft,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  Database,
  Users,
  Lock,
  LogOut,
  Mail,
  Key
} from 'lucide-react';

// Инициализация Firebase
// Вставьте ваши данные из Firebase Console ниже:
const firebaseConfig = {
  apiKey: "ВАШ_API_KEY",
  authDomain: "ВАШ_PROJECT_ID.firebaseapp.com",
  projectId: "ВАШ_PROJECT_ID",
  storageBucket: "ВАШ_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "ВАШ_SENDER_ID",
  appId: "ВАШ_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "contract-manager-v1";

const SHEETS = {
  PENDING: 'OCZEKUJĄCE UMOWY',
  NEW: 'NOWE UMOWY',
  RENEWED: 'PRZEDŁUŻONE UMOWY',
  EXPIRED: 'ZAKOŃCZONE UMOWY'
};

function App() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [activeTab, setActiveTab] = useState(SHEETS.NEW);
  const [loading, setLoading] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newContract, setNewContract] = useState({ client: '', value: '', dateEnd: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        setContracts([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const contractsCol = collection(db, 'artifacts', appId, 'public', 'data', 'contracts');
    const unsubscribe = onSnapshot(contractsCol, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContracts(docs);
        setLoading(false);
      }, 
      (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError('Ошибка входа: проверьте данные');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const addContract = async (e) => {
    e.preventDefault();
    if (!newContract.client || !newContract.value) return;
    try {
      const contractsCol = collection(db, 'artifacts', appId, 'public', 'data', 'contracts');
      await addDoc(contractsCol, {
        client: newContract.client,
        value: Number(newContract.value),
        dateStart: new Date().toISOString().split('T')[0],
        dateEnd: newContract.dateEnd || null,
        sheet: SHEETS.PENDING,
        createdBy: user.email,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewContract({ client: '', value: '', dateEnd: '' });
    } catch (err) { console.error(err); }
  };

  const moveContract = async (id, targetSheet) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', id);
      await updateDoc(docRef, { sheet: targetSheet });
    } catch (err) { console.error(err); }
  };

  const deleteContract = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', id);
      await deleteDoc(docRef);
    } catch (err) { console.error(err); }
  };

  const filteredData = useMemo(() => contracts.filter(c => c.sheet === activeTab), [contracts, activeTab]);

  if (!user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-indigo-600 p-8 text-white text-center">
            <h1 className="text-2xl font-bold">Вход в систему</h1>
          </div>
          <form onSubmit={handleAuth} className="p-8 space-y-5">
            {authError && <div className="text-red-600 text-xs">{authError}</div>}
            <input type="email" required className="w-full p-3 border rounded-xl" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" required className="w-full p-3 border rounded-xl" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold">Войти</button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-xs text-slate-400">
              {isRegistering ? 'Есть аккаунт? Войти' : 'Нет аккаунта? Создать'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm">
          <h1 className="text-xl font-black">ContractCloud</h1>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">{user?.email}</span>
            <button onClick={handleLogout} className="text-xs text-red-500">Выйти</button>
            <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold">+ Добавить</button>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto p-1 bg-slate-200 rounded-2xl">
          {Object.values(SHEETS).map(name => (
            <button key={name} onClick={() => setActiveTab(name)} className={`px-4 py-2 rounded-xl text-sm font-bold ${activeTab === name ? 'bg-white text-indigo-600' : 'text-slate-500'}`}>
              {name}
            </button>
          ))}
        </nav>

        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead><tr className="bg-slate-50 text-[10px] uppercase text-slate-400"><th className="p-6">Клиент</th><th className="p-6">Даты</th><th className="p-6 text-right">Сумма</th><th className="p-6 text-right">Действия</th></tr></thead>
            <tbody>
              {filteredData.map(c => (
                <tr key={c.id} className="border-t">
                  <td className="p-6 font-bold">{c.client}</td>
                  <td className="p-6 text-sm text-slate-500">{c.dateStart} - {c.dateEnd}</td>
                  <td className="p-6 text-right font-bold">{c.value.toLocaleString()} ₽</td>
                  <td className="p-6 text-right flex justify-end gap-2">
                    {activeTab === SHEETS.PENDING && <button onClick={() => moveContract(c.id, SHEETS.NEW)} className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold">ОК</button>}
                    {activeTab === SHEETS.NEW && <button onClick={() => moveContract(c.id, SHEETS.RENEWED)} className="bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Продлить</button>}
                    <button onClick={() => deleteContract(c.id)} className="text-slate-300 hover:text-red-500"><XCircle /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={addContract} className="bg-white p-8 rounded-3xl w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">Новый договор</h2>
            <input required className="w-full p-3 border rounded-xl" placeholder="Клиент" value={newContract.client} onChange={e => setNewContract({...newContract, client: e.target.value})} />
            <input required type="number" className="w-full p-3 border rounded-xl" placeholder="Сумма" value={newContract.value} onChange={e => setNewContract({...newContract, value: e.target.value})} />
            <input type="date" className="w-full p-3 border rounded-xl" value={newContract.dateEnd} onChange={e => setNewContract({...newContract, dateEnd: e.target.value})} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-400">Отмена</button>
              <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Создать</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ЗАПУСК ПРИЛОЖЕНИЯ (Этого не хватало!)
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
