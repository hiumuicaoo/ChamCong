export interface DayAttendance {
  workingDay: boolean; // default true for Mon-Fri, false for Sat-Sun
  trucBan: boolean;
  giamDinh: boolean;
  caseNumber: string;
  gioHanhChinh: number;
  ngoaiGio: number;
}

export interface Declaration {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface Declarations {
  study: Declaration[];
  vacation: Declaration[];
  holiday: Declaration[];
}

export interface AttendanceState {
  month: string; // YYYY-MM
  declarations: Declarations;
  days: Record<string, DayAttendance>; // Key is YYYY-MM-DD
}
