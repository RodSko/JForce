import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Printer, ImageDown, Camera } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, BorderStyle, TextRun, AlignmentType, VerticalAlign, PageOrientation, ImageRun } from 'docx';
import html2canvas from 'html2canvas';

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

const GenerateReport: React.FC<Props> = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null); // Ref para input de foto
  const reportContainerRef = useRef<HTMLDivElement>(null);
  
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  
  // Estado para armazenar fotos dos veículos: Map<TripID, Base64String>
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, string>>({});
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

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

  const getTomorrowDate = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('pt-BR');
  };

  const triggerFileInput = () => {
    setImportStatus('idle');
    setReportData([]); 
    setVehiclePhotos({}); // Limpar fotos ao carregar nova planilha
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Aciona o input de foto para um cartão específico
  const handlePhotoCardClick = (id: string) => {
    setActivePhotoId(id);
    if (photoInputRef.current) {
      photoInputRef.current.value = ''; // Resetar valor para permitir re-seleção do mesmo arquivo
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

          // Processar dados para o Relatório Visual
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
        
        // Atualizar estado para mostrar relatório visual
        setReportData(processedReportItems);
        setImportStatus('success');
        setStatusMessage(`${processedReportItems.length} viagens processadas para o relatório!`);
        
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

  const handleExportToPNG = async () => {
    if (!reportContainerRef.current) return;
    
    try {
      const canvas = await html2canvas(reportContainerRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `Relatorio_Visual_${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (err) {
      console.error("Erro ao gerar PNG:", err);
      alert("Não foi possível gerar a imagem.");
    }
  };

  // Helper para converter DataURL para ArrayBuffer (necessário para docx)
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
      
      if (i > 0 && i % CARDS_PER_ROW === 0) {
        currentRowBase += 9;
      }

      const r = currentRowBase;
      const c = colBase;

      // Área da FOTO
      setGridCell(r, c, "FOTO DO VEÍCULO");
      setGridCell(r, c+1, "");
      setGridCell(r+1, c, "");
      setGridCell(r+1, c+1, "");
      newMerges.push({ s: { r: r, c: c }, e: { r: r+1, c: c+1 } }); 

      // Dados
      setGridCell(r+2, c, "NOME DA LINHA");
      setGridCell(r+2, c+1, item.pdd);
      setGridCell(r+3, c, "ID VIAGEM");
      setGridCell(r+3, c+1, item.id);
      setGridCell(r+4, c, "TIPO DE VEICULO");
      setGridCell(r+4, c+1, item.vehicleType);
      setGridCell(r+5, c, "VOLUMETRIA REAL");
      setGridCell(r+5, c+1, item.volume);
      setGridCell(r+6, c, "CAPACIDADE");
      setGridCell(r+6, c+1, item.capacity);
      setGridCell(r+7, c, "SATURAÇÃO");
      setGridCell(r+7, c+1, `${(item.saturation * 100).toFixed(0)}%`);
      setGridCell(r+8, c, "PLACA");
      setGridCell(r+8, c+1, item.plate);
    }

    XLSX.utils.sheet_add_aoa(ws, grid, { origin: "A1" });
    ws['!merges'] = newMerges;

    const wscols = [];
    for (let i = 0; i < CARDS_PER_ROW; i++) {
        wscols.push({ wch: 20 }); 
        wscols.push({ wch: 35 });
        wscols.push({ wch: 3 });
    }
    
    ws['!cols'] = wscols;
      
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");

    const fileName = `Relatorio_Operacional_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExportToWord = async () => {
    const rows: TableRow[] = [];
    let currentCells: TableCell[] = [];

    for (let i = 0; i < reportData.length; i++) {
      const item = reportData[i];

      // Verificar se existe foto carregada
      let photoChildren: any[] = [
        new Paragraph({
          children: [new TextRun({ text: "FOTO DO VEÍCULO", bold: true, size: 20, color: "CCCCCC" })],
          alignment: AlignmentType.CENTER
        })
      ];

      if (vehiclePhotos[item.id]) {
        try {
          const imageBuffer = await dataUrlToArrayBuffer(vehiclePhotos[item.id]);
          photoChildren = [
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 250,
                    height: 150,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          ];
        } catch (e) {
          console.error("Erro ao processar imagem para Word", e);
        }
      }

      const cardTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          // Photo Row
          new TableRow({
            height: { value: 2000, rule: 'atLeast' }, 
            children: [
              new TableCell({
                columnSpan: 2,
                children: photoChildren,
                verticalAlign: VerticalAlign.CENTER,
              })
            ]
          }),
          // Data Rows
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
                  shading: { fill: "E5E7EB" },
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

      currentCells.push(new TableCell({
        children: [new Paragraph(""), cardTable, new Paragraph("")],
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        margins: { top: 200, bottom: 200, left: 200, right: 200 }
      }));

      if (currentCells.length === 4 || i === reportData.length - 1) {
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
      {/* Input escondido para fotos */}
      <input 
        type="file" 
        ref={photoInputRef} 
        onChange={handlePhotoUpload} 
        accept="image/*" 
        className="hidden" 
      />

      <div className="print:hidden space-y-8">
        <div className="bg-indigo-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
          <h2 className="text-3xl font-bold mb-2">Relatório de Carregamento</h2>
          <p className="text-indigo-100 max-w-xl">
            Importe a planilha para gerar os cartões de carregamento visual.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Card Importar Planilha (Principal) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative flex flex-col justify-between">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Gerar Relatório Visual</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                Carregue a planilha operacional (.xlsx, .xls ou .csv) para gerar os cartões, visualizar e exportar.
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
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-medium transition-colors disabled:opacity-50 text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform"
            >
              {importStatus === 'loading' ? 'Processando...' : (
                <>
                  <FileText className="w-5 h-5" />
                  Selecionar Planilha
                </>
              )}
            </button>

             {importStatus !== 'idle' && (
              <div className={`mt-4 p-3 rounded-lg text-sm flex items-start justify-center gap-2 ${
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
            <div className="flex flex-wrap gap-3">
               <button 
                onClick={handleExportToWord}
                className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                Word
              </button>
              <button 
                onClick={handleExportToExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button 
                onClick={handleExportToPNG}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                <ImageDown className="w-4 h-4" />
                PNG
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>

          <div ref={reportContainerRef} className="bg-white p-4">
            {/* Header Vermelho para PNG/Impressão */}
            <div className="w-full bg-[#FF0000] text-white font-bold text-2xl text-center py-4 mb-4 uppercase">
              CARREGAMENTO SE AJU - {getTomorrowDate()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-4">
              {reportData.map((item, idx) => (
                <div key={idx} className="border-2 border-slate-800 break-inside-avoid bg-white flex flex-col">
                  {/* Espaço para Foto (Agora Clicável) */}
                  <div 
                    className="h-48 bg-slate-100 border-b-2 border-slate-800 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-200 transition-colors relative overflow-hidden group"
                    onClick={() => handlePhotoCardClick(item.id)}
                    title="Clique para adicionar foto"
                  >
                    {vehiclePhotos[item.id] ? (
                      <img 
                        src={vehiclePhotos[item.id]} 
                        alt={`Veículo ${item.id}`} 
                        className="max-w-full max-h-full w-auto h-auto object-contain"
                      />
                    ) : (
                      <>
                        <Camera className="w-10 h-10 mb-2 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all text-slate-500" />
                        <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Adicionar Foto</span>
                      </>
                    )}
                  </div>

                  {/* Tabela de Dados */}
                  <div className="text-sm">
                    <div className="grid grid-cols-2 border-b border-slate-300">
                      <div className="bg-slate-200 p-2 font-bold text-slate-800 text-xs flex items-center">NOME DA LINHA</div>
                      <div className="p-2 font-mono text-slate-900 font-bold flex items-center justify-center text-center">{item.pdd || '-'}</div>
                    </div>

                    <div className="grid grid-cols-2 border-b border-slate-300">
                      <div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">ID VIAGEM</div>
                      <div className="p-2 font-mono text-xs flex items-center justify-center text-center break-all">{item.id}</div>
                    </div>

                    <div className="grid grid-cols-2 border-b border-slate-300">
                      <div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">TIPO DE VEICULO</div>
                      <div className="p-2 text-xs flex items-center justify-center text-center uppercase">{item.vehicleType}</div>
                    </div>

                    <div className="grid grid-cols-2 border-b border-slate-300">
                      <div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">VOLUMETRIA REAL</div>
                      <div className="p-2 text-xs flex items-center justify-center text-center font-mono">{item.volume}</div>
                    </div>

                    <div className="grid grid-cols-2 border-b border-slate-300">
                      <div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">CAPACIDADE</div>
                      <div className="p-2 text-xs flex items-center justify-center text-center font-mono">{item.capacity}</div>
                    </div>

                    <div className="grid grid-cols-2 border-b border-slate-300">
                      <div className="bg-slate-100 p-2 font-bold text-slate-700 text-xs flex items-center">SATURAÇÃO</div>
                      <div className={`p-2 text-xs flex items-center justify-center text-center font-bold ${
                        item.saturation > 1 ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {(item.saturation * 100).toFixed(0)}%
                      </div>
                    </div>

                    <div className="grid grid-cols-2">
                      <div className="bg-slate-200 p-2 font-bold text-slate-700 text-xs flex items-center">PLACA</div>
                      <div className="p-2 text-sm flex items-center justify-center text-center font-bold uppercase">{item.plate}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateReport;