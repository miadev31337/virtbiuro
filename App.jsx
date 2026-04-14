import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Plus, XCircle, LogOut, Pencil, RefreshCw, ArrowRight, Upload } from 'lucide-react';
import Papa from 'papaparse';
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
  const [confirmDeleteContractId, setConfirmDeleteContractId] = useState(null);
  const [extendContractId, setExtendContractId] = useState(null);
  const [extendMonths, setExtendMonths] = useState(12);
  const [editingContract, setEditingContract] = useState(null);

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

  const saveEditContract = async (e) => {
    e.preventDefault();
    if (!editingContract || !editingContract.id) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', editingContract.id);
      
      let calculatedDateEnd = null;
      const baseDate = editingContract.dataRozpoczecia || editingContract.dateStart;
      if (baseDate) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + Number(editingContract.okresNajmu || 12));
        d.setDate(d.getDate() - 1);
        calculatedDateEnd = d.toISOString().split('T')[0];
      }

      const payload = {
        client: editingContract.nazwa || editingContract.client,
        nazwa: editingContract.nazwa || editingContract.client,
        nip: editingContract.nip || '',
        numerBiura: editingContract.numerBiura || '',
        okresNajmu: Number(editingContract.okresNajmu || 12),
        kwota: Number(editingContract.kwota !== undefined && editingContract.kwota !== null ? editingContract.kwota : (editingContract.value || 0)),
        value: Number(editingContract.kwota !== undefined && editingContract.kwota !== null ? editingContract.kwota : (editingContract.value || 0)),
        dataRozpoczecia: baseDate,
        dateStart: baseDate,
        dateEnd: calculatedDateEnd,
        createdBy: user.email
      };

      if (editingContract.dateEndExtended) {
        const extD = new Date(calculatedDateEnd);
        const extMonths = Number(editingContract.extendMonthsEdit || 12);
        extD.setMonth(extD.getMonth() + extMonths);
        payload.dateEndExtended = extD.toISOString().split('T')[0];
        payload.extendPeriod = extMonths;
      }

      await updateDoc(docRef, payload);
      setEditingContract(null);
    } catch (err) { console.error(err); }
  };

  const handleOpenEdit = (c) => {
    setEditingContract({
      ...c,
      extendMonthsEdit: c.extendPeriod || 12
    });
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
        d.setDate(d.getDate() - 1);
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
      setConfirmDeleteContractId(null);
    } catch (err) { console.error(err); }
  };

  const updateStatusKRS = async (id, newStatus) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'contracts', id);
      await updateDoc(docRef, { statusKRS: newStatus });
    } catch (err) { console.error(err); }
  };

  const handleExtend = async () => {
    if (!extendContractId) return;
    
    // Продление даты
    const contract = contracts.find(c => c.id === extendContractId);
    if (!contract) return;
    
    try {
      let newDateEnd = null;
      // Строго берём оригинальную дату завершения (Koniec)
      const baseDateString = contract.dateEnd || contract.dataRozpoczecia || contract.dateStart;
      
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
        okresNajmu: extendMonths, // Обновляем выбранный период в таблице
        kwota: extendMonths * 50,
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
      let computedSheet = c.sheet;
      if (computedSheet === 'NOWE UMOWY') computedSheet = SHEETS.NEW;
      
      // Автоматический перенос в ZAKOŃCZONE UMOWY
      if (computedSheet === SHEETS.NEW || computedSheet === 'BIEŻĄCE UMOWY') {
        const actualKoniec = c.dateEndExtended || c.dateEnd;
        if (actualKoniec) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endDate = new Date(actualKoniec);
          endDate.setHours(0, 0, 0, 0);
          if (endDate < today) {
            computedSheet = SHEETS.EXPIRED;
          }
        }
      }

      if (computedSheet !== activeTab) return false;

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

  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const contractsCol = collection(db, 'artifacts', appId, 'public', 'data', 'contracts');
        
        let importedCount = 0;

        for (const row of rows) {
          try {
            const nazwa = row['Nazwa']?.trim();
            const nip = row['NIP']?.trim() || '';
            const start = row['Start']?.trim();
            const koniec = row['Koniec']?.trim();
            const biuro = row['Biuro']?.trim() || '';
            const krs = row['KRS']?.trim() || 'Aktywny';

            if (!nazwa || !start || !koniec) {
              console.warn('Пропуск строки: нет необходимых полей (Nazwa, Start, Koniec)', row);
              continue;
            }

            // Вычисляем Okres
            const startDate = new Date(start);
            const endDate = new Date(koniec);
            let diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
            
            // Если дни различаются, корректируем периоды (или проще просто взять разницу месяцев)
            if (diffMonths <= 0) diffMonths = 1;

            const okresNajmu = Number(diffMonths);
            const kwota = okresNajmu * 50;

            await addDoc(contractsCol, {
              client: nazwa,
              nazwa: nazwa,
              nip: nip,
              numerBiura: biuro,
              okresNajmu: okresNajmu,
              kwota: kwota,
              value: kwota, // backward compatibility
              dataRozpoczecia: start,
              dateStart: start,
              dateEnd: koniec,
              statusKRS: krs,
              sheet: 'BIEŻĄCE UMOWY',
              createdBy: 'Import',
              createdAt: serverTimestamp(),
              oplata: { done: false, checkedBy: null }
            });
            importedCount++;
          } catch (err) {
            console.error('Ошибка импорта строки', row, err);
          }
        }
        
        alert(`Импорт завершен! Успешно загружено ${importedCount} договоров.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => {
        console.error('Ошибка парсинга CSV:', error);
        alert('Ошибка при чтении файла. Убедитесь, что это корректный CSV.');
      }
    });
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
          
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn-import" title="Import CSV">
            <Upload size={18} /> {window.innerWidth > 600 ? 'Import' : ''}
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
            {activeTab === SHEETS.EXPIRED ? (
              <tr>
                <th>Klient</th>
                <th>Koniec</th>
                <th>Status w KRS / CEIDG</th>
                <th>Data wykreślenia</th>
                <th>Po terminie</th>
                <th style={{textAlign: 'right'}}>Akcje</th>
              </tr>
            ) : (
              <tr>
                <th>Klient</th>
                <th>Daty</th>
                {activeTab !== SHEETS.EXPIRED && <th>Manager</th>}
                <th style={{textAlign: 'right'}}>Kwota</th>
                {activeTab !== SHEETS.PENDING && <th style={{textAlign: 'center'}}>Opłata</th>}
                <th style={{textAlign: 'right'}}>Akcje</th>
              </tr>
            )}
          </thead>
          <tbody>
            {currentData.map(c => {
              if (activeTab === SHEETS.EXPIRED) {
                const actualKoniec = c.dateEndExtended || c.dateEnd;
                let dataWykreslenia = '-';
                let daysOverdue = 0;
                
                if (actualKoniec) {
                  const dObj = new Date(actualKoniec);
                  dObj.setDate(dObj.getDate() + 30);
                  dataWykreslenia = dObj.toISOString().split('T')[0];

                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const wykrObj = new Date(dataWykreslenia);
                  wykrObj.setHours(0, 0, 0, 0);
                  
                  daysOverdue = Math.floor((today.getTime() - wykrObj.getTime()) / (1000 * 3600 * 24));
                }

                const currentKRS = c.statusKRS || 'Aktywny';
                const showKara = daysOverdue > 0 && currentKRS === 'Aktywny';

                return (
                  <tr key={c.id}>
                    <td className="cell-client">
                      <div style={{fontWeight: 800, marginBottom: '0.3rem'}}>{c.nazwa || c.client || '-'}</div>
                      {c.nip && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>NIP:</span> {c.nip}</div>}
                      {c.numerBiura && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>Biuro:</span> {c.numerBiura}</div>}
                    </td>

                    <td className="cell-dates">
                      <div style={{fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500}}>
                        {actualKoniec || '-'}
                      </div>
                    </td>

                    <td>
                      <select 
                        className={`inline-status-select ${currentKRS.toLowerCase()}`}
                        value={currentKRS}
                        onChange={(e) => updateStatusKRS(c.id, e.target.value)}
                      >
                        <option value="Aktywny">Aktywny</option>
                        <option value="Nie">Nie</option>
                      </select>
                    </td>

                    <td className="cell-dates">
                      <div style={{fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500}}>
                        {dataWykreslenia}
                      </div>
                    </td>

                    <td className="cell-dates">
                      {showKara ? (
                        <>
                          <div style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--danger-color)'}}>{daysOverdue} {daysOverdue === 1 ? 'dzień' : 'dni'}</div>
                          <div className="kara-text">Kara: {daysOverdue * 500} PLN</div>
                        </>
                      ) : (
                        <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>-</div>
                      )}
                    </td>

                    <td style={{verticalAlign: 'middle'}}>
                      <div className="cell-actions-inner">
                        <button onClick={() => setExtendContractId(c.id)} className="btn-icon" title="Przedłuż" style={{ color: '#4f46e5' }}>
                          <RefreshCw size={20} />
                        </button>
                        <button onClick={() => handleOpenEdit(c)} className="btn-icon" title="Edytuj" style={{ color: 'var(--primary-color)' }}>
                          <Pencil size={20} />
                        </button>
                        <button onClick={() => setConfirmDeleteContractId(c.id)} className="btn-icon" title="Usuń" style={{ color: 'var(--danger-color)' }}>
                          <XCircle size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={c.id}>
                  <td className="cell-client">
                    <div style={{fontWeight: 800, marginBottom: '0.3rem'}}>{c.nazwa || c.client || '-'}</div>
                    {c.nip && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>NIP:</span> {c.nip}</div>}
                    {c.numerBiura && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>Biuro:</span> {c.numerBiura}</div>}
                  </td>
                  <td className="cell-dates">
                    {c.okresNajmu && <div style={{fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem'}}>Okres: {c.okresNajmu} mies.</div>}
                    {(c.dataRozpoczecia || c.dateStart) && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>Start:</span> {c.dataRozpoczecia || c.dateStart}</div>}
                    {c.dateEnd && <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}><span style={{color: 'var(--text-primary)', fontWeight: 700}}>Koniec:</span> {c.dateEnd}</div>}
                    {c.dateEndExtended && <div style={{fontSize: '0.85rem', color: 'var(--danger-color)', fontWeight: 700, marginTop: '0.2rem'}}>Przedłużona do: {c.dateEndExtended}</div>}
                  </td>
                  {activeTab !== SHEETS.EXPIRED && (
                    <td style={{fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500}}>
                      {c.createdBy || '-'}
                    </td>
                  )}
                  <td className="cell-value">{(c.kwota !== undefined && c.kwota !== null ? c.kwota : (c.value || 0)).toLocaleString()} PLN</td>
                  
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
                        <button onClick={() => setConfirmOkContractId(c.id)} className="btn-icon" title="Akceptuj" style={{ color: 'var(--success-color)' }}>
                          <ArrowRight size={20} />
                        </button>
                      )}
                      {activeTab === SHEETS.NEW && (
                        <button onClick={() => setExtendContractId(c.id)} className="btn-icon" title="Przedłuż" style={{ color: '#4f46e5' }}>
                          <RefreshCw size={20} />
                        </button>
                      )}
                      <button onClick={() => handleOpenEdit(c)} className="btn-icon" title="Edytuj" style={{ color: 'var(--primary-color)' }}>
                        <Pencil size={20} />
                      </button>
                      <button onClick={() => setConfirmDeleteContractId(c.id)} className="btn-icon" title="Usuń" style={{ color: 'var(--danger-color)' }}>
                        <XCircle size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {editingContract && (() => {
        let previewDateEnd = null;
        if (editingContract.dataRozpoczecia || editingContract.dateStart) {
          const d = new Date(editingContract.dataRozpoczecia || editingContract.dateStart);
          d.setMonth(d.getMonth() + Number(editingContract.okresNajmu || 12));
          d.setDate(d.getDate() - 1);
          previewDateEnd = d.toISOString().split('T')[0];
        }

        let previewDateExtended = null;
        if (editingContract.dateEndExtended && previewDateEnd) {
          const extD = new Date(previewDateEnd);
          extD.setMonth(extD.getMonth() + Number(editingContract.extendMonthsEdit || 12));
          previewDateExtended = extD.toISOString().split('T')[0];
        }

        return (
          <div className="modal-overlay">
            <form onSubmit={saveEditContract} className="modal-card">
              <h2 className="modal-title">Edytuj umowę</h2>
              <input 
                required 
                className="input-field" 
                placeholder="Nazwa" 
                value={editingContract.nazwa || editingContract.client || ''} 
                onChange={e => setEditingContract({ ...editingContract, nazwa: e.target.value })} 
              />
              <input 
                type="number" 
                className="input-field" 
                placeholder="NIP" 
                value={editingContract.nip || ''} 
                onChange={e => setEditingContract({ ...editingContract, nip: e.target.value })} 
              />
              <input 
                required 
                className="input-field" 
                placeholder="Numer biura" 
                value={editingContract.numerBiura || ''} 
                onChange={e => setEditingContract({ ...editingContract, numerBiura: e.target.value })} 
              />
              
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Data rozpoczęcia:</label>
                <input 
                  required 
                  type="date" 
                  className="input-field" 
                  value={editingContract.dataRozpoczecia || editingContract.dateStart || ''} 
                  onChange={e => setEditingContract({ ...editingContract, dataRozpoczecia: e.target.value, dateStart: e.target.value })} 
                  title="Data rozpoczęcia"
                />
              </div>
              
              <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Okres najmu:</label>
                  <select
                    className="input-field"
                    style={{ width: '120px', margin: 0 }}
                    value={editingContract.okresNajmu || 12}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setEditingContract({ ...editingContract, okresNajmu: val, kwota: val * 50 });
                    }}
                  >
                    {[6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>{m} mies.</option>
                    ))}
                  </select>
                </div>
                {previewDateEnd && (
                  <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    Koniec: {previewDateEnd}
                  </div>
                )}
              </div>

              {editingContract.dateEndExtended && (
                <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--danger-color)', whiteSpace: 'nowrap' }}>Przedłużenie:</label>
                    <select
                      className="input-field"
                      style={{ borderColor: 'var(--danger-color)', width: '120px', margin: 0 }}
                      value={editingContract.extendMonthsEdit || 12}
                      onChange={e => setEditingContract({ ...editingContract, extendMonthsEdit: Number(e.target.value) })}
                    >
                      {[6, 7, 8, 9, 10, 11, 12].map(m => (
                        <option key={m} value={m}>{m} mies.</option>
                      ))}
                    </select>
                  </div>
                  {previewDateExtended && (
                    <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--danger-color)', fontWeight: 600 }}>
                      Przedłużona do: {previewDateExtended}
                    </div>
                  )}
                </div>
              )}

              <div className="input-with-currency">
                <input 
                  required 
                  type="number" 
                  className="input-field" 
                  placeholder="Kwota" 
                  value={editingContract.kwota !== undefined && editingContract.kwota !== null ? editingContract.kwota : (editingContract.value || '')} 
                  onChange={e => setEditingContract({ ...editingContract, kwota: e.target.value })} 
                />
                <span className="currency-symbol">PLN</span>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingContract(null)} className="btn-secondary">Odrzuć</button>
                <button type="submit" className="btn-primary">Zapisz</button>
              </div>
            </form>
          </div>
        );
      })()}

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
                <option key={m} value={m}>Okres najmu: {m} mies.</option>
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
              style={{ width: '100%', marginBottom: '1rem' }}
              value={extendMonths}
              onChange={e => setExtendMonths(Number(e.target.value))}
            >
              {[6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>{m} mies.</option>
              ))}
            </select>
            
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              Kwota płatności: <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>{extendMonths * 50} PLN</span>
            </div>

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

      {/* Confirm Delete Modal */}
      {confirmDeleteContractId && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 className="modal-title" style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--danger-color)' }}>Usuń umowę</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Czy na pewno chcesz bezpowrotnie usunąć tę umowę?</p>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                onClick={() => setConfirmDeleteContractId(null)} 
                className="btn-secondary" 
                style={{ flex: 1 }}>
                NIE
              </button>
              <button 
                onClick={() => deleteContract(confirmDeleteContractId)} 
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
