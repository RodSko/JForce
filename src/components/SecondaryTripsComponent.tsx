import React, { useRef, useState } from 'react';
import { Map, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const SecondaryTripsComponent: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatus('idle');
    setMessage('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Basic processing logic placeholder
          console.log('Workbook loaded:', workbook.SheetNames);
          
          setStatus('success');
          setMessage('Arquivo processado com sucesso!');
        } catch (err) {
          console.error(err);
          setStatus('error');
          setMessage('Erro ao processar o arquivo Excel.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Erro ao ler o arquivo.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Map className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Viagens Secundárias</h3>
            <p className="text-slate-500 text-sm">Upload e processamento de planilhas de viagens secundárias</p>
          </div>
        </div>

        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isProcessing ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'hover:bg-indigo-50/50 hover:border-indigo-300 border-slate-200'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            disabled={isProcessing}
          />
          
          <div className="flex flex-col items-center gap-4">
            {isProcessing ? (
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            ) : (
              <div className="p-4 bg-slate-100 rounded-full">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
            )}
            
            <div>
              <p className="text-lg font-bold text-slate-700">
                {isProcessing ? 'Processando arquivo...' : 'Clique para selecionar ou arraste o arquivo'}
              </p>
              <p className="text-sm text-slate-400 mt-1">Suporta Excel (.xlsx, .xls) ou CSV</p>
            </div>
          </div>
        </div>

        {status !== 'idle' && (
          <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 ${
            status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            {status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
          <h4 className="font-bold uppercase tracking-wider text-sm">Instruções</h4>
        </div>
        <ul className="space-y-3 text-slate-400 text-sm list-disc list-inside">
          <li>Certifique-se de que a planilha contém as colunas necessárias para identificação das viagens.</li>
          <li>O sistema processará automaticamente os dados e gerará os reports necessários.</li>
          <li>Em caso de erro, verifique se o arquivo não está protegido por senha.</li>
        </ul>
      </div>
    </div>
  );
};

export default SecondaryTripsComponent;
