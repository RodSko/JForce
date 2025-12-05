import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Map } from 'lucide-react';

const SecondaryTrips: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="bg-cyan-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Map className="w-8 h-8" />
          Viagens Secundárias
        </h2>
        <p className="text-cyan-100 max-w-xl">
          Importe a planilha de controle para gerenciar rotas e viagens secundárias.
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto">
          <label className="block text-sm font-bold text-slate-700 mb-2">Upload de Planilha</label>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx,.xls,.csv" 
            className="hidden" 
          />
          
          <div 
            onClick={triggerFileInput}
            className={`
              w-full p-10 border-2 border-dashed rounded-xl flex flex-col items-center gap-4 cursor-pointer transition-all group justify-center
              ${selectedFile 
                ? 'border-cyan-300 bg-cyan-50' 
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-cyan-400'
              }
            `}
          >
            {selectedFile ? (
              <>
                <div className="bg-cyan-100 p-4 rounded-full">
                  <FileSpreadsheet className="w-10 h-10 text-cyan-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800 break-all text-lg">{selectedFile.name}</p>
                  <p className="text-sm text-cyan-600 font-medium mt-1">Arquivo pronto para processamento</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium underline"
                >
                  Remover arquivo
                </button>
              </>
            ) : (
              <>
                <div className="bg-slate-200 p-4 rounded-full group-hover:bg-cyan-100 transition-colors">
                  <Upload className="w-10 h-10 text-slate-400 group-hover:text-cyan-600 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-700 text-lg">Clique para selecionar a planilha</p>
                  <p className="text-sm text-slate-500 mt-1">Suporta .xlsx, .xls e .csv</p>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Placeholder para botão de ação futuro */}
        {selectedFile && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
              Aguardando instruções de processamento...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecondaryTrips;