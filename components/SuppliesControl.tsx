
import React, { useState, useMemo } from 'react';
import { Box, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, FileText, AlertTriangle, History, Package, User, Calendar, Trash2, Save, X, Pencil, Settings } from 'lucide-react';

// --- Interfaces Locais ---
interface SupplyItem {
  id: string;
  name: string;
  quantity: number;
  unit: string; // ex: 'un', 'cx', 'rolo'
  minStock: number;
}

interface SupplyTransaction {
  id: string;
  supplyId: string;
  supplyName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string; // ISO String
  user: string; // Quem retirou ou quem adicionou
}

// --- Dados Iniciais (Mock) ---
const INITIAL_SUPPLIES: SupplyItem[] = [
  { id: '1', name: 'Lacres de Segurança', quantity: 1500, unit: 'un', minStock: 200 },
  { id: '2', name: 'Sacas de Ráfia', quantity: 45, unit: 'un', minStock: 50 },
  { id: '3', name: 'Fita Adesiva Transparente', quantity: 12, unit: 'rolo', minStock: 5 },
  { id: '4', name: 'Etiquetas Térmicas', quantity: 3, unit: 'rolo', minStock: 2 },
];

const INITIAL_HISTORY: SupplyTransaction[] = [
  { id: 't1', supplyId: '1', supplyName: 'Lacres de Segurança', type: 'OUT', quantity: 50, date: new Date(Date.now() - 86400000).toISOString(), user: 'João Silva' },
  { id: 't2', supplyId: '3', supplyName: 'Fita Adesiva Transparente', type: 'IN', quantity: 10, date: new Date(Date.now() - 172800000).toISOString(), user: 'Almoxarifado' },
];

