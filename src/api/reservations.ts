import apiClient from './client';

export type OccupantType = 'INDIVIDUAL' | 'PAREJA' | 'MULTIPLE_PERSON';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

export interface ReservationCompanion {
  name: string;
  documentNumber?: string;
  phone?: string;
}

export interface CreateReservationDTO {
  firstName: string;
  lastName?: string;
  phone: string;
  roomTypeId: string;
  checkInDate: string;       // 'YYYY-MM-DD'
  checkOutDate: string;      // 'YYYY-MM-DD'
  numberOfGuests: number;
  occupantType: OccupantType;
  approximateArrivalTime?: string;
  depositAmount?: number;
  specialRequests?: string;
  companions?: ReservationCompanion[];
}

export interface ReservationResponse {
  id: string;
  reservationNumber: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  guestHasObservations: boolean;
  roomTypeId: string;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  numberOfGuests: number;
  occupantType: OccupantType;
  approximateArrivalTime: string | null;
  status: ReservationStatus;
  statusLabel: string;
  depositAmount: number | null;
  depositPaid: boolean;
  estimatedTotal: number;
  specialRequests: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string | null;
  companions: ReservationCompanion[];
}

export const reservationsApi = {
  create: (data: CreateReservationDTO) =>
    apiClient.post<ReservationResponse>('/reservations', data).then(r => r.data),

  getByPhone: (phone: string) =>
    apiClient.get<ReservationResponse[]>(`/reservations/phone/${phone}`).then(r => r.data),

  getByNumber: (number: string) =>
    apiClient.get<ReservationResponse>(`/reservations/number/${number}`).then(r => r.data),

  getById: (id: string) =>
    apiClient.get<ReservationResponse>(`/reservations/${id}`).then(r => r.data),

  getTodayCheckIns: () =>
    apiClient.get<ReservationResponse[]>('/reservations/today/check-ins').then(r => r.data),

  getTodayCheckOuts: () =>
    apiClient.get<ReservationResponse[]>('/reservations/today/check-outs').then(r => r.data),

  cancel: (id: string) =>
    apiClient.delete(`/reservations/${id}/cancel`).then(r => r.data),
};