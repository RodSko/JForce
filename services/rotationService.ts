import { Employee, TaskDefinition, DailyRecord, Assignment, TaskCategory } from '../types';
import { TASK_DEFINITIONS } from '../constants';

/**
 * Algoritmo de Escalonamento Automático LogiTeam v2.0
 * 
 * PRIORIDADES PARA FICAR SOLTO (RESERVA):
 * 1. EDINA: Fixa (Nunca sai do Solto)
 * 2. ALEX: Prioridade Máxima (Só sai do Solto se não houver MAIS NINGUÉM disponível)
 * 3. VITÓRIA / SOFIA: Prioridade Alta (Só saem do Solto se os funcionários padrão acabarem)
 */
export const calculateAutoRotation = (
  employees: Employee[],
  history: DailyRecord[],
  currentAssignments: Assignment[],
  diaristaCount: number = 0,
  volume: number = 0
): Assignment[] => {
  const activeEmployees = employees.filter(e => e.active);
  const manualAssignments = currentAssignments.filter(a => a.isManual);
  const manualEmployeeIds = new Set(manualAssignments.map(a => a.employeeId));
  
  // Pool de funcionários disponíveis (sem os manuais)
  let availablePool = activeEmployees.filter(e => !manualEmployeeIds.has(e.id));

  const normalize = (name: string) => 
    name.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  
  // Regra de Elite para Virada (Volume Alto)
  const eliteTurnTeam = ['gabriel', 'cleverton', 'jamisson', 'robson', 'ryan', 'pedro'];
  const isHighVolume = volume > 12000;

  // 1. Identificar e Separar Grupos de Prioridade
  const edina = availablePool.find(e => normalize(e.name) === 'edina');
  if (edina) availablePool = availablePool.filter(e => e.id !== edina.id);

  const p1Names = ['alex'];
  const poolP1 = availablePool.filter(e => p1Names.includes(normalize(e.name)));
  
  const p2Names = ['vitoria', 'sofia'];
  const poolP2 = availablePool.filter(e => p2Names.includes(normalize(e.name)));
  
  // O pool padrão são todos que não são P1 nem P2
  let standardPool = availablePool.filter(e => 
    !p1Names.includes(normalize(e.name)) && 
    !p2Names.includes(normalize(e.name))
  );

  const newAssignments: Assignment[] = [...manualAssignments];
  let diaristasRemaining = diaristaCount;

  // --- REGRA DE DIARISTAS (Prioridade Total em Descarga e Ensacar) ---
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

  const baggingTask = TASK_DEFINITIONS.find(t => t.id === 'task-bagging');
  if (baggingTask && diaristasRemaining > 0) {
    let slotIdx = 0;
    while (diaristasRemaining > 0) {
      const isOccupied = newAssignments.some(a => a.taskId === baggingTask.id && a.slotIndex === slotIdx);
      if (!isOccupied) {
        newAssignments.push({ taskId: baggingTask.id, slotIndex: slotIdx, employeeId: 'diarista-id', isManual: false });
        diaristasRemaining--;
      }
      slotIdx++;
    }
  }

  // --- DEFINIÇÃO DE SLOTS OBRIGATÓRIOS (EXCETO SOLTO) ---
  const taskSlots: { taskId: string; slotIndex: number; category: TaskCategory; priority: number }[] = [];
  TASK_DEFINITIONS.forEach(task => {
    if (task.category !== TaskCategory.SOLTO) {
      for (let i = 0; i < task.capacity; i++) {
        const isOccupied = newAssignments.some(a => a.taskId === task.id && a.slotIndex === i);
        if (!isOccupied) {
          // Virada e Descarga são prioridades máximas de preenchimento
          let priority = 3;
          if (task.category === TaskCategory.TURN) priority = 1; 
          else if (task.category === TaskCategory.UNLOAD) priority = 2;
          taskSlots.push({ taskId: task.id, slotIndex: i, category: task.category, priority });
        }
      }
    }
  });

  // Ordenar slots por criticidade (Virada > Descarga > Outros)
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

  // Preencher slots seguindo a hierarquia de disponibilidade
  taskSlots.forEach(slot => {
    // Ordem de preferência de quem vai TRABALHAR na tarefa:
    // 1. Standard (Geral)
    // 2. Pool P2 (Vitória/Sofia) - Só se Standard acabar
    // 3. Pool P1 (Alex) - Só se TUDO acabar
    
    const priorityBuckets = [standardPool, poolP2, poolP1];
    let chosen: Employee | null = null;

    for (const bucket of priorityBuckets) {
      let candidates = bucket.filter(emp => {
        // Restrição de Gênero para Descarga e Virada
        if ((slot.category === TaskCategory.TURN || slot.category === TaskCategory.UNLOAD) && emp.gender === 'F') return false;
        
        // Regra de Elite para Virada se Volume > 12000
        if (isHighVolume && slot.category === TaskCategory.TURN) {
          return eliteTurnTeam.includes(normalize(emp.name));
        }
        
        return true;
      });

      if (candidates.length > 0) {
        // Rotacionar baseado no histórico (quem não fez essa tarefa há mais tempo)
        candidates.sort((a, b) => getTaskHistoryScore(b.id, slot.taskId) - getTaskHistoryScore(a.id, slot.taskId));
        chosen = candidates[0];
        break; 
      }
    }

    if (chosen) {
      newAssignments.push({ taskId: slot.taskId, slotIndex: slot.slotIndex, employeeId: chosen.id, isManual: false });
      
      // Remover dos pools para não duplicar
      const id = chosen.id;
      standardPool = standardPool.filter(e => e.id !== id);
      const idxP2 = poolP2.findIndex(e => e.id === id);
      if (idxP2 > -1) poolP2.splice(idxP2, 1);
      const idxP1 = poolP1.findIndex(e => e.id === id);
      if (idxP1 > -1) poolP1.splice(idxP1, 1);
    }
  });

  // --- TUDO O QUE SOBROU VAI PARA O SOLTO ---
  const soltoTask = TASK_DEFINITIONS.find(t => t.category === TaskCategory.SOLTO);
  if (soltoTask) {
    // Edina entra aqui primeiro por ser fixa
    const leftovers = [];
    if (edina) leftovers.push(edina);
    leftovers.push(...poolP1, ...poolP2, ...standardPool);

    leftovers.forEach((emp) => {
      let slotIdx = 0;
      while (newAssignments.some(a => a.taskId === soltoTask.id && a.slotIndex === slotIdx)) slotIdx++;
      newAssignments.push({ taskId: soltoTask.id, slotIndex: slotIdx, employeeId: emp.id, isManual: false });
    });
  }

  return newAssignments;
};