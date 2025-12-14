import React, { useState, useMemo, useEffect } from 'react';
import { Box, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, FileText, AlertTriangle, History, Package, User, Calendar, Trash2, Save, X, Pencil, Settings, Loader2, BarChart3, AlertCircle } from 'lucide-react';
import { SupplyItem, SupplyTransaction } from '../types';
import { dataService } from '../services/dataService';

const SuppliesControl: React.FC = () => {
  // Estados
  const [view, setView] = useState<'inventory' | 'reports'>('inventory');
  const [supplies, setSupplies] = useState<SupplyItem[]>([]);
  const [history, setHistory] = useState<SupplyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  
  // Novo Estado para Modal de Exclusão
  const [itemToDelete, setItemToDelete] = useState<SupplyItem | null>(null);
  
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('OUT');
  const [selectedSupply, setSelectedSupply] = useState<SupplyItem | null>(null);

  // Estado de Edição e Processamento
  const [editingId, setEditingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form States
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('un');
  const [newItemMin, setNewItemMin] = useState(10);
  const [newItemQty, setNewItemQty] = useState(0);

  const [transQty, setTransQty] = useState(1);
  const [transUser, setTransUser] = useState('');

  // Carregar dados ao montar
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [items, transactions] = await Promise.all([
        dataService.getSupplies(),
        dataService.getSupplyTransactions()
      ]);
      setSupplies(items);
      setHistory(transactions);
    } catch (error) {
      console.error("Erro ao carregar insumos:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Filtros ---
  const filteredSupplies = supplies.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Ações ---

  const handleSaveItem = async () => {
    if (!newItemName) return;
    setProcessing(true);

    try {
      const isNew = !editingId;
      const itemId = editingId || `supply-${Date.now()}`;
      
      const itemToSave: SupplyItem = {
        id: itemId,
        name: newItemName,
        unit: newItemUnit,
        minStock: newItemMin,
        quantity: isNew ? newItemQty : newItemQty // Se for edição, assume o valor atualizado
      };

      await dataService.saveSupply(itemToSave);

      if (isNew && newItemQty > 0) {
        const trans: SupplyTransaction = {
          id: `init-${Date.now()}`,
          supplyId: itemId,
          supplyName: newItemName,
          type: 'IN',
          quantity: newItemQty,
          date: new Date().toISOString(),
          user: 'Cadastro Inicial'
        };
        await dataService.addSupplyTransaction(trans);
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar item.");
    } finally {
      setProcessing(false);
    }
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

  const confirmTransaction = async () => {
    if (!selectedSupply || !transUser) {
      alert("Preencha todos os campos.");
      return;
    }
    if (transactionType === 'OUT' && transQty > selectedSupply.quantity) {
      alert("Estoque insuficiente!");
      return;
    }

    setProcessing(true);
    try {
      const newQuantity = transactionType === 'IN' 
        ? selectedSupply.quantity + transQty 
        : selectedSupply.quantity - transQty;

      const updatedSupply = { ...selectedSupply, quantity: newQuantity };

      await dataService.saveSupply(updatedSupply);

      const newTrans: SupplyTransaction = {
        id: `trans-${Date.now()}`,
        supplyId: selectedSupply.id,
        supplyName: selectedSupply.name,
        type: transactionType,
        quantity: transQty,
        date: new Date().toISOString(),
        user: transUser
      };

      await dataService.addSupplyTransaction(newTrans);
      
      await loadData();
      setShowTransactionModal(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao processar transação.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestDelete = (item: SupplyItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setItemToDelete(item);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    setDeletingId(itemToDelete.id);
    try {
      await dataService.deleteSupply(itemToDelete.id);
      setSupplies(prev => prev.filter(s => s.id !== itemToDelete.id));
      await loadData(); // Reload for safety
      setItemToDelete(null);
    } catch (error: any) {
      console.error("Erro delete:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setDeletingId(null);
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
      
      // Encontrar última movimentação
      const lastMove = history
        .filter(h => h.supplyId === supply.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      return {
        ...supply,
        totalConsumed,
        lastMoveDate: lastMove ? new Date(lastMove.date).toLocaleDateString('pt-BR') : '-'
      };
    });
  }, [supplies, history]);

  if (loading && supplies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-600" />
        <p>Carregando estoque...</p>
      </div>
    );
  }

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
          <BarChart3 className="w-4 h-4" /> Relatórios de Uso
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
              const isDeleting = deletingId === item.id;

              return (
                <div key={item.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${isLowStock ? 'border-red-200' : 'border-slate-200'}`}>
                  
                  {/* Header do Card (Título + Ações) */}
                  <div className="p-4 pb-0 flex justify-between items-start">
                    <div className="pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{item.name}</h3>
                        {isLowStock && (
                          <div className="bg-red-100 text-red-700 p-1 rounded-full flex-shrink-0" title="Estoque Baixo">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-1 flex-shrink-0 z-20">
                      <button 
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-1.5 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4 pointer-events-none" />
                      </button>
                      
                      <button 
                        type="button"
                        onClick={(e) => handleRequestDelete(item, e)}
                        disabled={isDeleting}
                        className="p-1.5 bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-md transition-colors cursor-pointer"
                        title="Excluir"
                      >
                         <Trash2 className="w-4 h-4 pointer-events-none" />
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo do Card */}
                  <div className="px-4 pb-4 flex-1">
                    <div className="flex items-baseline gap-1 mt-2">
                       <span className={`text-4xl font-bold ${isLowStock ? 'text-red-600' : 'text-slate-800'}`}>
                         {item.quantity}
                       </span>
                       <span className="text-sm text-slate-500 font-medium">{item.unit}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Mínimo: {item.minStock} {item.unit}</p>
                  </div>
                  
                  {/* Rodapé com botões grandes */}
                  <div className="bg-slate-50 border-t border-slate-100 p-3 grid grid-cols-2 gap-3 mt-auto">
                    <button 
                      type="button"
                      onClick={() => openTransaction(item, 'IN')}
                      className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded text-green-700 text-sm font-medium hover:bg-green-50 hover:border-green-200 transition-colors"
                    >
                      <ArrowDownLeft className="w-4 h-4" /> Entrada
                    </button>
                    <button 
                      type="button"
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
        <div className="space-y-6 animate-fade-in">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <History className="w-5 h-5 text-indigo-600" /> Histórico de Consumo
                </h3>
                <span className="text-xs text-slate-500">Total de Itens: {reportStats.length}</span>
             </div>
             
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                   <tr>
                     <th className="px-6 py-4">Item</th>
                     <th className="px-6 py-4 text-center">Total Consumido</th>
                     <th className="px-6 py-4 text-center">Estoque Atual</th>
                     <th className="px-6 py-4 text-right">Última Movimentação</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {reportStats.map(stat => (
                     <tr key={stat.id} className="hover:bg-slate-50">
                       <td className="px-6 py-4">
                         <div className="font-medium text-slate-800">{stat.name}</div>
                         <div className="text-xs text-slate-500">Mínimo: {stat.minStock} {stat.unit}</div>
                       </td>
                       <td className="px-6 py-4 text-center">
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                           {stat.totalConsumed} {stat.unit}
                         </span>
                       </td>
                       <td className="px-6 py-4 text-center font-bold text-slate-700">
                         {stat.quantity} {stat.unit}
                       </td>
                       <td className="px-6 py-4 text-right text-slate-500 font-mono">
                         {stat.lastMoveDate}
                       </td>
                     </tr>
                   ))}
                   {reportStats.length === 0 && (
                     <tr>
                       <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                         Nenhum dado registrado.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
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
                disabled={processing}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveItem}
                disabled={processing}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex justify-center items-center gap-2"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
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
                disabled={processing}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmTransaction}
                disabled={processing}
                className={`flex-1 py-2 text-white rounded-lg hover:opacity-90 font-medium flex justify-center items-center gap-2 ${transactionType === 'IN' ? 'bg-green-600' : 'bg-red-600'}`}
              >
                 {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-100 p-3 rounded-full border-4 border-white shadow-lg">
                 <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <div className="mt-6 text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Insumo?</h3>
                <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm mb-4">
                   <p className="font-bold">Atenção!</p>
                   <p>Você está prestes a excluir: <strong>{itemToDelete.name}</strong></p>
                </div>
                <p className="text-slate-500 text-sm mb-6">
                   Isso apagará permanentemente o registro deste insumo e <strong>todo o histórico de uso</strong> associado a ele. Essa ação não pode ser desfeita.
                </p>

                <div className="flex gap-3">
                   <button 
                     onClick={() => setItemToDelete(null)}
                     className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                   >
                     Cancelar
                   </button>
                   <button 
                     onClick={confirmDelete}
                     className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-lg flex items-center justify-center gap-2"
                   >
                     {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                     Excluir Definitivamente
                   </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SuppliesControl;