import client from './client';
import type { DashboardSummary, Room } from '../types';

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await client.get('/dashboard/summary');
  return res.data;
}

export async function getRooms(): Promise<Room[]> {
  const res = await client.get('/rooms');
  return res.data;
}

export async function updateRoomStatus(roomId: string, status: string) {
  const res = await client.patch(`/rooms/${roomId}/status`, { status });
  return res.data;
}