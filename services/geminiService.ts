import { GoogleGenAI, Type } from "@google/genai";
import { Employee, TaskDefinition, DailyRecord } from '../types';
import { TASK_DEFINITIONS } from '../constants';

export const generateScheduleSuggestion = async (
  employees: Employee[],
  history: DailyRecord[],
  targetDate: string
) => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare context for the model
  const activeEmployees = employees.filter(e => e.active).map(e => e.name);
  
  // Summarize last 5 days to help rotation
  const recentHistory = history
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map(record => ({
      date: record.date,
      assignments: record.assignments.map(a => {
        const taskName = TASK_DEFINITIONS.find(t => t.id === a.taskId)?.name || a.taskId;
        const empName = employees.find(e => e.id === a.employeeId)?.name || "Unknown";
        return `${empName} -> ${taskName}`;
      })
    }));

  const prompt = `
    You are a logistics manager AI.
    We have ${activeEmployees.length} active employees: ${activeEmployees.join(', ')}.
    
    We need to assign them to the following tasks for date ${targetDate}:
    ${JSON.stringify(TASK_DEFINITIONS.map(t => ({ id: t.id, name: t.name, capacity: t.capacity })))}
    
    Recent History (last 5 days) for rotation context:
    ${JSON.stringify(recentHistory)}
    
    GOAL: Create a fair daily roster. Rotate employees so they don't do the same hard task (like Unloading) every day.
    Ensure every task slot is filled. Total slots needed: 16.
    
    Return a JSON object with a 'rationale' string explaining the rotation logic, and an 'assignments' array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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