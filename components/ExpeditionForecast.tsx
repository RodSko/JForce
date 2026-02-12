
import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, TrendingUp, AlertCircle, CheckCircle2, Loader2, Table, Package, MapPin, BarChart3, RefreshCw, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

// Lista oficial das 17 bases conforme solicitação
const BASES_SE = ['NSS-SE', 'NSG-SE', 'F-IBN SE', 'F-LAG SE', 'PRO-SE', 'F- EST SE', 'CDM-SE', 'BUG-SE'];
const BASES_AL = ['ARP-AL', 'PMI-AL', 'STI-AL', 'F-MCZ AL', 'CAL-AL', 'CRP-AL', 'MDC-AL', 'JCN-AL', 'JGA-AL'];
const ALL_ALLOWED_BASES = [...BASES_SE, ...BASES_AL];

interface ForecastResult {
  base: string;
  count: number;
  state: 'SE' | 'AL';
}

const ExpeditionForecast: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [processedResults, setProcessedResults] = useState<ForecastResult[]>([]);
  
  // Informações para ajudar o usuário caso a planilha não seja lida
  const [debug, setDebug] = useState<{cols: string[], rowsRead: number}>({cols: [], rowsRead: 0});

  // Normalização agressiva para garantir o "match" independente de espaços ou hífens extras
  const normalize = (str: string) => {
    if (!str) return '';
    return str.toString().toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");
  };

  const findColumn = (headers: string[], candidates: string[]): string => {
    // Busca prioritária (Exata ou contida)
    for (const cand of candidates) {
      const normCand = normalize(cand);
      const found = headers.find(h => normalize(h).includes(normCand) || normCand.includes(normalize(h)));
      if (found) return found;
    }
    return '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus('loading');
    setProcessedResults([]);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        
        if (jsonData.length === 0) throw new Error("A planilha selecionada parece estar vazia.");

        const headers = Object.keys(jsonData[0]);
        setDebug({ cols: headers, rowsRead: jsonData.length });

        // Mapeamento de colunas baseado na sua dica
        const colOrder = findColumn(headers, ['Número de pedido JMS', 'Pedido', 'JMS', 'Order', 'Referencia']);
        const colBase = findColumn(headers, ['Base Destino', 'Destino', 'Parada', 'Base', 'Next Stop']);

        if (!colOrder || !colBase) {
          throw new Error(`Não encontramos as colunas necessárias. Procurei por "Pedido" e "Base Destino". Colunas lidas: ${headers.slice(0, 5).join(', ')}...`);
        }

        const counts: Record<string, number> = {};
        let validMatches = 0;
        
        jsonData.forEach(row => {
          const orderId = String(row[colOrder] || '').trim();
          const baseRaw = String(row[colBase] || '').trim().toUpperCase();

          // 1. Remover Pedidos Filhos (Aqueles que terminam com -01, -02, etc)
          // Se tiver hífen, ignoramos
          if (orderId.includes('-')) return;

          // 2. Tentar encontrar qual das 17 bases esse registro pertence
          const normBaseRaw = normalize(baseRaw);
          const matchedBase = ALL_ALLOWED_BASES.find(b => {
            const normAllowed = normalize(b);
            return normBaseRaw === normAllowed || normBaseRaw.includes(normAllowed) || normAllowed.includes(normBaseRaw);
          });

          if (matchedBase) {
            counts[matchedBase] = (counts[matchedBase] || 0) + 1;
            validMatches++;
          }
        });

        if (validMatches === 0) {
          throw new Error("Planilha lida com sucesso, mas nenhum pedido das 17 bases homologadas foi encontrado na coluna de destinos.");
        }

        const results: ForecastResult[] = Object.entries(counts).map(([base, count]) => ({
          base,
          count,
          state: (BASES_SE.includes(base) ? 'SE' : 'AL') as 'SE' | 'AL'
        })).sort((a, b) => b.count - a.count);

        setProcessedResults(results);
        setStatus('success');
      } catch (err: any) {
        console.error(err);
        setStatus('error');
        setErrorMessage(err.message || "Erro desconhecido ao processar arquivo.");
      }
    };
    reader.onerror = () => {
      setStatus('error');
      setErrorMessage("Erro ao carregar o arquivo para o navegador.");
    };
    reader.readAsBinaryString(file);
  };

  const handleReset = () => {
    setProcessedResults([]);
    setFileName('');
    setStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dataSE = useMemo(() => processedResults.filter(r => r.state === 'SE'), [processedResults]);
  const dataAL = useMemo(() => processedResults.filter(r => r.state === 'AL'), [processedResults]);
  const total = processedResults.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      {/* Banner Superior */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1553413077-190dd305871c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-indigo-400" />
          Previsão de Expedição
        </h2>
        <p className="text-slate-300 max-w-2xl font-medium">
          Análise automática de demanda para Sergipe e Alagoas. O sistema filtra automaticamente pedidos filhos e foca na coluna <span className="text-white font-bold">Base Destino</span>.
        </p>
      </div>

      {/* Área de Upload */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-bold text-slate-800">Importar Previsão</h3>
            <p className="text-sm text-slate-500">Arraste ou selecione sua planilha de expedição.</p>
          </div>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls" />
          
          <div className="flex flex-col items-center gap-4">
            {!fileName ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
              >
                <FileSpreadsheet className="w-5 h-5" /> Selecionar Planilha Excel
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 w-full">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{fileName}</p>
                  <p className="text-xs text-green-600">Planilha Carregada com Sucesso</p>
                </div>
                <button onClick={handleReset} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin" /> Processando dados...
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-100 p-6 rounded-xl text-left animate-fade-in space-y-3">
              <div className="flex items-center gap-3 text-red-800">
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                <p className="font-bold">Não foi possível gerar a previsão</p>
              </div>
              <p className="text-sm text-red-700">{errorMessage}</p>
              
              <div className="mt-4 pt-4 border-t border-red-100">
                <p className="text-[10px] font-black uppercase text-red-900 mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Detalhes do Diagnóstico:
                </p>
                <div className="bg-white/50 p-3 rounded font-mono text-[10px] text-slate-600">
                  Colunas encontradas: {debug.cols.join(', ') || 'Nenhuma'}<br/>
                  Total de linhas lidas: {debug.rowsRead}
                </div>
              </div>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pedidos Pai</p>
                <p className="text-2xl font-black text-slate-900">{total.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-blue-600 p-6 rounded-xl text-white shadow-lg flex items-center gap-4">
              <MapPin className="w-8 h-8 opacity-40" />
              <div>
                <p className="text-xs font-bold uppercase opacity-80">Bases Sergipe</p>
                <p className="text-2xl font-black">{dataSE.reduce((a,c)=>a+c.count, 0).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="bg-teal-600 p-6 rounded-xl text-white shadow-lg flex items-center gap-4">
              <MapPin className="w-8 h-8 opacity-40" />
              <div>
                <p className="text-xs font-bold uppercase opacity-80">Bases Alagoas</p>
                <p className="text-2xl font-black">{dataAL.reduce((a,c)=>a+c.count, 0).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Gráficos Lado a Lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Bloco Sergipe */}
            <div className="bg-white p-6 rounded-2xl border-2 border-blue-50 shadow-sm">
              <h3 className="text-lg font-black text-blue-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> SERGIPE (SE)
              </h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataSE} layout="vertical" margin={{ left: 30, right: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="base" type="category" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#1e3a8a' }} width={80} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={25}>
                      <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 'bold', fill: '#1e3a8a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bloco Alagoas */}
            <div className="bg-white p-6 rounded-2xl border-2 border-teal-50 shadow-sm">
              <h3 className="text-lg font-black text-teal-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> ALAGOAS (AL)
              </h3>
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataAL} layout="vertical" margin={{ left: 30, right: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="base" type="category" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#134e4a' }} width={80} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={25}>
                      <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 'bold', fill: '#134e4a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Tabela de Rodapé */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Table className="w-5 h-5 text-indigo-600" /> Detalhamento Consolidado
                </h3>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 p-4 gap-4">
                {processedResults.map((res, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors">
                    <span className="text-[10px] font-black text-slate-600">{res.base}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${res.state === 'SE' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
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
