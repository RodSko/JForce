import React from 'react';
import { Box, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const SuppliesControl: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div className="bg-emerald-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Box className="w-8 h-8" />
          Controle de Insumos
        </h2>
        <p className="text-emerald-100 max-w-xl">
          Gestão de estoque, lacres, sacas e materiais operacionais.
        </p>
      </div>

      {/* Toolbar Placeholder */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="Buscar insumo..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex gap-3 w-full md:w-auto">
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
             <Filter className="w-4 h-4" /> Filtros
           </button>
           <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm">
             <Plus className="w-4 h-4" /> Novo Item
           </button>
        </div>
      </div>

      {/* Empty State / Placeholder Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
          <Box className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Módulo de Insumos</h3>
        <p className="text-slate-500 max-w-md">
          Esta área está preparada para receber as funcionalidades de controle de estoque.
          Aguardando instruções sobre quais itens gerenciar e regras de entrada/saída.
        </p>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg w-full">
           <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-sm text-slate-600 flex items-center gap-3">
             <ArrowDownLeft className="w-5 h-5 text-green-500" /> Entrada de Material
           </div>
           <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-sm text-slate-600 flex items-center gap-3">
             <ArrowUpRight className="w-5 h-5 text-red-500" /> Saída / Consumo
           </div>
        </div>
      </div>
    </div>
  );
};

export default SuppliesControl;