import React from 'react';
import { TaskDefinition, Employee, Assignment, TaskCategory } from '../types';
import { User, Package, Truck, Network, Briefcase, UserPlus, X } from 'lucide-react';

interface Props {
  task: TaskDefinition;
  assignments: Assignment[];
  employees: Employee[];
  onAssign: (taskId: string, slotIndex: number, employeeId: string) => void;
}

const AssignmentCard: React.FC<Props> = ({ task, assignments, employees, onAssign }) => {
  const getIcon = (cat: TaskCategory) => {
    switch (cat) {
      case TaskCategory.UNLOAD: return <Truck className="w-4 h-4 text-rose-500" />;
      case TaskCategory.TURN: return <Package className="w-4 h-4 text-orange-500" />;
      case TaskCategory.FISHING: return <Network className="w-4 h-4 text-blue-500" />;
      case TaskCategory.BAGGING: return <Briefcase className="w-4 h-4 text-emerald-500" />;
      case TaskCategory.SOLTO: return <User className="w-4 h-4 text-slate-400" />;
    }
  };

  // Correção: Apenas considerar atribuições com employeeId válido (não vazio)
  const currentTaskAssignments = assignments.filter(a => a.taskId === task.id && a.employeeId);
  const assignedEmployeeIds = new Set(assignments.filter(a => a.employeeId).map(a => a.employeeId));
  const isSolto = task.category === TaskCategory.SOLTO;
  
  const maxOccupiedSlot = currentTaskAssignments.length > 0 
    ? Math.max(...currentTaskAssignments.map(a => a.slotIndex)) 
    : -1;

  const displayCapacity = isSolto 
    ? Math.max(currentTaskAssignments.length + 1, 1) 
    : Math.max(task.capacity, maxOccupiedSlot + 1);

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col ${isSolto ? 'bg-slate-50/50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            {getIcon(task.category)}
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">{task.name}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase">{task.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {currentTaskAssignments.length} / {isSolto ? '∞' : task.capacity}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {Array.from({ length: displayCapacity }).map((_, idx) => {
          const assignment = assignments.find(a => a.taskId === task.id && a.slotIndex === idx && a.employeeId);
          const isDiarista = assignment?.employeeId === 'diarista-id';
          const employee = assignment ? employees.find(e => e.id === assignment.employeeId) : null;
          
          return (
            <div key={`${task.id}-${idx}`} className="min-h-[38px] flex items-stretch">
              {isDiarista ? (
                <div className="w-full flex items-center justify-between px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-black text-emerald-900 uppercase">DIARISTA</span>
                  </div>
                  <button 
                    onClick={() => onAssign(task.id, idx, "")}
                    className="text-emerald-400 hover:text-emerald-600 p-1"
                    data-html2canvas-ignore
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : assignment ? (
                <div className="w-full flex items-center justify-between px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="flex items-center gap-2 overflow-visible">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${employee?.gender === 'M' ? 'bg-blue-600' : 'bg-pink-600'}`} />
                    <span className="text-xs font-black text-slate-900 whitespace-nowrap leading-none">
                      {employee?.name || "Desconhecido"}
                    </span>
                  </div>
                  <button 
                    onClick={() => onAssign(task.id, idx, "")}
                    className="text-indigo-300 hover:text-indigo-600 p-1 ml-1"
                    data-html2canvas-ignore
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-full relative" data-html2canvas-ignore>
                  <select
                    className="w-full h-full text-[11px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-400 italic appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-inner"
                    value=""
                    onChange={(e) => onAssign(task.id, idx, e.target.value)}
                  >
                    <option value="">-- Selecionar --</option>
                    <option value="diarista-id">+ ADICIONAR DIARISTA</option>
                    {employees
                      .filter(e => !assignedEmployeeIds.has(e.id) && e.active)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(e => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssignmentCard;