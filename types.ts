export interface Employee {
  id: string;
  name: string;
  active: boolean;
  gender: 'M' | 'F';
}

export enum TaskCategory {
  UNLOAD = 'Descarregar',
  TURN = 'Virar Pacote',
  FISHING = 'Pescar Rota',
  BAGGING = 'Ensacar',
  SOLTO = 'Solto'
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  capacity: number;
}

export interface Assignment {
  taskId: string;
  employeeId: string;
  slotIndex: number;
  isManual?: boolean;
}

export interface TripInfo {
  id: string;
  volume?: number;
  unsealed: boolean;
  unsealTimestamp?: string;
  unsealTimeISO?: string;
}

export interface DailyRecord {
  id: string;
  date: string;
  volume: number;
  trucks: number;
  diaristaCount: number;
  assignments: Assignment[];
  trips?: TripInfo[];
}

export interface AIRecommendation {
  rationale: string;
  assignments: { taskId: string; slotIndex: number; employeeName: string }[];
}

export interface SupplyItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minStock: number;
}

export interface SupplyTransaction {
  id: string;
  supplyId: string;
  supplyName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  user: string;
}

export interface EpiItem {
  id: string;
  name: string;
  caNumber: string;
  quantity: number;
  minStock: number;
  validityDays?: number;
}

export interface EpiTransaction {
  id: string;
  epiId: string;
  epiName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  employeeId?: string;
  employeeName: string;
  notes?: string;
}

export interface BatchNumber {
  id: string;
  number: string;
  description: string;
  created_at: string;
}