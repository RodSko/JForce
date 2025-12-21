import React, { useState } from 'react';
import { Employee } from '../types';
import { UserPlus, UserX, UserCheck, Pencil, Check, X, Loader2, Trash2, AlertTriangle } from 'lucide-react';

interface Props {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => Promise<void>;
  onUpdateEmployee: (emp: Employee) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
}

const TeamManagement: React.FC<Props> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<'M' | 'F'>('M');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editGenderValue, setEditGenderValue] = useState<'M' | 'F'>('M');
  const [loading, setLoading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Employee | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        name: newName,
        active: true,
        gender: newGender
      };
      await onAddEmployee(newEmp);
      setNewName('');
    } catch (error: any) {
      console.error("Error adding employee:", error);
      // Mostramos o erro detalhado para ajudar no diagnóstico
      const errorDetail = error.message || (error.error_description) || JSON.stringify(error);
      alert(`ERRO AO ADICIONAR:\n${errorDetail}\n\nNota: Certifique-se de que a coluna 'gender' existe na sua tabela 'employees' do Supabase.`);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (emp: Employee) => {
    try {
      await onUpdateEmployee({ ...emp, active: !emp.active });
    } catch (error: any) {
      alert(`Erro ao atualizar status: ${error.message}`);
    }
  };

  const startEditing = (emp: Employee) => {
    setEditingId(emp.id);
    setEditNameValue(emp.name);
    setEditGenderValue(emp.gender);
  };

  const saveEdit = async (originalEmp: Employee) => {
    if (editingId && editNameValue.trim()) {
      setLoading(true);
      try {
        await onUpdateEmployee({ 
          ...originalEmp, 
          name: editNameValue, 
          gender: editGenderValue 
        });
        setEditingId(null);
      } catch (error: any) {
        console.error("Error updating employee:", error);
        alert(`ERRO AO SALVAR:\n${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setLoading(true);
    try {
      await onDeleteEmployee(itemToDelete.id);
      setItemToDelete(null);
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      alert(`Erro ao excluir: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Novo Colaborador</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do colaborador"
            className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            disabled={loading}
          />
        </div>
        <div className="w-full md:w-32">
          <label className="block text-sm font-medium text-slate-700 mb-1">Sexo</label>
          <select
            value={newGender}
            onChange={(e) => setNewGender(e.target.value as 'M' | 'F')}
            className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            disabled={loading}
          >
            <option value="M">Masc.</option>
            <option value="F">Fem.</option>
          </select>
        </div>
        <button 
          onClick={handleAdd}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} 
          Adicionar
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4 text-left">Nome</th>
              <th className="px-6 py-4 text-center">Sexo</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">
                  {editingId === emp.id ? (
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="w-full px-2 py-1 bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(emp);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                  ) : (
                    emp.name
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {editingId === emp.id ? (
                    <select
                      value={editGenderValue}
                      onChange={(e) => setEditGenderValue(e.target.value as 'M' | 'F')}
                      className="px-2 py-1 border rounded"
                    >
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${emp.gender === 'M' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                      {emp.gender === 'M' ? 'Masc' : 'Fem'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    emp.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {emp.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {editingId === emp.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(emp)}
                          className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50"
                          title="Salvar"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(emp)}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(emp)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    
                    <div className="h-4 w-px bg-slate-200 mx-1"></div>

                    <button
                      onClick={() => toggleStatus(emp)}
                      className={`text-sm font-medium ${
                        emp.active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                      }`}
                    >
                      {emp.active ? (
                        <span className="flex items-center gap-1"><UserX className="w-4 h-4"/> Desativar</span>
                      ) : (
                        <span className="flex items-center gap-1"><UserCheck className="w-4 h-4"/> Ativar</span>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-100 p-3 rounded-full border-4 border-white shadow-lg">
                 <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <div className="mt-6 text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Colaborador?</h3>
                <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm mb-4">
                   <p className="font-bold">Atenção!</p>
                   <p>Você está prestes a excluir: <strong>{itemToDelete.name}</strong></p>
                </div>
                <p className="text-slate-500 text-sm mb-6">
                   Essa ação é permanente e removerá o colaborador do banco de dados. Para apenas suspender o acesso, use a opção "Desativar".
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
                     disabled={loading}
                     className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                     {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                     Excluir Agora
                   </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;