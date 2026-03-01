import React, { useState, useEffect } from 'react';
import { HardHat, Plus, Search, Filter, History, Package, User, Trash2, Pencil, AlertTriangle, ArrowDownLeft, ArrowUpRight, Loader2, ShieldCheck, CalendarClock, X, AlertCircle } from 'lucide-react';
import { EpiItem, EpiTransaction, Employee } from '../types';
import { dataService } from '../services/dataService';

const EpiControl: React.FC = () => {
  // --- Estados Principais ---
  const [view, setView] = useState<'inventory' | 'history'>('inventory');
  const [epis, setEpis] = useState<EpiItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<EpiTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Modais e Forms ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  
  // Novo Estado para Modal de Exclusão
  const [itemToDelete, setItemToDelete] = useState<EpiItem | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form: Item EPI
  const [epiName, setEpiName] = useState('');
  const [epiCa, setEpiCa] = useState('');
  const [epiQty, setEpiQty] = useState(0);
  const [epiMin, setEpiMin] = useState(5);
  const [epiValidity, setEpiValidity] = useState(180); // Dias

  // Form: Entrega/Movimentação
  const [selectedEpi, setSelectedEpi] = useState<EpiItem | null>(null);
  const [transType, setTransType] = useState<'IN' | 'OUT'>('OUT'); // OUT = Entrega, IN = Reposição
  const [transQty, setTransQty] = useState(1);
  const [transEmpId, setTransEmpId] = useState('');
  const [transNotes, setTransNotes] = useState('');

  // --- Inicialização ---
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [episData, empsData, transData] = await Promise.all([
        dataService.getEpis(),
        dataService.getEmployees(),
        dataService.getEpiTransactions()
      ]);
      setEpis(episData);
      setEmployees(empsData);
      setTransactions(transData);
    } catch (error) {
      console.error("Erro carregando EPIs:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers ---
  const filteredEpis = epis.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.caNumber.includes(searchTerm)
  );

  const activeEmployees = employees.filter(e => e.active);

  // --- Actions: CRUD EPI ---
  const openAddModal = () => {
    setEditingId(null);
    setEpiName('');
    setEpiCa('');
    setEpiQty(0);
    setEpiMin(5);
    setEpiValidity(180);
    setShowAddModal(true);
  };

  const openEditModal = (item: EpiItem) => {
    setEditingId(item.id);
    setEpiName(item.name);
    setEpiCa(item.caNumber);
    setEpiQty(item.quantity);
    setEpiMin(item.minStock);
    setEpiValidity(item.validityDays || 180);
    setShowAddModal(true);
  };

  const handleSaveEpi = async () => {
    if (!epiName) return;
    setProcessing(true);
    try {
      const isNew = !editingId;
      const id = editingId || `epi-${Date.now()}`;
      
      const item: EpiItem = {
        id,
        name: epiName,
        caNumber: epiCa,
        quantity: isNew ? epiQty : epiQty, // Se editar, mantem o form
        minStock: epiMin,
        validityDays: epiValidity
      };

      await dataService.saveEpi(item);

      // Se novo e com estoque inicial > 0, cria transação IN
      if (isNew && epiQty > 0) {
        await dataService.addEpiTransaction({
          id: `epi-init-${Date.now()}`,
          epiId: id,
          epiName: epiName,
          type: 'IN',
          quantity: epiQty,
          date: new Date().toISOString(),
          employeeName: 'Estoque Inicial',
          notes: 'Cadastro Inicial'
        });
      }

      await loadData();
      setShowAddModal(false);
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao salvar EPI: ${e.message || "Verifique se a tabela 'epis' foi criada no Supabase."}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestDelete = (item: EpiItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setItemToDelete(item);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    setDeletingId(itemToDelete.id);
    try {
      await dataService.deleteEpi(itemToDelete.id);
      setEpis(prev => prev.filter(x => x.id !== itemToDelete.id));
      await loadData(); // Reload to refresh history view too
      setItemToDelete(null);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao excluir: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // --- Actions: Transações (Entrega/Reposição) ---
  const openDeliverModal = (item: EpiItem, type: 'IN' | 'OUT') => {
    setSelectedEpi(item);
    setTransType(type);
    setTransQty(1);
    setTransEmpId('');
    setTransNotes('');
    setShowDeliverModal(true);
  };

  const handleTransaction = async () => {
    if (!selectedEpi) return;
    if (transType === 'OUT' && !transEmpId) {
      alert("Selecione um funcionário para entrega.");
      return;
    }
    if (transType === 'OUT' && selectedEpi.quantity < transQty) {
      alert("Estoque insuficiente.");
      return;
    }

    setProcessing(true);
    try {
      const empName = transType === 'IN' 
        ? 'Estoque / Compra' 
        : employees.find(e => e.id === transEmpId)?.name || 'Desconhecido';

      // 1. Atualizar EPI
      const newQty = transType === 'IN' 
        ? selectedEpi.quantity + transQty 
        : selectedEpi.quantity - transQty;
      
      await dataService.saveEpi({ ...selectedEpi, quantity: newQty });

      // 2. Criar Transação
      await dataService.addEpiTransaction({
        id: `ept-${Date.now()}`,
        epiId: selectedEpi.id,
        epiName: selectedEpi.name,
        type: transType,
        quantity: transQty,
        date: new Date().toISOString(),
        employeeId: transType === 'OUT' ? transEmpId : undefined,
        employeeName: empName,
        notes: transNotes
      });

      await loadData();
      setShowDeliverModal(false);
    } catch (e: any) {
       console.error(e);
       alert(`Erro ao processar: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10 relative">
      
      {/* Header */}
      <div className="bg-orange-900 rounded-2xl p-8 text-white shadow-xl bg-[url('https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center bg-blend-overlay bg-opacity-90">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <HardHat className="w-8 h-8" />
          Controle de EPIs
        </h2>
        <p className="text-orange-100 max-w-xl">
          Gestão de entrega, validade e estoque de equipamentos de proteção.
        </p>
      </div>

      {/* Navegação */}
      <div className="flex border-b border-slate-200 gap-6">
        <button 
          onClick={() => setView('inventory')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${view === 'inventory' ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500 hover:text-orange-600'}`}
        >
          <ShieldCheck className="w-4 h-4" /> Estoque & Entregas
        </button>
        <button 
          onClick={() => setView('history')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${view === 'history' ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500 hover:text-orange-600'}`}
        >
          <History className="w-4 h-4" /> Histórico Completo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-orange-600" /></div>
      ) : (
        <>
          {view === 'inventory' && (
            <div className="space-y-6 animate-fade-in">
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-96">
                  <input 
                    type="text" 
                    placeholder="Buscar EPI (Nome ou CA)..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <button onClick={openAddModal} className="w-full md:w-auto flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">
                  <Plus className="w-4 h-4" /> Novo EPI
                </button>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredEpis.map(item => {
                  const isLow = item.quantity <= item.minStock;
                  const isDeleting = deletingId === item.id;
                  
                  return (
                    <div key={item.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col group ${isLow ? 'border-red-300' : 'border-slate-200'}`}>
                      <div className="p-4 flex justify-between items-start">
                        <div>
                           <h3 className="font-bold text-slate-800 text-lg leading-tight">{item.name}</h3>
                           <p className="text-xs text-slate-500 font-mono mt-1">CA: {item.caNumber || 'N/A'}</p>
                        </div>
                        <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity z-10">
                           <button 
                             onClick={() => openEditModal(item)} 
                             className="p-1.5 bg-slate-100 rounded hover:bg-indigo-100 hover:text-indigo-600 border border-slate-200"
                             title="Editar"
                           >
                             <Pencil className="w-4 h-4" />
                           </button>
                           
                           <button 
                             type="button" 
                             onClick={(e) => handleRequestDelete(item, e)} 
                             disabled={isDeleting}
                             className="p-1.5 bg-slate-100 rounded hover:bg-red-100 hover:text-red-600 cursor-pointer border border-slate-200"
                             title="Excluir"
                           >
                             <Trash2 className="w-4 h-4 pointer-events-none" />
                           </button>
                        </div>
                      </div>
                      
                      <div className="px-4 pb-4 flex-1">
                        <div className="flex items-baseline gap-1 mt-2">
                           <span className={`text-4xl font-bold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>{item.quantity}</span>
                           <span className="text-sm text-slate-500 font-medium">un</span>
                        </div>
                        {isLow && <div className="text-xs text-red-600 flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> Estoque Baixo (Min: {item.minStock})</div>}
                      </div>

                      <div className="bg-slate-50 border-t border-slate-100 p-3 grid grid-cols-2 gap-3">
                        <button onClick={() => openDeliverModal(item, 'IN')} className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded text-green-700 text-xs font-bold hover:bg-green-50 uppercase">
                           <ArrowDownLeft className="w-4 h-4" /> Repor
                        </button>
                        <button onClick={() => openDeliverModal(item, 'OUT')} className="flex items-center justify-center gap-2 py-2 bg-orange-600 text-white border border-transparent rounded text-xs font-bold hover:bg-orange-700 uppercase shadow-sm">
                           <ArrowUpRight className="w-4 h-4" /> Entregar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">EPI</th>
                    <th className="px-6 py-4">Responsável / Funcionário</th>
                    <th className="px-6 py-4 text-right">Qtd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {t.type === 'IN' ? 'ENTRADA' : 'ENTREGA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{t.epiName}</td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex items-center gap-2">
                           <User className="w-4 h-4 text-slate-400" />
                           {t.employeeName}
                        </div>
                        {t.notes && <div className="text-xs text-slate-400 mt-1 italic">{t.notes}</div>}
                      </td>
                      <td className="px-6 py-4 text-right font-bold">{t.quantity}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Sem histórico.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal Adicionar EPI */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingId ? 'Editar EPI' : 'Novo EPI'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500">Nome do Equipamento</label>
                <input type="text" value={epiName} onChange={e => setEpiName(e.target.value)} className="w-full p-2 border rounded" placeholder="Ex: Bota de Segurança" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">C.A. (Certificado de Aprovação)</label>
                <input type="text" value={epiCa} onChange={e => setEpiCa(e.target.value)} className="w-full p-2 border rounded" placeholder="Ex: 12345" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500">Estoque Atual</label>
                    <input type="number" value={epiQty} onChange={e => setEpiQty(Number(e.target.value))} className="w-full p-2 border rounded" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500">Mínimo (Alerta)</label>
                    <input type="number" value={epiMin} onChange={e => setEpiMin(Number(e.target.value))} className="w-full p-2 border rounded" />
                 </div>
              </div>
              <div>
                 <label className="text-xs font-bold text-slate-500">Validade Média (Dias)</label>
                 <input type="number" value={epiValidity} onChange={e => setEpiValidity(Number(e.target.value))} className="w-full p-2 border rounded" placeholder="Para troca" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
               <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 border rounded text-slate-600">Cancelar</button>
               <button onClick={handleSaveEpi} disabled={processing} className="flex-1 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700">
                  {processing ? <Loader2 className="animate-spin mx-auto"/> : 'Salvar'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Entrega/Movimentação */}
      {showDeliverModal && selectedEpi && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border-t-4 border-orange-500">
            <h3 className="text-lg font-bold text-slate-800 mb-1">
               {transType === 'IN' ? 'Reposição de Estoque' : 'Entrega de EPI'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{selectedEpi.name} (CA: {selectedEpi.caNumber})</p>

            <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-500">Quantidade</label>
                  <input type="number" min="1" value={transQty} onChange={e => setTransQty(Number(e.target.value))} className="w-full p-2 border rounded text-lg font-bold text-center" />
               </div>

               {transType === 'OUT' && (
                 <div>
                    <label className="text-xs font-bold text-slate-500">Funcionário</label>
                    <select value={transEmpId} onChange={e => setTransEmpId(e.target.value)} className="w-full p-2 border rounded bg-white">
                       <option value="">Selecione...</option>
                       {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                 </div>
               )}

               <div>
                  <label className="text-xs font-bold text-slate-500">Observações (Opcional)</label>
                  <input type="text" value={transNotes} onChange={e => setTransNotes(e.target.value)} className="w-full p-2 border rounded" placeholder="Motivo, número da nota, etc." />
               </div>
            </div>

            <div className="flex gap-3 mt-6">
               <button onClick={() => setShowDeliverModal(false)} className="flex-1 py-2 border rounded text-slate-600">Cancelar</button>
               <button onClick={handleTransaction} disabled={processing} className="flex-1 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700">
                  {processing ? <Loader2 className="animate-spin mx-auto"/> : 'Confirmar'}
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
                <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir EPI?</h3>
                <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm mb-4">
                   <p className="font-bold">Atenção!</p>
                   <p>Você está prestes a excluir: <strong>{itemToDelete.name}</strong></p>
                </div>
                <p className="text-slate-500 text-sm mb-6">
                   Isso apagará permanentemente o registro deste equipamento e <strong>todo o histórico de entregas</strong> associado a ele. Essa ação não pode ser desfeita.
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

export default EpiControl;