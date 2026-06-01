import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { 
  FileSpreadsheet, Users, Clock, Flame, Calendar,
  Loader2, BarChart2, Table2, RefreshCcw, Search, Download, ClipboardList, Info, Sparkles
} from 'lucide-react';

interface Props {
  history: unknown[];
  employees: unknown[];
}

interface ScanRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: Record<string, any>;
  scanTime: Date;
  scanTimeString: string;
}

interface HourlyStat {
  hourString: string;
  count: number;
  percentage: number;
}

const formatToDateTimeLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
};

const Reports: React.FC<Props> = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dataRows, setDataRows] = useState<ScanRow[]>([]);
  const [columnName, setColumnName] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Customizadores da operação
  const [peopleCount, setPeopleCount] = useState<number>(5); // Padrão: 5 pessoas
  const [activeTab, setActiveTab] = useState<'analytics' | 'hourly' | 'records'>('analytics');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [startTimeFilter, setStartTimeFilter] = useState<string>('');
  const [endTimeFilter, setEndTimeFilter] = useState<string>('');
  const itemsPerPage = 15;

  // Encontra coluna correspondente ao "Tempo de digitalização" ou variações
  const findScanTimeColumn = (row: Record<string, unknown>): string => {
    const keys = Object.keys(row);
    const candidates = [
      'tempo de digitalização', 'tempo de digitalizacao', 'digitalização', 'digitalizacao', 
      'tempo digitalizacao', 'data/hora', 'data hora', 'data e hora', 'scan time', 'bipagem', 'hora de digitalização', 'data importacao'
    ];
    for (const candidate of candidates) {
      const matchedKey = keys.find(k => k.toLowerCase().trim() === candidate);
      if (matchedKey) return matchedKey;
    }
    for (const candidate of candidates) {
      const matchedKey = keys.find(k => k.toLowerCase().includes(candidate));
      if (matchedKey) return matchedKey;
    }
    return '';
  };

  // Convert Excel dates (numerical or string) to genuine JS Dates
  const parseExcelDate = (val: unknown): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    
    if (typeof val === 'number') {
      // Diferença de dias entre epoch de Excel (1900-01-01) e Unix (1970-01-01) é de aprox 25569 dias
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(jsDate.getTime())) {
        return jsDate;
      }
    }
    
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      
      // Match formatos comuns brasileiros DD/MM/YYYY HH:MM:SS
      const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\s+(\d{1,2}):(\d{1,2})(:(\d{1,2}))?/;
      const dmyMatch = trimmed.match(dmyRegex);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1; // 0-based
        let year = parseInt(dmyMatch[3], 10);
        if (year < 100) year += 2000;
        
        const hour = parseInt(dmyMatch[4], 10);
        const minute = parseInt(dmyMatch[5], 10);
        const second = dmyMatch[7] ? parseInt(dmyMatch[7], 10) : 0;
        
        const d = new Date(year, month, day, hour, minute, second);
        if (!isNaN(d.getTime())) return d;
      }
      
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
    }
    
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg('');
    setFileName(file.name);
    setDataRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        if (json.length === 0) {
          throw new Error('A planilha está vazia.');
        }

        // Tentar encontrar coluna de digitalização no primeiro registro
        const colName = findScanTimeColumn(json[0]);
        if (!colName) {
          throw new Error('Não localizamos a coluna "Tempo de digitalização" ou similar na planilha.');
        }

        setColumnName(colName);

        const parsedRows: ScanRow[] = [];
        json.forEach((row) => {
          const rawVal = row[colName];
          const parsedDate = parseExcelDate(rawVal);
          if (parsedDate) {
            parsedRows.push({
              raw: row,
              scanTime: parsedDate,
              scanTimeString: parsedDate.toLocaleString('pt-BR')
            });
          }
        });

        if (parsedRows.length === 0) {
          throw new Error(`Coluna "${colName}" encontrada, mas nenhum valor pôde ser convertido em data/hora válidas.`);
        }

        // Ordenar bipes cronologicamente
        parsedRows.sort((a, b) => a.scanTime.getTime() - b.scanTime.getTime());
        setDataRows(parsedRows);
        if (parsedRows.length > 0) {
          setStartTimeFilter(formatToDateTimeLocal(parsedRows[0].scanTime));
          setEndTimeFilter(formatToDateTimeLocal(parsedRows[parsedRows.length - 1].scanTime));
        }
        setCurrentPage(1);
      } catch (err: unknown) {
        console.error(err);
        const msg = err instanceof Error ? err.message : 'Falha ao analisar a planilha.';
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('Erro na leitura do arquivo de planilha.');
      setIsLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleReset = () => {
    setDataRows([]);
    setFileName('');
    setColumnName('');
    setErrorMsg('');
    setTableSearch('');
    setStartTimeFilter('');
    setEndTimeFilter('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filtrar os bipes pelo intervalo de tempo selecionado
  const filteredRowsByTime = useMemo(() => {
    if (dataRows.length === 0) return [];

    const start = startTimeFilter ? new Date(startTimeFilter) : null;
    const end = endTimeFilter ? new Date(endTimeFilter) : null;

    return dataRows.filter(row => {
      const timeMs = row.scanTime.getTime();
      if (start && timeMs < start.getTime()) return false;
      if (end && timeMs > end.getTime()) return false;
      return true;
    });
  }, [dataRows, startTimeFilter, endTimeFilter]);

  // Cálculos de Métricas Principais
  const metrics = useMemo(() => {
    if (filteredRowsByTime.length === 0) return null;

    const totalScans = filteredRowsByTime.length;
    const firstScan = filteredRowsByTime[0].scanTime;
    const lastScan = filteredRowsByTime[filteredRowsByTime.length - 1].scanTime;

    // Diferença em ms
    const diffMs = lastScan.getTime() - firstScan.getTime();
    
    // Se a diferença for zero, defaultamos para 1 hora mínima operacional para não dar divisão por zero
    const activeHours = diffMs > 0 ? diffMs / (1000 * 60 * 60) : 1;
    const activeMinutes = diffMs > 0 ? diffMs / (1000 * 60) : 1;

    // Pacotes por hora (geral)
    const scansPerHour = totalScans / activeHours;

    // Pacotes por minuto
    const scansPerMinute = totalScans / activeMinutes;

    // Pacotes por pessoa
    const peopleCountSafe = Math.max(1, peopleCount);
    const scansPerPerson = totalScans / peopleCountSafe;

    // Pacotes por pessoa por hora
    const scansPerPersonPerHour = scansPerHour / peopleCountSafe;

    // Formatação amigável de duração
    const durationHours = Math.floor(activeMinutes / 60);
    const durationMins = Math.floor(activeMinutes % 60);
    const durationString = durationHours > 0 
      ? `${durationHours}h ${durationMins}m` 
      : `${durationMins} min`;

    return {
      totalScans,
      firstScanString: firstScan.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      lastScanString: lastScan.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      durationString,
      activeHours,
      scansPerHour,
      scansPerMinute,
      scansPerPerson,
      scansPerPersonPerHour
    };
  }, [filteredRowsByTime, peopleCount]);

  // Estatísticas agrupadas por Hora do Dia
  const hourlyStats = useMemo((): HourlyStat[] => {
    if (filteredRowsByTime.length === 0) return [];

    const hourMap: Record<number, number> = {};
    filteredRowsByTime.forEach(row => {
      const h = row.scanTime.getHours();
      hourMap[h] = (hourMap[h] || 0) + 1;
    });

    const total = filteredRowsByTime.length;
    const stats: HourlyStat[] = [];
    
    // Obter min e max hora bipada para preencher intervalos vazios se quisermos
    const hoursInFile = Object.keys(hourMap).map(Number).sort((a, b) => a - b);
    if (hoursInFile.length === 0) return [];
    
    const minHour = hoursInFile[0];
    const maxHour = hoursInFile[hoursInFile.length - 1];

    for (let h = minHour; h <= maxHour; h++) {
      const count = hourMap[h] || 0;
      stats.push({
        hourString: `${String(h).padStart(2, '0')}:00`,
        count,
        percentage: (count / total) * 100
      });
    }

    return stats;
  }, [filteredRowsByTime]);

  // Estatísticas de fluxo acumulativo de trabalho (curva progressiva)
  const timelineData = useMemo(() => {
    if (filteredRowsByTime.length === 0) return [];

    let currentSum = 0;
    return filteredRowsByTime.map((row, idx) => {
      currentSum += 1;
      return {
        index: idx + 1,
        timeString: row.scanTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        count: currentSum
      };
    }).filter((_, idx, arr) => {
      // Amostrar para não explodir o gráfico se tiverem milhares de linhas
      const step = Math.max(1, Math.floor(arr.length / 50));
      return idx % step === 0 || idx === arr.length - 1;
    });
  }, [filteredRowsByTime]);

  // Filtragem da tabela com busca por conteúdo do pedido
  const filteredDataRows = useMemo(() => {
    if (!tableSearch) return filteredRowsByTime;
    const term = tableSearch.toLowerCase().trim();
    return filteredRowsByTime.filter(row => {
      // Procura em todos os valores das colunas originais do registro
      return Object.values(row.raw).some(val => 
        String(val).toLowerCase().includes(term)
      );
    });
  }, [filteredRowsByTime, tableSearch]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDataRows.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDataRows, currentPage]);

  const totalPages = Math.ceil(filteredDataRows.length / itemsPerPage) || 1;

  // Realizar Exportação de Relatório Processado (Médias e Estatísticas por hora)
  const handleExportProcessed = () => {
    if (!metrics || filteredRowsByTime.length === 0) return;

    // Aba 1: Métricas de Resumo
    const summarySheetData = [
      { Métrica: "Nome do Arquivo", Valor: fileName },
      { Métrica: "Total de Pacotes Bipados", Valor: metrics.totalScans },
      { Métrica: "Horário do Primeiro Bipe", Valor: filteredRowsByTime[0].scanTimeString },
      { Métrica: "Horário do Último Bipe", Valor: filteredRowsByTime[filteredRowsByTime.length - 1].scanTimeString },
      { Métrica: "Tempo de Duração Ativa", Valor: metrics.durationString },
      { Métrica: "Operadores informados", Valor: peopleCount },
      { Métrica: "Média Geral de Pacotes por Hora", Valor: Math.round(metrics.scansPerHour * 100) / 100 },
      { Métrica: "Média Geral de Pacotes por Minuto", Valor: Math.round(metrics.scansPerMinute * 100) / 100 },
      { Métrica: "Total de Pacotes por Pessoa", Valor: Math.round(metrics.scansPerPerson * 100) / 100 },
      { Métrica: "Média Individual (Pacotes/Pessoa/Hora)", Valor: Math.round(metrics.scansPerPersonPerHour * 100) / 100 }
    ];

    // Aba 2: Detalhamento por Intervalo de Hora
    const hourlySheetData = hourlyStats.map(stat => ({
      "Intervalo de Horário": stat.hourString,
      "Quantidade Bipada": stat.count,
      "Participação (%)": `${stat.percentage.toFixed(2)}%`,
      "Média p/ Pessoa nesta Hora": (stat.count / Math.max(1, peopleCount)).toFixed(2)
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
    const wsHourly = XLSX.utils.json_to_sheet(hourlySheetData);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo da Operação");
    XLSX.utils.book_append_sheet(wb, wsHourly, "Produtividade por Hora");

    XLSX.writeFile(wb, `Analise_Produtividade_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Cabeçalho */}
      <div className="bg-[linear-gradient(135deg,#1e1b4b,#312e81)] rounded-2xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 right-0 p-4 opacity-5">
           <ClipboardList className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Flame className="w-8 h-8 text-amber-400 animate-pulse" />
            Relatórios de Produtividade
          </h2>
          <p className="text-slate-300 max-w-2xl font-medium text-sm md:text-base">
            Envie sua planilha operacional de bipes. O sistema analisará a coluna <span className="text-amber-300 font-bold">Tempo de digitalização</span> para calcular o rendimento real da equipe.
          </p>
        </div>
      </div>

      {dataRows.length === 0 ? (
        /* Árvore de Upload de Arquivo */
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center shadow-md space-y-6 hover:border-indigo-400 transition-all">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden" 
            />

            <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-800 text-lg">Carregar Planilha de Bipagem</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium leading-relaxed">
                Importe a planilha contendo os dados dos pacotes. O sistema fará a varredura automática do tempo de digitalização.
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                </>
              ) : (
                'Selecionar Arquivo Excel / CSV'
              )}
            </button>

            {errorMsg && (
              <div className="text-red-500 font-bold text-xs bg-red-50 p-3 rounded-lg flex items-center gap-2 justify-center border border-red-100 max-w-md mx-auto">
                <Info className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-200">
               <h4 className="font-bold text-xs text-slate-700 mb-2 flex items-center gap-1">
                 <Info className="w-3.5 h-3.5 text-indigo-500" /> Formato Esperado:
               </h4>
               <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                 A planilha deve conter uma coluna com um dos seguintes nomes: <strong className="text-indigo-950 font-black">"Tempo de digitalização"</strong>, <strong className="text-indigo-950 font-black">"Tempo de digitalizacao"</strong>, <strong className="text-indigo-950 font-black">"Digitalização"</strong> ou <strong className="text-indigo-950 font-black">"Data/Hora"</strong> contendo os registros temporais de cada bipe.
               </p>
            </div>
          </div>
        </div>
      ) : (
        /* Painel Ativo de Produtividade */
        <div className="space-y-8">
          {/* Top Bar Config, Arquivo e Ações principais */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <p className="font-black text-slate-900 text-sm truncate" title={fileName}>{fileName}</p>
                <p className="text-[10px] text-indigo-600 font-black uppercase tracking-wider">
                  Colunada detectada: <span className="font-mono">{columnName}</span>
                </p>
              </div>
            </div>

            {/* Configuração de Pessoas */}
            <div className="flex items-center gap-3 bg-indigo-50/70 border border-indigo-100 px-4 py-3 rounded-xl max-w-xs w-full">
              <Users className="w-5 h-5 text-indigo-600 shrink-0" />
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase tracking-widest text-indigo-700">Operadores Ativos</label>
                <input 
                  type="number" 
                  min={1} 
                  value={peopleCount} 
                  onChange={(e) => setPeopleCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-white px-2 py-0.5 border border-indigo-200 text-slate-800 text-xs font-bold font-mono rounded w-16 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[10px] text-indigo-500 font-semibold leading-tight max-w-[90px] text-right">
                Ajuste para recalcular métricas/hora por pessoa
              </p>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportProcessed}
                className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Planilha de Análise
              </button>
              
              <button
                onClick={handleReset}
                className="px-3 py-3 text-slate-400 hover:text-red-500 border border-slate-200 bg-slate-50 hover:bg-red-50 rounded-xl font-bold text-[10px] uppercase transition-all"
                title="Subir outra planilha"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filtros de Intervalo de Tempo */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-end gap-6 animate-fade-in">
            <div className="flex-1 w-full space-y-2">
              <label className="block text-xs font-black uppercase text-slate-500 flex items-center gap-1.5 leading-none">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Início do Intervalo de Análise
              </label>
              <input 
                type="datetime-local"
                value={startTimeFilter}
                onChange={(e) => {
                  setStartTimeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono shadow-inner"
              />
            </div>

            <div className="flex-1 w-full space-y-2">
              <label className="block text-xs font-black uppercase text-slate-500 flex items-center gap-1.5 leading-none">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Fim do Intervalo de Análise
              </label>
              <input 
                type="datetime-local"
                value={endTimeFilter}
                onChange={(e) => {
                  setEndTimeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono shadow-inner"
              />
            </div>

            <div className="w-full md:w-auto self-stretch flex items-end">
              <button
                onClick={() => {
                  if (dataRows.length > 0) {
                    setStartTimeFilter(formatToDateTimeLocal(dataRows[0].scanTime));
                    setEndTimeFilter(formatToDateTimeLocal(dataRows[dataRows.length - 1].scanTime));
                    setCurrentPage(1);
                  }
                }}
                className="w-full md:px-5 py-3 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 h-[42px]"
                title="Resetar para o intervalo total da planilha"
              >
                <RefreshCcw className="w-3.5 h-3.5 text-slate-500" /> Resetar Data/Hora
              </button>
            </div>
          </div>

          {/* Cards KPI Médias em Reação ao peopleCount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            {/* KPI 1: Pacotes Totais */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-600 group-hover:scale-110 transition-transform">
                <Flame className="w-20 h-20" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total de Pacotes Bipados</p>
              <p className="text-3xl font-black text-slate-900 mt-2">
                {metrics?.totalScans.toLocaleString('pt-BR')}
              </p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <span>Início: <strong className="text-slate-700 font-bold">{metrics?.firstScanString}</strong></span>
                <span>•</span>
                <span>Fim: <strong className="text-slate-700 font-bold">{metrics?.lastScanString}</strong></span>
              </div>
            </div>

            {/* KPI 2: Duração Operação */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-slate-500">
                <Clock className="w-20 h-20" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Tempo de Atividade de Scan</p>
              <p className="text-3xl font-black text-indigo-950 mt-2">
                {metrics?.durationString}
              </p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-500 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Fluxo contínuo calculado</span>
              </div>
            </div>

            {/* KPI 3: Produtividade por Hora e por Minuto */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Vazão Geral de Bipes</p>
              <p className="text-3xl font-black text-amber-600 mt-2">
                {Math.round(metrics?.scansPerHour || 0).toLocaleString('pt-BR')} <span className="text-xs text-slate-400 font-bold">/hora</span>
              </p>
              <p className="mt-2 text-[10px] text-slate-500 font-medium font-mono">
                Média de {metrics?.scansPerMinute.toFixed(1)} pacotes por minuto
              </p>
            </div>

            {/* KPI 4: Produtividade Individual por Pessoa */}
            <div className="bg-indigo-600 p-5 rounded-2xl text-white shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-white">
                <Users className="w-20 h-20" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-wider text-indigo-200">Rendimento Individual</p>
              <p className="text-3xl font-black mt-2">
                {Math.round(metrics?.scansPerPersonPerHour || 0).toLocaleString('pt-BR')} <span className="text-xs text-indigo-200">/hora</span>
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-indigo-100 font-semibold font-mono">
                <span>Total de {Math.round(metrics?.scansPerPerson || 0).toLocaleString('pt-BR')} pacotes/operador</span>
              </div>
            </div>
          </div>

          {/* Abas e Visualizador de Dados Integrados */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Navegador de Abas */}
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === 'analytics' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" /> Gráficos de Fluxo
                </button>
                <button
                  onClick={() => setActiveTab('hourly')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === 'hourly' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4" /> Produtividade / Hora
                </button>
                <button
                  onClick={() => setActiveTab('records')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeTab === 'records' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Table2 className="w-4 h-4" /> Lista de Registros
                </button>
              </div>

              {activeTab === 'records' && (
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar pedido ou tag..."
                    value={tableSearch}
                    onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>
              )}
            </div>

            {/* Conteúdo Ativo */}
            <div className="p-6">
              {filteredRowsByTime.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic flex text-sm flex-col items-center justify-center gap-3">
                  <Info className="w-12 h-12 text-indigo-300" />
                  <div>
                    <h5 className="font-extrabold text-slate-700 text-sm">Sem Dados para Exibição</h5>
                    <p className="text-[11px] text-slate-400 max-w-sm mt-1 leading-relaxed">
                      Nenhum bipe foi localizado dentro do intervalo de tempo selecionado. Tente alterar ou resetar seus filtros.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* TAB 1: GRÁFICOS DE FLUXO */}
                  {activeTab === 'analytics' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Gráfico 1: Scans Distribuidos por hora */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm uppercase">Curva de Bipagem por Hora do Dia</h4>
                        <p className="text-[11px] text-slate-400 font-medium">Quantidade total de pacotes bipados agrupados para cada hora de operação.</p>
                      </div>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={hourlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="hourString" stroke="#94a3b8" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                              formatter={(value) => [`${value} pacotes`, 'Quantidade']}
                            />
                            <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Pacotes Bipados" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Gráfico 2: Fluxo Acumulativo de Produção */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm uppercase">Curva Progressiva Acumulada</h4>
                        <p className="text-[11px] text-slate-400 font-medium">Gráfico que mostra o crescimento de pacotes bipados e avanço ao longo do dia.</p>
                      </div>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={timelineData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="timeString" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                              formatter={(value) => [`${value} pacotes`, 'Progresso Total']}
                            />
                            <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={0.1} fill="#10b981" strokeWidth={2} name="Total Bipado" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRODUTIVIDADE / HORA */}
              {activeTab === 'hourly' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm uppercase">Detalhamento Prático por Hora</h4>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Análise exata de rendimento total e individual considerando <strong className="text-slate-700 font-bold">{peopleCount} operadores</strong> ativos declarados.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Intervalo Horário</th>
                          <th className="px-6 py-4">Soma Bipada (Volume)</th>
                          <th className="px-6 py-4">Participação no Total</th>
                          <th className="px-6 py-4">Vazão Média p/ Operador nesta Hora</th>
                          <th className="px-6 py-4 text-right">Avaliação do Fluxo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hourlyStats.map((stat, idx) => {
                          const perPerson = stat.count / Math.max(1, peopleCount);
                          const isPeak = stat.count === Math.max(...hourlyStats.map(s => s.count));
                          const isLow = stat.count === Math.min(...hourlyStats.map(s => s.count)) && stat.count > 0;
                          
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-black text-slate-800">{stat.hourString}</td>
                              <td className="px-6 py-4 font-bold font-mono text-indigo-950">
                                {stat.count.toLocaleString('pt-BR')} pacotes
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-medium">{stat.percentage.toFixed(1)}%</td>
                              <td className="px-6 py-4">
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-black font-mono">
                                  {perPerson.toFixed(1)} /hora
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isPeak && (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                                    Pico Operacional ⚡
                                  </span>
                                )}
                                {isLow && (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                                    Queda / Almoço 💤
                                  </span>
                                )}
                                {!isPeak && !isLow && <span className="text-slate-400 font-medium">Estável</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: LISTA DE EVENTOS BIPADOS */}
              {activeTab === 'records' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm uppercase">Logs Detalhados da Planilha</h4>
                      <p className="text-[11px] text-slate-400 font-medium">Apresentando todos os pacotes válidos e seus respectivos horários.</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      Exibindo {filteredDataRows.length.toLocaleString('pt-BR')} registros filtrados
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 w-16">#</th>
                          <th className="px-6 py-3">Tempo de Digitalização</th>
                          {/* Mostrar outras colunas relevantes se existirem na planilha */}
                          {Object.keys(dataRows[0]?.raw || {}).slice(0, 3).map((col, cIdx) => (
                            col !== columnName ? <th key={col + cIdx} className="px-6 py-3">{col}</th> : null
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {paginatedRows.map((row, idx) => {
                          const recordNum = (currentPage - 1) * itemsPerPage + idx + 1;
                          return (
                            <tr key={idx} className="hover:bg-slate-50 font-mono text-[11px]">
                              <td className="px-6 py-3 text-slate-400 font-bold">{recordNum}</td>
                              <td className="px-6 py-3 font-bold text-indigo-950 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                {row.scanTimeString}
                              </td>
                              {/* Valores dinâmicos da planilha original */}
                              {Object.entries(row.raw).slice(0, 3).map(([key, val], vIdx) => (
                                key !== columnName ? (
                                  <td key={key + vIdx} className="px-6 py-3 text-slate-600 truncate max-w-sm">
                                    {String(val)}
                                  </td>
                                ) : null
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <span className="text-[11px] font-black text-slate-600">
                        PÁGINA {currentPage} DE {totalPages}
                      </span>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40"
                      >
                        Próxima
                      </button>
                    </div>
                  )}

                </div>
              )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;