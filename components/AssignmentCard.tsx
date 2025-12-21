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

  const currentTaskAssignments = assignments.filter(a => a.taskId === task.id);
  const assignedEmployeeIds = new Set(assignments.map(a => a.employeeId));
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
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-100 rounded-lg">
            {getIcon(task.category)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-none">{task.name}</h3>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">{task.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {currentTaskAssignments.length} / {isSolto ? '∞' : task.capacity}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {Array.from({ length: displayCapacity }).map((_, idx) => {
          const assignment = currentTaskAssignments.find(a => a.slotIndex === idx);
          const isDiarista = assignment?.employeeId === 'diarista-id';
          const employee = assignment ? employees.find(e => e.id === assignment.employeeId) : null;
          
          return (
            <div key={`${task.id}-${idx}`} className="min-h-[32px] flex items-stretch">
              {isDiarista ? (
                <div className="w-full flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-3 h-3 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800 uppercase">DIARISTA</span>
                  </div>
                  <button 
                    onClick={() => onAssign(task.id, idx, "")}
                    className="text-emerald-300 hover:text-emerald-600 p-0.5"
                    data-html2canvas-ignore
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : assignment ? (
                <div className="w-full flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${employee?.gender === 'M' ? 'bg-blue-500' : 'bg-pink-500'}`} />
                    <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                      {employee?.name || "Desconhecido"}
                    </span>
                  </div>
                  <button 
                    onClick={() => onAssign(task.id, idx, "")}
                    className="text-indigo-200 hover:text-indigo-600 p-0.5"
                    data-html2canvas-ignore
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-full relative" data-html2canvas-ignore>
                  <select
                    className="w-full h-full text-[11px] px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 italic appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    value=""
                    onChange={(e) => onAssign(task.id, idx, e.target.value)}
                  >
                    <option value="">Vago...</option>
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