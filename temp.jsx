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
  signOut
} from 'firebase/auth';
import { Plus, XCircle, LogOut } from 'lucide-react';
import './index.css';

// Инициализация Firebase
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
const appId = "contract-manager-v1";

const SHEETS = {
  PENDING: 'OCZEKUJĄCE UMOWY',
  NEW: 'BIEŻĄCE UMOWY',
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
  
  // Modals state
  const [confirmOkContractId, setConfirmOkContractId] = useState(null);
  const [confirmUncheckContractId, setConfirmUncheckContractId] = useState(null);
  const [extendContractId, setExtendContractId] = useState(null);
  const [extendMonths, setExtendMonths] = useState(12);

  // Filters state
  const [filterAdded, setFilterAdded] = useState('');
  const [filterCustomDate, setFilterCustomDate] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterExtended, setFilterExtended] = useState('');

  const defaultNewContract = () => ({
    nazwa: '',
    nip: '',
    numerBiura: '',
    kwota: 600,
    okresNajmu: 12,
    dataRozpoczecia: new Date().toISOString().split('T')[0]
  });

  const [newContract, setNewContract] = useState(defaultNewContract());

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
      console.error("Firebase auth error:", err.code, err.message);
      setAuthError('Błąd logowania: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const getNextOfficeNumber = () => {
    let maxNum = 0;
    contracts.forEach(c => {
      if (c.numerBiura && c.numerBiura.startsWith('02.')) {
        const numPart = parseInt(c.numerBiura.substring(3), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    const nextNum = maxNum + 1;
    const paddedNum = nextNum.toString().padStart(3, '0');
    return `02.${paddedNum}`;
  };

  const openAddModal = () => {
    setNewContract({
      ...defaultNewContract(),
      numerBiura: getNextOfficeNumber()
    });
    setShowAddModal(true);
  };

  const addContract = async (e) => {
    e.preventDefault();
    if (!newContract.nazwa) return;
    try {
      const contractsCol = collection(db, 'artifacts', appId, 'public', 'data', 'contracts');
      
      let calculatedDateEnd = null;
      if (newContract.dataRozpoczecia) {
        const d = new Date(newContract.dataRozpoczecia);
        d.setMonth(d.getMonth() + Number(newContract.okresNajmu));
        calculatedDateEnd = d.toISOString().split('T')[0];
      }

      await addDoc(contractsCol, {
        client: newContract.nazwa,
        nazwa: newContract.nazwa,
        nip: newContract.nip,
        numerBiura: newContract.numerBiura,
        okresNajmu: Number(newContract.okresNajmu),
        kwota: Number(newContract.kwota),
        value: Number(newContract.kwota || 0),
        dataRozpoczecia: newContract.dataRozpoczecia,
        dateStart: newContract.dataRozpoczecia,
        dateEnd: calculatedDateEnd,
        sheet: SHEETS.PENDING,
        createdBy: user.email,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setNewContract(defaultNewContract());
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

  const handleExtend = async () => {
    if (!extendContractId) return;
    
    // Продление даты
    const contract = contracts.find(c => c.id === extendContractId);
    if (!contract) return;
    
    try {
      let newDateEnd = null;
      // Если у нас уже было продление, берем dateEndExtended, если нет - берем dateEnd.
      const baseDateString = contract.dateEndExtended || contract.dateEnd || contract.dataRozpoczecia || contract.dateStart;
      
      if (baseDateString) {
        const dateObj = new Date(baseDateString);
        // + period месяцев
        dateObj.setMonth(dateObj.getMonth() + extendMonths);
        newDateEnd = dateObj.toISOString().split('T')[0];
      } else {
        // Фоллбэк
        const dateObj = new Date();
        dateObj.setMonth(dateObj.getMonth() + extendMonths);
        newDateEnd = dateObj.toISOString().split('T')[0];
      }
      
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', extendContractId);
      await updateDoc(docRef, { 
        dateEndExtended: newDateEnd,
        oplata: { done: false, checkedBy: null }
      });
      
      setExtendContractId(null);
      setExtendMonths(12);
    } catch (err) { console.error(err); }
  };

  const toggleOplata = async (contractId, currentStatus) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', contractId);
      const newStatus = !currentStatus;
      await updateDoc(docRef, {
        oplata: {
          done: newStatus,
          checkedBy: newStatus ? user.email : null
        }
      });
    } catch (err) { console.error(err); }
  };

  const filteredData = useMemo(() => {
    const data = contracts.filter(c => {
      // Поддержка старых записей "NOWE UMOWY" для вкладки "BIEŻĄCE UMOWY"
      const isValidSheet = (activeTab === SHEETS.NEW && c.sheet === 'NOWE UMOWY') || c.sheet === activeTab;
      if (!isValidSheet) return false;

      // Filter Payment
      if (filterPayment === 'TAK' && !c.oplata?.done) return false;
      if (filterPayment === 'NIE' && c.oplata?.done) return false;

      // Filter Extended
      if (filterExtended === 'TAK' && !c.dateEndExtended) return false;
      if (filterExtended === 'NIE' && c.dateEndExtended) return false;

      // Filter Added Date
      if (filterAdded) {
        let docDate = null;
        if (c.createdAt && c.createdAt.toDate) {
          docDate = c.createdAt.toDate();
        } else if (c.createdAt) {
          docDate = new Date(c.createdAt);
        } else if (c.dataRozpoczecia || c.dateStart) {
          docDate = new Date(c.dataRozpoczecia || c.dateStart);
        }

        if (docDate) {
          const docTimestamp = docDate.getTime();
          const now = new Date();
          now.setHours(0, 0, 0, 0); // start of today
          
          if (filterAdded === '30' || filterAdded === '90') {
            const daysAgo = new Date(now);
            daysAgo.setDate(daysAgo.getDate() - parseInt(filterAdded, 10));
            if (docTimestamp < daysAgo.getTime()) return false;
          } else if (filterAdded === 'custom' && filterCustomDate) {
            const customDateTimestamp = new Date(filterCustomDate).getTime();
            // Показываем договоры, добавленные НАЧИНАЯ с выбранной даты
            if (docTimestamp < customDateTimestamp) return false;
          }
        }
      }

      return true;
    });

    // Сортировка (новые сверху)
    return data.sort((a, b) => {
      const getTimestamp = (doc) => {
        if (doc.createdAt && doc.createdAt.toMillis) return doc.createdAt.toMillis();
        if (doc.createdAt) return new Date(doc.createdAt).getTime();
        if (doc.dataRozpoczecia || doc.dateStart) return new Date(doc.dataRozpoczecia || doc.dateStart).getTime();
        return 0;
      };
      return getTimestamp(b) - getTimestamp(a);
    });
  }, [contracts, activeTab, filterAdded, filterCustomDate, filterPayment, filterExtended]);

  const clearFilters = () => {
    setFilterAdded('');
    setFilterCustomDate('');
    setFilterPayment('');
    setFilterExtended('');
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterAdded, filterCustomDate, filterPayment, filterExtended]);
  
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const currentData = filteredData.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  if (!user && !loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Logowanie</h1>
          </div>
          <form onSubmit={handleAuth} className="auth-form">
            {authError && <div className="auth-error">{authError}</div>}
            <input 
              type="email" 
              required 
              className="input-field" 
              placeholder="Adres e-mail" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
            <input 
              type="password" 
              required 
              className="input-field" 
              placeholder="Hasło" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
            <button type="submit" className="btn-primary">
              {isRegistering ? 'Zarejestruj się' : 'Zaloguj się'}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="btn-link">
              {isRegistering ? 'Masz konto? Zaloguj się' : 'Nie masz konta? Utwórz'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="content-loader">Ładowanie...</div>;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Wirtualne biuro Vogla 28</h1>
        <div className="header-actions">
          <span className="user-email">{user?.email}</span>
          <button onClick={handleLogout} className="btn-logout" title="Wyloguj">
            {window.innerWidth > 600 ? 'Wyloguj' : <LogOut size={18} />}
          </button>
          <button onClick={openAddModal} className="btn-add">
            <Plus size={18} /> {window.innerWidth > 600 ? 'Dodaj' : ''}
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        {Object.values(SHEETS).map(name => (
          <button 
            key={name} 
            onClick={() => setActiveTab(name)} 
            className={`tab-btn ${activeTab === name ? 'active' : ''}`}
          >
            {name}
          </button>
        ))}
      </nav>

      <div className="filters-bar">
        <div className="filter-group">
          <span className="filter-label">Ostatnio dodane:</span>
          <select className="filter-select" value={filterAdded} onChange={e => setFilterAdded(e.target.value)}>
            <option value="">Wszystkie</option>
            <option value="30">30 dni</option>
            <option value="90">90 dni</option>
            <option value="custom">Swoja data</option>
          </select>
          {filterAdded === 'custom' && (
            <input 
              type="date" 
              className="filter-select" 
              value={filterCustomDate} 
              onChange={e => setFilterCustomDate(e.target.value)} 
            />
          )}
        </div>

        <div className="filter-group">
          <span className="filter-label">Płatność:</span>
          <select className="filter-select" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
            <option value="">Wszystkie</option>
            <option value="TAK">Tak</option>
            <option value="NIE">Nie</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Przedłużone:</span>
          <select className="filter-select" value={filterExtended} onChange={e => setFilterExtended(e.target.value)}>
            <option value="">Wszystkie</option>
            <option value="TAK">Tak</option>
            <option value="NIE">Nie</option>
          </select>
        </div>

        {(filterAdded || filterPayment || filterExtended) && (
          <button onClick={clearFilters} className="btn-clear-filters">
            Wyczyść filtry
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Klient</th>
              <th>Daty</th>
              {activeTab !== SHEETS.EXPIRED && <th>Manager</th>}
              <th style={{textAlign: 'right'}}>Kwota</th>
              {activeTab !== SHEETS.PENDING && <th style={{textAlign: 'center'}}>Opłata</th>}
              <th style={{textAlign: 'right'}}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map(c => (
              <tr key={c.id}>
                <td className="cell-client">
                  <div style={{fontWeight: 800, marginBottom: '0.3rem'}}>{c.nazwa || c.client || '-'}</div>
                  {c.nip && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>NIP:</span> {c.nip}</div>}
                  {c.numerBiura && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>Biuro:</span> {c.numerBiura}</div>}
                </td>
                <td className="cell-dates">
                  {c.okresNajmu && <div style={{fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem'}}>Okres: {c.okresNajmu} miesięcy</div>}
                  {(c.dataRozpoczecia || c.dateStart) && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>Start:</span> {c.dataRozpoczecia || c.dateStart}</div>}
                  {c.dateEnd && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>Koniec:</span> {c.dateEnd}</div>}
                  {c.dateEndExtended && <div style={{fontSize: '0.85rem', color: 'var(--danger-color)', fontWeight: 700, marginTop: '0.2rem'}}>Przedłużona do: {c.dateEndExtended}</div>}
                </td>
                {activeTab !== SHEETS.EXPIRED && (
                  <td style={{fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500}}>
                    {c.createdBy || '-'}
                  </td>
                )}
                <td className="cell-value">{(c.kwota || c.value || 0).toLocaleString()} PLN</td>
                
                {/* Opłata */}
                {activeTab !== SHEETS.PENDING && (
                  <td style={{textAlign: 'center', verticalAlign: 'middle'}}>
                    <div title={c.oplata?.checkedBy ? `Oznaczono przez: ${c.oplata.checkedBy}` : ''}>
                      <input 
                        type="checkbox" 
                        checked={!!c.oplata?.done} 
                        onChange={() => {
                          if (c.oplata?.done) {
                            setConfirmUncheckContractId(c.id);
                          } else {
                            toggleOplata(c.id, false);
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                      />
                    </div>
                  </td>
                )}

                <td style={{verticalAlign: 'middle'}}>
                  <div className="cell-actions-inner">
                    {activeTab === SHEETS.PENDING && (
                      <button onClick={() => setConfirmOkContractId(c.id)} className="btn-action success">OK</button>
                    )}
                    {activeTab === SHEETS.NEW && (
                      <button onClick={() => setExtendContractId(c.id)} className="btn-action indigo">Przedłuż</button>
                    )}
                    <button onClick={() => deleteContract(c.id)} className="btn-icon" title="Usuń">
                      <XCircle size={20} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredData.length === 0 && (
           <div style={{padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)'}}>
             Brak umów w tej kategorii
           </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-bar">
          <button 
            className="btn-pagination" 
            disabled={safePage === 1} 
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Poprzednia
          </button>
          <span className="pagination-info">Strona {safePage} z {totalPages}</span>
          <button 
            className="btn-pagination" 
            disabled={safePage === totalPages} 
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Następna
          </button>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <form onSubmit={addContract} className="modal-card">
            <h2 className="modal-title">Nowa umowa</h2>
            <input 
              required 
              className="input-field" 
              placeholder="Nazwa" 
              value={newContract.nazwa} 
              onChange={e => setNewContract({ ...newContract, nazwa: e.target.value })} 
            />
            <input 
              type="number" 
              className="input-field" 
              placeholder="NIP" 
              value={newContract.nip} 
              onChange={e => setNewContract({ ...newContract, nip: e.target.value })} 
            />
            <input 
              required 
              className="input-field" 
              placeholder="Numer biura" 
              value={newContract.numerBiura} 
              onChange={e => setNewContract({ ...newContract, numerBiura: e.target.value })} 
            />
            
            <select
              className="input-field"
              value={newContract.okresNajmu}
              onChange={e => {
                const val = Number(e.target.value);
                setNewContract({ ...newContract, okresNajmu: val, kwota: val * 50 });
              }}
            >
              {[6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>Okres najmu: {m} miesięcy</option>
              ))}
            </select>
            
            <input 
              required 
              type="date" 
              className="input-field" 
              value={newContract.dataRozpoczecia} 
              onChange={e => setNewContract({ ...newContract, dataRozpoczecia: e.target.value })} 
              title="Data rozpoczęcia"
            />

            <div className="input-with-currency">
              <input 
                required 
                type="number" 
                className="input-field" 
                placeholder="Kwota" 
                value={newContract.kwota} 
                onChange={e => setNewContract({ ...newContract, kwota: e.target.value })} 
              />
              <span className="currency-symbol">PLN</span>
            </div>
            
            <div className="modal-actions">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Anuluj</button>
              <button type="submit" className="btn-primary">Utwórz</button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm OK Modal */}
      {confirmOkContractId && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 className="modal-title" style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Czy na pewno chcesz przenieść umowę do bieżących?</h2>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                onClick={() => setConfirmOkContractId(null)} 
                className="btn-secondary" 
                style={{ flex: 1 }}>
                NIE
              </button>
              <button 
                onClick={() => {
                  moveContract(confirmOkContractId, SHEETS.NEW);
                  setConfirmOkContractId(null);
                }} 
                className="btn-primary" 
                style={{ flex: 1, backgroundColor: 'var(--success-color)' }}>
                TAK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {extendContractId && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '400px' }}>
            <h2 className="modal-title" style={{ fontSize: '1.25rem', marginBottom: '0' }}>Okres przedłużenia umowy na:</h2>
            <select
              className="input-field"
              value={extendMonths}
              onChange={e => setExtendMonths(Number(e.target.value))}
            >
              {[6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>{m} miesięcy</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
              <button onClick={() => { setExtendContractId(null); setExtendMonths(12); }} className="btn-secondary" style={{ flex: 1 }}>Odrzuć</button>
              <button onClick={handleExtend} className="btn-primary" style={{ flex: 1 }}>Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Uncheck Modal */}
      {confirmUncheckContractId && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 className="modal-title" style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Czy na pewno chcesz cofnąć status płatności?</h2>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                onClick={() => setConfirmUncheckContractId(null)} 
                className="btn-secondary" 
                style={{ flex: 1 }}>
                NIE
              </button>
              <button 
                onClick={() => {
                  toggleOplata(confirmUncheckContractId, true); // true = был включен, теперь выключаем
                  setConfirmUncheckContractId(null);
                }} 
                className="btn-primary" 
                style={{ flex: 1, backgroundColor: 'var(--danger-color)' }}>
                TAK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ЗАПУСК ПРИЛОЖЕНИЯ
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
