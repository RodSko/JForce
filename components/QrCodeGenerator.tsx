import React, { useRef, useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Upload, FileSpreadsheet, QrCode, Play, Pause, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';

const QrCodeGenerator: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dados
  const [codes, setCodes] = useState<string[]>([]);
  const [filename, setFilename] = useState<string>('');
  
  // Controle de Navegação
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Intervalo do Play Automático (1 segundo)
  useEffect(() => {
    let interval: any;
    
    if (isPlaying && codes.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          // Se chegar ao fim, para
          if (prevIndex >= codes.length - 1) {
            setIsPlaying(false);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, 1000); // 1000ms = 1 segundo
    }

    return () => clearInterval(interval);
  }, [isPlaying, codes]);

  // Handler de Upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Ler como array de arrays para pegar a primeira coluna independente do cabeçalho
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        
        // Extrair dados: ignorar cabeçalho se parecer texto, pegar primeira coluna
        // Filtra vazios
        const extractedCodes: string[] = [];
        
        jsonData.forEach((row: any, index: number) => {
           // Pega o primeiro valor da linha que não seja vazio
           if (row && row.length > 0) {
             const val = row[0];
             if (val !== undefined && val !== null && String(val).trim() !== '') {
               // Opcional: Pular cabeçalho se for a primeira linha e parecer "Código" ou "ID"
               if (index === 0 && ['código', 'codigo', 'id', 'qr', 'qrcode'].includes(String(val).toLowerCase())) {
                 return;
               }
               extractedCodes.push(String(val).trim());
             }
           }
        });

        if (extractedCodes.length === 0) {
          alert("Nenhum código encontrado na primeira coluna da planilha.");
          return;
        }

        setCodes(extractedCodes);
        setCurrentIndex(0);
        setIsPlaying(false);

      } catch (error) {
        console.error("Erro ao ler planilha", error);
        alert("Erro ao processar o arquivo.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleReset = () => {
    setCodes([]);
    setFilename('');
    setCurrentIndex(0);
    setIsPlaying(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Controles Manuais
  const next = () => {
    if (currentIndex < codes.length - 1) setCurrentIndex(c => c + 1);
  };

  const prev = () => {
    if (currentIndex > 0) setCurrentIndex(c => c - 1);
  };

  const togglePlay = () => {
    if (currentIndex >= codes.length - 1 && !isPlaying) {
      setCurrentIndex(0); // Reinicia se estiver no fim
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <QrCode className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <QrCode className="w-8 h-8 text-indigo-400" />
            Gerador de QR Code
          </h2>
          <p className="text-slate-300 max-w-xl">
            Importe uma lista de códigos e visualize-os sequencialmente para escaneamento rápido.
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      {codes.length === 0 ? (
        /* Estado de Upload */
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
           <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Upload className="w-10 h-10 text-indigo-600" />
           </div>
           <h3 className="text-xl font-bold text-slate-800 mb-2">Importar Lista de Códigos</h3>
           <p className="text-slate-500 mb-8 max-w-md mx-auto">
             Carregue uma planilha Excel (.xlsx). O sistema lerá a primeira coluna como dados para os QR Codes.
           </p>
           
           <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
           />
           
           <button 
             onClick={triggerFileInput}
             className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
           >
             <FileSpreadsheet className="w-5 h-5" />
             Selecionar Planilha
           </button>
        </div>
      ) : (
        /* Visualizador de QR Code */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Coluna da Esquerda: Informações e Lista (Visual simplificado) */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <div className="flex justify-between items-start mb-4">
                 <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Arquivo</p>
                    <p className="font-medium text-slate-800 truncate max-w-[150px]" title={filename}>{filename}</p>
                 </div>
                 <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 underline">
                   Trocar
                 </button>
               </div>
               
               <div className="flex justify-between items-end">
                 <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Progresso</p>
                    <p className="text-3xl font-bold text-indigo-600">
                      {currentIndex + 1} <span className="text-lg text-slate-400 font-normal">/ {codes.length}</span>
                    </p>
                 </div>
                 <div className="w-12 h-12 rounded-full border-4 border-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                   {Math.round(((currentIndex + 1) / codes.length) * 100)}%
                 </div>
               </div>
               
               {/* Barra de Progresso */}
               <div className="w-full h-2 bg-slate-100 rounded-full mt-4 overflow-hidden">
                 <div 
                   className="h-full bg-indigo-500 transition-all duration-300"
                   style={{ width: `${((currentIndex + 1) / codes.length) * 100}%` }}
                 />
               </div>
            </div>

            {/* Próximo Item (Preview Texto) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
               <p className="text-xs text-slate-500 font-bold uppercase mb-1">Próximo Código:</p>
               <p className="font-mono text-sm text-slate-700 truncate">
                 {currentIndex < codes.length - 1 ? codes[currentIndex + 1] : "(Fim da lista)"}
               </p>
            </div>
          </div>

          {/* Coluna Central/Direita: O QR Code Grande */}
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-8 min-h-[500px]">
             
             {/* Área do QR Code */}
             <div className="bg-white p-4 border-4 border-slate-900 rounded-lg mb-8 shadow-2xl">
                <QRCode 
                  value={codes[currentIndex]} 
                  size={256} 
                  level="H" // High error correction
                />
             </div>

             {/* Valor em Texto */}
             <div className="bg-slate-100 px-6 py-3 rounded-full mb-8 max-w-full">
               <p className="font-mono text-xl font-bold text-slate-800 break-all text-center">
                 {codes[currentIndex]}
               </p>
             </div>

             {/* Controles */}
             <div className="flex items-center gap-4">
                <button 
                  onClick={prev}
                  disabled={currentIndex === 0 || isPlaying}
                  className="p-4 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Anterior"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>

                <button 
                  onClick={togglePlay}
                  className={`
                    p-6 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all
                    ${isPlaying 
                      ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }
                  `}
                  title={isPlaying ? "Pausar" : "Iniciar Apresentação"}
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10 fill-current" />
                  ) : (
                    <Play className="w-10 h-10 fill-current ml-1" />
                  )}
                </button>

                <button 
                  onClick={next}
                  disabled={currentIndex === codes.length - 1 || isPlaying}
                  className="p-4 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Próximo"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
             </div>

             <div className="mt-4 h-6">
               {isPlaying && (
                 <p className="text-sm text-indigo-600 font-medium animate-pulse flex items-center gap-2">
                   <RotateCcw className="w-3 h-3 animate-spin" /> Avançando automaticamente (1s)...
                 </p>
               )}
             </div>

          </div>

        </div>
      )}
    </div>
  );
};

export default QrCodeGenerator;