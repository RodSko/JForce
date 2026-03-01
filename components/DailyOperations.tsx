import React, { useState, useEffect, useRef } from 'react';
import { DailyRecord, Employee, TaskDefinition, Assignment, TripInfo } from '../types';
import { TASK_DEFINITIONS } from '../constants';
import AssignmentCard from './AssignmentCard';
import { Save, Calendar, Unlock, Lock, Container, Trash2, Calculator, RefreshCw, Info, Loader2, UserPlus, ImageDown, Share2, Plus, BarChart3 } from 'lucide-react';
import { calculateAutoRotation } from '../services/rotationService';
import html2canvas from 'html2canvas';

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
  const [isExporting, setIsExporting] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

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
    }
  }, [trips]);

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
        const currentVolume = Number(volume) || 0;
        const newAssignments = calculateAutoRotation(employees, history, assignments, diaristas, currentVolume);
        setAssignments(newAssignments);
      } finally {
        setProcessing(false);
      }
    }, 400);
  };

  const handleSave = () => {
    const record: DailyRecord = {
      id: date,
      date,
      volume: Number(volume) || 0,
      trucks: Number(trucks) || 0,
      diaristaCount: diaristas,
      assignments,
      trips: trips.filter(t => t.id.trim() !== '')
    };
    onSaveRecord(record);
    alert("Dados salvos com sucesso!");
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 600));

    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2.5,
        logging: false,
        useCORS: true,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
           const container = clonedDoc.querySelector('[data-report-container]') as HTMLElement;
           if (container) {
             container.style.width = '1200px';
             container.style.padding = '40px';
           }
        }
      });

      const image = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement('a');
      const [y, m, d] = date.split('-');
      link.download = `ESCALA_${d}_${m}_${y}.png`;
      link.href = image;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddTrip = () => setTrips(prev => [...prev, { id: '', unsealed: false }]);
  const handleRemoveTrip = (idx: number) => setTrips(prev => prev.filter((_, i) => i !== idx));
  
  const handleTripChange = (idx: number, id: string) => {
    const next = [...trips];
    next[idx] = { ...next[idx], id: id.toUpperCase() };
    setTrips(next);
  };

  const handleTripVolumeChange = (idx: number, vol: string) => {
    const next = [...trips];
    next[idx] = { ...next[idx], volume: vol === '' ? undefined : Number(vol) };
    setTrips(next);
  };

  const toggleUnseal = (idx: number) => {
    const next = [...trips];
    const isUnsealing = !next[idx].unsealed;
    const now = new Date();
    next[idx] = { 
      ...next[idx], 
      unsealed: isUnsealing,
      unsealTimestamp: isUnsealing ? now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : undefined
    };
    setTrips(next);
  };

  const activeEmployeesCount = employees.filter(e => e.active).length;
  // Correção: Apenas contar se o ID for válido e não for diarista
  const assignedCount = assignments.filter(a => a.employeeId && a.employeeId !== 'diarista-id').length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-6 items-end justify-between" data-html2canvas-ignore>
        <div className="flex flex-wrap gap-5 items-end">
          <div className="w-44">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data Operação</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="w-28">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Diaristas</label>
            <input type="number" min="0" value={diaristas} onChange={(e) => setDiaristas(Number(e.target.value))} className="w-full px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-xl text-sm font-black text-emerald-700 outline-none" />
          </div>
          <div className="w-40">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Volumetria Total</label>
            <div className="relative">
              <input 
                type="number" 
                min="0" 
                value={volume} 
                onChange={(e) => setVolume(e.target.value === '' ? '' : Number(e.target.value))} 
                className="w-full pl-3 pr-10 py-2 border border-indigo-200 bg-indigo-50 rounded-xl text-sm font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20" 
                placeholder="0"
              />
              <BarChart3 className="w-4 h-4 text-indigo-300 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>
          <div className="w-28">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Carretas</label>
            <input type="number" min="0" value={trucks} onChange={(e) => setTrucks(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleSmartSchedule} disabled={processing} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition-all disabled:opacity-50">
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            DISTRIBUIR
          </button>
          <button onClick={handleExportImage} disabled={isExporting} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-black hover:bg-black transition-all">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
            PNG
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-black hover:bg-blue-700 transition-all">
            <Save className="w-4 h-4" /> SALVAR
          </button>
        </div>
      </div>

      <div ref={reportRef} data-report-container className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-[1200px] mx-auto">
        <div className="flex justify-between items-start mb-8 border-b-4 border-slate-900 pb-8">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">ESCALA OPERACIONAL</h1>
            <div className="flex items-center gap-2 mt-3">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span className="text-lg font-black text-slate-700 uppercase tracking-tighter">
                {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl text-center min-w-[140px] shadow-lg">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volumetria Total</p>
              <p className="text-4xl font-black text-white leading-none tracking-tighter">{volume || 0}</p>
            </div>
            <div className="bg-white border-4 border-slate-900 p-4 rounded-2xl text-center min-w-[140px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Carretas</p>
              <p className="text-4xl font-black text-slate-900 leading-none tracking-tighter">{trucks || 0}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-4 space-y-6">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="p-1 bg-white rounded shadow-sm">
                  <Info className="w-4 h-4 text-indigo-600" />
                </div>
                RESUMO EQUIPE
              </h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-black mb-1.5 uppercase">
                    <span className="text-slate-500">Alocação Atual</span>
                    <span className="text-indigo-600">{assignedCount} / {activeEmployeesCount}</span>
                  </div>
                  <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                    <div className="h-full bg-indigo-600 transition-all shadow-[0_0_8px_rgba(79,70,229,0.3)]" style={{ width: `${(assignedCount/activeEmployeesCount)*100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Container className="w-4 h-4 text-indigo-400" /> CONTROLE DE VIAGENS
                </h4>
                <button onClick={handleAddTrip} className="text-white hover:text-indigo-300 p-1" data-html2canvas-ignore>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {trips.map((trip, idx) => (
                  <div key={idx} className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5">ID VIAGEM</label>
                        {isExporting ? (
                          <div className="px-2 py-1.5 bg-slate-50 rounded border border-slate-200 text-xs font-black text-slate-900 uppercase">
                            {trip.id || '---'}
                          </div>
                        ) : (
                          <input type="text" value={trip.id} onChange={(e) => handleTripChange(idx, e.target.value)} placeholder="ID" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-black text-slate-900 uppercase focus:ring-1 focus:ring-indigo-500 outline-none" />
                        )}
                      </div>
                      <div className="w-20">
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-0.5">VOLUME</label>
                        {isExporting ? (
                          <div className="px-2 py-1.5 bg-indigo-50 rounded border border-indigo-100 text-xs font-black text-indigo-700 text-center">
                            {trip.volume || 0}
                          </div>
                        ) : (
                          <input type="number" value={trip.volume || ''} onChange={(e) => handleTripVolumeChange(idx, e.target.value)} placeholder="0" className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-black text-indigo-600 text-center focus:ring-1 focus:ring-indigo-500 outline-none" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toggleUnseal(idx)} 
                          className={`p-1.5 rounded-lg border transition-all ${trip.unsealed ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                          title={trip.unsealed ? 'Deslacrado' : 'Lacrado'}
                          disabled={isExporting}
                        >
                          {trip.unsealed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <div>
                          <p className={`text-[10px] font-black uppercase leading-none ${trip.unsealed ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {trip.unsealed ? 'DESLACRADO' : 'AGUARDANDO'}
                          </p>
                          {trip.unsealed && (
                            <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">HORA: {trip.unsealTimestamp}</p>
                          )}
                        </div>
                      </div>
                      {!isExporting && (
                        <button onClick={() => handleRemoveTrip(idx)} className="text-slate-300 hover:text-red-500 p-1" data-html2canvas-ignore>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {trips.length === 0 && <p className="text-center py-6 text-[10px] text-slate-400 font-black uppercase tracking-widest italic">Nenhuma viagem ativa</p>}
              </div>
            </div>
          </div>

          <div className="col-span-8">
            <div className="grid grid-cols-2 gap-5">
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

        <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center opacity-50">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">LogiTeam Manager &copy; 2025</span>
           <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RELATÓRIO OPERACIONAL FINALIZADO</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DailyOperations;