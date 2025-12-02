import React, { useState, useEffect } from 'react';
import { DailyRecord, Employee, TaskDefinition, Assignment, TripInfo } from '../types';
import { TASK_DEFINITIONS } from '../constants';
import AssignmentCard from './AssignmentCard';
import { Save, Sparkles, Loader2, Calendar, Unlock, Lock, Container, Plus, Trash2 } from 'lucide-react';
import { generateScheduleSuggestion } from '../services/geminiService';

interface Props {
  employees: Employee[];
  history: DailyRecord[];
  onSaveRecord: (record: DailyRecord) => void;
}

const DailyOperations: React.FC<Props> = ({ employees, history, onSaveRecord }) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [volume, setVolume] = useState<number | ''>('');
  const [trucks, setTrucks] = useState<number | ''>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  // State for Trips (Dynamic)
  const [trips, setTrips] = useState<TripInfo[]>([]);

  const [loadingAI, setLoadingAI] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);

  // Load existing data if editing a past date
  useEffect(() => {
    const existing = history.find(h => h.date === date);
    if (existing) {
      setVolume(existing.volume);
      setTrucks(existing.trucks);
      setAssignments(existing.assignments);
      setTrips(existing.trips || []);
    } else {
      setVolume('');
      setTrucks('');
      setAssignments([]);
      setTrips([]);
    }
    setAiRationale(null);
  }, [date, history]);

  const handleAssign = (taskId: string, slotIndex: number, employeeId: string) => {
    setAssignments(prev => {
      // Remove any existing assignment for this slot
      const filtered = prev.filter(a => !(a.taskId === taskId && a.slotIndex === slotIndex));
      if (!employeeId) return filtered;
      
      // If employee is assigned elsewhere, remove them from there (optional, but good UX)
      const withoutEmployee = filtered.filter(a => a.employeeId !== employeeId);
      
      return [...withoutEmployee, { taskId, employeeId, slotIndex }];
    });
  };

  const handleAddTrip = () => {
    if (trips.length < 5) {
      setTrips(prev => [...prev, { id: '', unsealed: false }]);
    }
  };

  const handleRemoveTrip = (index: number) => {
    setTrips(prev => prev.filter((_, i) => i !== index));
  };

  const handleTripChange = (index: number, value: string) => {
    // Uppercase and limit to 15 chars
    const formattedValue = value.toUpperCase().slice(0, 15);
    
    setTrips(prev => {
      const newTrips = [...prev];
      newTrips[index] = { ...newTrips[index], id: formattedValue };
      return newTrips;
    });
  };

  const toggleTripUnsealed = (index: number) => {
    setTrips(prev => {
      const newTrips = [...prev];
      const currentTrip = newTrips[index];
      const isNowUnsealed = !currentTrip.unsealed;
      
      // Se tornou deslacrada, adiciona timestamp. Se lacrou novamente, remove.
      const timestamp = isNowUnsealed 
        ? new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : undefined;

      newTrips[index] = { 
        ...currentTrip, 
        unsealed: isNowUnsealed,
        unsealTimestamp: timestamp
      };
      return newTrips;
    });
  };

  const handleSave = () => {
    // Validação removida para permitir salvamento parcial (ex: salvar viagens sem ter volume definido ainda)
    
    const record: DailyRecord = {
      id: date,
      date,
      volume: Number(volume) || 0, // Se estiver vazio, salva como 0
      trucks: Number(trucks) || 0, // Se estiver vazio, salva como 0
      assignments,
      trips
    };
    onSaveRecord(record);
    alert("Dados salvos com sucesso!");
  };

  const handleSmartSchedule = async () => {
    setLoadingAI(true);
    try {
      const suggestion = await generateScheduleSuggestion(employees, history, date);
      setAiRationale(suggestion.rationale);
      
      // Map suggestion names back to IDs
      const newAssignments: Assignment[] = [];
      
      suggestion.assignments.forEach((sug: any) => {
        const emp = employees.find(e => e.name.toLowerCase() === sug.employeeName.toLowerCase());
        const task = TASK_DEFINITIONS.find(t => t.id === sug.taskId);
        
        if (emp && task) {
          newAssignments.push({
            taskId: task.id,
            slotIndex: sug.slotIndex,
            employeeId: emp.id
          });
        }
      });
      
      setAssignments(newAssignments);
    } catch (e) {
      alert("Erro ao gerar sugestão. Verifique a API Key.");
    } finally {
      setLoadingAI(false);
    }
  };

  const assignedCount = assignments.length;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-end">
        <div className="flex gap-4 items-end w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-medium text-slate-500 mb-1">Volumetria</label>
            <input
              type="number"
              placeholder="Ex: 5000"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm w-full md:w-32 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-medium text-slate-500 mb-1">Carretas</label>
            <input
              type="number"
              placeholder="Ex: 2"
              value={trucks}
              onChange={(e) => setTrucks(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm w-full md:w-24 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
           <button
            onClick={handleSmartSchedule}
            disabled={loadingAI}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loadingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            IA Escala
          </button>

          <button
            onClick={handleSave}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metrics & Trips */}
        <div className="space-y-6 lg:col-span-1">
          {/* Progress Bar */}
          <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Alocação da Equipe: {assignedCount} / {employees.length}
            </span>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${assignedCount === employees.length ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min((assignedCount / employees.length) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Trip Registration */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Container className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Registro de Viagens</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{trips.length}/5</span>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              {trips.length > 0 ? (
                trips.map((trip, idx) => (
                  <div key={idx} className="animate-fade-in flex items-start gap-2">
                     <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          maxLength={15}
                          placeholder="ID Viagem (15 dígitos)"
                          value={trip.id}
                          onChange={(e) => handleTripChange(idx, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none placeholder:normal-case"
                        />
                        {trip.unsealed && trip.unsealTimestamp && (
                          <span className="text-[10px] text-green-600 font-medium px-1">
                            Deslacrado em: {trip.unsealTimestamp}
                          </span>
                        )}
                     </div>
                    
                    <button 
                      onClick={() => toggleTripUnsealed(idx)}
                      className={`flex items-center justify-center w-10 h-[38px] rounded border transition-all duration-200 ${
                        trip.unsealed 
                          ? 'bg-green-100 border-green-300 text-green-600 shadow-inner' 
                          : 'bg-red-100 border-red-300 text-red-600 hover:bg-red-200'
                      }`}
                      title={trip.unsealed ? "Deslacrada" : "Lacrada"}
                    >
                      {trip.unsealed ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={() => handleRemoveTrip(idx)}
                      className="flex items-center justify-center w-8 h-[38px] text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remover Viagem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  Nenhuma viagem registrada hoje
                </div>
              )}

              {trips.length < 5 && (
                <button
                  onClick={handleAddTrip}
                  className="w-full py-2 border border-dashed border-indigo-300 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Nova Viagem
                </button>
              )}
            </div>
          </div>

          {aiRationale && (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl text-sm text-purple-800 animate-fade-in">
              <strong>Sugestão da IA:</strong> {aiRationale}
            </div>
          )}
        </div>

        {/* Right Column: Assignments Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TASK_DEFINITIONS.map(task => (
              <AssignmentCard
                key={task.id}
                task={task}
                assignments={assignments}
                employees={employees}
                onAssign={handleAssign}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyOperations;