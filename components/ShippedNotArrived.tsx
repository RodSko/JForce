import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Filter, Download, Settings2, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Search, ListFilter, GitCompare, ArrowRightLeft } from 'lucide-react';

interface ProcessLog {
  step: string;
  count: number;
  removed: number;
}

const ShippedNotArrived: React.FC = () => {
  // --- STATE GERAL ---
  const [mode, setMode] = useState<'single' | 'cross'>('single');

  // --- STATE MODO SINGLE (Existente) ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [targetTripId, setTargetTripId] = useState<string>('');
  
  const [colMapping, setColMapping] = useState({
    time: '',
    order: '',
    base: '',
    stop: '',
    id: ''
  });
  
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // --- STATE MODO CROSS (Novo) ---
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);
  const [file1Name, setFile1Name] = useState('');
  const [file2Name, setFile2Name] = useState('');
  const [data1, setData1] = useState<any[]>([]);
  const [data2, setData2] = useState<any[]>([]);
  const [crossStatus, setCrossStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [crossResult, setCrossResult] = useState<any[]>([]);
  const [crossMessage, setCrossMessage] = useState('');

  // --- FUNÇÕES UTILITÁRIAS ---

  const cleanValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val).trim().replace(/\s+/g, ' ').toUpperCase();
  };

  const findColumn = (row: any, candidates: string[]): string => {
    if (!row) return '';
    const keys = Object.keys(row);
    for (const key of keys) {
      if (candidates.some(c => key.toLowerCase().includes(c))) {
        return key;
      }
    }
    return '';
  };

  // --- LÓGICA MODO SINGLE (Existente) ---

  const identifyColumns = (headers: string[]) => {
    const mapping = { time: '', order: '', base: '', stop: '', id: '' };
    const patterns = {
      time: ['tempo de digitalização', 'tempo', 'digitalizacao', 'data', 'hora'],
      order: ['número de pedido jms', 'numero de pedido jms', 'pedido', 'jms', 'ordem'],
      base: ['base de escaneamento', 'base', 'escaneamento', 'local'],
      stop: ['parada anterior ou próxima', 'parada anterior ou proxima', 'parada', 'destino', 'estacao'],
      id: ['número do id', 'numero do id', 'id', 'identificação', 'codigo']
    };

    headers.forEach(header => {
      const hLower = header.toLowerCase();
      (Object.keys(patterns) as Array<keyof typeof patterns>).forEach(key => {
        if (!mapping[key]) {
          if (patterns[key].some(pattern => hLower.includes(pattern))) {
            mapping[key] = header;
          }
        }
      });
    });
    setColMapping(mapping);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        
        if (data.length > 0) {
          setDataset(data);
          const cols = Object.keys(data[0]);
          setHeaders(cols);
          identifyColumns(cols);
          setStatus('idle');
          setFilteredData([]);
          setLogs([]);
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao ler arquivo Excel.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleProcess = () => {
    if (!dataset.length) return;
    
    const missingCols = [];
    if (!colMapping.time) missingCols.push("Tempo de digitalização");
    if (!colMapping.order) missingCols.push("Número de pedido JMS");
    if (!colMapping.base) missingCols.push("Base de escaneamento");
    if (!colMapping.stop) missingCols.push("Parada anterior ou próxima");
    if (!colMapping.id) missingCols.push("Número do ID");

    if (missingCols.length > 0) {
      alert(`Colunas não identificadas: ${missingCols.join(', ')}.`);
      return;
    }

    if (!targetTripId.trim()) {
      alert("Por favor, insira o ID da Viagem.");
      return;
    }

    const idAlvoClean = cleanValue(targetTripId);
    const processLogs: ProcessLog[] = [];
    
    let currentData = [...dataset];
    processLogs.push({ step: 'Dados Originais', count: currentData.length, removed: 0 });

    // 1. Sort Z->A
    currentData.sort((a, b) => {
      const timeA = cleanValue(a[colMapping.time]);
      const timeB = cleanValue(b[colMapping.time]);
      return timeB.localeCompare(timeA, undefined, { numeric: true, sensitivity: 'base' });
    });
    processLogs.push({ step: '1. Ordenação: Tempo (Z → A)', count: currentData.length, removed: 0 });

    // 2. Deduplicate
    const seenOrders = new Set();
    const uniqueData: any[] = [];
    currentData.forEach(row => {
      const orderId = cleanValue(row[colMapping.order]);
      if (orderId && !seenOrders.has(orderId)) {
        seenOrders.add(orderId);
        uniqueData.push(row);
      }
    });
    const removedDupes = currentData.length - uniqueData.length;
    currentData = uniqueData;
    processLogs.push({ step: '2. Deduplicação: Pedidos JMS', count: currentData.length, removed: removedDupes });

    // 3. Filter Base SP BRE
    const beforeBase = currentData.length;
    currentData = currentData.filter(row => cleanValue(row[colMapping.base]).includes('SP BRE'));
    processLogs.push({ step: "3. Filtro Base: 'SP BRE'", count: currentData.length, removed: beforeBase - currentData.length });

    // 4. Filter Stop SE AJU
    const beforeStop = currentData.length;
    currentData = currentData.filter(row => cleanValue(row[colMapping.stop]).includes('SE AJU'));
    processLogs.push({ step: "4. Filtro Parada: 'SE AJU'", count: currentData.length, removed: beforeStop - currentData.length });

    // 5. Filter ID
    const beforeId = currentData.length;
    currentData = currentData.filter(row => {
      const val = cleanValue(row[colMapping.id]);
      const valNoSpace = val.replace(/\s+/g, '');
      const targetNoSpace = idAlvoClean.replace(/\s+/g, '');
      return val === idAlvoClean || valNoSpace === targetNoSpace;
    });
    processLogs.push({ step: `5. Filtro ID: '${idAlvoClean}'`, count: currentData.length, removed: beforeId - currentData.length });

    setFilteredData(currentData);
    setLogs(processLogs);
    setStatus(currentData.length > 0 ? 'success' : 'error');
    if (currentData.length === 0) {
      setErrorMessage("Nenhum registro restou após a aplicação sequencial dos filtros.");
    }
  };

  const handleDownload = () => {
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados Filtrados");
    XLSX.writeFile(wb, `Resultado_Filtro_${targetTripId}.xlsx`);
  };

  const handleReset = () => {
    setDataset([]);
    setFilteredData([]);
    setStatus('idle');
    setTargetTripId('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- LÓGICA MODO CROSS (Novo) ---

  const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
        } catch (err) { reject(err); }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleFile1Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile1Name(file.name);
      const data = await readExcel(file);
      setData1(data);
    }
  };

  const handleFile2Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile2Name(file.name);
      const data = await readExcel(file);
      setData2(data);
    }
  };

  const handleCrossProcess = () => {
    if (data1.length === 0 || data2.length === 0) {
      alert("Por favor, carregue ambas as planilhas.");
      return;
    }

    // Identificar colunas
    const colId1 = findColumn(data1[0], ['número de pedido jms', 'numero de pedido jms', 'pedido', 'jms']);
    const colId2 = findColumn(data2[0], ['número de pedido jms', 'numero de pedido jms', 'pedido', 'jms']);

    if (!colId1 || !colId2) {
      alert("Não foi possível encontrar a coluna 'Número de pedido JMS' em uma das planilhas.");
      return;
    }

    // Processar Planilha 1: Remover Pedidos Filhos (contém '-')
    const cleanData1 = data1.filter(row => {
      const id = cleanValue(row[colId1]);
      return !id.includes('-');
    });

    // Processar Planilha 2: Remover Filhos (-) E Lotes (BR)
    const validIdsTable2 = new Set<string>();
    data2.forEach(row => {
      const id = cleanValue(row[colId2]);
      if (id && !id.includes('-') && !id.startsWith('BR')) {
        validIdsTable2.add(id);
      }
    });

    // Cruzamento: O que tem na 1 e NÃO tem na 2
    const diff = cleanData1.filter(row => {
      const id = cleanValue(row[colId1]);
      return !validIdsTable2.has(id);
    });

    setCrossResult(diff);
    setCrossStatus(diff.length > 0 ? 'success' : 'error');
    if (diff.length === 0) {
      setCrossMessage("Todos os pedidos válidos da Planilha 1 foram encontrados na Planilha 2.");
    }
  };

  const handleCrossDownload = () => {
    const ws = XLSX.utils.json_to_sheet(crossResult);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Diferenca");
    XLSX.writeFile(wb, `Relatorio_Diferenca_Cruzamento.xlsx`);
  };

  const handleCrossReset = () => {
    setData1([]);
    setData2([]);
    setFile1Name('');
    setFile2Name('');
    setCrossResult([]);
    setCrossStatus('idle');
    if (file1Ref.current) file1Ref.current.value = '';
    if (file2Ref.current) file2Ref.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8">
      {/* Header com Toggle */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
         <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
            <ListFilter className="w-8 h-8 text-indigo-400" />
            Expediu Mas Não Chegou
          </h2>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setMode('single')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${mode === 'single' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <Filter className="w-4 h-4" /> Filtro Sequencial (Único)
            </button>
            <button 
              onClick={() => setMode('cross')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${mode === 'cross' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <GitCompare className="w-4 h-4" /> Cruzamento de Bases (Duplo)
            </button>
          </div>
        </div>
      </div>

      {/* ==================== MODO SINGLE ==================== */}
      {mode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          {/* COLUNA ESQUERDA: CONFIGURAÇÃO */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" /> Upload da Planilha
                </h3>
                {dataset.length > 0 && (
                  <button onClick={handleReset} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Limpar
                  </button>
                )}
              </div>
              
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls" />
              
              {!dataset.length ? (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-8 h-8" />
                  <span>Selecionar Arquivo .xlsx</span>
                </button>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-green-800 truncate" title={fileName}>{fileName}</p>
                    <p className="text-xs text-green-600">{dataset.length} linhas carregadas</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-600" /> ID para Filtro Final
              </h3>
              <p className="text-xs text-slate-500 mb-3">Insira o ID exato para o 5º passo do filtro.</p>
              <input 
                type="text" 
                value={targetTripId}
                onChange={(e) => setTargetTripId(e.target.value)}
                placeholder="Ex: DBGX..."
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm uppercase"
              />
            </div>

            {dataset.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-indigo-600" /> Mapeamento de Colunas
                </h3>
                
                {[
                  { key: 'time', label: 'Tempo de digitalização' },
                  { key: 'order', label: 'Número de pedido JMS' },
                  { key: 'base', label: 'Base de escaneamento' },
                  { key: 'stop', label: 'Parada anterior ou próxima' },
                  { key: 'id', label: 'Número do ID' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-bold text-slate-500">{field.label}</label>
                    <select 
                      value={colMapping[field.key as keyof typeof colMapping]} 
                      onChange={(e) => setColMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className={`w-full p-2 border rounded text-xs mt-1 outline-none ${!colMapping[field.key as keyof typeof colMapping] ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                    >
                      <option value="">Selecione a coluna...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}

                <button 
                  onClick={handleProcess}
                  className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Filter className="w-4 h-4" /> Aplicar Filtros Sequenciais
                </button>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: RESULTADOS SINGLE */}
          <div className="lg:col-span-8 space-y-6">
            {logs.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">📈 Sequência de Processamento</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">
                    <div className="col-span-2">Ação</div>
                    <div className="text-right">Linhas Restantes</div>
                    <div className="text-right">Removidas</div>
                  </div>
                  
                  {logs.map((log, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-4 items-center text-sm">
                      <div className="col-span-2 font-medium text-slate-700 flex items-center gap-2">
                        {log.step}
                      </div>
                      <div className="text-right font-mono font-bold text-slate-800">{log.count}</div>
                      <div className="text-right text-red-500 text-xs">
                        {log.removed > 0 ? `-${log.removed}` : '-'}
                      </div>
                    </div>
                  ))}

                  <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
                     <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-500">Linhas Iniciais</p>
                        <p className="text-xl font-bold text-slate-700">{logs[0].count}</p>
                     </div>
                     <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-500">Linhas Finais</p>
                        <p className="text-xl font-bold text-indigo-600">{logs[logs.length-1].count}</p>
                     </div>
                     <div className="bg-slate-50 p-3 rounded-lg text-center">
                        <p className="text-xs text-slate-500">Redução Total</p>
                        <p className="text-xl font-bold text-green-600">
                          {(((logs[0].count - logs[logs.length-1].count) / logs[0].count) * 100).toFixed(1)}%
                        </p>
                     </div>
                  </div>
                </div>
              </div>
            )}

            {status === 'success' && filteredData.length > 0 && (
              <div className="bg-green-50 p-6 rounded-xl border border-green-200 animate-fade-in flex flex-col md:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                    <div>
                      <h3 className="font-bold text-green-800 text-lg">Processamento Concluído</h3>
                      <p className="text-green-700 text-sm">{filteredData.length} registros correspondem aos critérios.</p>
                    </div>
                 </div>
                 <button 
                    onClick={handleDownload}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2"
                 >
                    <Download className="w-5 h-5" /> Baixar Resultado (Excel)
                 </button>
              </div>
            )}

            {status === 'error' && (
               <div className="bg-red-50 p-6 rounded-xl border border-red-200 animate-fade-in flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                  <div>
                     <h3 className="font-bold text-red-800">Resultado Vazio</h3>
                     <p className="text-red-700 text-sm">{errorMessage}</p>
                  </div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODO CROSS ==================== */}
      {mode === 'cross' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Tabela 1 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">1</div>
                 Planilha Principal (Base)
               </h3>
               <p className="text-sm text-slate-500">
                 Desta planilha serão removidos pedidos filhos (com hífen). O que sobrar será comparado.
               </p>
               
               <input type="file" ref={file1Ref} onChange={handleFile1Upload} className="hidden" accept=".xlsx,.xls" />
               <div 
                 onClick={() => file1Ref.current?.click()}
                 className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors h-32 ${data1.length > 0 ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'}`}
               >
                  {data1.length > 0 ? (
                    <div className="text-center">
                       <FileSpreadsheet className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                       <p className="font-bold text-indigo-900 text-sm truncate max-w-[200px]">{file1Name}</p>
                       <p className="text-xs text-indigo-600">{data1.length} linhas</p>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                       <Upload className="w-6 h-6 mx-auto mb-2" />
                       <span className="text-sm font-medium">Carregar Planilha 1</span>
                    </div>
                  )}
               </div>
            </div>

            {/* Input Tabela 2 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-xs">2</div>
                 Planilha de Comparação
               </h3>
               <p className="text-sm text-slate-500">
                 Desta planilha serão removidos filhos e lotes (iniciados com BR).
               </p>
               
               <input type="file" ref={file2Ref} onChange={handleFile2Upload} className="hidden" accept=".xlsx,.xls" />
               <div 
                 onClick={() => file2Ref.current?.click()}
                 className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors h-32 ${data2.length > 0 ? 'border-teal-300 bg-teal-50' : 'border-slate-300 hover:bg-slate-50'}`}
               >
                  {data2.length > 0 ? (
                    <div className="text-center">
                       <FileSpreadsheet className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                       <p className="font-bold text-teal-900 text-sm truncate max-w-[200px]">{file2Name}</p>
                       <p className="text-xs text-teal-600">{data2.length} linhas</p>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                       <Upload className="w-6 h-6 mx-auto mb-2" />
                       <span className="text-sm font-medium">Carregar Planilha 2</span>
                    </div>
                  )}
               </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
             <button
               onClick={handleCrossProcess}
               disabled={data1.length === 0 || data2.length === 0}
               className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
             >
               <ArrowRightLeft className="w-5 h-5" /> Processar Cruzamento
             </button>
             {(data1.length > 0 || data2.length > 0) && (
               <button onClick={handleCrossReset} className="px-4 py-3 text-slate-500 hover:text-red-600 font-medium">
                 Limpar Tudo
               </button>
             )}
          </div>

          {/* Resultados Cruzamento */}
          {crossStatus === 'success' && crossResult.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                <div className="flex items-start gap-4">
                   <div className="bg-amber-100 p-3 rounded-full">
                     <AlertCircle className="w-8 h-8 text-amber-600" />
                   </div>
                   <div>
                     <h3 className="text-xl font-bold text-slate-800">Diferenças Encontradas</h3>
                     <p className="text-slate-600 mt-1">
                       Foram encontrados <strong className="text-amber-600">{crossResult.length}</strong> pedidos na Planilha 1 que <span className="underline decoration-amber-500">não constam</span> na Planilha 2.
                     </p>
                   </div>
                </div>
                <button 
                  onClick={handleCrossDownload}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm flex items-center gap-2 whitespace-nowrap"
                >
                  <Download className="w-5 h-5" /> Baixar Diferença
                </button>
              </div>

              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                 <table className="w-full text-sm text-left whitespace-nowrap">
                   <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                     <tr>
                       {Object.keys(crossResult[0] || {}).map((header, i) => (
                         <th key={i} className="px-4 py-2 border-b">{header}</th>
                       ))}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-200">
                     {crossResult.slice(0, 100).map((row, idx) => (
                       <tr key={idx} className="hover:bg-slate-100">
                         {Object.values(row).map((val: any, vIdx) => (
                           <td key={vIdx} className="px-4 py-2 text-slate-700">{val}</td>
                         ))}
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {crossResult.length > 100 && (
                   <div className="p-2 text-center text-xs text-slate-500 bg-slate-100 border-t sticky bottom-0">
                     Exibindo os primeiros 100 registros. Baixe a planilha para ver tudo.
                   </div>
                 )}
              </div>
            </div>
          )}

          {crossStatus === 'error' && (
            <div className="bg-green-50 p-6 rounded-xl border border-green-200 flex items-center gap-4 animate-fade-in">
               <CheckCircle2 className="w-10 h-10 text-green-600" />
               <div>
                 <h3 className="text-lg font-bold text-green-800">Tudo Certo!</h3>
                 <p className="text-green-700">{crossMessage}</p>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShippedNotArrived;