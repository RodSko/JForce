import React, { useState, useMemo } from 'react';
import { DailyRecord, Employee, TaskCategory } from '../types';
import { TASK_DEFINITIONS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, Filter, Table2, User, Container, Lock, Unlock } from 'lucide-react';

interface Props {
  history: DailyRecord[];
  employees: Employee[];
}

const Reports: React.FC<Props> = ({ history, employees }) => {
  // Configurar datas iniciais
  // Padrão solicitado: Data Inicial = Hoje - 1 dia, Data Final = Hoje + 2 dias
  const now = new Date();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const defaultStart = yesterday.toISOString().split('T')[0];

  const twoDaysAfter = new Date(now);
  twoDaysAfter.setDate(now.getDate() + 2);
  const defaultEnd = twoDaysAfter.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

  // Filtrar o histórico baseado no intervalo selecionado
  const filteredHistory = useMemo(() => {
    return history.filter(rec => {
      return rec.date >= startDate && rec.date <= endDate;
    });
  }, [history, startDate, endDate]);

  // Lista de funcionários a serem exibidos (Todos ou Específico)
  const targetEmployees = useMemo(() => {
    if (selectedEmployeeId === 'all') {
      return employees;
    }
    return employees.filter(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // 1. Prepare data for Volume/Trucks over time using filtered history
  const operationalData = useMemo(() => {
    return filteredHistory
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(rec => {
        // Fix timezone issue for chart labels using string split
        const [year, month, day] = rec.date.split('-');
        return {
          date: `${day}/${month}`,
          volume: rec.volume,
          trucks: rec.trucks
        };
      });
  }, [filteredHistory]);

  // 2. Prepare Heatmap data (Employee vs Task Category count)
  const categoryStats = useMemo(() => {
    return targetEmployees.map(emp => {
      const stats: any = { name: emp.name };
      
      // Initialize counts
      Object.values(TaskCategory).forEach(cat => stats[cat] = 0);

      filteredHistory.forEach(day => {
        const assignment = day.assignments.find(a => a.employeeId === emp.id);
        if (assignment) {
          const taskDef = TASK_DEFINITIONS.find(t => t.id === assignment.taskId);
          if (taskDef) {
            stats[taskDef.category] = (stats[taskDef.category] || 0) + 1;
          }
        }
      });
      return stats;
    });
  }, [targetEmployees, filteredHistory]);

  // 3. Prepare Specific Task Detail data (Employee vs Specific Task ID)
  const specificTaskStats = useMemo(() => {
    return targetEmployees.map(emp => {
      // Create an object with employee name and all task IDs initialized to 0
      const stats: Record<string, any> = { id: emp.id, name: emp.name };
      TASK_DEFINITIONS.forEach(task => stats[task.id] = 0);

      filteredHistory.forEach(day => {
        const assignment = day.assignments.find(a => a.employeeId === emp.id);
        if (assignment) {
          stats[assignment.taskId] = (stats[assignment.taskId] || 0) + 1;
        }
      });
      return stats;
    });
  }, [targetEmployees, filteredHistory]);

  // 4. Prepare Trips Report Data
  const tripsData = useMemo(() => {
    const allTrips: { date: string; id: string; volume?: number; unsealed: boolean; timestamp?: string }[] = [];
    
    // Sort history specifically for the table (Newest first)
    const sortedHistory = [...filteredHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedHistory.forEach(day => {
      if (day.trips && day.trips.length > 0) {
        day.trips.forEach(trip => {
          allTrips.push({
            date: day.date,
            id: trip.id,
            volume: trip.volume,
            unsealed: !!trip.unsealed, // Force boolean conversion
            timestamp: trip.unsealTimestamp
          });
        });
      }
    });
    return allTrips;
  }, [filteredHistory]);

  // Helper para formatar data evitando problemas de timezone (UTC vs Local)
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-end gap-4 sticky top-20 z-10">
        <div className="flex items-center gap-2 text-indigo-600 mb-2 lg:mb-1 mr-4 min-w-fit">
          <Filter className="w-5 h-5" />
          <span className="font-semibold">Filtros</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {/* Data Inicial */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Inicial</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Final</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Filtro Colaborador */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Colaborador</label>
            <div className="relative">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full appearance-none"
              >
                <option value="all">Todos os Colaboradores</option>
                {employees.filter(e => e.active).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Volume */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-6">
             <h3 className="text-lg font-bold text-slate-800">Volume & Carretas</h3>
             <span className="text-xs text-slate-400 font-light px-2 py-1 bg-slate-100 rounded">Dados Gerais da Operação</span>
          </div>
          {operationalData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={operationalData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{fontSize: 12}} />
                  <YAxis yAxisId="left" stroke="#3b82f6" label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: '#3b82f6' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#ef4444" label={{ value: 'Carretas', angle: 90, position: 'insideRight', fill: '#ef4444' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} name="Volume" dot={{r: 4}} />
                  <Line yAxisId="right" type="monotone" dataKey="trucks" stroke="#ef4444" strokeWidth={2} name="Carretas" dot={{r: 4}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-400 italic">
              Sem dados no período selecionado
            </div>
          )}
        </div>

        {/* Gráfico de Distribuição */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">
            Distribuição por Categoria
            {selectedEmployeeId !== 'all' && <span className="text-indigo-600 ml-2 text-sm font-normal">(Filtrado)</span>}
          </h3>
          {filteredHistory.length > 0 && categoryStats.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" />
                  <YAxis dataKey="name" type="category" width={100} stroke="#334155" tick={{fontSize: 11}} interval={0} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} />
                  <Legend wrapperStyle={{fontSize: '11px'}} />
                  <Bar dataKey={TaskCategory.UNLOAD} stackId="a" fill="#ef4444" name="Descarregar" radius={[0, 4, 4, 0]} />
                  <Bar dataKey={TaskCategory.FISHING} stackId="a" fill="#3b82f6" name="Pesca (Rota)" />
                  <Bar dataKey={TaskCategory.TURN} stackId="a" fill="#f97316" name="Virar" />
                  <Bar dataKey={TaskCategory.BAGGING} stackId="a" fill="#22c55e" name="Ensacar" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="h-[300px] flex items-center justify-center text-slate-400 italic">
              Sem dados para exibir
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Relatório de Viagens e Lacres (MOVIDA PARA CIMA) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <div className="flex items-center gap-2">
             <Container className="w-5 h-5 text-indigo-600" />
             <h3 className="font-semibold text-slate-800">Relatório de Viagens e Lacres</h3>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 w-40">Data</th>
                <th className="px-6 py-3">ID Viagem</th>
                <th className="px-6 py-3 text-right">Volume</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Horário Deslacre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tripsData.map((trip, idx) => (
                <tr key={`${trip.id}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-700">
                    {formatDate(trip.date)}
                  </td>
                  <td className="px-6 py-3 font-mono text-slate-600">
                    {trip.id}
                  </td>
                  <td className="px-6 py-3 font-mono text-slate-600 text-right font-bold">
                    {trip.volume ? trip.volume.toLocaleString('pt-BR') : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      trip.unsealed 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {trip.unsealed ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {trip.unsealed ? 'Deslacrada' : 'Lacrada'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-slate-500 font-mono">
                    {trip.timestamp ? trip.timestamp : '-'}
                  </td>
                </tr>
              ))}
              {tripsData.length === 0 && (
                <tr>
                   <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                     Nenhuma viagem registrada no período selecionado.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela Detalhada por TAREFA ESPECÍFICA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <div className="flex items-center gap-2">
             <Table2 className="w-5 h-5 text-indigo-600" />
             <h3 className="font-semibold text-slate-800">Detalhamento por Posto Específico (Rotas)</h3>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Colaborador</th>
                {TASK_DEFINITIONS.map(task => (
                  <th key={task.id} className="px-3 py-3 whitespace-nowrap min-w-[120px]" title={task.description}>
                    <div className="flex flex-col">
                      <span>{task.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{task.category}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {specificTaskStats.map((stat: any, index) => (
                <tr key={stat.id} className={index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-50'}>
                  <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-inherit border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {stat.name}
                  </td>
                  {TASK_DEFINITIONS.map(task => {
                    const count = stat[task.id];
                    return (
                      <td key={task.id} className="px-3 py-3 text-center border-r border-slate-50 last:border-0">
                        {count > 0 ? (
                          <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-indigo-50 text-indigo-700 font-medium">
                            {count}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {specificTaskStats.length === 0 && (
                <tr>
                   <td colSpan={TASK_DEFINITIONS.length + 1} className="p-4 text-center text-slate-400 italic">
                     Nenhum colaborador encontrado com os filtros atuais.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela Resumo Categorias */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-80">
        <div className="p-3 border-b border-slate-100 bg-slate-50">
           <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Resumo Geral por Categoria</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                {Object.values(TaskCategory).map(cat => (
                  <th key={cat} className="px-4 py-3">{cat}</th>
                ))}
                <th className="px-4 py-3">Total Dias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoryStats.map((stat: any) => {
                const total = 
                  (stat[TaskCategory.UNLOAD] || 0) + 
                  (stat[TaskCategory.FISHING] || 0) + 
                  (stat[TaskCategory.TURN] || 0) + 
                  (stat[TaskCategory.BAGGING] || 0);

                return (
                  <tr key={stat.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{stat.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {stat[TaskCategory.UNLOAD] > 0 ? stat[TaskCategory.UNLOAD] : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {stat[TaskCategory.FISHING] > 0 ? stat[TaskCategory.FISHING] : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {stat[TaskCategory.TURN] > 0 ? stat[TaskCategory.TURN] : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {stat[TaskCategory.BAGGING] > 0 ? stat[TaskCategory.BAGGING] : '-'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{total}</td>
                  </tr>
                );
              })}
              {categoryStats.length === 0 && (
                <tr>
                   <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                     Nenhum dado encontrado.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;