import { GoogleGenAI, Type } from "@google/genai";
import { Employee, TaskDefinition, DailyRecord } from '../types';
import { TASK_DEFINITIONS } from '../constants';

export const generateScheduleSuggestion = async (
  employees: Employee[],
  history: DailyRecord[],
  targetDate: string,
  manualAssignments: { taskId: string, slotIndex: number, employeeId: string }[] = []
) => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare context for the model
  const activeEmployees = employees.filter(e => e.active).map(e => ({
    id: e.id,
    name: e.name,
    gender: e.gender
  }));
  
  const recentHistory = history
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map(record => ({
      date: record.date,
      assignments: record.assignments.map(a => {
        const taskName = TASK_DEFINITIONS.find(t => t.id === a.taskId)?.name || a.taskId;
        const empName = employees.find(e => e.id === a.employeeId)?.name || "Unknown";
        return { employeeName: empName, task: taskName, taskId: a.taskId };
      })
    }));

  const prompt = `
    You are a logistics manager AI.
    Active team (${activeEmployees.length} people): ${JSON.stringify(activeEmployees)}.
    
    CRITICAL RULES:
    1. Gender Rule: Females (gender: 'F') CANNOT be assigned to 'Virar Pacote' (task-turn).
    2. Rotation Rule: Employees should not repeat the same task they did recently until they've rotated through others.
    3. Mandatory Slots: Fill slots for these tasks first: ${JSON.stringify(TASK_DEFINITIONS.filter(t => t.id !== 'task-solto').map(t => ({ id: t.id, name: t.name, capacity: t.capacity })))}.
    4. Surplus Logic: If there are more employees than mandatory task slots, assign the remainder to 'Solto / Reserva' (task-solto).
    5. Manual Overrides: These positions are already filled manually (do not change them): ${JSON.stringify(manualAssignments.map(m => {
        const emp = employees.find(e => e.id === m.employeeId);
        return { taskId: m.taskId, slotIndex: m.slotIndex, employeeName: emp?.name };
    }))}.
    
    Recent History for rotation:
    ${JSON.stringify(recentHistory)}
    
    GOAL: Create a fair daily roster for ${targetDate}. Ensure every active employee has a position.
    Return a JSON object with 'rationale' and 'assignments' array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rationale: { type: Type.STRING },
            assignments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  slotIndex: { type: Type.INTEGER },
                  employeeName: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};