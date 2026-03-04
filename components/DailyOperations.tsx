import React, { useState, useEffect } from 'react';
import { DailyRecord, TripInfo, Employee } from '../types';
import { Plus, Trash2, Lock, Unlock } from 'lucide-react';

const convertDateToBRFormat = (date: Date) => {
  return date.toLocaleDateString('pt-BR');
};

interface DailyOperationsProps {
  employees: Employee[];
  history: DailyRecord[];
  onSaveRecord: (record: DailyRecord) => Promise<boolean>;
}

const DailyOperations: React.FC<DailyOperationsProps> = ({ employees, history, onSaveRecord }) => {
  const [trips, setTrips] = useState<TripInfo[]>([]);
  const [volume, setVolume] = useState('');
  const [trucks, setTrucks] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const record = history.find(r => r.date === date);
    if (record) {
      setTrips(record.trips || []);
      setVolume(String(record.volume || ''));
      setTrucks(String(record.trucks || ''));
    } else {
      setTrips([]);
      setVolume('');
      setTrucks('');
    }
  }, [date, history]);

  const handleAddTrip = () => {
    if (trips.length < 5) {
      setTrips([...trips, { id: '', unsealed: false, unsealTimestamp: '' }]);
    }
  };

  const handleRemoveTrip = (index: number) => {
    setTrips(trips.filter((_, i) => i !== index));
  };

  const handleTripChange = (index: number, value: string) => {
    const newTrips = [...trips];
    newTrips[index].id = value;
    setTrips(newTrips);
  };

  const toggleTripUnsealed = (index: number) => {
    const newTrips = [...trips];
    newTrips[index].unsealed = !newTrips[index].unsealed;
    newTrips[index].unsealTimestamp = newTrips[index].unsealed ? convertDateToBRFormat(new Date()) : '';
    setTrips(newTrips);
    
    // Auto-save
    const recordToSave: DailyRecord = {
      id: date,
      date,
      volume: Number(volume) || 0,
      trucks: Number(trucks) || 0,
      diaristaCount: 0,
      assignments: [],
      trips: newTrips,
    };
    onSaveRecord(recordToSave);
  };

  const handleSave = () => {
    const recordToSave: DailyRecord = {
      id: date,
      date,
      volume: Number(volume) || 0,
      trucks: Number(trucks) || 0,
      diaristaCount: 0,
      assignments: [],
      trips: trips.filter(t => t.id !== ''),
    };
    onSaveRecord(recordToSave);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Operações Diárias - {date}</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">Volumetria</label>
        <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">Carretas</label>
        <input type="number" value={trucks} onChange={(e) => setTrucks(e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">Viagens</label>
        {trips.map((trip, index) => (
          <div key={index} className="flex items-center gap-2 mb-2">
            <input type="text" value={trip.id} onChange={(e) => handleTripChange(index, e.target.value)} className="border border-gray-300 rounded-md p-2 flex-grow" placeholder="ID Viagem" />
            <button onClick={() => toggleTripUnsealed(index)} className={`p-2 rounded ${trip.unsealed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {trip.unsealed ? <Unlock /> : <Lock />}
            </button>
            <button onClick={() => handleRemoveTrip(index)} className="p-2 text-red-600"><Trash2 /></button>
          </div>
        ))}
        <button onClick={handleAddTrip} className="flex items-center gap-2 text-indigo-600 font-medium"><Plus /> Adicionar Viagem</button>
      </div>
      <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-md">Salvar</button>
    </div>
  );
};

export default DailyOperations;
