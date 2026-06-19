import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

export interface PaymentMethodOption {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

async function fetchPaymentMethods(): Promise<PaymentMethodOption[]> {
  const { data } = await apiClient.get<PaymentMethodOption[]>('payment-methods/active');
  return data;
}

export function usePaymentMethods() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: fetchPaymentMethods,
    staleTime: 5 * 60 * 1000, // 5 minutos — no cambian seguido
  });

  /** Lista para <select> / botones: { value: code, label } */
  const options = data.map(pm => ({ value: pm.code, label: pm.label }));

  /** Record code → label para mostrar labels en listas/tablas */
  const labelMap: Record<string, string> = Object.fromEntries(
    data.map(pm => [pm.code, pm.label])
  );

  /** Resuelve un código a su label, con fallback al código si no existe */
  function getLabel(code: string | null | undefined): string {
    if (!code) return '—';
    return labelMap[code] ?? code;
  }

  return { options, labelMap, getLabel, isLoading, error };
}