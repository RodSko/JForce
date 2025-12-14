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
  volume?: number; // Volumetria específica da viagem
  unsealed: boolean; // deslacrada
  unsealTimestamp?: string; // Data e hora do deslacre (Formatado para exibição)
  unsealTimeISO?: string; // Data ISO para cálculos de timer
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

export interface SupplyItem {
  id: string;
  name: string;
  quantity: number;
  unit: string; // ex: 'un', 'cx', 'rolo'
  minStock: number;
}

export interface SupplyTransaction {
  id: string;
  supplyId: string;
  supplyName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string; // ISO String
  user: string; // Quem retirou ou quem adicionou
}

export interface EpiItem {
  id: string;
  name: string;
  caNumber: string; // Certificado de Aprovação
  quantity: number;
  minStock: number;
  validityDays?: number; // Validade média em dias para troca
}

export interface EpiTransaction {
  id: string;
  epiId: string;
  epiName: string;
  type: 'IN' | 'OUT'; // IN = Compra/Estoque, OUT = Entrega funcionário
  quantity: number;
  date: string;
  employeeId?: string; // ID do funcionário que recebeu
  employeeName: string; // Nome do funcionário ou 'Estoque Inicial'
  notes?: string;
}