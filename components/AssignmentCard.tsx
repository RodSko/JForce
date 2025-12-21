import React from 'react';
import { TaskDefinition, Employee, Assignment, TaskCategory } from '../types';
import { User, Package, Truck, Network, Briefcase, UserPlus } from 'lucide-react';

interface Props {
  task: TaskDefinition;
  assignments: Assignment[];
  employees: Employee[];
  onAssign: (taskId: string, slotIndex: number, employeeId: string) => void;
}

const AssignmentCard: React.FC<Props> = ({ task, assignments, employees, onAssign }) => {
  const getIcon = (cat: TaskCategory) => {
    switch (cat) {
      case TaskCategory.UNLOAD: return <Truck className="w-5 h-5 text-red-500" />;
      case TaskCategory.TURN: return <Package className="w-5 h-5 text-orange-500" />;
      case TaskCategory.FISHING: return <Network className="w-5 h-5 text-blue-500" />;
      case TaskCategory.BAGGING: return <Briefcase className="w-5 h-5 text-green-500" />;
      case TaskCategory.SOLTO: return <User className="w-5 h-5 text-slate-400" />;
    }
  };

  const currentTaskAssignments = assignments.filter(a => a.taskId === task.id);
  const assignedEmployeeIds = new Set(assignments.map(a => a.employeeId));

  const isSolto = task.category === TaskCategory.SOLTO;
  
  // Encontrar o maior índice de slot ocupado para garantir que todos apareçam
  const maxOccupiedSlot = currentTaskAssignments.length > 0 
    ? Math.max(...currentTaskAssignments.map(a => a.slotIndex)) 
    : -1;

  // Mostra a capacidade original OU o número de alocações (se for maior)
  const displayCapacity = isSolto 
    ? Math.max(currentTaskAssignments.length + 1, 1) 
    : Math.max(task.capacity, maxOccupiedSlot + 1);

  return (
    <div className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow p-4 ${isSolto ? 'border-slate-300 bg-slate-50/30' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {getIcon(task.category)}
            <h3 className="font-semibold text-slate-800">{task.name}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">{task.description}</p>
        </div>
        <span className={`text-xs font-mono px-2 py-1 rounded ${isSolto ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600'}`}>
          {currentTaskAssignments.length} {isSolto ? 'alocados' : `/ ${task.capacity}`}
        </span>
      </div>

      <div className="space-y-2">
        {Array.from({ length: displayCapacity }).map((_, idx) => {
          const assignment = currentTaskAssignments.find(a => a.slotIndex === idx);
          const isDiarista = assignment?.employeeId === 'diarista-id';
          const isExtraSlot = !isSolto && idx >= task.capacity;
          
          return (
            <div key={`${task.id}-${idx}`} className="relative">
              {isDiarista ? (
                <div className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded text-sm font-bold ${isExtraSlot ? 'bg-emerald-100 border-emerald-300 text-emerald-900 animate-pulse' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-500" />
                    <span>DIARISTA {isExtraSlot ? '(Extra)' : ''}</span>
                  </div>
                  <button 
                    onClick={() => onAssign(task.id, idx, "")}
                    className="text-[10px] text-emerald-600 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <select
                  className={`w-full text-sm p-2 rounded border transition-colors ${
                    assignment 
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-900 font-medium' 
                      : 'border-slate-200 bg-white text-slate-400 italic'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  value={assignment?.employeeId || ""}
                  onChange={(e) => onAssign(task.id, idx, e.target.value)}
                >
                  <option value="">-- {assignment ? 'Remover' : 'Vazio'} --</option>
                  <option value="diarista-id">DIARISTA (Manual)</option>
                  {assignment && !isDiarista && (
                    <option value={assignment.employeeId}>
                      {employees.find(e => e.id === assignment.employeeId)?.name}
                    </option>
                  )}
                  {employees
                    .filter(e => !assignedEmployeeIds.has(e.id) && e.active)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.gender})
                      </option>
                    ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssignmentCard;