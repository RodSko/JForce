import { Employee, TaskDefinition, DailyRecord, Assignment, TaskCategory } from '../types';
import { TASK_DEFINITIONS } from '../constants';

/**
 * Algoritmo de Escalonamento Automático Baseado em Regras
 */
export const calculateAutoRotation = (
  employees: Employee[],
  history: DailyRecord[],
  currentAssignments: Assignment[]
): Assignment[] => {
  // 1. Identificar colaboradores ativos
  const activeEmployees = employees.filter(e => e.active);
  
  // 2. Separar quem já foi alocado manualmente
  const manualEmployeeIds = new Set(currentAssignments.filter(a => a.isManual).map(a => a.employeeId));
  const availableEmployees = activeEmployees.filter(e => !manualEmployeeIds.has(e.id));

  // 3. Preparar lista de todos os slots vazios (exceto a categoria SOLTO que é o destino final)
  const taskSlots: { taskId: string; slotIndex: number; category: TaskCategory }[] = [];
  TASK_DEFINITIONS.forEach(task => {
    if (task.category !== TaskCategory.SOLTO) {
      for (let i = 0; i < task.capacity; i++) {
        // Verificar se este slot já está ocupado manualmente
        const isOccupied = currentAssignments.some(a => a.taskId === task.id && a.slotIndex === i);
        if (!isOccupied) {
          taskSlots.push({ taskId: task.id, slotIndex: i, category: task.category });
        }
      }
    }
  });

  const newAssignments: Assignment[] = [...currentAssignments.filter(a => a.isManual)];
  let remainingPool = [...availableEmployees];

  // 4. Função para calcular "Score de Prioridade" baseado no histórico
  // Quanto maior o retorno, mais tempo faz que o colaborador não executa a tarefa
  const getTaskPriorityScore = (employeeId: string, taskId: string): number => {
    let daysSince = 999; // Valor alto para quem nunca fez
    
    // Ordenar histórico do mais recente para o mais antigo
    const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (let i = 0; i < sortedHistory.length; i++) {
      const record = sortedHistory[i];
      const wasInTask = record.assignments.some(a => a.employeeId === employeeId && a.taskId === taskId);
      
      if (wasInTask) {
        // Se ele fez a tarefa ontem (primeiro registro do histórico), score 0 (baixa prioridade)
        if (i === 0) return 0;
        return i; // Score é a distância no tempo
      }
    }
    return daysSince;
  };

  // 5. Preencher os slots seguindo as restrições
  taskSlots.forEach(slot => {
    if (remainingPool.length === 0) return;

    // Filtrar candidatos válidos para o slot
    let candidates = remainingPool.filter(emp => {
      // Regra de Gênero: Mulheres não viram pacote
      if (slot.category === TaskCategory.TURN && emp.gender === 'F') {
        return false;
      }
      return true;
    });

    if (candidates.length > 0) {
      // Ordenar candidatos por quem está há mais tempo sem fazer essa tarefa específica (Score)
      candidates.sort((a, b) => {
        const scoreA = getTaskPriorityScore(a.id, slot.taskId);
        const scoreB = getTaskPriorityScore(b.id, slot.taskId);
        return scoreB - scoreA; // Maior score (mais tempo sem fazer) primeiro
      });

      const chosen = candidates[0];
      newAssignments.push({
        taskId: slot.taskId,
        slotIndex: slot.slotIndex,
        employeeId: chosen.id,
        isManual: false
      });

      // Remover do pool de disponíveis
      remainingPool = remainingPool.filter(e => e.id !== chosen.id);
    }
  });

  // 6. Lógica de Excedente: Todos que sobraram vão para "SOLTO"
  const soltoTask = TASK_DEFINITIONS.find(t => t.category === TaskCategory.SOLTO);
  if (soltoTask) {
    remainingPool.forEach((emp, idx) => {
      newAssignments.push({
        taskId: soltoTask.id,
        slotIndex: idx, // No SOLTO o index é incremental para os que sobraram
        employeeId: emp.id,
        isManual: false
      });
    });
  }

  return newAssignments;
};
