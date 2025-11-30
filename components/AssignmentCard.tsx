import React from 'react';
import { TaskDefinition, Employee, Assignment, TaskCategory } from '../types';
import { User, Package, Truck, Network, Briefcase } from 'lucide-react';

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
    }
  };

  const currentTaskAssignments = assignments.filter(a => a.taskId === task.id);
  
  // Calculate unassigned employees for dropdown
  const assignedEmployeeIds = new Set(assignments.map(a => a.employeeId));

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {getIcon(task.category)}
            <h3 className="font-semibold text-slate-800">{task.name}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">{task.description}</p>
        </div>
        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
          {currentTaskAssignments.length}/{task.capacity}
        </span>
      </div>

      <div className="space-y-2">
        {Array.from({ length: task.capacity }).map((_, idx) => {
          const assignment = currentTaskAssignments.find(a => a.slotIndex === idx);
          
          return (
            <div key={`${task.id}-${idx}`} className="relative">
              <select
                className={`w-full text-sm p-2 rounded border ${
                  assignment ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-slate-50 text-slate-400'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                value={assignment?.employeeId || ""}
                onChange={(e) => onAssign(task.id, idx, e.target.value)}
              >
                <option value="">-- Selecionar --</option>
                {/* Show currently assigned person for this slot */}
                {assignment && (
                  <option value={assignment.employeeId}>
                    {employees.find(e => e.id === assignment.employeeId)?.name}
                  </option>
                )}
                {/* Show only unassigned employees */}
                {employees
                  .filter(e => !assignedEmployeeIds.has(e.id) && e.active)
                  .map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssignmentCard;