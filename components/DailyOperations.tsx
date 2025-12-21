import React, { useState, useEffect, useRef } from 'react';
import { DailyRecord, Employee, TaskDefinition, Assignment, TripInfo } from '../types';
import { TASK_DEFINITIONS } from '../constants';
import AssignmentCard from './AssignmentCard';
import { Save, Calendar, Unlock, Lock, Container, Trash2, Calculator, RefreshCw, Info, Loader2, UserPlus, ImageDown, Share2, Plus } from 'lucide-react';
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
        const newAssignments = calculateAutoRotation(employees, history, assignments, diaristas);
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
    alert("Dados salvos!");
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 600));

    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1080,
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.download = `Escala_${date}.png`;
      link.href = image;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddTrip = () => setTrips(prev => [...prev, { id: '', unsealed: false }]);
  const handleRemoveTrip = (idx: number) => setTrips(prev => prev.filter((_, i) => i !== idx));

  const activeEmployeesCount = employees.filter(e => e.active).length;
  const assignedCount = assignments.filter(a => a.employeeId !== 'diarista-id').length;

  return (
    <div className="space-y-6">
      {/* Controles de Interface */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end justify-between" data-html2canvas-ignore>
        <div className="flex flex-wrap gap-4">
          <div className="w-40">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diaristas</label>
            <input type="number" value={diaristas} onChange={(e) => setDiaristas(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-emerald-600" />
          </div>
          <div className="w-24">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Carretas</label>
            <input type="number" value={trucks} onChange={(e) => setTrucks(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleSmartSchedule} disabled={processing} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50">
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Distribuir Equipe
          </button>
          <button onClick={handleExportImage} disabled={isExporting} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
            PNG
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all">
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>

      {/* ÁREA DE CAPTURA (PNG) */}
      <div ref={reportRef} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-[1080px] mx-auto">
        {/* Header Profissional */}
        <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">ESCALA OPERACIONAL</h1>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Volumetria</p>
              <p className="text-3xl font-black text-indigo-600 leading-none mt-1">{volume || 0}</p>
            </div>
            <div className="h-10 w-px bg-slate-100 mx-2" />
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carretas</p>
              <p className="text-3xl font-black text-slate-900 leading-none mt-1">{trucks || 0}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Coluna Lateral: Info e Viagens */}
          <div className="col-span-4 space-y-6">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Informações
              </h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-500">Equipe Alocada</span>
                    <span className="text-indigo-600">{assignedCount}/{activeEmployeesCount}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(assignedCount/activeEmployeesCount)*100}%` }} />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Regras Ativas:</p>
                  <ul className="text-[10px] font-bold text-slate-600 space-y-1">
                    <li className="flex items-center gap-2">• Carga Pesada: Exclusivo Masc.</li>
                    <li className="flex items-center gap-2">• Edina: Fixa Reserva</li>
                    <li className="flex items-center gap-2">• Preferencial: Alex, Vitória, Sofia</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <Container className="w-3.5 h-3.5 text-indigo-400" /> Viagens
                </h4>
                <button onClick={handleAddTrip} className="text-white hover:text-indigo-300" data-html2canvas-ignore>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {trips.map((trip, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                      {isExporting ? (trip.id || 'SEM ID') : (
                        <input 
                          type="text" 
                          value={trip.id} 
                          onChange={(e) => {
                            const n = [...trips];
                            n[idx].id = e.target.value.toUpperCase();
                            setTrips(n);
                          }}
                          placeholder="ID VIAGEM"
                          className="bg-transparent w-full outline-none"
                        />
                      )}
                    </div>
                    {!isExporting && (
                      <button onClick={() => handleRemoveTrip(idx)} className="text-slate-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {trips.length === 0 && <p className="text-center py-4 text-[10px] text-slate-400 italic">Nenhuma viagem registrada</p>}
              </div>
            </div>
          </div>

          {/* Grid de Tarefas */}
          <div className="col-span-8">
            <div className="grid grid-cols-2 gap-4">
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

        {/* Rodapé do PNG */}
        <div className="mt-12 pt-6 border-t border-slate-100 flex justify-between items-center opacity-40">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">LogiTeam Manager &copy; 2025</span>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-indigo-500" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Status: Operacional Finalizado</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DailyOperations;