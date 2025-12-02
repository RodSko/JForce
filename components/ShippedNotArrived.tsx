import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Truck, Package, Download, Loader2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const ShippedNotArrived: React.FC = () => {
  const loadingInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  
  const [loadingFileName, setLoadingFileName] = useState<string | null>(null);
  const [batchFileName, setBatchFileName] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);

  const triggerLoadingInput = () => {
    if (loadingInputRef.current) {
      loadingInputRef.current.click();
    }
  };

  const triggerBatchInput = () => {
    if (batchInputRef.current) {
      batchInputRef.current.click();
    }
  };

  const handleLoadingUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLoadingFileName(file.name);
    }
  };

  const handleBatchUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBatchFileName(file.name);
    }
  };

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

  const handleProcessAndDownload = async () => {
    const loadingFile = loadingInputRef.current?.files?.[0];
    const batchFile = batchInputRef.current?.files?.[0];

    if (!loadingFile || !batchFile) {
      alert("Por favor, selecione as duas planilhas antes de continuar.");
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Ler arquivos
      const [loadingData, batchData] = await Promise.all([
        readFile(loadingFile),
        readFile(batchFile)
      ]);

      // 2. Processar Tabela de Carregamento (Tabela 1)
      // Regra: Extrair 'Número de pedido JMS', manter apenas numéricos (sem traços/letras)
      const validLoadingOrders: any[] = [];
      
      loadingData.forEach((row: any) => {
        // Tenta achar a coluna pelo nome exato ou variações comuns
        const rawId = row['Número de pedido JMS'] || row['Numero de pedido JMS'] || row['Pedido'];
        
        if (rawId) {
          const idStr = String(rawId).trim();
          
          // Regex: Apenas dígitos do início ao fim (^ indica início, \d+ dígitos, $ fim)
          // Isso exclui automaticamente "123-001" ou "A123"
          if (/^\d+$/.test(idStr)) {
            // Guardamos a linha original + o ID limpo para comparação
            validLoadingOrders.push({ ...row, _cleanId: idStr });
          }
        }
      });

      // 3. Processar Tabela de Lote (Tabela 2) para referência rápida
      const batchIds = new Set<string>();
      
      batchData.forEach((row: any) => {
        const rawId = row['Número de pedido JMS'] || row['Numero de pedido JMS'] || row['Pedido'];
        if (rawId) {
          // Aqui pegamos o ID como string para comparar
          // Assumindo que no lote o ID também deve bater com o formato limpo
          const idStr = String(rawId).trim();
          batchIds.add(idStr);
        }
      });

      // 4. Cruzamento (PROCV / Anti-Join)
      // Exportar apenas os pedidos da Tabela 1 que NÃO estão na Tabela 2
      const missingOrders = validLoadingOrders.filter(item => !batchIds.has(item._cleanId));

      if (missingOrders.length === 0) {
        alert("Nenhum pedido faltante encontrado! Todos os pedidos válidos do carregamento constam no lote.");
        setIsProcessing(false);
        return;
      }

      // 5. Gerar Excel Final
      // Remove a chave auxiliar _cleanId antes de exportar
      const exportData = missingOrders.map(({ _cleanId, ...rest }) => rest);

      const ws = XLSX.utils.json_to_sheet(exportData);

      // --- MELHORIA DE FORMATAÇÃO: Ajuste Automático de Colunas ---
      // Calcula a largura máxima de cada coluna baseada no conteúdo
      if (exportData.length > 0) {
        const colWidths = Object.keys(exportData[0]).map(key => {
          let maxLen = key.length; // Começa com o tamanho do cabeçalho
          
          // Verifica o tamanho dos dados nas primeiras 500 linhas (para performance)
          // ou todas se for pequeno
          const limit = Math.min(exportData.length, 500);
          
          for (let i = 0; i < limit; i++) {
            const value = exportData[i][key];
            const len = value ? String(value).length : 0;
            if (len > maxLen) maxLen = len;
          }

          // Adiciona um padding e limita um máximo razoável (ex: 50 chars)
          return { wch: Math.min(maxLen + 5, 60) };
        });

        ws['!cols'] = colWidths;
      }
      // -----------------------------------------------------------

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faltantes");

      const fileName = `pedidos_faltantes_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert(`Processamento concluído! ${missingOrders.length} pedidos encontrados e baixados.`);

    } catch (error) {
      console.error("Erro ao processar planilhas:", error);
      alert("Ocorreu um erro ao processar os arquivos. Verifique se o formato está correto.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-800">Expedido Mas Não Chegou</h2>
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
              <h3 className="font-semibold text-blue-900">1. Relatório de Carregamento</h3>
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
                    <p className="text-xs text-slate-400">Planilha de Carregamento</p>
                  </div>
                )}
              </div>

              <button 
                onClick={triggerLoadingInput}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Selecionar Arquivo
              </button>
            </div>
          </div>

          {/* Card 2: Importar Lote */}
          <div className="flex flex-col h-full">
            <div className="bg-orange-50 border border-orange-100 rounded-t-xl p-4 flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-orange-900">2. Controle de Lote</h3>
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
                    <p className="text-xs text-slate-400">Planilha de Lote</p>
                  </div>
                )}
              </div>

              <button 
                onClick={triggerBatchInput}
                className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Selecionar Arquivo
              </button>
            </div>
          </div>
        </div>

        {/* Action Button */}
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
            {isProcessing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Download className="w-6 h-6" />
                Processar e Baixar Resultado
              </>
            )}
          </button>
        </div>
        
        {(!loadingFileName || !batchFileName) && (
           <div className="text-center mt-4 text-sm text-slate-400 flex items-center justify-center gap-2">
             <AlertCircle className="w-4 h-4" />
             Selecione ambos os arquivos acima para habilitar o botão.
           </div>
        )}

      </div>
    </div>
  );
};

export default ShippedNotArrived;