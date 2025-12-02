import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Truck, Package, Download, Loader2, AlertCircle, Search, FileSearch } from 'lucide-react';
import * as XLSX from 'xlsx';

const ShippedNotArrived: React.FC = () => {
  // Refs para comparação inicial
  const loadingInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  
  // Ref para análise avançada
  const analysisInputRef = useRef<HTMLInputElement>(null);
  
  // Estados Comparação Inicial
  const [loadingFileName, setLoadingFileName] = useState<string | null>(null);
  const [batchFileName, setBatchFileName] = useState<string | null>(null);
  
  // Estados Análise Avançada
  const [analysisFileName, setAnalysisFileName] = useState<string | null>(null);
  const [tripIdFilter, setTripIdFilter] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Handlers para Comparação Inicial ---
  const triggerLoadingInput = () => loadingInputRef.current?.click();
  const triggerBatchInput = () => batchInputRef.current?.click();

  const handleLoadingUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setLoadingFileName(file.name);
  };

  const handleBatchUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setBatchFileName(file.name);
  };

  // --- Handlers para Análise Avançada ---
  const triggerAnalysisInput = () => analysisInputRef.current?.click();

  const handleAnalysisUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setAnalysisFileName(file.name);
  };

  // --- Utilitários ---
  const readFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          resolve(jsonData as any[]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const autoFitColumns = (data: any[]) => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).map(key => {
      let maxLen = key.length;
      const limit = Math.min(data.length, 500);
      for (let i = 0; i < limit; i++) {
        const value = data[i][key];
        const len = value ? String(value).length : 0;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(maxLen + 5, 60) };
    });
  };

  // Helper para encontrar nomes de colunas de forma flexível (case insensitive, trim)
  const findColumnName = (row: any, possibleNames: string[]): string | undefined => {
    const keys = Object.keys(row);
    for (const name of possibleNames) {
      const found = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
      if (found) return found;
    }
    return undefined;
  };

  // --- Lógica Principal: Comparação (Carregamento x Lote) ---
  const handleProcessAndDownload = async () => {
    const loadingFile = loadingInputRef.current?.files?.[0];
    const batchFile = batchInputRef.current?.files?.[0];

    if (!loadingFile || !batchFile) {
      alert("Por favor, selecione as duas planilhas antes de continuar.");
      return;
    }

    setIsProcessing(true);

    try {
      const [loadingData, batchData] = await Promise.all([
        readFile(loadingFile),
        readFile(batchFile)
      ]);

      const validLoadingOrders: any[] = [];
      
      // Identificar coluna de pedido na primeira planilha
      const firstLoadingRow = loadingData[0] || {};
      const loadingOrderCol = findColumnName(firstLoadingRow, ['Número de pedido JMS', 'Numero de pedido JMS', 'Pedido', 'Order ID']);

      if (!loadingOrderCol) {
        throw new Error("Coluna 'Número de pedido JMS' não encontrada na planilha de carregamento.");
      }

      loadingData.forEach((row: any) => {
        const rawId = row[loadingOrderCol];
        if (rawId) {
          const idStr = String(rawId).trim();
          if (/^\d+$/.test(idStr)) {
            validLoadingOrders.push({ ...row, _cleanId: idStr });
          }
        }
      });

      const batchIds = new Set<string>();
      const firstBatchRow = batchData[0] || {};
      const batchOrderCol = findColumnName(firstBatchRow, ['Número de pedido JMS', 'Numero de pedido JMS', 'Pedido', 'Order ID']);

      if (!batchOrderCol) {
        throw new Error("Coluna 'Número de pedido JMS' não encontrada na planilha de lote.");
      }

      batchData.forEach((row: any) => {
        const rawId = row[batchOrderCol];
        if (rawId) {
          const idStr = String(rawId).trim();
          batchIds.add(idStr);
        }
      });

      const missingOrders = validLoadingOrders.filter(item => !batchIds.has(item._cleanId));

      if (missingOrders.length === 0) {
        alert("Nenhum pedido faltante encontrado!");
        setIsProcessing(false);
        return;
      }

      const exportData = missingOrders.map(({ _cleanId, ...rest }) => rest);
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = autoFitColumns(exportData);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faltantes");

      const fileName = `pedidos_faltantes_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert(`Processamento concluído! ${missingOrders.length} pedidos encontrados e baixados.`);

    } catch (error: any) {
      console.error("Erro:", error);
      alert(`Erro: ${error.message || "Ocorreu um erro ao processar os arquivos."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Lógica Secundária: Análise Avançada (Rastreio Filtrado) ---
  const handleProcessAnalysis = async () => {
    const analysisFile = analysisInputRef.current?.files?.[0];
    
    if (!analysisFile) {
      alert("Por favor, selecione a planilha de rastreio.");
      return;
    }
    
    if (!tripIdFilter.trim()) {
      alert("Por favor, insira o ID da Viagem para filtrar.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const rawData = await readFile(analysisFile);
      
      if (rawData.length === 0) {
        alert("A planilha está vazia.");
        setIsAnalyzing(false);
        return;
      }

      const targetBase = 'SP BRE';
      const targetStop = 'SE AJU';
      const targetTripId = tripIdFilter.trim().toUpperCase();

      // Identificar nomes corretos das colunas
      const firstRow = rawData[0];
      const colBase = findColumnName(firstRow, ['Base de escaneamento', 'Scan Base', 'Base']);
      const colStop = findColumnName(firstRow, ['Parada anterior ou próxima', 'Parada anterior ou proxima', 'Next Stop']);
      const colTripId = findColumnName(firstRow, ['Número do ID', 'Numero do ID', 'ID Viagem', 'Trip ID', 'ID']);
      const colTime = findColumnName(firstRow, ['Tempo de digitalização', 'Tempo de digitalizacao', 'Scan Time', 'Data']);
      const colOrderId = findColumnName(firstRow, ['Número de pedido JMS', 'Numero de pedido JMS', 'Pedido']);

      // Validação das colunas essenciais
      if (!colBase || !colStop || !colTripId) {
        alert("Não foi possível encontrar as colunas necessárias na planilha (Base de escaneamento, Parada, Número do ID). Verifique o arquivo.");
        setIsAnalyzing(false);
        return;
      }

      // 1. Filtragem Inicial
      let filteredData = rawData.filter((row: any) => {
        const base = String(row[colBase] || '').trim().toUpperCase();
        const stop = String(row[colStop] || '').trim().toUpperCase();
        const tripId = String(row[colTripId] || '').trim().toUpperCase();

        return base === targetBase && stop === targetStop && tripId.includes(targetTripId);
      });

      if (filteredData.length === 0) {
        alert(`Nenhum dado encontrado.\nVerifique se o ID "${targetTripId}" está correto e se existem registros com Base SP BRE e Parada SE AJU.`);
        setIsAnalyzing(false);
        return;
      }

      // 2. Classificação: Tempo de digitalização Z a A (Descendente)
      if (colTime) {
        filteredData.sort((a, b) => {
          const valA = a[colTime];
          const valB = b[colTime];
          
          // Tentar criar objetos Date para comparação precisa
          const dateA = valA ? new Date(valA).getTime() : 0;
          const dateB = valB ? new Date(valB).getTime() : 0;

          // Se for uma data válida, usa timestamp
          if (!isNaN(dateA) && !isNaN(dateB) && dateA !== 0 && dateB !== 0) {
            return dateB - dateA; // Decrescente (Mais novo primeiro)
          }

          // Fallback para string se a data não for parseável
          const strA = String(valA || '');
          const strB = String(valB || '');
          if (strA < strB) return 1;
          if (strA > strB) return -1;
          return 0;
        });
      }

      // 3. Remoção de Duplicatas (Mantendo o mais recente pois já ordenamos)
      const uniqueOrders = new Map();
      const finalData: any[] = [];

      filteredData.forEach((row: any) => {
        // Se achou coluna de pedido, usa pra deduplicar. Se não, usa toda a linha como chave (improvável mas seguro)
        const uniqueKey = colOrderId ? (row[colOrderId] || Math.random()) : Math.random();
        
        if (colOrderId && uniqueKey) {
            if (!uniqueOrders.has(uniqueKey)) {
                uniqueOrders.set(uniqueKey, true);
                finalData.push(row);
            }
        } else {
            finalData.push(row);
        }
      });

      // 4. Exportação
      const ws = XLSX.utils.json_to_sheet(finalData);
      ws['!cols'] = autoFitColumns(finalData);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analise_Filtrada");

      const fileName = `analise_rastreio_${targetTripId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      // Feedback
      const msg = `Análise concluída!\n\nRegistros filtrados: ${filteredData.length}\nRegistros únicos (exportados): ${finalData.length}`;
      alert(msg);

    } catch (error) {
      console.error("Erro na análise:", error);
      alert("Erro ao processar arquivo de análise. Verifique o formato.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      {/* Seção 1: Comparação de Faltantes */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-800">1. Expedido Mas Não Chegou</h2>
          <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
            Faça o cruzamento de dados entre o relatório de carregamento e o controle de lotes para identificar discrepâncias.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Card 1: Importar Carregamento */}
          <div className="flex flex-col h-full">
            <div className="bg-blue-50 border border-blue-100 rounded-t-xl p-4 flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-blue-900">Relatório de Carregamento</h3>
            </div>
            
            <div className="border-x border-b border-slate-200 rounded-b-xl p-6 flex-1 flex flex-col items-center justify-center bg-white">
              <input 
                type="file" 
                ref={loadingInputRef} 
                onChange={handleLoadingUpload} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />
              
              <div 
                className="w-full p-8 border-2 border-dashed border-blue-200 rounded-xl bg-slate-50 hover:bg-blue-50/50 transition-colors flex flex-col items-center gap-4 group cursor-pointer" 
                onClick={triggerLoadingInput}
              >
                <FileSpreadsheet className="w-12 h-12 text-blue-300 group-hover:text-blue-500 transition-colors" />
                {loadingFileName ? (
                  <div className="text-center">
                    <p className="font-medium text-slate-800 break-all">{loadingFileName}</p>
                    <p className="text-xs text-green-600 font-medium mt-1">Arquivo selecionado</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">Clique para selecionar</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Importar Lote */}
          <div className="flex flex-col h-full">
            <div className="bg-orange-50 border border-orange-100 rounded-t-xl p-4 flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-orange-900">Controle de Lote</h3>
            </div>
            
            <div className="border-x border-b border-slate-200 rounded-b-xl p-6 flex-1 flex flex-col items-center justify-center bg-white">
              <input 
                type="file" 
                ref={batchInputRef} 
                onChange={handleBatchUpload} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />
              
              <div 
                className="w-full p-8 border-2 border-dashed border-orange-200 rounded-xl bg-slate-50 hover:bg-orange-50/50 transition-colors flex flex-col items-center gap-4 group cursor-pointer" 
                onClick={triggerBatchInput}
              >
                <FileSpreadsheet className="w-12 h-12 text-orange-300 group-hover:text-orange-500 transition-colors" />
                {batchFileName ? (
                  <div className="text-center">
                    <p className="font-medium text-slate-800 break-all">{batchFileName}</p>
                    <p className="text-xs text-green-600 font-medium mt-1">Arquivo selecionado</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">Clique para selecionar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center border-t border-slate-100 pt-8">
          <button
            onClick={handleProcessAndDownload}
            disabled={isProcessing || !loadingFileName || !batchFileName}
            className={`
              flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-bold shadow-lg transition-all
              ${isProcessing || !loadingFileName || !batchFileName
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-xl hover:-translate-y-1'
              }
            `}
          >
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
            Processar e Baixar Resultado
          </button>
        </div>
      </div>

      {/* Seção 2: Análise Avançada de Rastreio */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-purple-500">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">2. Análise Avançada de Rastreio</h2>
          <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
            Filtra registros SP BRE -> SE AJU, ordena por tempo (Z-A) e remove duplicatas com base no ID da viagem.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
          {/* Input ID Viagem */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">ID da Viagem (Filtro)</label>
            <div className="relative">
              <input
                type="text"
                value={tripIdFilter}
                onChange={(e) => setTripIdFilter(e.target.value)}
                placeholder="Ex: SRTR2250..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none uppercase font-mono"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Upload Planilha */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Relatório de Bipagem</label>
            <input 
              type="file" 
              ref={analysisInputRef} 
              onChange={handleAnalysisUpload} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
            />
            <div 
              onClick={triggerAnalysisInput}
              className="w-full py-3 px-4 border border-dashed border-purple-300 bg-purple-50 rounded-xl text-purple-700 font-medium cursor-pointer hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
            >
              <FileSearch className="w-5 h-5" />
              {analysisFileName ? (
                <span className="truncate max-w-[200px]">{analysisFileName}</span>
              ) : (
                "Selecionar Planilha"
              )}
            </div>
          </div>

          {/* Botão Ação */}
          <div className="flex-1">
             <button
              onClick={handleProcessAnalysis}
              disabled={isAnalyzing || !analysisFileName || !tripIdFilter}
              className={`
                w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all shadow-md
                ${isAnalyzing || !analysisFileName || !tripIdFilter
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white hover:shadow-lg'
                }
              `}
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Processar Análise
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippedNotArrived;