import { supabase } from '../lib/supabase';
import { Employee, DailyRecord, SupplyItem, SupplyTransaction, EpiItem, EpiTransaction } from '../types';

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
  },

  // --- Supplies ---

  async getSupplies(): Promise<SupplyItem[]> {
    const { data, error } = await supabase
      .from('supplies')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit,
      minStock: Number(item.min_stock)
    }));
  },

  async saveSupply(item: SupplyItem): Promise<void> {
    const { error } = await supabase
      .from('supplies')
      .upsert({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        min_stock: item.minStock
      });
    
    if (error) throw error;
  },

  async deleteSupply(id: string): Promise<void> {
    // 1. Tentar excluir transações primeiro
    const { error: transError } = await supabase
      .from('supply_transactions')
      .delete()
      .eq('supply_id', id);
    
    if (transError) {
       console.error("Erro ao limpar transações de insumo (não fatal se CASCADE existir):", transError);
    }

    // 2. Excluir o item principal
    const { error } = await supabase
      .from('supplies')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Não foi possível excluir o item: ${error.message} (${error.details || ''})`);
    }
  },

  // --- Supply Transactions ---

  async getSupplyTransactions(): Promise<SupplyTransaction[]> {
    const { data, error } = await supabase
      .from('supply_transactions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((item: any) => ({
      id: item.id,
      supplyId: item.supply_id,
      supplyName: item.supply_name,
      type: item.type,
      quantity: Number(item.quantity),
      date: item.date,
      user: item.user_name
    }));
  },

  async addSupplyTransaction(transaction: SupplyTransaction): Promise<void> {
    const { error } = await supabase
      .from('supply_transactions')
      .insert({
        id: transaction.id,
        supply_id: transaction.supplyId,
        supply_name: transaction.supplyName,
        type: transaction.type,
        quantity: transaction.quantity,
        date: transaction.date,
        user_name: transaction.user
      });
    
    if (error) throw error;
  },

  // --- EPIs (PPEs) ---

  async getEpis(): Promise<EpiItem[]> {
    const { data, error } = await supabase
      .from('epis')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      caNumber: item.ca_number || '',
      quantity: Number(item.quantity),
      minStock: Number(item.min_stock),
      validityDays: Number(item.validity_days || 0)
    }));
  },

  async saveEpi(item: EpiItem): Promise<void> {
    const { error } = await supabase
      .from('epis')
      .upsert({
        id: item.id,
        name: item.name,
        ca_number: item.caNumber,
        quantity: item.quantity,
        min_stock: item.minStock,
        validity_days: item.validityDays
      });
    
    if (error) throw error;
  },

  async deleteEpi(id: string): Promise<void> {
    // 1. Tentar excluir transações
    const { error: transError } = await supabase
      .from('epi_transactions')
      .delete()
      .eq('epi_id', id);

    if (transError) {
      console.error("Erro ao limpar transações de EPI:", transError);
    }

    // 2. Excluir EPI
    const { error } = await supabase
      .from('epis')
      .delete()
      .eq('id', id);

    if (error) {
       throw new Error(`Erro ao excluir EPI: ${error.message} (${error.details || ''})`);
    }
  },

  async getEpiTransactions(): Promise<EpiTransaction[]> {
    const { data, error } = await supabase
      .from('epi_transactions')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((item: any) => ({
      id: item.id,
      epiId: item.epi_id,
      epiName: item.epi_name,
      type: item.type,
      quantity: Number(item.quantity),
      date: item.date,
      employeeId: item.employee_id,
      employeeName: item.employee_name,
      notes: item.notes
    }));
  },

  async addEpiTransaction(transaction: EpiTransaction): Promise<void> {
    const { error } = await supabase
      .from('epi_transactions')
      .insert({
        id: transaction.id,
        epi_id: transaction.epiId,
        epi_name: transaction.epiName,
        type: transaction.type,
        quantity: transaction.quantity,
        date: transaction.date,
        employee_id: transaction.employeeId,
        employee_name: transaction.employeeName,
        notes: transaction.notes
      });
    
    if (error) throw error;
  }
};