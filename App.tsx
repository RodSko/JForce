import React, { useState, useEffect } from 'react';
import { DailyRecord, Employee, TripInfo } from './types';
import Layout from './components/Layout';
import DailyOperations from './components/DailyOperations';
import TeamManagement from './components/TeamManagement';
import Reports from './components/Reports';
import GenerateReport from './components/GenerateReport';
import ManagementReport from './components/ManagementReport';
import ShippedNotArrived from './components/ShippedNotArrived';
import SecondaryTrips from './components/SecondaryTrips';
import SuppliesControl from './components/SuppliesControl';
import EpiControl from './components/EpiControl';
import QrCodeGenerator from './components/QrCodeGenerator';
import BatchNumbers from './components/BatchNumbers';
import { dataService } from './services/dataService';
import { Loader2, AlertTriangle, Database, Copy, Check } from 'lucide-react';

// SQL Script atualizado para incluir todas as colunas necessárias
const SETUP_SQL = `-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE PARA CORRIGIR ERROS DE COLUNA

-- 1. Tabela de Funcionários
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    gender TEXT DEFAULT 'M'
);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'M';

-- 2. Tabela de Registros Diários
CREATE TABLE IF NOT EXISTS public.daily_records (
    id TEXT PRIMARY KEY, 
    date TEXT NOT NULL,
    volume NUMERIC,
    trucks NUMERIC,
    diarista_count NUMERIC DEFAULT 0,
    assignments JSONB DEFAULT '[]'::jsonb,
    trips JSONB DEFAULT '[]'::jsonb
);
-- Garante que as colunas novas existam caso a tabela tenha sido criada antigamente
ALTER TABLE public.daily_records ADD COLUMN IF NOT EXISTS diarista_count NUMERIC DEFAULT 0;
ALTER TABLE public.daily_records ADD COLUMN IF NOT EXISTS trips JSONB DEFAULT '[]'::jsonb;

-- 3. Tabelas de Insumos
CREATE TABLE IF NOT EXISTS public.supplies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'un',
    min_stock NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.supply_transactions (
    id TEXT PRIMARY KEY,
    supply_id TEXT REFERENCES public.supplies(id) ON DELETE CASCADE,
    supply_name TEXT,
    type TEXT CHECK (type IN ('IN', 'OUT')),
    quantity NUMERIC NOT NULL,
    date TEXT NOT NULL,
    user_name TEXT
);

-- 4. Tabelas de EPIs
CREATE TABLE IF NOT EXISTS public.epis (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ca_number TEXT,
    quantity NUMERIC DEFAULT 0,
    min_stock NUMERIC DEFAULT 5,
    validity_days NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.epi_transactions (
    id TEXT PRIMARY KEY,
    epi_id TEXT REFERENCES public.epis(id) ON DELETE CASCADE,
    epi_name TEXT,
    type TEXT CHECK (type IN ('IN', 'OUT')),
    quantity NUMERIC NOT NULL,
    date TEXT NOT NULL,
    employee_id TEXT,
    employee_name TEXT,
    notes TEXT
);

-- 5. Tabela de Números de Lotes
CREATE TABLE IF NOT EXISTS public.batch_numbers (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS e criar políticas de acesso
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epi_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access" ON public.employees FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.daily_records FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.supplies FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.supply_transactions FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.epis FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.epi_transactions FOR ALL USING (true);
CREATE POLICY "Public Access" ON public.batch_numbers FOR ALL USING (true);`;

function App() {
  const [view, setView] = useState<'daily' | 'team' | 'reports' | 'generate' | 'shipped' | 'management' | 'secondary' | 'supplies' | 'epis' | 'qrcode' | 'batches'>('daily');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [empData, histData] = await Promise.all([
          dataService.getEmployees(),
          dataService.getHistory(),
          dataService.getSupplies(),
          dataService.getEpis()
        ]);
        setEmployees(empData);
        setHistory(histData);
      } catch (err: any) {
        console.error("Failed to load data:", err);
        const msg = err.message || JSON.stringify(err);
        const code = err.code || '';
        
        // Se a tabela ou coluna não existir, mostramos a tela de configuração
        if (code === 'PGRST204' || code === 'PGRST205' || code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
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
        return [record, ...prev];
      });
      return true;
    } catch (err: any) {
      console.error("Error saving record:", err);
      // Caso ocorra erro de coluna inexistente ao salvar
      if (err.message?.includes('column') || err.code === '42703') {
        setError('MISSING_TABLES');
      } else {
        alert(`Erro ao salvar: ${err.message || "Erro desconhecido"}`);
      }
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

  const handleDeleteEmployee = async (id: string) => {
    await dataService.deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e.id !== id));
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

  if (error) {
    const isMissingTables = error === 'MISSING_TABLES';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-2xl w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">
            {isMissingTables ? 'Estrutura do Banco de Dados Incompleta' : 'Erro de Conexão'}
          </h2>
          
          <p className="text-slate-600 mb-6 text-center text-sm">
            {isMissingTables 
              ? 'Parece que algumas colunas (como diarista_count ou trips) ou tabelas ainda não foram criadas no seu Supabase. Siga os passos abaixo para corrigir.' 
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
                   <li>Acesse o seu dashboard no <strong>Supabase</strong>.</li>
                   <li>Vá até o <strong>SQL Editor</strong> e crie uma nova query.</li>
                   <li>Cole o código e clique em <strong>RUN</strong>.</li>
                   <li>Recarregue este aplicativo.</li>
                 </ol>
               </div>

               <div className="relative">
                 <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-[10px] font-mono overflow-auto max-h-64 whitespace-pre-wrap">
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
          onDeleteEmployee={handleDeleteEmployee}
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
      {view === 'management' && (
        <ManagementReport history={history} />
      )}
      {view === 'shipped' && (
        <ShippedNotArrived />
      )}
      {view === 'secondary' && (
        <SecondaryTrips />
      )}
      {view === 'batches' && (
        <BatchNumbers />
      )}
      {view === 'supplies' && (
        <SuppliesControl />
      )}
      {view === 'epis' && (
        <EpiControl />
      )}
      {view === 'qrcode' && (
        <QrCodeGenerator />
      )}
    </Layout>
  );
}

export default App;