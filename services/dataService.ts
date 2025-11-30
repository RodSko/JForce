import { supabase } from '../lib/supabase';
import { Employee, DailyRecord } from '../types';

export const dataService = {
  // --- Employees ---

  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async createEmployee(employee: Employee): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .insert(employee);
    
    if (error) throw error;
  },

  async updateEmployee(employee: Employee): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({ name: employee.name, active: employee.active })
      .eq('id', employee.id);
    
    if (error) throw error;
  },

  // --- Daily Records ---

  async getHistory(): Promise<DailyRecord[]> {
    const { data, error } = await supabase
      .from('daily_records')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Sanitize data to ensure arrays are never null/undefined
    return (data || []).map((record: any) => ({
      id: record.id,
      date: record.date,
      volume: record.volume,
      trucks: record.trucks,
      assignments: Array.isArray(record.assignments) ? record.assignments : [],
      trips: Array.isArray(record.trips) ? record.trips : []
    }));
  },

  async saveDailyRecord(record: DailyRecord): Promise<void> {
    // Upsert (Insert or Update) based on ID (date)
    const { error } = await supabase
      .from('daily_records')
      .upsert({
        id: record.id,
        date: record.date,
        volume: record.volume,
        trucks: record.trucks,
        assignments: record.assignments || [],
        trips: record.trips || []
      });

    if (error) throw error;
  }
};