const SuppliesControl: React.FC = () => {
  // Estados
  const [view, setView] = useState<'inventory' | 'reports'>('inventory');
  const [supplies, setSupplies] = useState<SupplyItem[]>(INITIAL_SUPPLIES);
  const [history, setHistory] = useState<SupplyTransaction[]>(INITIAL_HISTORY);
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('OUT');
  const [selectedSupply, setSelectedSupply] = useState<SupplyItem | null>(null);

  // Estado de Edição
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('un');
  const [newItemMin, setNewItemMin] = useState(10);
  const [newItemQty, setNewItemQty] = useState(0);

  const [transQty, setTransQty] = useState(1);
  const [transUser, setTransUser] = useState('');

  // --- Filtros ---
  const filteredSupplies = supplies.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Ações ---

  const handleSaveItem = () => {
    if (!newItemName) return;

    if (editingId) {
      // Editar Existente
      setSupplies(prev => prev.map(item => 
        item.id === editingId 
          ? { ...item, name: newItemName, unit: newItemUnit, minStock: newItemMin, quantity: newItemQty }
          : item
      ));
    } else {
      // Criar Novo
      const newItem: SupplyItem = {
        id: Date.now().toString(),
        name: newItemName,
        unit: newItemUnit,
        minStock: newItemMin,
        quantity: newItemQty
      };
      setSupplies(prev => [...prev, newItem]);
      
      // Registrar entrada inicial se qtd > 0 apenas na criação
      if (newItemQty > 0) {
        const trans: SupplyTransaction = {
          id: `init-${Date.now()}`,
          supplyId: newItem.id,
          supplyName: newItem.name,
          type: 'IN',
          quantity: newItemQty,
          date: new Date().toISOString(),
          user: 'Cadastro Inicial'
        };
        setHistory(prev => [trans, ...prev]);
      }
    }

    closeModal();
  };

  const openAddModal = () => {
    setEditingId(null);
    resetForms();
    setShowAddModal(true);
  };

  const openEditModal = (item: SupplyItem) => {
    setEditingId(item.id);
    setNewItemName(item.name);
    setNewItemUnit(item.unit);
    setNewItemMin(item.minStock);
    setNewItemQty(item.quantity);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    resetForms();
  };

  const openTransaction = (item: SupplyItem, type: 'IN' | 'OUT') => {
    setSelectedSupply(item);
    setTransactionType(type);
    setTransQty(1);
    setTransUser('');
    setShowTransactionModal(true);
  };

  const confirmTransaction = () => {
    if (!selectedSupply || !transUser) {
      alert("Preencha todos os campos.");
      return;
    }
    if (transactionType === 'OUT' && transQty > selectedSupply.quantity) {
      alert("Estoque insuficiente!");
      return;
    }

    // 1. Atualizar Estoque
    setSupplies(prev => prev.map(s => {
      if (s.id === selectedSupply.id) {
        return {
          ...s,
          quantity: transactionType === 'IN' ? s.quantity + transQty : s.quantity - transQty
        };
      }
      return s;
    }));

    // 2. Registrar Histórico
    const newTrans: SupplyTransaction = {
      id: Date.now().toString(),
      supplyId: selectedSupply.id,
      supplyName: selectedSupply.name,
      type: transactionType,
      quantity: transQty,
      date: new Date().toISOString(),
      user: transUser
    };

    setHistory(prev => [newTrans, ...prev]);
    setShowTransactionModal(false);
  };

  const deleteItem = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este item do estoque? O histórico será mantido.')) {
      setSupplies(prev => prev.filter(s => s.id !== id));
    }
  };

  const resetForms = () => {
    setNewItemName('');
    setNewItemQty(0);
    setNewItemMin(10);
    setTransQty(1);
    setTransUser('');
  };

  // --- Cálculos de Relatório ---
  const reportStats = useMemo(() => {
    return supplies.map(supply => {
      // Filtrar saídas deste item
      const outputs = history.filter(h => h.supplyId === supply.id && h.type === 'OUT');
      const totalConsumed = outputs.reduce((acc, curr) => acc + curr.quantity, 0);
      
      // Média (Simplificada: Total Consumido / 1 mês, ou ajustável por período)
      // Aqui vamos considerar o total histórico como base para média mensal fictícia
      const avgMonthly = Math.round(totalConsumed); 

      return {
        ...supply,
        totalConsumed,
        avgMonthly
      };
    });
  }, [supplies, history]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10 relative">
      {/* Header */}
      <div className="bg-emerald-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Box className="w-8 h-8" />
          Controle de Insumos
        </h2>
        <p className="text-emerald-100 max-w-xl">
          Gestão de estoque, controle de saídas e previsão de consumo.
        </p>
      </div>

      {/* Navegação de Abas */}
      <div className="flex border-b border-slate-200 gap-6">
        <button 
          onClick={() => setView('inventory')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${view === 'inventory' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
        >
          <Package className="w-4 h-4" /> Inventário
        </button>
        <button 
          onClick={() => setView('reports')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${view === 'reports' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-emerald-600'}`}
        >
          <FileText className="w-4 h-4" /> Relatórios de Uso
        </button>
      </div>

      {/* === VIEW: INVENTÁRIO === */}
      {view === 'inventory' && (
        <div className="space-y-6 animate-fade-in">
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative w-full md:w-96">
              <input 
                type="text" 
                placeholder="Buscar insumo..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <button 
              onClick={openAddModal}
              className="w-full md:w-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo Item
            </button>
          </div>

          {/* Grid de Itens */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSupplies.map(item => {
              const isLowStock = item.quantity <= item.minStock;
              return (
                <div key={item.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md relative group ${isLowStock ? 'border-red-200' : 'border-slate-200'}`}>
                  
                  {/* Botões de Ação (Editar/Excluir) */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openEditModal(item)}
                      className="p-1.5 bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-md shadow-sm"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 bg-white text-slate-500 hover:text-red-600 border border-slate-200 rounded-md shadow-sm"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-slate-800 text-lg leading-tight pr-8">{item.name}</h3>
                       {isLowStock && (
                         <div className="bg-red-100 text-red-700 p-1.5 rounded-full flex-shrink-0" title="Estoque Baixo">
                           <AlertTriangle className="w-4 h-4" />
                         </div>
                       )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-4">
                       <span className={`text-4xl font-bold ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                         {item.quantity}
                       </span>
                       <span className="text-sm text-slate-500 font-medium">{item.unit}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Mínimo: {item.minStock} {item.unit}</p>
                  </div>
                  
                  <div className="bg-slate-50 border-t border-slate-100 p-3 grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => openTransaction(item, 'IN')}
                      className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded text-green-700 text-sm font-medium hover:bg-green-50 hover:border-green-200 transition-colors"
                    >
                      <ArrowDownLeft className="w-4 h-4" /> Entrada
                    </button>
                    <button 
                      onClick={() => openTransaction(item, 'OUT')}
                      className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded text-red-700 text-sm font-medium hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" /> Saída
                    </button>
                  </div>
                </div>
              );
            })}
            
            {filteredSupplies.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum insumo encontrado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === VIEW: RELATÓRIOS === */}
      {view === 'reports' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Métricas de Consumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Histórico Recente
              </h3>
              <div className="overflow-auto max-h-[300px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Data</th>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Qtd.</th>
                      <th className="px-4 py-2">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.slice(0, 20).map(hist => (
                      <tr key={hist.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-500">
                          {new Date(hist.date).toLocaleDateString('pt-BR')} {new Date(hist.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="px-4 py-2 font-medium text-slate-700">{hist.supplyName}</td>
                        <td className="px-4 py-2">
                          {hist.type === 'IN' ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">ENTRADA</span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">SAÍDA</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono">{hist.quantity}</td>
                        <td className="px-4 py-2 text-slate-600">{hist.user}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sem histórico</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Média de Uso Mensal
              </h3>
              <div className="overflow-auto max-h-[300px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                    <tr>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2 text-right">Consumo Total</th>
                      <th className="px-4 py-2 text-right">Média Mensal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportStats.map(stat => (
                      <tr key={stat.id}>
                        <td className="px-4 py-3 font-medium text-slate-700">{stat.name}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{stat.totalConsumed} {stat.unit}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          ~ {stat.avgMonthly} {stat.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-4 italic">
                * Cálculo baseado no histórico total disponível.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: NOVO/EDITAR ITEM --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              {editingId ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nome do Item</label>
                <input 
                  type="text" 
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ex: Bobina de Filme Stretch"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Unidade</label>
                  <select 
                    value={newItemUnit}
                    onChange={e => setNewItemUnit(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="cx">Caixa (cx)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="pct">Pacote (pct)</option>
                    <option value="rolo">Rolo</option>
                    <option value="m">Metro (m)</option>
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-600 mb-1">
                     {editingId ? 'Estoque Atual' : 'Qtd. Inicial'}
                   </label>
                   <input 
                    type="number" 
                    min="0"
                    value={newItemQty}
                    onChange={e => setNewItemQty(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Estoque Mínimo (Alerta)</label>
                <input 
                  type="number" 
                  min="0"
                  value={newItemMin}
                  onChange={e => setNewItemMin(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={closeModal}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveItem}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TRANSAÇÃO (ENTRADA/SAÍDA) --- */}
      {showTransactionModal && selectedSupply && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-2 ${transactionType === 'IN' ? 'bg-green-500' : 'bg-red-500'}`} />
            
            <h3 className="text-xl font-bold text-slate-800 mb-1">
              {transactionType === 'IN' ? 'Registrar Entrada' : 'Registrar Saída'}
            </h3>
            <p className="text-slate-500 text-sm mb-6">Item: <span className="font-semibold text-slate-800">{selectedSupply.name}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Quantidade ({selectedSupply.unit})</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setTransQty(Math.max(1, transQty - 1))} className="p-2 bg-slate-100 rounded hover:bg-slate-200">-</button>
                  <input 
                    type="number" 
                    min="1"
                    value={transQty}
                    onChange={e => setTransQty(Number(e.target.value))}
                    className="flex-1 p-2 text-center border border-slate-300 rounded font-bold text-lg outline-none"
                  />
                  <button onClick={() => setTransQty(transQty + 1)} className="p-2 bg-slate-100 rounded hover:bg-slate-200">+</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  {transactionType === 'IN' ? 'Origem / Fornecedor' : 'Quem retirou?'}
                </label>
                <div className="relative">
                   <input 
                    type="text" 
                    value={transUser}
                    onChange={e => setTransUser(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded focus:ring-2 outline-none"
                    placeholder={transactionType === 'IN' ? "Ex: Compra Nota 123" : "Nome do Colaborador"}
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {transactionType === 'OUT' && (
                <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 flex justify-between">
                  <span>Estoque Atual:</span>
                  <span className="font-bold">{selectedSupply.quantity} {selectedSupply.unit}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowTransactionModal(false)}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmTransaction}
                className={`flex-1 py-2 text-white rounded-lg hover:opacity-90 font-medium ${transactionType === 'IN' ? 'bg-green-600' : 'bg-red-600'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliesControl;
