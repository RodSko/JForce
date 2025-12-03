import React, { useState, useEffect } from 'react';
import { DailyRecord, Employee, TripInfo } from './types';
import Layout from './components/Layout';
import DailyOperations from './components/DailyOperations';
import TeamManagement from './components/TeamManagement';
import Reports from './components/Reports';
import GenerateReport from './components/GenerateReport';
import ShippedNotArrived from './components/ShippedNotArrived';
import { dataService } from './services/dataService';
import { Loader2, AlertTriangle, Database, Copy, Check } from 'lucide-react';

// SQL Script for setup to be displayed in case of missing tables
const SETUP_SQL = `-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.daily_records (
    id TEXT PRIMARY KEY, -- YYYY-MM-DD
    date TEXT NOT NULL,
    volume NUMERIC,
    trucks NUMERIC,
    assignments JSONB DEFAULT '[]'::jsonb,
    trips JSONB DEFAULT '[]'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (Adjust for production!)
DROP POLICY IF EXISTS "Public Access Employees" ON public.employees;
CREATE POLICY "Public Access Employees" ON public.employees FOR ALL USING (true);

DROP POLICY IF EXISTS "Public Access Records" ON public.daily_records;
CREATE POLICY "Public Access Records" ON public.daily_records FOR ALL USING (true);`;

function App() {
  const [view, setView] = useState<'daily' | 'team' | 'reports' | 'generate' | 'shipped'>('daily');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initial Load from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [empData, histData] = await Promise.all([
          dataService.getEmployees(),
          dataService.getHistory()
        ]);
        setEmployees(empData);
        setHistory(histData);
      } catch (err: any) {
        console.error("Failed to load data:", JSON.stringify(err));
        // Extract meaningful message from Supabase error
        const msg = err.message || JSON.stringify(err);
        const code = err.code || '';
        
        // Check for specific "table not found" error
        if (code === 'PGRST205' || msg.includes('does not exist')) {
          setError('MISSING_TABLES');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSaveRecord = async (record: DailyRecord) => {
    try {
      await dataService.saveDailyRecord(record);
      
      setHistory(prev => {
        const idx = prev.findIndex(p => p.date === record.date);
        if (idx >= 0) {
          const newHistory = [...prev];
          newHistory[idx] = record;
          return newHistory;
        }
        return [record, ...prev]; // Add new records to top for easier history view
      });
      return true;
    } catch (error: any) {
      console.error("Error saving record:", error);
      alert(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
      return false;
    }
  };

  const handleAddEmployee = async (newEmp: Employee) => {
    await dataService.createEmployee(newEmp);
    setEmployees(prev => [...prev, newEmp]);
  };

  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    await dataService.updateEmployee(updatedEmp);
    setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
        <p>Carregando sistema...</p>
      </div>
    );
  }

  // Error State Display
  if (error) {
    const isMissingTables = error === 'MISSING_TABLES';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-2xl w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">
            {isMissingTables ? 'Configuração Necessária' : 'Erro de Conexão'}
          </h2>
          
          <p className="text-slate-600 mb-6 text-center">
            {isMissingTables 
              ? 'O banco de dados do Supabase ainda não possui as tabelas necessárias.' 
              : 'Não foi possível carregar os dados do banco de dados.'}
          </p>

          {isMissingTables ? (
            <div className="space-y-4">
               <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                 <h3 className="font-semibold text-blue-800 text-sm flex items-center gap-2 mb-2">
                   <Database className="w-4 h-4" /> Como Resolver:
                 </h3>
                 <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1 ml-1">
                   <li>Copie o código SQL abaixo.</li>
                   <li>Acesse seu painel do Supabase.</li>
                   <li>Vá até o <strong>SQL Editor</strong>.</li>
                   <li>Cole o código e clique em <strong>RUN</strong>.</li>
                   <li>Recarregue esta página.</li>
                 </ol>
               </div>

               <div className="relative">
                 <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">
                   {SETUP_SQL}
                 </pre>
                 <button 
                  onClick={copySqlToClipboard}
                  className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors"
                  title="Copiar SQL"
                 >
                   {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                 </button>
               </div>
            </div>
          ) : (
            <div className="bg-slate-100 p-3 rounded text-left mb-6 overflow-auto max-h-32">
              <code className="text-xs text-slate-700 font-mono break-all">{error}</code>
            </div>
          )}
          
          <div className="mt-8 flex justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          onAddEmployee={handleAddEmployee}
          onUpdateEmployee={handleUpdateEmployee}
        />
      )}
      {view === 'reports' && (
        <Reports 
          history={history} 
          employees={employees} 
        />
      )}
      {view === 'generate' && (
        <GenerateReport />
      )}
      {view === 'shipped' && (
        <ShippedNotArrived />
      )}
    </Layout>
  );
}

export default App;