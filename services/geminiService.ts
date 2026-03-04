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
    1. Gender Rule: Females (gender: 'F') CANNOT do 'Virar Pacote' or 'Descarregar Carreta'.
    2. EDINA Rule: She must ALWAYS be in 'Solto / Reserva' (task-solto).
    3. ALEX, VITÓRIA and SOFIA Rule (IMPORTANT): 
       - They all prefer 'Solto / Reserva'.
       - ALEX has the highest priority to stay 'Solto'.
       - VITÓRIA and SOFIA have the second highest priority to stay 'Solto'.
       - Only assign them to mandatory tasks (Fishing/Bagging/Unload/Turn) if you run out of all other available employees.
    4. Rotation: Avoid repeating the same task for the same person if possible.
    5. Mandatory: Fill all slots for Fishing and Bagging first.
    6. Completeness: EVERY active employee must be assigned to exactly one task. No one should be left out.
    
    Manual Overrides (Fixed): ${JSON.stringify(manualAssignments)}.
    
    Recent History: ${JSON.stringify(recentHistory)}
    
    GOAL: Create a fair daily roster for ${targetDate}.
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