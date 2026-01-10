
import React, { useState, useEffect, useRef } from 'react';
import { Hash, Search, Plus, Trash2, Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, RefreshCw, BarChart2, PackageCheck, Info, MapPin, ListChecks, ArrowRight, FilterX, Files, Eraser } from 'lucide-react';
import { BatchNumber } from '../types';
import { dataService } from '../services/dataService';
import * as XLSX from 'xlsx';

// Lista exata das 17 bases homologadas da operação SE AJU
const ALLOWED_BASES = [
  'NSS-SE', 'NSG-SE', 'IBN-SE', 'F LAG-SE', 'PRO-SE', 'F EST-SE', 
  'CDM-SE', 'BUG-SE', 'ARP-AL', 'PMI-AL', 'STI-AL', 'CAL-AL', 
  'CRP-AL', 'MDC-AL', 'JCN-AL', 'JGA-AL', 'F MCZ-AL'
];

interface AnalysisResult {
  base: string;
  orderCount: number;
  batchesNeeded: number;
}

const BatchNumbers: React.FC = () => {
  const [batches, setBatches] = useState<BatchNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados Acumuladores para Multi-Planilha
  const [cumulativeBaseCounts, setCumulativeBaseCounts] = useState<Record<string, number>>({});
  const [cumulativeValidOrders, setCumulativeValidOrders] = useState<Set<string>>(new Set());
  const [cumulativeIgnoredCount, setCumulativeIgnoredCount] = useState(0);
  const [filesProcessed, setFilesProcessed] = useState(0);
  
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  const [itemToDelete, setItemToDelete] = useState<BatchNumber | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await dataService.getBatchNumbers();
      setBatches(data);
    } catch (error) {
      console.error("Erro ao carregar lotes:", error);
    } finally {
      setLoading(false);
    }
  };

  const cleanValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val).trim().toUpperCase();
  };

  const normalize = (str: string) => str.replace(/\s+/g, '').toUpperCase();

  const findColumn = (row: any, candidates: string[]): string => {
    if (!row) return '';
    const keys = Object.keys(row);
    for (const name of candidates) {
      const found = keys.find(k => normalize(k) === normalize(name));
      if (found) return found;
    }
    for (const key of keys) {
      if (candidates.some(c => normalize(key).includes(normalize(c)))) {
        return key;
      }
    }
    return '';
  };

  const processFile = (file: File): Promise<{baseCounts: Record<string, number>, validOrders: Set<string>, ignoredCount: number}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

          if (jsonData.length === 0) {
            resolve({ baseCounts: {}, validOrders: new Set(), ignoredCount: 0 });
            return;
          }

          const colOrder = findColumn(jsonData[0], ['número de pedido jms', 'numero de pedido jms', 'pedido', 'order id', 'jms', 'referencia']);
          const colBase = findColumn(jsonData[0], ['base destino', 'destino', 'base de destino', 'parada anterior ou próxima', 'parada anterior ou proxima', 'base', 'parada']);

          const baseCounts: Record<string, number> = {};
          const validOrders = new Set<string>();
          let ignoredCount = 0;

          if (!colOrder || !colBase) {
             resolve({ baseCounts: {}, validOrders: new Set(), ignoredCount: 0 });
             return;
          }

          jsonData.forEach(row => {
            const orderId = cleanValue(row[colOrder]);
            let baseNameRaw = cleanValue(row[colBase]) || '';
            
            if (!orderId) return;

            const normalizedInput = normalize(baseNameRaw);
            const matchedBase = ALLOWED_BASES.find(b => {
              const normalizedAllowed = normalize(b);
              return normalizedInput.includes(normalizedAllowed);
            });

            if (!orderId.includes('-') && !orderId.startsWith('BR')) {
              if (matchedBase) {
                validOrders.add(orderId);
                baseCounts[matchedBase] = (baseCounts[matchedBase] || 0) + 1;
              } else {
                ignoredCount++;
              }
            }
          });

          resolve({ baseCounts, validOrders, ignoredCount });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    
    try {
      // Criar cópias dos acumuladores atuais
      const newBaseCounts = { ...cumulativeBaseCounts };
      const newValidOrders = new Set(cumulativeValidOrders);
      let newIgnoredCount = cumulativeIgnoredCount;
      let newFilesCount = filesProcessed + files.length;

      // Processar os novos arquivos
      const results = await Promise.all(Array.from(files).map((file: File) => processFile(file)));

      // Consolidar novos dados aos existentes
      results.forEach(res => {
        newIgnoredCount += res.ignoredCount;
        
        // Iterar sobre cada pedido encontrado na planilha
        res.validOrders.forEach(orderId => {
          if (!newValidOrders.has(orderId)) {
            newValidOrders.add(orderId);
          }
        });
        
        Object.entries(res.baseCounts).forEach(([base, count]) => {
          newBaseCounts[base] = (newBaseCounts[base] || 0) + count;
        });
      });

      // Atualizar Estados
      setCumulativeBaseCounts(newBaseCounts);
      setCumulativeValidOrders(newValidOrders);
      setCumulativeIgnoredCount(newIgnoredCount);
      setFilesProcessed(newFilesCount);

      // Fix: Cast count to number to resolve "Type unknown is not assignable to number" and arithmetic errors.
      // Calcular Resultados Finais
      const finalResults: AnalysisResult[] = Object.entries(newBaseCounts).map(([base, count]) => {
        const numCount = count as number;
        return {
          base,
          orderCount: numCount,
          batchesNeeded: Math.ceil(numCount / 80)
        };
      }).sort((a, b) => b.orderCount - a.orderCount);

      setAnalysisResults(finalResults);
      setShowAnalysis(true);

    } catch (error) {
      console.error(error);
      alert("Erro ao processar arquivos.");
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetAnalysis = () => {
    setCumulativeBaseCounts({});
    setCumulativeValidOrders(new Set());
    setCumulativeIgnoredCount(0);
    setFilesProcessed(0);
    setAnalysisResults([]);
    setShowAnalysis(false);
  };

  const handleAddBatch = async () => {
    if (!newNumber.trim()) return;
    setProcessing(true);
    try {
      const batch: BatchNumber = {
        id: `batch-${Date.now()}`,
        number: newNumber.trim().toUpperCase(),
        description: newDesc.trim(),
        created_at: new Date().toISOString()
      };
      await dataService.saveBatchNumber(batch);
      await loadBatches();
      setShowAddModal(false);
      setNewNumber('');
      setNewDesc('');
    } catch (error) {
      alert("Erro ao salvar o lote.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setProcessing(true);
    try {
      await dataService.deleteBatchNumber(itemToDelete.id);
      await loadBatches();
      setItemToDelete(null);
    } catch (error) {
      alert("Erro ao excluir.");
    } finally {
      setProcessing(false);
    }
  };

  const filteredBatches = batches.filter(b => 
    b.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Hash className="w-8 h-8 text-indigo-400" />
          Dimensionamento Acumulativo de Lotes
        </h2>
        <p className="text-slate-300 max-w-xl font-medium">
          Soma automática de múltiplas planilhas para as 17 bases homologadas. (Limite: 80 pedidos/lote)
        </p>
      </div>

      {/* --- PAINEL DE ANÁLISE CONSOLIDADA --- */}
      {showAnalysis && (
        <div className="bg-white rounded-xl border-2 border-indigo-100 shadow-2xl overflow-hidden animate-fade-in">
          <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center text-white">
             <div className="flex items-center gap-2">
                <Files className="w-5 h-5 text-indigo-300" />
                <h3 className="font-black uppercase tracking-tight text-sm">Volume Somado ({filesProcessed} arquivos)</h3>
             </div>
             <div className="flex items-center gap-2">
                <button 
                  onClick={handleResetAnalysis} 
                  className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white px-3 py-1.5 rounded-lg transition-all text-[10px] font-black uppercase"
                  title="Limpar todos os dados e começar nova soma"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Reiniciar Soma
                </button>
                <button onClick={() => setShowAnalysis(false)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
             </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pedidos Únicos</p>
                  <p className="text-3xl font-black text-slate-900">{cumulativeValidOrders.size.toLocaleString('pt-BR')}</p>
               </div>
               <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-inner">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Necessidade de Lotes</p>
                  <p className="text-3xl font-black text-indigo-700">
                    {analysisResults.reduce((acc, curr) => acc + curr.batchesNeeded, 0)}
                  </p>
               </div>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner opacity-60">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Arquivos na Soma</p>
                  <p className="text-3xl font-black text-slate-400">{filesProcessed}</p>
               </div>
               <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-[10px] text-emerald-800 font-bold leading-tight">
                    Soma ativa. Novos arquivos adicionados serão somados ao total acima mantendo a regra das 17 bases.
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {analysisResults.map((res, idx) => (
                <div key={idx} className={`p-5 rounded-xl border-2 flex flex-col justify-between h-40 transition-all hover:shadow-lg hover:border-indigo-400 ${res.batchesNeeded > 1 ? 'border-orange-200 bg-orange-50/20' : 'border-slate-100 bg-slate-50/50'}`}>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">BASE DESTINO</span>
                       <MapPin className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                    <h4 className="text-xl font-black text-slate-900 leading-tight truncate">
                      {res.base}
                    </h4>
                  </div>
                  
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg font-black text-sm shadow-sm ${res.batchesNeeded > 1 ? 'bg-orange-600 text-white' : 'bg-slate-800 text-white'}`}>
                      <span className="truncate mr-2 uppercase">{res.base}</span>
                      <span className="whitespace-nowrap uppercase tracking-tighter">
                        {res.batchesNeeded} {res.batchesNeeded === 1 ? 'LOTE' : 'LOTES'}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 text-right px-1">
                      VOLUME ACUMULADO: {res.orderCount}
                    </p>
                  </div>
                </div>
              ))}
              {analysisResults.length === 0 && (
                <div className="col-span-full py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <FilterX className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-500 font-bold uppercase text-xs">Aguardando dados das 17 bases homologadas.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- FERRAMENTAS --- */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Pesquisar registro de lote..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-all"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" multiple />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar Planilha à Soma
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Novo Registro Individual
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
            <p className="font-bold uppercase text-[10px] tracking-widest">Sincronizando...</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100 shadow-inner">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Código do Lote</th>
                  <th className="px-6 py-4">Unidade / Obs</th>
                  <th className="px-6 py-4 text-center">Data</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-indigo-50/30 group transition-colors">
                    <td className="px-6 py-4 font-black text-slate-900 font-mono text-base">
                      {batch.number}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {batch.description || '---'}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-400 text-[10px] font-bold">
                      {new Date(batch.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setItemToDelete(batch)}
                        className="text-slate-200 hover:text-red-600 transition-all p-2 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-24 text-center text-slate-300 font-medium italic">
                      Sem registros individuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Cadastro */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200 border-t-8 border-indigo-600">
            <h3 className="text-xl font-black text-slate-800 mb-5 uppercase tracking-tighter">Registrar Lote Individual</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Número do Lote</label>
                <input 
                  type="text" 
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="EX: BR00000000"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold text-lg shadow-inner"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Base de Destino</label>
                <input 
                  type="text" 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: PMI-AL"
                  className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-inner uppercase"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border-2 border-slate-100 rounded-xl text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddBatch}
                disabled={processing || !newNumber.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg active:scale-95"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border-t-8 border-red-600">
            <div className="flex items-center gap-4 text-red-600 mb-6">
              <AlertTriangle className="w-10 h-10" />
              <h3 className="text-xl font-black uppercase tracking-tighter">Apagar Registro?</h3>
            </div>
            <p className="text-slate-600 mb-8 font-medium leading-relaxed">
              Deseja remover o lote <strong className="text-slate-900 underline font-black">{itemToDelete.number}</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3 border-2 border-slate-100 rounded-xl text-slate-600 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-colors"
              >
                Manter
              </button>
              <button 
                onClick={handleDelete}
                disabled={processing}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchNumbers;
