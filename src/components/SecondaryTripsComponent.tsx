import React, { useRef, useState, useMemo, useEffect } from 'react';
import { 
  Map, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, 
  Download, Search, Grid, Tv, Check, Copy, RefreshCcw, ChevronLeft, 
  ChevronRight, Play, Pause, Package, Inbox
} from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCode from 'react-qr-code';

const SecondaryTripsComponent: React.FC = () => {
  const loadedInputRef = useRef<HTMLInputElement>(null);
  const unloadedInputRef = useRef<HTMLInputElement>(null);

  // Dados das planilhas
  const [dataLoaded, setDataLoaded] = useState<Record<string, unknown>[]>([]);
  const [loadedFileName, setLoadedFileName] = useState('');
  
  const [dataUnloaded, setDataUnloaded] = useState<Record<string, unknown>[]>([]);
  const [unloadedFileName, setUnloadedFileName] = useState('');

  // Estados de processamento
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Lista comparativa final (carregados mas NÃO descarregados)
  const [pendingOrders, setPendingOrders] = useState<Record<string, unknown>[]>([]);
  const [orderField, setOrderField] = useState('');

  // Interface/Visualização dos QR Codes
  const [viewMode, setViewMode] = useState<'grid' | 'slide'>('grid');
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Auxiliar para ler arquivo do Excel de forma assíncrona
  const readExcelFile = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsBinaryString(file);
    });
  };

  // Mapeia colunas comuns para encontrar a identificação do Pedido
  const findOrderColumn = (row: Record<string, unknown> | undefined): string => {
    if (!row) return '';
    const keys = Object.keys(row);
    const candidates = [
      'pedido', 'número de pedido jms', 'numero de pedido jms', 'jms', 
      'id', 'código', 'codigo', 'remessa', 'documento', 'número do id', 'numero do id'
    ];
    for (const candidate of candidates) {
      const matchedKey = keys.find(k => k.toLowerCase().trim() === candidate);
      if (matchedKey) return matchedKey;
    }
    for (const candidate of candidates) {
      const matchedKey = keys.find(k => k.toLowerCase().includes(candidate));
      if (matchedKey) return matchedKey;
    }
    return keys[0] || '';
  };

  const handleLoadedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      setLoadedFileName(file.name);
      const parsed = await readExcelFile(file);
      setDataLoaded(parsed);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar planilha de Pedidos Carregados.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnloadedUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      setUnloadedFileName(file.name);
      const parsed = await readExcelFile(file);
      setDataUnloaded(parsed);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar planilha de Pedidos Descarregados.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompare = () => {
    if (dataLoaded.length === 0 || dataUnloaded.length === 0) {
      setStatus('error');
      setErrorMessage('Por favor, faça o upload de ambas as planilhas para realizar o cruzamento.');
      return;
    }

    setIsProcessing(true);
    setStatus('idle');
    setErrorMessage('');

    setTimeout(() => {
      try {
        const colLoaded = findOrderColumn(dataLoaded[0]);
        const colUnloaded = findOrderColumn(dataUnloaded[0]);

        if (!colLoaded) {
          throw new Error('Não foi possível identificar a coluna de pedido/código no arquivo de Pedidos Carregados.');
        }
        if (!colUnloaded) {
          throw new Error('Não foi possível identificar a coluna de pedido/código no arquivo de Pedidos Descarregados.');
        }

        setOrderField(colLoaded);

        const cleanValue = (val: unknown): string => {
          if (val === null || val === undefined) return '';
          return String(val).trim().toUpperCase();
        };

        const unloadedSet = new Set<string>();
        dataUnloaded.forEach(row => {
          const val = cleanValue(row[colUnloaded]);
          if (val) unloadedSet.add(val);
        });

        const diffRows: Record<string, unknown>[] = [];
        const seenCodes = new Set<string>();

        dataLoaded.forEach(row => {
          const val = cleanValue(row[colLoaded]);
          if (val && !unloadedSet.has(val) && !seenCodes.has(val)) {
            seenCodes.add(val);
            diffRows.push(row);
          }
        });

        setPendingOrders(diffRows);
        setSlideIndex(0);
        setStatus('success');
      } catch (err: unknown) {
        console.error(err);
        setStatus('error');
        const errorMsg = err instanceof Error ? err.message : 'Ocorreu um erro ao processar o cruzamento.';
        setErrorMessage(errorMsg);
      } finally {
        setIsProcessing(false);
      }
    }, 150);
  };

  // Filtragem dos resultados de busca em tempo real
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return pendingOrders;
    return pendingOrders.filter(row => {
      const code = String(row[orderField] || '').toLowerCase();
      return code.includes(term);
    });
  }, [pendingOrders, searchTerm, orderField]);

  // Slideshow do QR code
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isPlaying && filteredOrders.length > 0) {
      interval = setInterval(() => {
        setSlideIndex(prev => {
          if (prev >= filteredOrders.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, filteredOrders]);

  const handleDownload = () => {
    if (pendingOrders.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(pendingOrders);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendências");
    XLSX.writeFile(wb, `Pedidos_Pendentes_SC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleReset = () => {
    setDataLoaded([]);
    setLoadedFileName('');
    setDataUnloaded([]);
    setUnloadedFileName('');
    setPendingOrders([]);
    setSearchTerm('');
    setSlideIndex(0);
    setIsPlaying(false);
    setStatus('idle');
    setErrorMessage('');
    if (loadedInputRef.current) loadedInputRef.current.value = '';
    if (unloadedInputRef.current) unloadedInputRef.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Banner Principal */}
      <div className="bg-[linear-gradient(135deg,#0f172a,#1e293b)] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <Map className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Map className="w-8 h-8 text-indigo-400" />
            Viagens Secundárias
          </h2>
          <p className="text-slate-300 max-w-2xl font-medium text-sm md:text-base">
            Importe a planilha de <span className="text-indigo-300 font-bold">Pedidos Carregados</span> e de <span className="text-teal-300 font-bold">Pedidos Descarregados</span>.
            Identifique pendências, gere um arquivo de cruzamento e escaneie QR Codes de forma rápida diretamente na tela.
          </p>
        </div>
      </div>

      {status === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Planilha 1: Carregados */}
          <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-indigo-100 shadow-sm hover:border-indigo-300 transition-all">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">1</span>
              Pedidos Carregados ao SC
            </h3>
            <p className="text-xs text-slate-400 mb-6 font-medium">Planilha contendo os pedidos que saíram carregados da origem.</p>
            
            <input 
              type="file" 
              ref={loadedInputRef} 
              onChange={handleLoadedUpload} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />

            {!loadedFileName ? (
              <button 
                onClick={() => loadedInputRef.current?.click()}
                className="w-full py-12 bg-slate-50 hover:bg-indigo-50/40 rounded-xl border border-dashed border-slate-200 text-slate-500 hover:text-indigo-600 transition-all flex flex-col items-center gap-3"
              >
                <div className="p-3 bg-white shadow-sm rounded-lg"><Upload className="w-6 h-6 text-slate-400" /></div>
                <span className="text-sm font-bold">Selecionar Planilha de Carregamento</span>
                <span className="text-[10px] text-slate-400 font-medium">Suporta Excel (.xlsx, .xls)</span>
              </button>
            ) : (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 shrink-0"><FileSpreadsheet className="w-6 h-6" /></div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-indigo-950 truncate" title={loadedFileName}>{loadedFileName}</p>
                    <p className="text-[10px] text-indigo-600 font-black">{dataLoaded.length.toLocaleString('pt-BR')} linhas identificadas</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setDataLoaded([]); setLoadedFileName(''); }} 
                  className="text-xs text-red-500 hover:underline shrink-0"
                >
                  Trocar
                </button>
              </div>
            )}
          </div>

          {/* Planilha 2: Descarregados */}
          <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-teal-100 shadow-sm hover:border-teal-300 transition-all">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-black">2</span>
              Pedidos Descarregados no Destino
            </h3>
            <p className="text-xs text-slate-400 mb-6 font-medium">Planilha contendo os registros de entrega ou descarga efetuados.</p>
            
            <input 
              type="file" 
              ref={unloadedInputRef} 
              onChange={handleUnloadedUpload} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />

            {!unloadedFileName ? (
              <button 
                onClick={() => unloadedInputRef.current?.click()}
                className="w-full py-12 bg-slate-50 hover:bg-teal-50/40 rounded-xl border border-dashed border-slate-200 text-slate-500 hover:text-teal-600 transition-all flex flex-col items-center gap-3"
              >
                <div className="p-3 bg-white shadow-sm rounded-lg"><Upload className="w-6 h-6 text-slate-400" /></div>
                <span className="text-sm font-bold">Selecionar Planilha de Descarga</span>
                <span className="text-[10px] text-slate-400 font-medium">Suporta Excel (.xlsx, .xls)</span>
              </button>
            ) : (
              <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-teal-100 rounded-lg text-teal-600 shrink-0"><FileSpreadsheet className="w-6 h-6" /></div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-teal-950 truncate" title={unloadedFileName}>{unloadedFileName}</p>
                    <p className="text-[10px] text-teal-600 font-black">{dataUnloaded.length.toLocaleString('pt-BR')} linhas identificadas</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setDataUnloaded([]); setUnloadedFileName(''); }} 
                  className="text-xs text-red-500 hover:underline shrink-0"
                >
                  Trocar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botão de Cruzamento de Dados */}
      {status === 'idle' && (dataLoaded.length > 0 || dataUnloaded.length > 0) && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleCompare}
            disabled={isProcessing || !dataLoaded.length || !dataUnloaded.length}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest px-8 py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cruzando Dados...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4" />
                Comparar e Identificar Pendências
              </>
            )}
          </button>
        </div>
      )}

      {/* Exibição de Erros Globais */}
      {status === 'error' && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl flex items-center gap-4 shadow-sm animate-fade-in">
          <AlertCircle className="w-10 h-10 text-rose-600 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-black text-sm uppercase tracking-wider text-rose-950">Erro de Cruzamento</h4>
            <p className="text-sm">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Resultados do Dashboard do Cruzamento */}
      {status === 'success' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Métricas e Resumos Resumidos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Package className="w-6 h-6" /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Carregados</p>
                <p className="text-xl font-black text-slate-900">{dataLoaded.length.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-teal-50 text-teal-600 rounded-lg"><CheckCircle2 className="w-6 h-6" /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Descarregados</p>
                <p className="text-xl font-black text-slate-900">{dataUnloaded.length.toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <div className={`p-5 rounded-xl flex items-center gap-4 shadow-sm border ${
              pendingOrders.length > 0 
                ? 'bg-amber-50 border-amber-200 text-amber-950' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}>
              <div className={`p-3 rounded-lg ${
                pendingOrders.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {pendingOrders.length > 0 ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-[10px] font-bold opacity-70 uppercase tracking-wider">Pendentes de Descarga</p>
                <p className="text-xl font-black">{pendingOrders.length.toLocaleString('pt-BR')}</p>
              </div>
            </div>

            {/* Ações Rápidas de Download ou reinicio */}
            <div className="flex flex-col gap-2">
              {pendingOrders.length > 0 && (
                <button 
                  onClick={handleDownload}
                  className="w-full flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <Download className="w-4 h-4" /> Relatório (.xlsx)
                </button>
              )}
              <button 
                onClick={handleReset}
                className="w-full py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-red-600 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <RefreshCcw className="w-3 h-3" /> Novo Cruzamento
              </button>
            </div>
          </div>

          {/* Se houver pendências de descarga, mostra o buscador e os QR Codes */}
          {pendingOrders.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              
              {/* Controles de Visualização e Busca */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="font-black text-slate-800 tracking-tight text-lg mb-1 uppercase">Acompanhamento e QR Codes</h3>
                  <p className="text-xs text-slate-400 font-medium">Visualize os pedidos pendentes de descarga individualmente ou em grade.</p>
                </div>
                
                {/* Botões Grid vs Slide e Barra de Busca */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Busca */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Pesquisar pedido..." 
                      value={searchTerm} 
                      onChange={(e) => { setSearchTerm(e.target.value); setSlideIndex(0); }}
                      className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-48 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
                    />
                  </div>

                  {/* Abas visual */}
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-md flex items-center gap-1 text-xs font-bold transition-all ${
                        viewMode === 'grid' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" /> Grade
                    </button>
                    <button
                      onClick={() => setViewMode('slide')}
                      className={`p-2 rounded-md flex items-center gap-1 text-xs font-bold transition-all ${
                        viewMode === 'slide' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Tv className="w-3.5 h-3.5" /> Slides
                    </button>
                  </div>
                </div>
              </div>

              {/* Corpo da Visualização */}
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
                  <Inbox className="w-12 h-12 stroke-1" />
                  <p className="text-sm font-medium">Nenhum pedido pendente corresponde à sua busca.</p>
                </div>
              ) : (
                <>
                  {/* MODO GRADE */}
                  {viewMode === 'grid' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {filteredOrders.map((row, idx) => {
                        const code = String(row[orderField] || '').trim();
                        const isCopied = copiedCode === code;
                        return (
                          <div 
                            key={idx} 
                            className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between text-center hover:border-indigo-200 hover:shadow-md transition-all group"
                          >
                            <div className="bg-white p-2 border border-slate-200 rounded-lg shadow-sm mb-3">
                              <QRCode 
                                value={code} 
                                size={96} 
                                level="M"
                              />
                            </div>
                            <div className="w-full space-y-2">
                              <p className="font-mono text-xs font-black text-slate-900 truncate" title={code}>
                                {code}
                              </p>
                              <button
                                onClick={() => handleCopy(code)}
                                className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                                  isCopied 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100'
                                }`}
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" /> Copiado
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copiar Código
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* MODO SLIDE / APRESENTAÇÃO */}
                  {viewMode === 'slide' && (
                    <div className="max-w-md mx-auto py-4 flex flex-col items-center text-center space-y-6">
                      
                      {/* Cartão Central do Slide */}
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-8 shadow-md flex flex-col items-center justify-center">
                        <div className="bg-white p-4 border-4 border-slate-900 rounded-xl shadow-xl mb-6">
                          <QRCode 
                            value={String(filteredOrders[slideIndex]?.[orderField] || '')} 
                            size={200} 
                            level="H"
                          />
                        </div>
                        
                        <div className="bg-white px-5 py-2.5 border border-slate-200 rounded-full flex items-center gap-2 max-w-full shadow-sm mb-2">
                          <span className="font-mono text-lg font-black text-slate-800 truncate">
                            {String(filteredOrders[slideIndex]?.[orderField] || '')}
                          </span>
                          <button 
                            onClick={() => handleCopy(String(filteredOrders[slideIndex]?.[orderField] || ''))}
                            className={`p-1.5 rounded-full transition-all ${
                              copiedCode === String(filteredOrders[slideIndex]?.[orderField] || '')
                                ? 'bg-green-100 text-green-600'
                                : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                            }`}
                          >
                            {copiedCode === String(filteredOrders[slideIndex]?.[orderField] || '') ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Paginação */}
                        <p className="text-xs text-slate-400 font-bold tracking-wider">
                          PEDIDO {slideIndex + 1} DE {filteredOrders.length}
                        </p>
                      </div>

                      {/* Controles do Slide */}
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setSlideIndex(v => Math.max(0, v - 1))}
                          disabled={slideIndex === 0 || isPlaying}
                          className="p-3 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className={`p-5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center ${
                            isPlaying 
                              ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                        </button>

                        <button
                          onClick={() => setSlideIndex(v => Math.min(filteredOrders.length - 1, v + 1))}
                          disabled={slideIndex === filteredOrders.length - 1 || isPlaying}
                          className="p-3 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </div>

                      {isPlaying && (
                        <p className="text-xs text-indigo-600 font-bold uppercase animate-pulse">
                          Avanço automático ativado (2.0s)...
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

            </div>
          ) : (
            /* Sem pendências */
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-8 rounded-2xl flex flex-col items-center text-center gap-3 shadow-sm animate-fade-in max-w-lg mx-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              <div className="space-y-1">
                <h4 className="font-black text-base uppercase tracking-wider text-emerald-950">Sucesso absoluto!</h4>
                <p className="text-sm font-medium">Todos os pedidos carregados ao SC foram corretamente descarregados no destino.</p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Caixa de Referência */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
          <h4 className="font-bold uppercase tracking-wider text-xs">Instruções de Operação</h4>
        </div>
        <ol className="space-y-3 text-slate-400 text-xs list-decimal list-inside font-medium leading-relaxed">
          <li>Selecione a planilha que contém a relação de <strong className="text-white">Pedidos Carregados</strong> inicial.</li>
          <li>Selecione a planilha com o histórico de <strong className="text-white">Pedidos Descarregados</strong>.</li>
          <li>Clique em comparar. O sistema fará a limpeza, varredura de colunas chave e criará uma lista restrita com as pendências.</li>
          <li>Você poderá baixar o Excel com as pendências reais ou escanear os QR Codes gerados diretamente de seu celular para faturar/lançar.</li>
        </ol>
      </div>
    </div>
  );
};

export default SecondaryTripsComponent;
