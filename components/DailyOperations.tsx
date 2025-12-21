import React, { useState, useEffect } from 'react';
import { DailyRecord, Employee, TaskDefinition, Assignment, TripInfo } from '../types';
import { TASK_DEFINITIONS } from '../constants';
import AssignmentCard from './AssignmentCard';
import { Save, Calendar, Unlock, Lock, Container, Trash2, Calculator, RefreshCw, Info, Loader2, UserPlus } from 'lucide-react';
import { calculateAutoRotation } from '../services/rotationService';

interface Props {
  employees: Employee[];
  history: DailyRecord[];
  onSaveRecord: (record: DailyRecord) => void;
}

const DailyOperations: React.FC<Props> = ({ employees, history, onSaveRecord }) => {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [volume, setVolume] = useState<number | ''>('');
  const [trucks, setTrucks] = useState<number | ''>('');
  const [diaristas, setDiaristas] = useState<number>(0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [trips, setTrips] = useState<TripInfo[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const existing = history.find(h => h.date === date);
    if (existing) {
      setVolume(existing.volume);
      setTrucks(existing.trucks);
      setDiaristas(existing.diaristaCount || 0);
      setAssignments(existing.assignments);
      setTrips(existing.trips || []);
    } else {
      setVolume('');
      setTrucks('');
      setDiaristas(0);
      setAssignments([]);
      setTrips([]);
    }
  }, [date, history]);

  useEffect(() => {
    if (trips.length > 0) {
      const total = trips.reduce((acc, trip) => acc + (trip.volume || 0), 0);
      setVolume(total > 0 ? total : '');
    } else if (trips.length === 0 && !history.find(h => h.date === date)?.volume) {
       setVolume('');
    }
  }, [trips, date, history]);

  const handleAssign = (taskId: string, slotIndex: number, employeeId: string) => {
    setAssignments(prev => {
      const filtered = prev.filter(a => !(a.taskId === taskId && a.slotIndex === slotIndex));
      if (!employeeId) return filtered;
      
      const withoutEmployee = filtered.filter(a => a.employeeId !== employeeId);
      return [...withoutEmployee, { taskId, employeeId, slotIndex, isManual: true }];
    });
  };

  const handleSmartSchedule = () => {
    setProcessing(true);
    setTimeout(() => {
      try {
        const newAssignments = calculateAutoRotation(employees, history, assignments, diaristas);
        setAssignments(newAssignments);
      } catch (e) {
        alert("Erro ao calcular escala.");
      } finally {
        setProcessing(false);
      }
    }, 300);
  };

  const handleSave = () => {
    const cleanTrips = trips.filter(t => t.id.trim() !== '');
    const calculatedVolume = cleanTrips.reduce((acc, t) => acc + (t.volume || 0), 0);
    const record: DailyRecord = {
      id: date,
      date,
      volume: calculatedVolume,
      trucks: Number(trucks) || 0,
      diaristaCount: diaristas,
      assignments,
      trips: cleanTrips
    };
    onSaveRecord(record);
    alert("Dados salvos com sucesso!");
  };

  const handleAddTrip = () => trips.length < 5 && setTrips(prev => [...prev, { id: '', unsealed: false }]);
  const handleRemoveTrip = (idx: number) => setTrips(prev => prev.filter((_, i) => i !== idx));
  const handleTripChange = (idx: number, val: string) => {
    const formattedValue = val.toUpperCase().slice(0, 15);
    setTrips(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], id: formattedValue };
      return next;
    });
  };
  const handleTripVolumeChange = (idx: number, val: string) => {
    const num = val === '' ? undefined : Number(val);
    setTrips(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], volume: num };
      return next;
    });
  };
  const toggleTripUnsealed = (idx: number) => {
    const next = [...trips];
    const isNowUnsealed = !next[idx].unsealed;
    const now = new Date();
    next[idx] = { 
      ...next[idx], 
      unsealed: isNowUnsealed,
      unsealTimestamp: isNowUnsealed ? now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : undefined,
      unsealTimeISO: isNowUnsealed ? now.toISOString() : undefined
    };
    setTrips(next);
  };

  const activeEmployeesCount = employees.filter(e => e.active).length;
  const assignedCount = assignments.filter(a => a.employeeId !== 'diarista-id').length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-end">
        <div className="flex flex-wrap gap-4 items-end w-full md:w-auto">
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
            <div className="relative">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500" />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Volumetria</label>
            <div className="relative">
              <input type="number" value={volume} readOnly className="pl-3 pr-8 py-2 bg-slate-100 text-slate-700 font-bold border border-slate-300 rounded-lg text-sm w-full cursor-not-allowed" />
              <Calculator className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
            </div>
          </div>
          <div className="w-20">
            <label className="block text-xs font-medium text-slate-500 mb-1">Carretas</label>
            <input type="number" value={trucks} onChange={(e) => setTrucks(Number(e.target.value))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
              Diaristas
              <UserPlus className="w-3 h-3 text-emerald-500" />
            </label>
            <input 
              type="number" 
              min="0"
              max="10"
              value={diaristas} 
              onChange={(e) => setDiaristas(Math.max(0, Number(e.target.value)))} 
              className="px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-emerald-500" 
            />
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <button 
             onClick={handleSmartSchedule} 
             disabled={processing} 
             className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
           >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Distribuir Equipe
          </button>
          <button onClick={handleSave} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-700">Equipe Alocada</span>
              <span className="text-xs font-bold text-slate-500">{assignedCount} / {activeEmployeesCount}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${assignedCount >= activeEmployeesCount ? 'bg-green-500' : 'bg-indigo-500'}`} 
                style={{ width: `${activeEmployeesCount > 0 ? (assignedCount / activeEmployeesCount) * 100 : 0}%` }} 
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-[11px] text-amber-800 space-y-2">
            <div className="flex items-center gap-2 font-bold uppercase mb-1">
              <Info className="w-3 h-3" /> Regras do Sistema
            </div>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Diaristas:</strong> 2 primeiros na Descarga. <strong>TODO O RESTANTE</strong> vai para o Ensacamento (slots extras criados).</li>
              <li><strong>Diaristas NUNCA</strong> ficam no posto "Solto".</li>
              <li><strong>Edina:</strong> Reserva fixa no "Solto".</li>
              <li><strong>Alex:</strong> Prioridade máxima para ficar "Solto".</li>
              <li><strong>Vitória/Sofia:</strong> Preferência secundária para o "Solto".</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Container className="w-4 h-4 text-slate-500" /> Viagens
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {trips.length > 0 ? trips.map((trip, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={trip.id} onChange={(e) => handleTripChange(idx, e.target.value)} placeholder="ID" className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded uppercase font-mono outline-none focus:ring-1 focus:ring-indigo-500" />
                    <input type="number" value={trip.volume || ''} onChange={(e) => handleTripVolumeChange(idx, e.target.value)} placeholder="Vol" className="w-20 px-2 py-1 text-sm border border-slate-300 rounded outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <button onClick={() => toggleTripUnsealed(idx)} className={`p-2 rounded border transition-colors ${trip.unsealed ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {trip.unsealed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleRemoveTrip(idx)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )) : (
                <p className="text-center py-4 text-xs text-slate-400 italic">Nenhuma viagem registrada</p>
              )}
              {trips.length < 5 && (
                <button onClick={handleAddTrip} className="w-full py-2 border-dashed border border-indigo-300 text-indigo-600 rounded text-xs font-medium hover:bg-indigo-50 transition-colors">+ Adicionar Viagem</button>
              )}
            </div>
          </div>
        </div>

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