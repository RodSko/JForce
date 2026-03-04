import React from 'react';
import { Employee } from '../types';

interface TeamManagementProps {
  employees: Employee[];
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Gestão de Equipe</h2>
      <ul>
        {employees.map(employee => (
          <li key={employee.id} className="mb-2 p-2 border border-gray-300 rounded">
            {employee.name} - {employee.gender}
            <button onClick={() => onDeleteEmployee(employee.id)} className="ml-2 text-red-600">Excluir</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeamManagement;
