import React, { useRef, useState } from 'react';
import { DailyRecord } from '../types';
import { Download, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Printer, Image as ImageIcon } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [reportData, setReportData] = useState<ReportItem[]>([]);

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

  const handleExportToExcel = () => {
    // Preparar dados com os cabeçalhos exatos dos cartões
    const excelData = reportData.map(item => ({
      "NOME DA LINHA": item.pdd,
      "ID VIAGEM": item.id,
      "TIPO DE VEICULO": item.vehicleType,
      "VOLUMETRIA REAL": item.volume,
      "CAPACIDADE": item.capacity,
      "SATURAÇÃO": `${(item.saturation * 100).toFixed(0)}%`,
      "PLACA": item.plate
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório Visual");
    
    // Gerar nome do arquivo
    const fileName = `relatorio_operacional_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Baixar Histórico */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Baixar Histórico Completo</h3>
            <button 
              onClick={handleDownloadHistoryReport}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-medium transition-colors mt-4"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Baixar CSV
            </button>
          </div>

          {/* Card Importar Planilha */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Gerar Relatório Visual</h3>
            <p className="text-slate-500 text-sm mb-4">
              Carregue a planilha operacional para visualizar e imprimir os cartões de carregamento.
            </p>
            
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
                onClick={handleExportToExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Baixar Excel (XLSX)
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