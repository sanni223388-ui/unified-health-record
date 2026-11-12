export interface User {
  id: number;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  patient?: any;
  doctor?: any;
}
