// src/types/financials.ts

export interface DailyRow {
  day: number;
  planilla: number;
  venta: number;
  gastos: number;
  compraVitrina: number;
  aseo: number;
  mantenimiento: number;
  servicios: number;
  empleados: number;
  iva: number;
  baucher: number;
  nequi: number;
  transferencia: number;
  efectivo: number;
  totalIngresos: number;
  totalEgresos: number;
}

export interface EmployeePayRow {
  employeeName: string;
  total: number;
}

export interface ServiceRow {
  motivo: string;
  total: number;
}

export interface MonthlyFinancialResponse {
  year: number;
  month: number;
  monthLabel: string;
  totalPlanilla: number;
  totalVenta: number;
  totalIngresos: number;
  totalGastos: number;
  totalCompraVitrina: number;
  totalAseo: number;
  totalMantenimiento: number;
  totalServicios: number;
  totalEmpleados: number;
  totalIva: number;
  totalEgresos: number;
  totalEfectivo: number;
  totalBaucher: number;
  totalNequi: number;
  totalTransferencia: number;
  totalQr: number;
  utilidadNeta: number;
  dias: DailyRow[];
  nomina: EmployeePayRow[];
  servicios: ServiceRow[];
}

export interface MonthSummary {
  year: number;
  month: number;
  monthLabel: string;
  totalIngresos: number;
  totalPlanilla: number;
  totalVenta: number;
  totalEgresos: number;
  totalGastos: number;
  totalEmpleados: number;
  totalServicios: number;
  utilidadNeta: number;
  diasConIngresos: number;
}

export interface FinancialSummaryResponse {
  meses: MonthSummary[];
}