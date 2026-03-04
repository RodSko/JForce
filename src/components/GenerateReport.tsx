import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { dataService } from '@/services/dataService';

interface GenerateReportProps {
  history?: any[];
  employees?: any[];
}

const GenerateReport: React.FC<GenerateReportProps> = ({ history = [], employees = [] }) => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'custom'>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert('Selecione as datas inicial e final');
      return;
    }

    setLoading(true);
    try {
      // Aqui você pode implementar a lógica para gerar relatórios
      // Por exemplo, filtrar dados por data e exportar como PDF/CSV
      
      const filteredData = history.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
      });

      // Simular download
      const csvContent = generateCSV(filteredData);
      downloadFile(csvContent, `relatorio_${startDate}_${endDate}.csv`);
      
      alert('Relatório gerado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar relatório:', err);
      alert('Erro ao gerar relatório: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateCSV = (data: any[]) => {
    const headers = ['Data', 'Volume', 'Caminhões', 'Diaristas', 'Viagens'];
    const rows = data.map(record => [
      record.date,
      record.volume || 0,
      record.trucks || 0,
      record.diarista_count || 0,
      record.trips?.length || 0
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csv;
  };

  const downloadFile = (content: string, filename: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Gerar Relatório</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tipo de Relatório
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="daily">Relatório Diário</option>
              <option value="monthly">Relatório Mensal</option>
              <option value="custom">Período Customizado</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Data Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <> 
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando...
              </>
            ) : (
              <> 
                <FileDown className="w-5 h-5" />
                Gerar Relatório
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateReport;