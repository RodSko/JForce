import { TaskCategory, TaskDefinition, Employee } from './types';

export const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    id: 'task-unload',
    name: 'Descarregar Carreta',
    description: 'Recebimento e descarga',
    category: TaskCategory.UNLOAD,
    capacity: 2
  },
  {
    id: 'task-turn',
    name: 'Virar Pacote',
    description: 'Alinhamento na esteira',
    category: TaskCategory.TURN,
    capacity: 2
  },
  {
    id: 'fish-561-01-02',
    name: 'Rota 561-01 & 561-02',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'fish-561-00',
    name: 'Rota 561-00',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'fish-520-group-1',
    name: 'Rotas 520-00, 520-02, 520-09',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'fish-520-group-2',
    name: 'Rotas 520-10, 520-05, 520-11',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'fish-520-group-3',
    name: 'Rotas 520-07, 520-08',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'fish-560-group-1',
    name: 'Rotas 560-01, 560-02',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'fish-560-group-2',
    name: 'Rotas 560-04, 560-05',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'fish-mixed-group',
    name: 'Rotas 560-07, 562-00',
    description: 'Pesca na esteira',
    category: TaskCategory.FISHING,
    capacity: 1
  },
  {
    id: 'task-bagging',
    name: 'Ensacar',
    description: 'Finalização e embalagem',
    category: TaskCategory.BAGGING,
    capacity: 4 // Assuming 16 employees total - 12 assigned to specific tasks = 4 remaining
  }
];

export const INITIAL_EMPLOYEES: Employee[] = Array.from({ length: 16 }, (_, i) => ({
  id: `emp-${i + 1}`,
  name: `Colaborador ${i + 1}`,
  active: true
}));
