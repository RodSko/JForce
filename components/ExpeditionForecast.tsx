import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, TrendingUp, AlertCircle, CheckCircle2, Loader2, Table, Package, MapPin, BarChart3, RefreshCw, Info, Files } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

// Lista oficial das 19 bases conforme solicitação
const BASES_SE = ['NSS-SE', 'NSG-SE', 'F-IBN SE', 'F-LAG SE', 'PRO-SE', 'F- EST SE', 'CDM-SE', 'F CDM - SE', 'BUG-SE'];
const BASES_AL = ['ARP-AL', 'F ARP - AL', 'F ARP 02-AL', 'PMI-AL', 'STI-AL', 'F-MCZ AL', 'CAL-AL', 'CRP-AL', 'MDC-AL', 'JCN-AL', 'JGA-AL'];
const ALL_ALLOWED_BASES = [...BASES_SE, ...BASES_AL].sort((a, b) => b.length - a.length);

interface ForecastResult {
  base: string;
  count: number;
  state: 'SE' | 'AL';
}

const ExpeditionForecast: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filesCount, setFilesCount] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [processedResults, setProcessedResults] = useState<ForecastResult[]>([]);
  const [debug, setDebug] = useState<{cols: string[], rowsRead: number}>({cols: [], rowsRead: 0});

  // Normalização agressiva para garantir o "match"
  const normalize = (str: string) => {
    if (!str) return '';
    return str.toString().toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");
  };

  const findColumn = (headers: string[], candidates: string[]): string => {
    for (const cand of candidates) {
      const normCand = normalize(cand);
      const found = headers.find(h => normalize(h).includes(normCand) || normCand.includes(normalize(h)));
      if (found) return found;
    }
    return '';
  };

  const processSingleFile = (file: File): Promise<{counts: Record<string, number>, uniqueOrders: Set<string>, headers: string[], totalRows: number}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
          
          if (jsonData.length === 0) {
            resolve({ counts: {}, uniqueOrders: new Set(), headers: [], totalRows: 0 });
            return;
          }

          const headers = Object.keys(jsonData[0]);
          const colOrder = findColumn(headers, ['Número de pedido JMS', 'Pedido', 'JMS', 'Order', 'Referencia']);
          const colBase = findColumn(headers, ['Base Destino', 'Destino', 'Parada', 'Base', 'Next Stop']);

          if (!colOrder || !colBase) {
            reject(new Error(`Colunas não encontradas no arquivo ${file.name}. Procurei por "Pedido" e "Base Destino".`));
            return;
          }

          const counts: Record<string, number> = {};
          const uniqueOrders = new Set<string>();
          
          jsonData.forEach(row => {
            const orderId = String(row[colOrder] || '').trim();
            const baseRaw = String(row[colBase] || '').trim().toUpperCase();

            // Filtrar Pedidos Filhos
            if (orderId.includes('-')) return;

            const normBaseRaw = normalize(baseRaw);
            const matchedBase = ALL_ALLOWED_BASES.find(b => {
              const normAllowed = normalize(b);
              // Preferência por match exato ou que o termo da planilha contenha a base (ex: "BASE CDM-SE" contém "CDMSE")
              // Evitamos que "CDM-SE" dê match em "F CDM - SE" invertendo a lógica de inclusão para ser mais restritiva
              return normBaseRaw === normAllowed || normBaseRaw.includes(normAllowed);
            });

            if (matchedBase) {
              uniqueOrders.add(orderId);
              counts[matchedBase] = (counts[matchedBase] || 0) + 1;
            }
          });

          resolve({ counts, uniqueOrders, headers, totalRows: jsonData.length });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error(`Erro ao ler o arquivo ${file.name}`));
      reader.readAsBinaryString(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStatus('loading');
    setFilesCount(files.length);
    setProcessedResults([]);
    
    try {
      // Fix: Explicitly type 'file' as File to resolve TypeScript 'unknown' error
      const allFilePromises = Array.from(files).map((file: File) => processSingleFile(file));
      const resultsArray = await Promise.all(allFilePromises);

      const globalCounts: Record<string, number> = {};
      const globalUniqueOrders = new Set<string>();
      let totalRowsRead = 0;
      let lastHeaders: string[] = [];

      resultsArray.forEach(res => {
        totalRowsRead += res.totalRows;
        lastHeaders = res.headers;
        
        // Somar os counts de cada base
        Object.entries(res.counts).forEach(([base, count]) => {
          // Fix: Cast count to number to avoid 'unknown' type errors in arithmetic
          const numCount = count as number;
          globalCounts[base] = (globalCounts[base] || 0) + numCount;
        });

        // Acumular pedidos únicos para o totalizador geral
        res.uniqueOrders.forEach(order => globalUniqueOrders.add(order));
      });

      if (globalUniqueOrders.size === 0) {
        throw new Error("Nenhum pedido das 17 bases homologadas foi encontrado nos arquivos enviados.");
      }

      const finalResults: ForecastResult[] = Object.entries(globalCounts).map(([base, count]) => {
        // Fix: Cast count to number to ensure compatibility with ForecastResult interface
        const numCount = count as number;
        return {
          base,
          count: numCount,
          state: (BASES_SE.includes(base) ? 'SE' : 'AL') as 'SE' | 'AL'
        };
      }).sort((a, b) => b.count - a.count);

      setDebug({ cols: lastHeaders, rowsRead: totalRowsRead });
      setProcessedResults(finalResults);
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || "Erro ao processar os arquivos.");
    }
  };

  const handleReset = () => {
    setProcessedResults([]);
    setFilesCount(0);
    setStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dataSE = useMemo(() => processedResults.filter(r => r.state === 'SE'), [processedResults]);
  const dataAL = useMemo(() => processedResults.filter(r => r.state === 'AL'), [processedResults]);
  const totalVolume = processedResults.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      {/* Banner Superior */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1553413077-190dd305871c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-indigo-400" />
          Previsão Consolidada
        </h2>
        <p className="text-slate-300 max-w-2xl font-medium">
          Soma automática de demanda para Sergipe e Alagoas. Você pode selecionar <span className="text-white font-bold">múltiplas planilhas</span> para processar de uma só vez.
        </p>
      </div>

      {/* Área de Upload */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800">Importar Previsões</h3>
            <p className="text-sm text-slate-500">Selecione um ou mais arquivos de expedição simultaneamente.</p>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".xlsx,.xls" 
            multiple 
          />
          
          <div className="flex flex-col items-center gap-4">
            {status === 'idle' || status === 'error' ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
              >
                <FileSpreadsheet className="w-5 h-5" /> Selecionar Planilhas
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 w-full animate-fade-in">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <Files className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {filesCount} {filesCount === 1 ? 'Arquivo processado' : 'Arquivos consolidados'}
                  </p>
                  <p className="text-xs text-green-600 font-bold uppercase tracking-tighter">Soma de Volume Concluída</p>
                </div>
                <button onClick={handleReset} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Limpar e reiniciar">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-3 text-indigo-600 font-bold">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="animate-pulse">Consolidando dados de {filesCount} planilhas...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-100 p-6 rounded-xl text-left animate-fade-in space-y-3">
              <div className="flex items-center gap-3 text-red-800">
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                <p className="font-bold">Erro de Consolidação</p>
              </div>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard de Resultados */}
      {status === 'success' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Resumo Numérico */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600"><Package className="w-6 h-6" /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume Total (Pai)</p>
                <p className="text-3xl font-black text-slate-900">{totalVolume.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-blue-600 p-6 rounded-xl text-white shadow-lg flex items-center gap-4">
              <MapPin className="w-8 h-8 opacity-40" />
              <div>
                <p className="text-xs font-bold uppercase opacity-80">Carga Sergipe</p>
                <p className="text-3xl font-black">{dataSE.reduce((a,c)=>a+c.count, 0).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-teal-600 p-6 rounded-xl text-white shadow-lg flex items-center gap-4">
              <MapPin className="w-8 h-8 opacity-40" />
              <div>
                <p className="text-xs font-bold uppercase opacity-80">Carga Alagoas</p>
                <p className="text-3xl font-black">{dataAL.reduce((a,c)=>a+c.count, 0).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Gráficos Lado a Lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Bloco Sergipe */}
            <div className="bg-white p-6 rounded-2xl border-2 border-blue-50 shadow-sm">
              <h3 className="text-lg font-black text-blue-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">
                <BarChart3 className="w-5 h-5" /> Distribuição Sergipe (SE)
              </h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataSE} layout="vertical" margin={{ left: 30, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="base" type="category" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#1e3a8a' }} width={80} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={25}>
                      <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 'bold', fill: '#1e3a8a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bloco Alagoas */}
            <div className="bg-white p-6 rounded-2xl border-2 border-teal-50 shadow-sm">
              <h3 className="text-lg font-black text-teal-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">
                <BarChart3 className="w-5 h-5" /> Distribuição Alagoas (AL)
              </h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataAL} layout="vertical" margin={{ left: 30, right: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="base" type="category" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#134e4a' }} width={80} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={25}>
                      <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 'bold', fill: '#134e4a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Tabela de Rodapé */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Table className="w-5 h-5 text-indigo-600" /> Soma de Volume por Base ({filesCount} arquivos)
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase">Processado em tempo real</span>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 p-4 gap-4">
                {processedResults.map((res, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-200 transition-all group">
                    <span className="text-[10px] font-black text-slate-600 group-hover:text-indigo-600">{res.base}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black shadow-sm ${res.state === 'SE' ? 'bg-blue-600 text-white' : 'bg-teal-600 text-white'}`}>
                      {res.count}
                    </span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpeditionForecast;
