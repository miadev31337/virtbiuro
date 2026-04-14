import React, { useState, useEffect, useMemo } from 'react';
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
// Вставьте ваши данные из Firebase Console (Шаг 4 инструкции) ниже:
const firebaseConfig = {
  apiKey: "AIzaSyAwNxGthn9TaBbiZITH58Zin4X8wsEyaog",
  authDomain: "mycontractsystem.firebaseapp.com",
  projectId: "mycontractsystem",
  storageBucket: "mycontractsystem.firebasestorage.app",
  messagingSenderId: "742798632730",
  appId: "1:742798632730:web:012d17b9e9804ffcb3eea3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "contract-manager-v1"; // Уникальный ID для вашей базы данных

const SHEETS = {
  PENDING: 'OCZEKUJĄCE UMOWY',
  NEW: 'NOWE UMOWY',
  RENEWED: 'PRZEDŁUŻONE UMOWY',
  EXPIRED: 'ZAKOŃCZONE UMOWY'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [activeTab, setActiveTab] = useState(SHEETS.NEW);
  const [loading, setLoading] = useState(true);
  
  // Состояния для авторизации
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Состояния для создания договора
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContract, setNewContract] = useState({ client: '', value: '', dateEnd: '' });

  // 1. Мониторинг состояния пользователя
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

  // 2. Загрузка данных (только если залогинены)
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

  // Функции Auth
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
      setAuthError(err.message.includes('auth/user-not-found') ? 'Пользователь не найден' : 'Ошибка входа: проверьте данные');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  // Функции управления данными
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
    } catch (err) {
      console.error("Add error:", err);
    }
  };

  const moveContract = async (id, targetSheet) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', id);
      await updateDoc(docRef, { sheet: targetSheet });
    } catch (err) {
      console.error("Move error:", err);
    }
  };

  const deleteContract = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filteredData = useMemo(() => 
    contracts.filter(c => c.sheet === activeTab), 
  [contracts, activeTab]);

  // ЭКРАН ВХОДА
  if (!user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="bg-indigo-600 p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold">Вход в систему</h1>
            <p className="text-indigo-100 text-sm mt-1">Доступ только для сотрудников</p>
          </div>
          
          <form onSubmit={handleAuth} className="p-8 space-y-5">
            {authError && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {authError}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Пароль</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password" 
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
              {isRegistering ? 'Создать аккаунт' : 'Войти в систему'}
            </button>
            
            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-xs text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-slate-400 animate-pulse font-medium">Синхронизация данных...</p>
      </div>
    );
  }

  // ОСНОВНОЙ ИНТЕРФЕЙС
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">ContractCloud</h1>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                <span className="flex items-center gap-1 text-indigo-600"><Users className="w-3 h-3" /> {user?.email}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <button onClick={handleLogout} className="hover:text-red-500 flex items-center gap-1">
                  <LogOut className="w-3 h-3" /> Выйти
                </button>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Новый договор
          </button>
        </header>

        {/* Navigation */}
        <nav className="flex overflow-x-auto p-1.5 bg-slate-200/50 rounded-2xl gap-1 no-scrollbar backdrop-blur-sm">
          {Object.values(SHEETS).map(name => (
            <button
              key={name}
              onClick={() => setActiveTab(name)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === name 
                ? 'bg-white text-indigo-600 shadow-md' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
              }`}
            >
              {name === SHEETS.PENDING && <Clock className="w-4 h-4" />}
              {name === SHEETS.NEW && <CheckCircle className="w-4 h-4" />}
              {name === SHEETS.RENEWED && <RefreshCcw className="w-4 h-4" />}
              {name === SHEETS.EXPIRED && <XCircle className="w-4 h-4" />}
              {name}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === name ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                {contracts.filter(c => c.sheet === name).length}
              </span>
            </button>
          ))}
        </nav>

        {/* Table View */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Клиент</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Даты</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Сумма</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.map(c => {
                  const isLate = c.dateEnd && new Date(c.dateEnd) < new Date();
                  return (
                    <tr key={c.id} className="group hover:bg-indigo-50/30 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all duration-300">
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-lg leading-tight mb-1">{c.client}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">ID: {c.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <Calendar className="w-4 h-4 text-slate-300" /> {c.dateStart}
                          </div>
                          {c.dateEnd && (
                            <div className={`flex items-center gap-2 ${isLate ? 'text-red-500 font-bold' : 'text-slate-400 font-medium'}`}>
                              <ArrowRightLeft className="w-4 h-4 opacity-50" /> {c.dateEnd}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-slate-700 text-lg">
                        {c.value.toLocaleString()} <span className="text-slate-300 text-sm font-normal">₽</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-end gap-3">
                          {activeTab === SHEETS.PENDING && (
                            <button 
                              onClick={() => moveContract(c.id, SHEETS.NEW)}
                              className="px-5 py-2 bg-green-500 text-white rounded-xl text-xs font-black shadow-lg shadow-green-100 hover:bg-green-600 active:scale-95 transition-all"
                            >
                              ПОДТВЕРДИТЬ
                            </button>
                          )}
                          {activeTab === SHEETS.NEW && (
                            <>
                              <button 
                                onClick={() => moveContract(c.id, SHEETS.RENEWED)}
                                className="px-5 py-2 bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-600 active:scale-95 transition-all"
                              >
                                ПРОДЛИТЬ
                              </button>
                              <button 
                                onClick={() => moveContract(c.id, SHEETS.EXPIRED)}
                                className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                                title="Архивировать"
                              >
                                <XCircle className="w-6 h-6" />
                              </button>
                            </>
                          )}
                          {activeTab === SHEETS.EXPIRED && (
                            <button 
                              onClick={() => deleteContract(c.id)}
                              className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                            >
                              <XCircle className="w-6 h-6" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredData.length === 0 && (
              <div className="p-24 text-center flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                  <Database className="w-10 h-10" />
                </div>
                <p className="text-slate-400 font-bold italic tracking-wide">Раздел пуст</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <h2 className="text-2xl font-black mb-6 text-slate-800">Новый договор</h2>
              <form onSubmit={addContract} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">Клиент</label>
                  <input 
                    autoFocus required
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                    placeholder="Название компании"
                    value={newContract.client}
                    onChange={e => setNewContract({...newContract, client: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">Сумма (₽)</label>
                  <input 
                    required type="number"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                    placeholder="0"
                    value={newContract.value}
                    onChange={e => setNewContract({...newContract, value: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">Дедлайн</label>
                  <input 
                    type="date"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    value={newContract.dateEnd}
                    onChange={e => setNewContract({...newContract, dateEnd: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                  >
                    Создать
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <footer className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] pt-4">
          <Lock className="w-3 h-3" /> Защищенное соединение SSL
        </footer>

      </div>
    </div>
  );
}
