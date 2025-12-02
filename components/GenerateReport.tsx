import React, { useRef, useState } from 'react';
import { DailyRecord } from '../types';
import { Download, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Printer, Image as ImageIcon, Settings, File as FileIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, BorderStyle, TextRun, AlignmentType, VerticalAlign, PageOrientation } from 'docx';

interface Props {
  history: DailyRecord[];
  onImportTrips: (data: { date: string; tripId: string }[]) => Promise<void>;
}

interface ReportItem {
  pdd: string;
  id: string;
  vehicleType: string;
  volume: number;
  capacity: number;
  saturation: number;
  plate: string;
}

const GenerateReport: React.FC<Props> = ({ history, onImportTrips }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null); // Ref para o input do template
  
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  
  // Estado para o Template
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);

  // Mapeamento de Capacidade por Tipo de Veículo
  const getCapacity = (vehicleType: string): number => {
    const type = vehicleType?.toString().toLowerCase().trim() || '';
    if (type.includes('3/4')) return 2000;
    if (type.includes('van')) return 1100;
    if (type.includes('furg')) return 1100; // Furgao
    if (type.includes('utilit')) return 300; // Utilitário
    if (type.includes('toco')) return 4000;
    if (type.includes('truck')) return 5000;
    return 0; // Desconhecido
  };

  const handleDownloadHistoryReport = () => {
    const headers = ['Data', 'ID Viagem', 'Status', 'Hora Deslacre', 'Volume Dia', 'Carretas Dia'];
    const rows: string[] = [];
    
    const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedHistory.forEach(record => {
      if (record.trips && record.trips.length > 0) {
        record.trips.forEach(trip => {
          rows.push([
            record.date,
            trip.id,
            trip.unsealed ? 'Deslacrada' : 'Lacrada',
            trip.unsealTimestamp || '',
            record.volume.toString(),
            record.trucks.toString()
          ].join(';'));
        });
      } else {
        rows.push([
          record.date,
          'N/A',
          '-',
          '-',
          record.volume.toString(),
          record.trucks.toString()
        ].join(';'));
      }
    });

    downloadCSV(headers, rows, `historico_viagens_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadCSV = (headers: string[], rows: string[], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + headers.join(';') + '\n' + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerFileInput = () => {
    setImportStatus('idle');
    setReportData([]); // Limpar relatório anterior
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const triggerTemplateInput = () => {
    if (templateInputRef.current) {
      templateInputRef.current.click();
    }
  };

  const handleTemplateUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setTemplateFile(file);
      setTemplateName(file.name);
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

        const tripsToImport: { date: string; tripId: string }[] = [];
        const processedReportItems: ReportItem[] = [];

        jsonData.forEach((row: any) => {
          const idViagem = row['Tarefa de transporte No.'] || row['ID Viagem'] || row['Trip ID'];
          const dataSaida = row['Hora de saída planejada'] || row['Data'] || row['Previsão de chegada'];
          
          const pddChegada = row['PDD de chegada'] || row['Destino'] || '';
          const tipoVeiculo = row['Tipo de veículo utilizado'] || row['Veículo'] || '';
          const placa = row['Placa do carro'] || row['Placa'] || '';
          const pedidoMae = row['Número de " Pedido mãe"'] || row['Pedido mãe'] || '';
          
          if (!idViagem) return;

          // 1. Processar dados para Importação no Sistema
          let dateStr = '';
          if (dataSaida) {
            const matches = dataSaida.toString().match(/(\d{4}-\d{2}-\d{2})/);
            if (matches) {
              dateStr = matches[0];
            } else {
              dateStr = new Date().toISOString().split('T')[0];
            }
          } else {
             dateStr = new Date().toISOString().split('T')[0];
          }

          tripsToImport.push({
            date: dateStr,
            tripId: idViagem.toString().trim()
          });

          // 2. Processar dados para o Relatório Visual
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

        if (tripsToImport.length === 0) {
          throw new Error("Nenhuma viagem válida encontrada.");
        }

        // Importar para DB
        await onImportTrips(tripsToImport);
        
        // Atualizar estado para mostrar relatório visual
        setReportData(processedReportItems);
        setImportStatus('success');
        setStatusMessage(`${tripsToImport.length} viagens processadas com sucesso!`);
        
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (err: any) {
        console.error("Erro no processamento:", err);
        setImportStatus('error');
        setStatusMessage(err.message || "Erro ao processar arquivo.");
      }
    };

    reader.readAsBinaryString(file);
  };

  const handlePrint = () => {
    window.print();
  };

  const readFileAsBinary = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsBinaryString(file);
    });
  };

  const handleExportToExcel = async () => {
    let wb: XLSX.WorkBook;
    let ws: XLSX.WorkSheet;

    if (templateFile) {
      try {
        const data = await readFileAsBinary(templateFile);
        wb = XLSX.read(data, { type: 'binary' });
        // Usar a primeira planilha do template
        ws = wb.Sheets[wb.SheetNames[0]];
      } catch (error) {
        alert("Erro ao ler o arquivo de template.");
        return;
      }
    } else {
      // Criar novo workbook se não houver template
      wb = XLSX.utils.book_new();
      ws = XLSX.utils.aoa_to_sheet([]);
    }

    // Configuração do Grid Visual (4 Cartões por Linha)
    const CARDS_PER_ROW = 4;
    const grid: any[][] = [];
    
    // Recuperar merges existentes se houver (para não quebrar o template)
    const existingMerges = ws['!merges'] || [];
    const newMerges: XLSX.Range[] = [...existingMerges];

    // Função auxiliar para setar valor na grid (Array of Arrays)
    const setGridCell = (r: number, c: number, val: any) => {
      if (!grid[r]) grid[r] = [];
      grid[r][c] = val;
    };

    let currentRowBase = 0;
    
    for (let i = 0; i < reportData.length; i++) {
      const item = reportData[i];
      const colBase = (i % CARDS_PER_ROW) * 3; // Cada cartão ocupa 2 colunas + 1 de espaçamento
      
      // Se mudou de linha na grid (a cada 4 itens)
      if (i > 0 && i % CARDS_PER_ROW === 0) {
        currentRowBase += 9; // Cada cartão tem aprox 8 linhas de altura + 1 espaço
      }

      const r = currentRowBase;
      const c = colBase;

      // --- Construção do Cartão ---
      
      // 1. Área da FOTO (Mesclar 2 colunas por 2 linhas)
      setGridCell(r, c, "FOTO DO VEÍCULO");
      setGridCell(r, c+1, "");
      setGridCell(r+1, c, "");
      setGridCell(r+1, c+1, "");
      
      // Adicionar Merge
      newMerges.push({ s: { r: r, c: c }, e: { r: r+1, c: c+1 } }); 

      // 2. Dados (Linha por linha)
      
      // Nome da Linha
      setGridCell(r+2, c, "NOME DA LINHA");
      setGridCell(r+2, c+1, item.pdd);
      
      // ID Viagem
      setGridCell(r+3, c, "ID VIAGEM");
      setGridCell(r+3, c+1, item.id);
      
      // Tipo Veiculo
      setGridCell(r+4, c, "TIPO DE VEICULO");
      setGridCell(r+4, c+1, item.vehicleType);
      
      // Volumetria
      setGridCell(r+5, c, "VOLUMETRIA REAL");
      setGridCell(r+5, c+1, item.volume);
      
      // Capacidade
      setGridCell(r+6, c, "CAPACIDADE");
      setGridCell(r+6, c+1, item.capacity);
      
      // Saturação
      setGridCell(r+7, c, "SATURAÇÃO");
      setGridCell(r+7, c+1, `${(item.saturation * 100).toFixed(0)}%`);
      
      // Placa
      setGridCell(r+8, c, "PLACA");
      setGridCell(r+8, c+1, item.plate);
    }

    // Escrever o Grid na Planilha
    // sheet_add_aoa escreve os dados por cima da planilha existente (ou nova)
    XLSX.utils.sheet_add_aoa(ws, grid, { origin: "A1" });

    // Atualizar Merges
    ws['!merges'] = newMerges;

    // --- CORREÇÃO DE LARGURA DE COLUNAS ---
    // Define larguras específicas para cada tipo de coluna no padrão de 3 colunas por cartão
    const wscols = [];
    // Calculamos para cobrir todas as colunas geradas pelo grid
    // 4 cartões * 3 colunas = 12 colunas no total
    for (let i = 0; i < CARDS_PER_ROW; i++) {
        // Coluna 1 do Cartão (Rótulo) - Tamanho médio
        wscols.push({ wch: 20 }); 
        // Coluna 2 do Cartão (Valor) - Tamanho grande (para IDs e Nomes)
        wscols.push({ wch: 35 });
        // Coluna 3 (Espaçador) - Tamanho pequeno
        wscols.push({ wch: 3 });
    }
    
    // Sobrescreve as colunas da planilha (mesmo do template) para garantir a formatação
    ws['!cols'] = wscols;
      
    // Adicionar a planilha ao workbook se for novo (não tem template)
    if (!templateFile) {
      XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    } 

    // Gerar nome do arquivo
    const prefix = templateFile ? "Relatorio_Template_" : "Relatorio_Operacional_";
    const fileName = `${prefix}${new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const handleExportToWord = async () => {
    // 1. Create the grid logic (4 items per row)
    const rows: TableRow[] = [];
    let currentCells: TableCell[] = [];

    for (let i = 0; i < reportData.length; i++) {
      const item = reportData[i];

      // Create the Inner Table (The Card)
      const cardTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          // Photo Row
          new TableRow({
            height: { value: 2000, rule: 'exact' }, // Space for photo
            children: [
              new TableCell({
                columnSpan: 2,
                children: [new Paragraph({
                    children: [new TextRun({ text: "FOTO DO VEÍCULO", bold: true, size: 20, color: "CCCCCC" })],
                    alignment: AlignmentType.CENTER
                })],
                verticalAlign: VerticalAlign.CENTER,
              })
            ]
          }),
          // Data Rows helper
          ...[
            ["NOME DA LINHA", item.pdd],
            ["ID VIAGEM", item.id],
            ["TIPO DE VEICULO", item.vehicleType],
            ["VOLUMETRIA REAL", item.volume.toString()],
            ["CAPACIDADE", item.capacity.toString()],
            ["SATURAÇÃO", `${(item.saturation * 100).toFixed(0)}%`],
            ["PLACA", item.plate]
          ].map(([label, value]) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 40, type: WidthType.PERCENTAGE },
                  shading: { fill: "E5E7EB" }, // Gray-200
                  children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 16 })] })],
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 100, bottom: 100, left: 100, right: 100 }
                }),
                new TableCell({
                   width: { size: 60, type: WidthType.PERCENTAGE },
                   children: [new Paragraph({
                       children: [new TextRun({
                           text: value,
                           bold: label === "PLACA" || label === "SATURAÇÃO",
                           color: (label === "SATURAÇÃO" && parseFloat(value) > 100) ? "DC2626" : "000000",
                           size: 16
                       })],
                       alignment: AlignmentType.CENTER
                   })],
                   verticalAlign: VerticalAlign.CENTER,
                   margins: { top: 100, bottom: 100, left: 100, right: 100 }
                })
              ]
            })
          )
        ]
      });

      // Add Card Table to a Cell in the Master Row
      currentCells.push(new TableCell({
        children: [new Paragraph(""), cardTable, new Paragraph("")], // Padding around card
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        margins: { top: 200, bottom: 200, left: 200, right: 200 }
      }));

      // If we have 4 cells or it's the last item, push the row
      if (currentCells.length === 4 || i === reportData.length - 1) {
        // Fill remaining cells if last row is incomplete
        while (currentCells.length < 4) {
             currentCells.push(new TableCell({ children: [], width: { size: 25, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } } }));
        }
        rows.push(new TableRow({ children: currentCells }));
        currentCells = [];
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
            page: {
                size: { orientation: PageOrientation.LANDSCAPE },
                margin: { top: 500, bottom: 500, left: 500, right: 500 }
            }
        },
        children: [
          new Table({
            rows: rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            }
          })
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Visual_${new Date().toISOString().split('T')[0]}.docx`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Área de Controle (Não aparece na impressão) */}
      <div className="print:hidden space-y-8">
        <div className="bg-indigo-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
          <h2 className="text-3xl font-bold mb-2">Central de Relatórios</h2>
          <p className="text-indigo-100 max-w-xl">
            Importe a planilha para gerar os cartões de carregamento visual e alimentar o sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Baixar Histórico */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Baixar Histórico</h3>
              <p className="text-sm text-slate-500">Download completo do histórico de viagens e lacres em CSV.</p>
            </div>
            <button 
              onClick={handleDownloadHistoryReport}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-medium transition-colors mt-4"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Baixar CSV
            </button>
          </div>

          {/* Card Configurar Template */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Configuração de Template</h3>
              <p className="text-sm text-slate-500 mb-2">Opcional: Envie um arquivo Excel base para formatação personalizada.</p>
              
              <div className="bg-slate-50 p-3 rounded border border-slate-200 mb-2">
                 <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                   <FileIcon className="w-4 h-4 text-slate-400" />
                   <span className="truncate max-w-[150px]">
                     {templateName || "Padrão do Sistema"}
                   </span>
                 </div>
              </div>
            </div>

            <input 
              type="file" 
              ref={templateInputRef} 
              onChange={handleTemplateUpload} 
              accept=".xlsx,.xls" 
              className="hidden" 
            />

            <button 
              onClick={triggerTemplateInput}
              className="w-full flex items-center justify-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 py-3 rounded-lg font-medium transition-colors mt-4"
            >
              <Upload className="w-4 h-4" />
              Carregar Template
            </button>
          </div>

          {/* Card Importar Planilha (Principal) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Gerar Relatório Visual</h3>
              <p className="text-slate-500 text-sm mb-4">
                Carregue a planilha operacional para visualizar e imprimir.
              </p>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv,.xlsx,.xls" 
              className="hidden" 
            />
            
            <button 
              onClick={triggerFileInput}
              disabled={importStatus === 'loading'}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {importStatus === 'loading' ? 'Processando...' : (
                <>
                  <FileText className="w-4 h-4" />
                  Selecionar Planilha
                </>
              )}
            </button>

             {importStatus !== 'idle' && (
              <div className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
                importStatus === 'error' ? 'bg-red-50 text-red-700' : 
                importStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-600'
              }`}>
                {importStatus === 'error' && <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                {importStatus === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Relatório Visual (Área de Impressão) */}
      {reportData.length > 0 && (
        <div className="animate-fade-in">
          <div className="print:hidden flex flex-col sm:flex-row justify-between items-center mb-6 bg-slate-100 p-4 rounded-lg border border-slate-200 gap-4">
            <h3 className="text-xl font-bold text-slate-800">Pré-visualização do Relatório</h3>
            <div className="flex gap-3">
               <button 
                onClick={handleExportToWord}
                className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Baixar Word (.docx)
              </button>
              <button 
                onClick={handleExportToExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Baixar Excel (.xlsx)
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir / PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-4">
            {reportData.map((item, idx) => (
              <div key={idx} className="border-2 border-slate-800 break-inside-avoid bg-white flex flex-col">
                {/* Espaço para Foto */}
                <div className="h-48 bg-slate-100 border-b-2 border-slate-800 flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs uppercase font-bold tracking-wider">Foto do Veículo</span>
                </div>

                {/* Tabela de Dados */}
                <div className="text-sm">
                  {/* Linha 1: Nome da Linha */}
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="bg-slate-200 p-2 font-bold text-slate-800 text-xs flex items-center">NOME DA LINHA</div>
                    <div className="p-2 font-mono text-slate-900 font-bold flex items-center justify-center text-center">{item.pdd || '-'}</div>
                  </div>

                  {/* Linha 2: ID Viagem */}
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">ID VIAGEM</div>
                    <div className="p-2 font-mono text-xs flex items-center justify-center text-center break-all">{item.id}</div>
                  </div>

                  {/* Linha 3: Tipo Veículo */}
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">TIPO DE VEICULO</div>
                    <div className="p-2 text-xs flex items-center justify-center text-center uppercase">{item.vehicleType}</div>
                  </div>

                  {/* Linha 4: Volumetria */}
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">VOLUMETRIA REAL</div>
                    <div className="p-2 text-xs flex items-center justify-center text-center font-mono">{item.volume}</div>
                  </div>

                  {/* Linha 5: Capacidade */}
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">CAPACIDADE</div>
                    <div className="p-2 text-xs flex items-center justify-center text-center font-mono">{item.capacity}</div>
                  </div>

                  {/* Linha 6: Saturação */}
                  <div className="grid grid-cols-2 border-b border-slate-300">
                    <div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">SATURAÇÃO</div>
                    <div className={`p-2 text-xs flex items-center justify-center text-center font-bold ${
                      item.saturation > 1 ? 'text-red-600' : 'text-slate-900'
                    }`}>
                      {(item.saturation * 100).toFixed(0)}%
                    </div>
                  </div>

                  {/* Linha 7: Placa */}
                  <div className="grid grid-cols-2">
                    <div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">PLACA</div>
                    <div className="p-2 text-sm flex items-center justify-center text-center font-bold uppercase">{item.plate}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateReport;