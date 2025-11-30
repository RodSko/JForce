import React, { useState, useEffect } from 'react';
import { DailyRecord, Employee } from './types';
import { INITIAL_EMPLOYEES } from './constants';
import Layout from './components/Layout';
import DailyOperations from './components/DailyOperations';
import TeamManagement from './components/TeamManagement';
import Reports from './components/Reports';

// Simple mock persistence
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

function App() {
  const [view, setView] = useState<'daily' | 'team' | 'reports'>('daily');
  const [employees, setEmployees] = useLocalStorage<Employee[]>('logiteam-employees', INITIAL_EMPLOYEES);
  const [history, setHistory] = useLocalStorage<DailyRecord[]>('logiteam-history', []);

  const handleSaveRecord = (record: DailyRecord) => {
    setHistory(prev => {
      // Update if exists, else add
      const idx = prev.findIndex(p => p.date === record.date);
      if (idx >= 0) {
        const newHistory = [...prev];
        newHistory[idx] = record;
        return newHistory;
      }
      return [...prev, record];
    });
  };

  return (
    <Layout currentView={view} onChangeView={setView}>
      {view === 'daily' && (
        <DailyOperations 
          employees={employees} 
          history={history} 
          onSaveRecord={handleSaveRecord} 
        />
      )}
      {view === 'team' && (
        <TeamManagement 
          employees={employees} 
          setEmployees={setEmployees} 
        />
      )}
      {view === 'reports' && (
        <Reports 
          history={history} 
          employees={employees} 
        />
      )}
    </Layout>
  );
}

export default App;