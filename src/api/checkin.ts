import apiClient from './client';
import type { ReservationResponse } from '../types';

export interface CheckInRequest {
  reservationId: string;
  roomId?: string;
  earlyCheckInOption?: 'PREVIOUS_NIGHT' | 'CURRENT_NIGHT';
  towelsDelivered?: number;
  specialInstructions?: string;
  notes?: string;
}

export interface CheckInResponse {
  checkInId: string;
  reservationId: string;
  reservationNumber: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  floor: number;
  guestName: string;
  guestPhone: string;
  checkInDateTime: string;
  isEarlyCheckIn: boolean;
  earlyCheckInOption?: 'PREVIOUS_NIGHT' | 'CURRENT_NIGHT';
  towelsDelivered: number;
  checkedInBy: string;
  notes?: string;
}

export interface AvailableRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  roomTypeName: string;
}

export const checkInApi = {
  doCheckIn: async (data: CheckInRequest): Promise<CheckInResponse> => {
  console.log('CheckIn payload:', data);  // ← agrega esto
  const res = await apiClient.post('/checkin', data);
  return res.data;
    },
    

  findByReservation: async (reservationId: string): Promise<CheckInResponse> => {
    const res = await apiClient.get(`/checkin/reservation/${reservationId}`);
    return res.data;
  },

  getAvailableRooms: async (roomTypeId?: string): Promise<AvailableRoom[]> => {
    const params = roomTypeId ? { roomTypeId } : {};
    const res = await apiClient.get('/rooms/available', { params });
    return res.data;
  },

  searchByPhone: async (phone: string): Promise<ReservationResponse[]> => {
    const res = await apiClient.get(`/reservations/phone/${phone}`);
    return Array.isArray(res.data) ? res.data : [res.data];
  },

  searchByNumber: async (number: string): Promise<ReservationResponse> => {
    const res = await apiClient.get(`/reservations/number/${number}`);
    return res.data;
  },

  getTodayCheckIns: async (): Promise<ReservationResponse[]> => {
    const res = await apiClient.get('/reservations/today/check-ins');
    return res.data;
  },
  
};
