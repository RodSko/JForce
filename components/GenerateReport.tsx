import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Printer, ImageDown, Camera, BarChart3, LayoutGrid } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, BorderStyle, TextRun, AlignmentType, VerticalAlign, PageOrientation, ImageRun } from 'docx';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Cell } from 'recharts';

interface Props {}

interface ReportItem {
  pdd: string;
  id: string;
  vehicleType: string;
  volume: number;
  capacity: number;
  saturation: number;
  plate: string;
}

interface AnalyticsData {
  base: string;
  count: number;
}

const GenerateReport: React.FC<Props> = () => {
  const [activeTab, setActiveTab] = useState<'visual' | 'analytics'>('visual');

  // --- STATES FOR VISUAL REPORT ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, string>>({});
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  // --- STATES FOR ANALYTICS REPORT ---
  const analyticsInputRef = useRef<HTMLInputElement>(null);
  const [analyticsStatus, setAnalyticsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [totalExpedited, setTotalExpedited] = useState<number>(0);

  // --- SHARED HELPERS ---
  const findColumnName = (row: any, candidates: string[]): string | undefined => {
    if (!row) return undefined;
    const keys = Object.keys(row);
    for (const name of candidates) {
      const found = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
      if (found) return found;
    }
    return undefined;
  };

  const getCapacity = (vehicleType: string): number => {
    const type = vehicleType?.toString().toLowerCase().trim() || '';
    if (type.includes('3/4')) return 2000;
    if (type.includes('van')) return 1100;
    if (type.includes('furg')) return 1100;
    if (type.includes('utilit')) return 300;
    if (type.includes('toco')) return 4000;
    if (type.includes('truck')) return 5000;
    return 0;
  };

  const getTomorrowDate = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('pt-BR');
  };

  // --- VISUAL REPORT HANDLERS ---

  const triggerFileInput = () => {
    setImportStatus('idle');
    setReportData([]); 
    setVehiclePhotos({});
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoCardClick = (id: string) => {
    setActivePhotoId(id);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
      photoInputRef.current.click();
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && activePhotoId) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setVehiclePhotos(prev => ({
            ...prev,
            [activePhotoId]: e.target!.result as string
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus('loading');
    setStatusMessage('Lendo e processando arquivo...');

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

        if (!jsonData || jsonData.length === 0) {
          throw new Error("Arquivo vazio ou formato inválido.");
        }

        const processedReportItems: ReportItem[] = [];

        jsonData.forEach((row: any) => {
          const idViagem = row['Tarefa de transporte No.'] || row['ID Viagem'] || row['Trip ID'];
          const pddChegada = row['PDD de chegada'] || row['Destino'] || '';
          const tipoVeiculo = row['Tipo de veículo utilizado'] || row['Veículo'] || '';
          const placa = row['Placa do carro'] || row['Placa'] || '';
          const pedidoMae = row['Número de " Pedido mãe"'] || row['Pedido mãe'] || '';
          
          if (!idViagem) return;

          const capacidade = getCapacity(tipoVeiculo);
          let rawVol = pedidoMae.toString();
          if (rawVol.includes(',') && !rawVol.includes('.')) {
              rawVol = rawVol.replace(',', '.');
          }
          const volumetria = parseFloat(rawVol) || 0;
          const saturacao = capacidade > 0 ? (volumetria / capacidade) : 0;

          processedReportItems.push({
            pdd: pddChegada,
            id: idViagem,
            vehicleType: tipoVeiculo,
            volume: volumetria,
            capacity: capacidade,
            saturation: saturacao,
            plate: placa
          });
        });

        if (processedReportItems.length === 0) {
          throw new Error("Nenhuma viagem válida encontrada.");
        }
        
        setReportData(processedReportItems);
        setImportStatus('success');
        setStatusMessage(`${processedReportItems.length} viagens processadas!`);
        
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err: any) {
        console.error("Erro no processamento:", err);
        setImportStatus('error');
        setStatusMessage(err.message || "Erro ao processar arquivo.");
      }
    };

    reader.readAsBinaryString(file);
  };

  // --- ANALYTICS REPORT HANDLERS ---

  const triggerAnalyticsInput = () => {
    if (analyticsInputRef.current) {
      analyticsInputRef.current.click();
    }
  };

  const handleAnalyticsUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAnalyticsStatus('loading');
    setAnalyticsData([]);
    setTotalExpedited(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

        if (!jsonData || jsonData.length === 0) throw new Error("Planilha vazia.");

        // Identificar colunas
        const colOrder = findColumnName(jsonData[0], ['Número de pedido JMS', 'Numero de pedido JMS', 'Pedido', 'Order ID', 'ID']);
        const colBase = findColumnName(jsonData[0], ['Parada anterior ou próxima', 'Parada anterior ou proxima', 'Base', 'Destino', 'Parada']);

        if (!colOrder) throw new Error("Coluna de Pedido não encontrada.");

        let totalCount = 0;
        const baseCounts: Record<string, number> = {};

        jsonData.forEach(row => {
           const id = String(row[colOrder] || '').trim().toUpperCase();
           
           // Lógica de Exclusão
           // 1. Remover filhos (com hífen)
           if (id.includes('-')) return;
           
           // 2. Remover lotes (começa com BR)
           if (id.startsWith('BR')) return;

           // Se passou, conta como expedido
           if (id.length > 0) {
             totalCount++;
             
             // Agrupar por Base
             let baseName = 'INDEFINIDO';
             if (colBase && row[colBase]) {
               baseName = String(row[colBase]).trim().toUpperCase();
               // Limpeza básica do nome da base se necessário (ex: remover prefixos comuns)
               baseName = baseName.replace('CD ', '').replace('HUB ', ''); 
             }
             
             baseCounts[baseName] = (baseCounts[baseName] || 0) + 1;
           }
        });

        // Formatar para gráfico
        const chartData = Object.entries(baseCounts)
          .map(([base, count]) => ({ base, count }))
          .sort((a, b) => b.count - a.count); // Ordenar maior para menor

        setTotalExpedited(totalCount);
        setAnalyticsData(chartData);
        setAnalyticsStatus('success');

        if (analyticsInputRef.current) analyticsInputRef.current.value = '';

      } catch (err: any) {
        console.error(err);
        setAnalyticsStatus('error');
        alert(err.message || "Erro ao processar planilha.");
      }
    };
    reader.readAsBinaryString(file);
  };


  // --- EXPORT FUNCTIONS (VISUAL) ---
  const handlePrint = () => window.print();

  const handleExportToPNG = async () => {
    if (!reportContainerRef.current) return;
    try {
      const canvas = await html2canvas(reportContainerRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `Relatorio_Visual_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (err) { alert("Não foi possível gerar a imagem."); }
  };

  const dataUrlToArrayBuffer = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    return await res.arrayBuffer();
  };

  const handleExportToExcel = async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    const CARDS_PER_ROW = 4;
    const grid: any[][] = [];
    const newMerges: XLSX.Range[] = [];
    const setGridCell = (r: number, c: number, val: any) => {
      if (!grid[r]) grid[r] = [];
      grid[r][c] = val;
    };
    let currentRowBase = 0;
    
    for (let i = 0; i < reportData.length; i++) {
      const item = reportData[i];
      const colBase = (i % CARDS_PER_ROW) * 3;
      if (i > 0 && i % CARDS_PER_ROW === 0) currentRowBase += 9;
      const r = currentRowBase;
      const c = colBase;
      setGridCell(r, c, "FOTO DO VEÍCULO");
      newMerges.push({ s: { r: r, c: c }, e: { r: r+1, c: c+1 } }); 
      setGridCell(r+2, c, "NOME DA LINHA"); setGridCell(r+2, c+1, item.pdd);
      setGridCell(r+3, c, "ID VIAGEM"); setGridCell(r+3, c+1, item.id);
      setGridCell(r+4, c, "TIPO DE VEICULO"); setGridCell(r+4, c+1, item.vehicleType);
      setGridCell(r+5, c, "VOLUMETRIA REAL"); setGridCell(r+5, c+1, item.volume);
      setGridCell(r+6, c, "CAPACIDADE"); setGridCell(r+6, c+1, item.capacity);
      setGridCell(r+7, c, "SATURAÇÃO"); setGridCell(r+7, c+1, `${(item.saturation * 100).toFixed(0)}%`);
      setGridCell(r+8, c, "PLACA"); setGridCell(r+8, c+1, item.plate);
    }
    XLSX.utils.sheet_add_aoa(ws, grid, { origin: "A1" });
    ws['!merges'] = newMerges;
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `Relatorio_Operacional_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportToWord = async () => {
    const rows: TableRow[] = [];
    let currentCells: TableCell[] = [];

    for (let i = 0; i < reportData.length; i++) {
      const item = reportData[i];
      let photoChildren: any[] = [new Paragraph({ children: [new TextRun({ text: "FOTO DO VEÍCULO", bold: true, size: 20, color: "CCCCCC" })], alignment: AlignmentType.CENTER })];

      if (vehiclePhotos[item.id]) {
        try {
          const imageBuffer = await dataUrlToArrayBuffer(vehiclePhotos[item.id]);
          photoChildren = [new Paragraph({ children: [new ImageRun({ data: imageBuffer, transformation: { width: 250, height: 150 } })], alignment: AlignmentType.CENTER })];
        } catch (e) {}
      }

      const cardTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ height: { value: 2000, rule: 'atLeast' }, children: [new TableCell({ columnSpan: 2, children: photoChildren, verticalAlign: VerticalAlign.CENTER })] }),
          ...[
            ["NOME DA LINHA", item.pdd], ["ID VIAGEM", item.id], ["TIPO DE VEICULO", item.vehicleType],
            ["VOLUMETRIA REAL", item.volume.toString()], ["CAPACIDADE", item.capacity.toString()],
            ["SATURAÇÃO", `${(item.saturation * 100).toFixed(0)}%`], ["PLACA", item.plate]
          ].map(([label, value]) => new TableRow({ children: [
                new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, shading: { fill: "E5E7EB" }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 16 })] })], verticalAlign: VerticalAlign.CENTER }),
                new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value, bold: label === "PLACA" || label === "SATURAÇÃO", color: (label === "SATURAÇÃO" && parseFloat(value) > 100) ? "DC2626" : "000000", size: 16 })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER })
              ]
            }))
        ]
      });
      currentCells.push(new TableCell({ children: [new Paragraph(""), cardTable, new Paragraph("")], width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } } }));
      if (currentCells.length === 4 || i === reportData.length - 1) {
        while (currentCells.length < 4) currentCells.push(new TableCell({ children: [], width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } } }));
        rows.push(new TableRow({ children: currentCells }));
        currentCells = [];
      }
    }
    const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 500, bottom: 500, left: 500, right: 500 } } }, children: [new Table({ rows: rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } } })] }] });
    const blob = await Packer.toBlob(doc);
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Relatorio_Visual_${new Date().toISOString().split('T')[0]}.docx`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />

      {/* Tabs */}
      <div className="print:hidden">
        <div className="bg-indigo-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90 mb-6">
          <h2 className="text-3xl font-bold mb-2">Relatório de Carregamento</h2>
          <p className="text-indigo-100 max-w-xl">
             Gere relatórios visuais de veículos ou analise a volumetria expedida por base.
          </p>
        </div>

        <div className="flex border-b border-slate-200 gap-6 mb-6">
          <button 
            onClick={() => setActiveTab('visual')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'visual' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-indigo-600'}`}
          >
            <LayoutGrid className="w-4 h-4" /> Relatório Visual (Cartões)
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'analytics' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-indigo-600'}`}
          >
            <BarChart3 className="w-4 h-4" /> Gráfico de Expedição (Bases)
          </button>
        </div>
      </div>

      {/* === TAB 1: VISUAL REPORT === */}
      {activeTab === 'visual' && (
        <>
          <div className="print:hidden max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative flex flex-col justify-between">
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Upload className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Gerar Relatório Visual</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                  Carregue a planilha operacional para gerar os cartões de carregamento.
                </p>
              </div>
              
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" />
              
              <button 
                onClick={triggerFileInput}
                disabled={importStatus === 'loading'}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-medium transition-colors disabled:opacity-50 text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform"
              >
                {importStatus === 'loading' ? 'Processando...' : <><FileText className="w-5 h-5" /> Selecionar Planilha</>}
              </button>

              {importStatus !== 'idle' && (
                <div className={`mt-4 p-3 rounded-lg text-sm flex items-start justify-center gap-2 ${importStatus === 'error' ? 'bg-red-50 text-red-700' : importStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-600'}`}>
                  {importStatus === 'error' && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {importStatus === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          </div>

          {reportData.length > 0 && (
            <div className="animate-fade-in">
              <div className="print:hidden flex flex-col sm:flex-row justify-between items-center mb-6 bg-slate-100 p-4 rounded-lg border border-slate-200 gap-4 mt-8">
                <h3 className="text-xl font-bold text-slate-800">Pré-visualização</h3>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleExportToWord} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"><FileText className="w-4 h-4" /> Word</button>
                  <button onClick={handleExportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
                  <button onClick={handleExportToPNG} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"><ImageDown className="w-4 h-4" /> PNG</button>
                  <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium"><Printer className="w-4 h-4" /> Imprimir</button>
                </div>
              </div>

              <div ref={reportContainerRef} className="bg-white p-4">
                <div className="w-full bg-[#FF0000] text-white font-bold text-2xl text-center py-4 mb-4 uppercase">CARREGAMENTO SE AJU - {getTomorrowDate()}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-4">
                  {reportData.map((item, idx) => (
                    <div key={idx} className="border-2 border-slate-800 break-inside-avoid bg-white flex flex-col">
                      <div className="h-48 bg-slate-100 border-b-2 border-slate-800 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-200 transition-colors relative overflow-hidden group" onClick={() => handlePhotoCardClick(item.id)} title="Clique para adicionar foto">
                        {vehiclePhotos[item.id] ? <img src={vehiclePhotos[item.id]} alt={`Veículo ${item.id}`} className="max-w-full max-h-full w-auto h-auto object-contain" /> : <><Camera className="w-10 h-10 mb-2 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all text-slate-500" /><span className="text-xs uppercase font-bold tracking-wider text-slate-500">Adicionar Foto</span></>}
                      </div>
                      <div className="text-sm">
                        <div className="grid grid-cols-2 border-b border-slate-300"><div className="bg-slate-200 p-2 font-bold text-slate-800 text-xs flex items-center">NOME DA LINHA</div><div className="p-2 font-mono text-slate-900 font-bold flex items-center justify-center text-center">{item.pdd || '-'}</div></div>
                        <div className="grid grid-cols-2 border-b border-slate-300"><div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">ID VIAGEM</div><div className="p-2 font-mono text-xs flex items-center justify-center text-center break-all">{item.id}</div></div>
                        <div className="grid grid-cols-2 border-b border-slate-300"><div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">TIPO DE VEICULO</div><div className="p-2 text-xs flex items-center justify-center text-center uppercase">{item.vehicleType}</div></div>
                        <div className="grid grid-cols-2 border-b border-slate-300"><div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">VOLUMETRIA REAL</div><div className="p-2 text-xs flex items-center justify-center text-center font-mono">{item.volume}</div></div>
                        <div className="grid grid-cols-2 border-b border-slate-300"><div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">CAPACIDADE</div><div className="p-2 text-xs flex items-center justify-center text-center font-mono">{item.capacity}</div></div>
                        <div className="grid grid-cols-2 border-b border-slate-300"><div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">SATURAÇÃO</div><div className={`p-2 text-xs flex items-center justify-center text-center font-bold ${item.saturation > 1 ? 'text-red-600' : 'text-slate-900'}`}>{(item.saturation * 100).toFixed(0)}%</div></div>
                        <div className="grid grid-cols-2"><div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">PLACA</div><div className="p-2 text-sm flex items-center justify-center text-center font-bold uppercase">{item.plate}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* === TAB 2: ANALYTICS REPORT === */}
      {activeTab === 'analytics' && (
        <div className="animate-fade-in space-y-8">
          
          {/* Upload Box for Analytics */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative flex flex-col justify-between">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <BarChart3 className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Gráfico de Expedição</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                  Carregue a planilha para calcular o total expedido e gerar o gráfico por base (Filtrando filhos e lotes).
                </p>
              </div>
              
              <input type="file" ref={analyticsInputRef} onChange={handleAnalyticsUpload} accept=".csv,.xlsx,.xls" className="hidden" />
              
              <button 
                onClick={triggerAnalyticsInput}
                disabled={analyticsStatus === 'loading'}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-medium transition-colors disabled:opacity-50 text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform"
              >
                {analyticsStatus === 'loading' ? 'Processando...' : <><FileText className="w-5 h-5" /> Importar Dados</>}
              </button>
            </div>
          </div>

          {/* Results Area */}
          {analyticsStatus === 'success' && analyticsData.length > 0 && (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
               
               {/* Total Big Number */}
               <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-500 uppercase tracking-wide">Total Expedido</h3>
                  <p className="text-6xl font-extrabold text-orange-600 mt-2">{totalExpedited.toLocaleString('pt-BR')}</p>
                  <p className="text-sm text-slate-400 mt-2">Pedidos únicos (Filhos e Lotes removidos)</p>
               </div>

               {/* Chart */}
               <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analyticsData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="base" 
                        angle={-45} 
                        textAnchor="end" 
                        interval={0} 
                        height={60} 
                        tick={{fontSize: 10}}
                        stroke="#64748b"
                      />
                      <YAxis stroke="#64748b" />
                      <Tooltip 
                        cursor={{fill: '#fff7ed'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="count" name="Quantidade" fill="#f97316" radius={[4, 4, 0, 0]}>
                         <LabelList dataKey="count" position="top" fill="#ea580c" fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
               </div>

               {/* Data Table Preview */}
               <div className="mt-8 border-t border-slate-100 pt-6">
                 <h4 className="font-bold text-slate-700 mb-4">Detalhamento por Base</h4>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {analyticsData.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded border border-slate-200 text-center">
                         <div className="text-xs font-bold text-slate-500 uppercase truncate" title={item.base}>{item.base}</div>
                         <div className="text-xl font-bold text-slate-800">{item.count}</div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GenerateReport;