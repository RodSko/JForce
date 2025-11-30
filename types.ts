export interface Employee {
  id: string;
  name: string;
  active: boolean;
}

export enum TaskCategory {
  UNLOAD = 'Descarregar',
  TURN = 'Virar Pacote',
  FISHING = 'Pescar Rota',
  BAGGING = 'Ensacar'
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string; // The specific routes or details
  category: TaskCategory;
  capacity: number; // How many people needed
}

export interface Assignment {
  taskId: string;
  employeeId: string;
  slotIndex: number; // For tasks with multiple people, which slot (0, 1, etc)
}

export interface TripInfo {
  id: string; // 15 chars alphanumeric
  unsealed: boolean; // deslacrada
  unsealTimestamp?: string; // Data e hora do deslacre
}

export interface DailyRecord {
  id: string; // YYYY-MM-DD
  date: string;
  volume: number;
  trucks: number;
  assignments: Assignment[];
  trips?: TripInfo[];
}

export interface AIRecommendation {
  rationale: string;
  assignments: { taskId: string; slotIndex: number; employeeName: string }[];
}