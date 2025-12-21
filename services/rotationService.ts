import { Employee, TaskDefinition, DailyRecord, Assignment, TaskCategory } from '../types';
import { TASK_DEFINITIONS } from '../constants';

/**
 * Algoritmo de Escalonamento Automático Baseado em Regras
 * 1. Respeita alocações manuais.
 * 2. Aloca Diaristas: 2 na Descarga, TODO O RESTO no Ensacamento (sem limite).
 * 3. Reserva 'Edina' fixamente para 'Solto'.
 * 4. Dá preferência a 'Alex' (P1) e 'Vitória/Sofia' (P2) para 'Solto'.
 * 5. Preenche postos obrigatórios restantes por prioridade.
 */
export const calculateAutoRotation = (
  employees: Employee[],
  history: DailyRecord[],
  currentAssignments: Assignment[],
  diaristaCount: number = 0
): Assignment[] => {
  const activeEmployees = employees.filter(e => e.active);
  const manualAssignments = currentAssignments.filter(a => a.isManual);
  const manualEmployeeIds = new Set(manualAssignments.map(a => a.employeeId));
  let availablePool = activeEmployees.filter(e => !manualEmployeeIds.has(e.id));

  const normalize = (name: string) => 
    name.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  
  // Reservas Especiais de Funcionários
  const edina = availablePool.find(e => normalize(e.name) === 'edina');
  let reservedStrictlyForSolto: Employee[] = [];
  if (edina) {
    reservedStrictlyForSolto.push(edina);
    availablePool = availablePool.filter(e => e.id !== edina.id);
  }

  const p1Names = ['alex'];
  let poolP1 = availablePool.filter(e => p1Names.includes(normalize(e.name)));
  
  const p2Names = ['vitoria', 'sofia'];
  let poolP2 = availablePool.filter(e => p2Names.includes(normalize(e.name)));
  
  let standardPool = availablePool.filter(e => 
    !p1Names.includes(normalize(e.name)) && 
    !p2Names.includes(normalize(e.name))
  );

  const newAssignments: Assignment[] = [...manualAssignments];
  let diaristasRemaining = diaristaCount;

  // --- REGRA DE DIARISTAS ---
  
  // 1. Primeiros 2 Diaristas -> Descarga (task-unload)
  const unloadTask = TASK_DEFINITIONS.find(t => t.id === 'task-unload');
  if (unloadTask) {
    for (let i = 0; i < unloadTask.capacity; i++) {
      const isOccupied = newAssignments.some(a => a.taskId === unloadTask.id && a.slotIndex === i);
      if (!isOccupied && diaristasRemaining > 0) {
        newAssignments.push({ taskId: unloadTask.id, slotIndex: i, employeeId: 'diarista-id', isManual: false });
        diaristasRemaining--;
      }
    }
  }

  // 2. TODO O RESTANTE dos Diaristas -> Ensacamento (task-bagging)
  // Independente da capacidade original, o ensacamento absorve todos
  const baggingTask = TASK_DEFINITIONS.find(t => t.id === 'task-bagging');
  if (baggingTask && diaristasRemaining > 0) {
    let slotIdx = 0;
    while (diaristasRemaining > 0) {
      // Procura o próximo slot vago (respeitando manuais)
      const isOccupied = newAssignments.some(a => a.taskId === baggingTask.id && a.slotIndex === slotIdx);
      if (!isOccupied) {
        newAssignments.push({ taskId: baggingTask.id, slotIndex: slotIdx, employeeId: 'diarista-id', isManual: false });
        diaristasRemaining--;
      }
      slotIdx++;
    }
  }

  // --- FIM REGRA DE DIARISTAS ---

  // Slots vazios restantes em tarefas obrigatórias (excluindo Solto)
  const taskSlots: { taskId: string; slotIndex: number; category: TaskCategory; priority: number }[] = [];
  TASK_DEFINITIONS.forEach(task => {
    if (task.category !== TaskCategory.SOLTO) {
      // Para o ensacamento, a capacidade pode ter sido estourada pelos diaristas, 
      // então só geramos slots de funcionários se ainda estiver dentro da capacidade original
      for (let i = 0; i < task.capacity; i++) {
        const isOccupied = newAssignments.some(a => a.taskId === task.id && a.slotIndex === i);
        if (!isOccupied) {
          let priority = 3;
          if (task.category === TaskCategory.TURN) priority = 1; 
          else if (task.category === TaskCategory.UNLOAD) priority = 2;
          taskSlots.push({ taskId: task.id, slotIndex: i, category: task.category, priority });
        }
      }
    }
  });

  taskSlots.sort((a, b) => a.priority - b.priority);

  const getTaskHistoryScore = (employeeId: string, taskId: string): number => {
    const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (let i = 0; i < sortedHistory.length; i++) {
      if (sortedHistory[i].assignments.some(a => a.employeeId === employeeId && a.taskId === taskId)) {
        return i;
      }
    }
    return 999;
  };

  // Preencher slots obrigatórios com funcionários fixos
  taskSlots.forEach(slot => {
    let currentCandidatesPool: Employee[] = [];
    if (standardPool.length > 0) currentCandidatesPool = standardPool;
    else if (poolP2.length > 0) currentCandidatesPool = poolP2;
    else currentCandidatesPool = poolP1;
    
    if (currentCandidatesPool.length === 0) return;

    let candidates = currentCandidatesPool.filter(emp => {
      if ((slot.category === TaskCategory.TURN || slot.category === TaskCategory.UNLOAD) && emp.gender === 'F') return false;
      return true;
    });

    if (candidates.length === 0) {
      const fallbackPools = [poolP2, poolP1];
      for (const fPool of fallbackPools) {
        candidates = fPool.filter(emp => {
          if ((slot.category === TaskCategory.TURN || slot.category === TaskCategory.UNLOAD) && emp.gender === 'F') return false;
          return true;
        });
        if (candidates.length > 0) break;
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => getTaskHistoryScore(b.id, slot.taskId) - getTaskHistoryScore(a.id, slot.taskId));
      const chosen = candidates[0];
      newAssignments.push({ taskId: slot.taskId, slotIndex: slot.slotIndex, employeeId: chosen.id, isManual: false });
      standardPool = standardPool.filter(e => e.id !== chosen.id);
      poolP2 = poolP2.filter(e => e.id !== chosen.id);
      poolP1 = poolP1.filter(e => e.id !== chosen.id);
    }
  });

  // Alocar funcionários que sobraram no Solto
  const soltoTask = TASK_DEFINITIONS.find(t => t.category === TaskCategory.SOLTO);
  if (soltoTask) {
    const finalSoltos = [...reservedStrictlyForSolto, ...poolP1, ...poolP2, ...standardPool];
    
    finalSoltos.forEach((emp) => {
      let slotIdx = 0;
      while (newAssignments.some(a => a.taskId === soltoTask.id && a.slotIndex === slotIdx)) slotIdx++;
      newAssignments.push({ taskId: soltoTask.id, slotIndex: slotIdx, employeeId: emp.id, isManual: false });
    });
  }

  return newAssignments;
};