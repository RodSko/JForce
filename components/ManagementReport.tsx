import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Play, Package, Layers, RefreshCw, Users, Briefcase, UserX, Palmtree, MapPin, Calendar, Clock, Plus, Trash2, Truck, Send, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DailyRecord } from '../types';

interface Props {
  history?: DailyRecord[];
}

interface ManagementTrip {
  id: string;
  route: string;
  datetime: string;
}

// Helper para encontrar nomes de colunas variados
const findColumnName = (row: any, possibleNames: string[]): string | undefined => {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const found = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return undefined;
};

// Helper para ler arquivo Excel
const readFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        if (workbook.SheetNames.length === 0) {
          resolve([]);
          return;
        }
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

const ManagementReport: React.FC<Props> = ({ history = [] }) => {
  // Refs para inputs de arquivo
  const processedInputRef = useRef<HTMLInputElement>(null);
  const shippedInputRef = useRef<HTMLInputElement>(null);

  // Estados dos arquivos
  const [selectedProcessedFile, setSelectedProcessedFile] = useState<File | null>(null);
  const [selectedShippedFile, setSelectedShippedFile] = useState<File | null>(null);

  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  
  // Data do Report
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Configuração de inputs
  const [plannedEmployees, setPlannedEmployees] = useState<number>(17);
  const [outsourcedEmployees, setOutsourcedEmployees] = useState<number>(0);
  const [absentEmployees, setAbsentEmployees] = useState<number>(0);
  const [vacationEmployees, setVacationEmployees] = useState<number>(0);

  // Viagens
  const [trips, setTrips] = useState<ManagementTrip[]>([]);
  
  // Carregar dados iniciais do histórico quando a data muda
  useEffect(() => {
    const record = history.find(h => h.date === reportDate);
    if (record && record.trips && record.trips.length > 0) {
      const mappedTrips: ManagementTrip[] = record.trips.map(t => ({
        id: t.id,
        route: 'SP BRE X SE AJU', // Default
        datetime: t.unsealTimestamp || '' // Usa o timestamp de deslacre se houver
      }));
      setTrips(mappedTrips);
    } else {
      setTrips([]); // Limpa se não houver registro
    }
  }, [reportDate, history]);

  // Estado para armazenar os resultados do processamento
  const [results, setResults] = useState<{ 
    multiple: number; 
    processed: number; 
    shipped: number;
    shippedByBase: Record<string, number>;
    planned: number;
    outsourced: number;
    absent: number;
    vacation: number;
    trips: ManagementTrip[];
  } | null>(null);

  // Handlers para Viagens
  const handleAddTrip = () => {
    setTrips(prev => [...prev, { id: '', route: 'SP BRE X SE AJU', datetime: '' }]);
  };

  const handleRemoveTrip = (index: number) => {
    setTrips(prev => prev.filter((_, i) => i !== index));
  };

  const handleTripChange = (index: number, field: keyof ManagementTrip, value: string) => {
    setTrips(prev => {
      const newTrips = [...prev];
      newTrips[index] = { ...newTrips[index], [field]: value };
      return newTrips;
    });
  };

  // Handlers de Arquivo
  const triggerProcessedInput = () => processedInputRef.current?.click();
  const triggerShippedInput = () => shippedInputRef.current?.click();

  const handleProcessedFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedProcessedFile(file);
      setStatus('idle');
      setMessage('');
      setResults(null);
    }
  };

  const handleShippedFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedShippedFile(file);
      setStatus('idle');
      setMessage('');
      setResults(null);
    }
  };

  const handleReset = () => {
    setSelectedProcessedFile(null);
    setSelectedShippedFile(null);
    setStatus('idle');
    setResults(null);
    setMessage('');
    if (processedInputRef.current) processedInputRef.current.value = '';
    if (shippedInputRef.current) shippedInputRef.current.value = '';
  };

  const handleGenerateReport = async () => {
    if (!selectedProcessedFile) {
      alert("É obrigatório selecionar pelo menos a Planilha de Processados.");
      return;
    }

    setStatus('processing');
    setMessage('Lendo e processando dados...');

    try {
      // Ler arquivos (Expedidos é opcional, mas se não tiver, conta como 0 ou ignora)
      const promises = [readFile(selectedProcessedFile)];
      if (selectedShippedFile) {
        promises.push(readFile(selectedShippedFile));
      }

      const [processedData, shippedData] = await Promise.all(promises);

      // --- Processar Planilha 1: Processados ---
      if (processedData.length === 0) throw new Error("A planilha de processados está vazia.");
      
      const processedCol = findColumnName(processedData[0], ['Número de pedido JMS', 'Numero de pedido JMS', 'Pedido', 'Order ID']);
      if (!processedCol) throw new Error("Coluna 'Número de pedido JMS' não encontrada na planilha de processados.");

      let countMultiples = 0; // Total de pedidos
      let countProcessed = 0; // Pedidos Pai (sem hífen)

      processedData.forEach((row: any) => {
        const rawId = row[processedCol];
        if (rawId) {
          const idStr = String(rawId).trim();
          if (idStr.length > 0) {
            countMultiples++;
            if (!idStr.includes('-')) {
              countProcessed++;
            }
          }
        }
      });

      // --- Processar Planilha 2: Expedidos (Se houver) ---
      let countShipped = 0;
      const shippedByBase: Record<string, number> = {};

      if (shippedData && shippedData.length > 0) {
        const shippedOrderCol = findColumnName(shippedData[0], ['Número de pedido JMS', 'Numero de pedido JMS', 'Pedido', 'Order ID']);
        const shippedBaseCol = findColumnName(shippedData[0], ['Parada anterior ou próxima', 'Parada anterior ou proxima', 'Next Stop', 'Parada', 'Destino']);
        
        if (shippedOrderCol) {
          shippedData.forEach((row: any) => {
             const rawId = row[shippedOrderCol];
             if (rawId) {
               const idStr = String(rawId).trim().toUpperCase();
               
               // Filtros de Expedição:
               // 1. Não pode conter hífen (Pedido filho)
               // 2. Não pode começar com 'BR' (Lote)
               if (idStr.length > 0 && !idStr.includes('-') && !idStr.startsWith('BR')) {
                 countShipped++;

                 // Agrupar por Base
                 if (shippedBaseCol) {
                   const base = row[shippedBaseCol] ? String(row[shippedBaseCol]).trim().toUpperCase() : 'INDEFINIDO';
                   shippedByBase[base] = (shippedByBase[base] || 0) + 1;
                 }
               }
             }
          });
        } else {
           // Fallback se não achar coluna de pedido (apenas conta linhas, mas sem filtros complexos)
           countShipped = shippedData.length;
        }
      }

      setResults({
        multiple: countMultiples,
        processed: countProcessed,
        shipped: countShipped,
        shippedByBase: shippedByBase,
        planned: plannedEmployees,
        outsourced: outsourcedEmployees,
        absent: absentEmployees,
        vacation: vacationEmployees,
        trips: trips
      });

      setStatus('success');
      setMessage('Análise concluída com sucesso!');

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Erro ao processar arquivos.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="bg-indigo-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2">Relatório de Gestão</h2>
        <p className="text-indigo-100 max-w-xl">
          Importe as planilhas de dados gerenciais (Processados e Expedidos) para calcular indicadores operacionais.
        </p>
      </div>
      
      {/* Área Principal */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Se já tiver resultados, mostra painel de resultados */}
        {status === 'success' && results ? (
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <CheckCircle2 className="w-6 h-6 text-green-600" />
                 Resultados da Análise - {new Date(reportDate).toLocaleDateString('pt-BR')}
               </h3>
               <button 
                 onClick={handleReset}
                 className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors"
               >
                 <RefreshCw className="w-4 h-4" /> Nova Análise
               </button>
            </div>

            {/* Seção de Viagens no Resultado */}
            {results.trips.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Viagens Registradas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {results.trips.map((trip, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-indigo-700">{trip.id}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{trip.route}</span>
                      </div>
                      {trip.datetime && (
                         <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                           <Clock className="w-3 h-3" /> <span className="font-medium">Chegada:</span> {trip.datetime}
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* Card: Pacotes Múltiplos (Total) */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col items-center text-center gap-2 shadow-sm relative overflow-hidden">
                <div className="bg-blue-100 p-3 rounded-full mb-2">
                  <Layers className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Múltiplos</p>
                <p className="text-3xl font-bold text-slate-800">{results.multiple.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-blue-600">Total processados</p>
              </div>

              {/* Card: Pacotes Processados (Sem Hífen) */}
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 flex flex-col items-center text-center gap-2 shadow-sm relative overflow-hidden">
                <div className="bg-green-100 p-3 rounded-full mb-2">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-green-800 uppercase tracking-wide">Processados</p>
                <p className="text-3xl font-bold text-slate-800">{results.processed.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-green-600">Pedidos únicos (Pai)</p>
              </div>

              {/* Card: Expedidos (Novo) */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 flex flex-col items-center text-center gap-2 shadow-sm relative overflow-hidden">
                <div className="bg-teal-100 p-3 rounded-full mb-2">
                  <Send className="w-6 h-6 text-teal-600" />
                </div>
                <p className="text-sm font-semibold text-teal-800 uppercase tracking-wide">Expedidos</p>
                <p className="text-3xl font-bold text-slate-800">{results.shipped.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-teal-600">Pedidos Filtrados</p>
              </div>

              {/* Card: Colaboradores Planejados */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 flex flex-col items-center text-center gap-2 shadow-sm relative overflow-hidden">
                <div className="bg-purple-100 p-3 rounded-full mb-2">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-sm font-semibold text-purple-800 uppercase tracking-wide">Planejados</p>
                <p className="text-3xl font-bold text-slate-800">{results.planned}</p>
                <p className="text-xs text-purple-600">Equipe Meta</p>
              </div>

              {/* Card: Terceirizados */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 flex flex-col items-center text-center gap-2 shadow-sm relative overflow-hidden">
                <div className="bg-orange-100 p-3 rounded-full mb-2">
                  <Briefcase className="w-6 h-6 text-orange-600" />
                </div>
                <p className="text-sm font-semibold text-orange-800 uppercase tracking-wide">Terceiros</p>
                <p className="text-3xl font-bold text-slate-800">{results.outsourced}</p>
                <p className="text-xs text-orange-600">Apoio</p>
              </div>

              {/* Card: Folga/Falta */}
              <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex flex-col items-center text-center gap-2 shadow-sm relative overflow-hidden">
                <div className="bg-red-100 p-3 rounded-full mb-2">
                  <UserX className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-sm font-semibold text-red-800 uppercase tracking-wide">Folga/Falta</p>
                <p className="text-3xl font-bold text-slate-800">{results.absent}</p>
                <p className="text-xs text-red-600">Ausências</p>
              </div>

              {/* Card: Férias */}
              <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-6 flex flex-col items-center text-center gap-2 shadow-sm relative overflow-hidden">
                <div className="bg-cyan-100 p-3 rounded-full mb-2">
                  <Palmtree className="w-6 h-6 text-cyan-600" />
                </div>
                <p className="text-sm font-semibold text-cyan-800 uppercase tracking-wide">Férias</p>
                <p className="text-3xl font-bold text-slate-800">{results.vacation}</p>
                <p className="text-xs text-cyan-600">Afastados</p>
              </div>
            </div>

            {/* Detalhamento de Expedição por Base (NOVO) */}
            {Object.keys(results.shippedByBase).length > 0 && (
              <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-6 mt-6">
                <h4 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5" /> Detalhamento de Expedição por Base
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(results.shippedByBase)
                    .sort(([, a], [, b]) => (b as number) - (a as number)) // Ordenar por quantidade decrescente
                    .map(([base, count]) => (
                      <div key={base} className="bg-white p-3 rounded-lg border border-teal-100 shadow-sm flex flex-col">
                        <span className="text-xs font-bold text-teal-600 uppercase truncate" title={base}>{base}</span>
                        <span className="text-2xl font-bold text-slate-800">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 border border-slate-200">
              <p><span className="font-semibold">Planilha Processados:</span> {selectedProcessedFile?.name}</p>
              {selectedShippedFile && (
                <p className="mt-1"><span className="font-semibold">Planilha Expedidos:</span> {selectedShippedFile.name}</p>
              )}
            </div>
          </div>
        ) : (
          /* Se não tiver resultados, mostra Configuração e Upload */
          <div className="flex flex-col gap-8">
            
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
               <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Data do Relatório:</label>
               <input 
                 type="date"
                 value={reportDate}
                 onChange={(e) => setReportDate(e.target.value)}
                 className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
               />
            </div>

            {/* Configuração de Viagens */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                 <Truck className="w-5 h-5 text-indigo-600" />
                 Viagens do Dia
               </h3>
               
               <div className="space-y-3">
                 {trips.map((trip, idx) => (
                   <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-end bg-white p-4 rounded-lg border border-slate-200 shadow-sm animate-fade-in">
                      <div className="flex-1 w-full">
                         <label className="block text-xs font-bold text-slate-500 mb-1">ID da Viagem</label>
                         <input 
                           type="text"
                           placeholder="ID Viagem"
                           value={trip.id}
                           onChange={(e) => handleTripChange(idx, 'id', e.target.value)}
                           className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono text-sm"
                         />
                      </div>
                      <div className="flex-1 w-full">
                         <label className="block text-xs font-bold text-slate-500 mb-1">Rota</label>
                         <div className="relative">
                            <select 
                              value={trip.route}
                              onChange={(e) => handleTripChange(idx, 'route', e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                            >
                              <option value="SP BRE X BA FEC X SE AJU">SP BRE X BA FEC X SE AJU</option>
                              <option value="SP BRE X SE AJU">SP BRE X SE AJU</option>
                            </select>
                            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                         </div>
                      </div>
                      <div className="flex-1 w-full">
                         <label className="block text-xs font-bold text-slate-500 mb-1">Data e Hora de Chegada</label>
                         <input 
                           type="text"
                           placeholder="DD/MM/AAAA HH:mm"
                           value={trip.datetime}
                           onChange={(e) => handleTripChange(idx, 'datetime', e.target.value)}
                           className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                      </div>
                      <button
                        onClick={() => handleRemoveTrip(idx)}
                        className="p-2 mb-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                 ))}
                 <button
                    onClick={handleAddTrip}
                    className="w-full py-2 border border-dashed border-indigo-300 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Viagem
                  </button>
               </div>
            </div>

            {/* Configuração da Equipe */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
               <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5 text-indigo-600" />
                 Dados da Equipe
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">Planejados</label>
                   <input type="number" min="1" value={plannedEmployees} onChange={(e) => setPlannedEmployees(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">Terceirizados</label>
                   <input type="number" min="0" value={outsourcedEmployees} onChange={(e) => setOutsourcedEmployees(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">Folga / Falta</label>
                   <input type="number" min="0" value={absentEmployees} onChange={(e) => setAbsentEmployees(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1">Férias</label>
                   <input type="number" min="0" value={vacationEmployees} onChange={(e) => setVacationEmployees(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                 </div>
               </div>
            </div>

            {/* Upload Area - GRID DUPLO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: Processados */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">1. Planilha de Pedidos Processados</label>
                <input 
                  type="file" 
                  ref={processedInputRef} 
                  onChange={handleProcessedFileChange} 
                  accept=".xlsx,.xls,.csv" 
                  className="hidden" 
                />
                
                <div 
                  onClick={triggerProcessedInput}
                  className={`
                    w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center gap-4 cursor-pointer transition-all group h-48 justify-center
                    ${selectedProcessedFile 
                      ? 'border-indigo-300 bg-indigo-50' 
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'
                    }
                  `}
                >
                  {selectedProcessedFile ? (
                    <>
                      <FileSpreadsheet className="w-10 h-10 text-indigo-600" />
                      <div className="text-center">
                        <p className="font-bold text-slate-800 break-all text-sm">{selectedProcessedFile.name}</p>
                        <p className="text-xs text-indigo-600 font-medium mt-1">Processados Selecionado</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      <div className="text-center">
                        <p className="font-medium text-slate-700 text-sm">Carregar Processados</p>
                        <p className="text-xs text-slate-500 mt-1">.xlsx, .xls, .csv</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Box 2: Expedidos */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">2. Planilha de Pedidos Expedidos</label>
                <input 
                  type="file" 
                  ref={shippedInputRef} 
                  onChange={handleShippedFileChange} 
                  accept=".xlsx,.xls,.csv" 
                  className="hidden" 
                />
                
                <div 
                  onClick={triggerShippedInput}
                  className={`
                    w-full p-8 border-2 border-dashed rounded-xl flex flex-col items-center gap-4 cursor-pointer transition-all group h-48 justify-center
                    ${selectedShippedFile 
                      ? 'border-teal-300 bg-teal-50' 
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-teal-400'
                    }
                  `}
                >
                  {selectedShippedFile ? (
                    <>
                      <FileSpreadsheet className="w-10 h-10 text-teal-600" />
                      <div className="text-center">
                        <p className="font-bold text-slate-800 break-all text-sm">{selectedShippedFile.name}</p>
                        <p className="text-xs text-teal-600 font-medium mt-1">Expedidos Selecionado</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-slate-400 group-hover:text-teal-500 transition-colors" />
                      <div className="text-center">
                        <p className="font-medium text-slate-700 text-sm">Carregar Expedidos</p>
                        <p className="text-xs text-slate-500 mt-1">.xlsx, .xls, .csv</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerateReport}
              disabled={!selectedProcessedFile || status === 'processing'}
              className={`
                w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-md transition-all
                ${!selectedProcessedFile || status === 'processing'
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg hover:-translate-y-0.5'
                }
              `}
            >
              {status === 'processing' ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-current" />
                  Gerar Report Completo
                </>
              )}
            </button>

            {/* Status Message (Erro) */}
            {status === 'error' && (
              <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-100 flex items-center gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagementReport;