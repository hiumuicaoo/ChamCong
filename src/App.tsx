import { useState, useEffect, useMemo, FormEvent } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Info, 
  Clock, 
  ShieldAlert, 
  GraduationCap, 
  Palmtree, 
  Briefcase, 
  TrendingUp, 
  Server, 
  Database,
  RefreshCw,
  X,
  AlertTriangle,
  Gift,
  Grid,
  PieChart,
  User,
  Lock,
  LogOut,
  Fingerprint
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DayAttendance, Declaration, AttendanceState } from "./types";
import { 
  getDaysInMonth, 
  formatLocalDate, 
  formatDayMonth, 
  parseLocalDate, 
  getWeekDays, 
  isDateInPeriods, 
  isDefaultWorkingDay, 
  getWeekdayNameVN 
} from "./utils";

// Define a diverse set of highly distinct and vibrant colors for case numbers (avoiding work emerald, duty amber, study blue, vacation red, holiday pink)
const CASE_COLORS = [
  { bg: "bg-purple-600 border-purple-700 text-purple-50", hex: "#9333ea", label: "Tím Thủy Tiên" },
  { bg: "bg-orange-600 border-orange-700 text-orange-50", hex: "#ea580c", label: "Cam Đất" },
  { bg: "bg-teal-600 border-teal-700 text-teal-50", hex: "#0d9488", label: "Xanh Mòng Két" },
  { bg: "bg-indigo-600 border-indigo-700 text-indigo-50", hex: "#4f46e5", label: "Xanh Chàm" },
  { bg: "bg-fuchsia-600 border-fuchsia-700 text-fuchsia-50", hex: "#c026d3", label: "Hồng Fuchsia" },
  { bg: "bg-cyan-600 border-cyan-700 text-cyan-50", hex: "#0891b2", label: "Xanh Cyan" },
  { bg: "bg-violet-600 border-violet-700 text-violet-50", hex: "#7c3aed", label: "Tím Violet" },
  { bg: "bg-slate-600 border-slate-700 text-slate-50", hex: "#475569", label: "Xám Slate" },
  { bg: "bg-rose-700 border-rose-800 text-rose-50", hex: "#be123c", label: "Đỏ Đậm Rose" },
  { bg: "bg-amber-700 border-amber-800 text-amber-50", hex: "#b45309", label: "Nâu Amber" },
];

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [currentUser, setCurrentUser] = useState<{ username: string; fullName: string } | null>(() => {
    const saved = localStorage.getItem("auth_user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Auth UI state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const url = authMode === "login" ? "/api/login" : "/api/register";
      const payload = authMode === "login"
        ? { username: authUsername, password: authPassword }
        : { username: authUsername, password: authPassword, fullName: authFullName };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gặp lỗi xử lý.");
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
      
      // Clear inputs
      setAuthUsername("");
      setAuthPassword("");
      setAuthFullName("");
    } catch (err: any) {
      setAuthError(err.message || "Không thể kết nối máy chủ.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Active month state (YYYY-MM format, e.g. "2026-07")
  const [activeMonthStr, setActiveMonthStr] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  // Selected date to view the corresponding week (defaults to today or 1st day of active month)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const active = `${y}-${m}`;
    return active === activeMonthStr ? today : new Date(y, today.getMonth(), 1);
  });

  // Main attendance state loaded from backend
  const [attendance, setAttendance] = useState<AttendanceState>({
    month: activeMonthStr,
    declarations: { study: [], vacation: [], holiday: [] },
    days: {}
  });

  // YTD Cumulative Overtime hours from backend
  const [cumulativeOvertime, setCumulativeOvertime] = useState<number>(0);

  // YTD Cumulative Vacation days from backend
  const [cumulativeVacation, setCumulativeVacation] = useState<number>(0);

  // Admin-specific states
  const [adminSelectedUser, setAdminSelectedUser] = useState<{ username: string; fullName: string } | null>(null);
  const [adminUsers, setAdminUsers] = useState<Array<{ username: string; fullName: string; role?: string }>>([]);
  const [adminNewUsername, setAdminNewUsername] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminNewFullName, setAdminNewFullName] = useState("");
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersSuccessMessage, setAdminUsersSuccessMessage] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "error">("synced");
  const [activeTab, setActiveTab] = useState<"attendance" | "declarations" | "admin">("attendance");

  // Segment state for mobile view
  const [mobileTab, setMobileTab] = useState<"week" | "month" | "stats">("week");

  // Popup modal state for single day editing
  const [editingDayStr, setEditingDayStr] = useState<string | null>(null);
  const [modalTrucBan, setModalTrucBan] = useState<boolean>(false);
  const [modalGiamDinh, setModalGiamDinh] = useState<boolean>(false);
  const [modalCaseNumber, setModalCaseNumber] = useState<string>("");
  const [modalGioHanhChinh, setModalGioHanhChinh] = useState<number>(0);
  const [modalNgoaiGio, setModalNgoaiGio] = useState<number>(0);

  // New Declaration states
  const [newDecType, setNewDecType] = useState<"study" | "vacation" | "holiday">("vacation");
  const [newDecStart, setNewDecStart] = useState<string>("");
  const [newDecEnd, setNewDecEnd] = useState<string>("");
  const [decError, setDecError] = useState<string>("");

  // Year & Month parse from activeMonthStr
  const [activeYear, activeMonth] = useMemo(() => {
    const parts = activeMonthStr.split("-").map(Number);
    return [parts[0], parts[1]];
  }, [activeMonthStr]);

  const isEditingDayWeekend = useMemo(() => {
    if (!editingDayStr) return false;
    const parsed = parseLocalDate(editingDayStr);
    const dow = parsed.getDay();
    return dow === 0 || dow === 6;
  }, [editingDayStr]);

  // Sync with selectedDate when active month changes
  useEffect(() => {
    const [y, m] = activeMonthStr.split("-").map(Number);
    // If selectedDate is not in the active month, set it to the 1st of that month
    if (selectedDate.getFullYear() !== y || (selectedDate.getMonth() + 1) !== m) {
      setSelectedDate(new Date(y, m - 1, 1));
    }
  }, [activeMonthStr]);

  // Fetch all users for Admin Dashboard
  const fetchAdminUsers = async () => {
    if (!token || currentUser?.username !== "admin") return;
    setAdminUsersLoading(true);
    setAdminUsersError("");
    setAdminUsersSuccessMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Không thể tải danh sách tài khoản.");
      const data = await response.json();
      setAdminUsers(data);
    } catch (err: any) {
      setAdminUsersError(err.message || "Lỗi khi tải danh sách người dùng.");
    } finally {
      setAdminUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "admin" && currentUser?.username === "admin") {
      fetchAdminUsers();
    }
  }, [activeTab, currentUser, token]);

  const handleAdminCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminNewUsername || !adminNewPassword) return;
    setAdminUsersError("");
    setAdminUsersSuccessMessage("");
    setAdminUsersLoading(true);
    try {
      const response = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUser: adminNewUsername,
          password: adminNewPassword,
          fullName: adminNewFullName
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lỗi tạo tài khoản.");
      
      setAdminUsersSuccessMessage(`Đã tạo tài khoản @${adminNewUsername} thành công.`);
      setAdminNewUsername("");
      setAdminNewPassword("");
      setAdminNewFullName("");
      await fetchAdminUsers();
    } catch (err: any) {
      setAdminUsersError(err.message || "Lỗi khi tạo tài khoản.");
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const handleAdminResetPassword = async (targetUser: string) => {
    const newPassword = prompt(`Nhập mật khẩu mới cho tài khoản @${targetUser}:`);
    if (!newPassword) return;
    if (newPassword.trim().length < 4) {
      alert("Mật khẩu mới phải từ 4 ký tự trở lên.");
      return;
    }
    setAdminUsersError("");
    setAdminUsersSuccessMessage("");
    setAdminUsersLoading(true);
    try {
      const response = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUser,
          newPassword: newPassword.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lỗi đặt lại mật khẩu.");
      setAdminUsersSuccessMessage(`Đặt lại mật khẩu cho @${targetUser} thành công!`);
    } catch (err: any) {
      setAdminUsersError(err.message || "Lỗi khi đặt lại mật khẩu.");
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const handleAdminDeleteUser = async (targetUser: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản @${targetUser} không? Hành động này không thể hoàn tác.`)) {
      return;
    }
    setAdminUsersError("");
    setAdminUsersSuccessMessage("");
    setAdminUsersLoading(true);
    try {
      const response = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ targetUser })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lỗi xóa tài khoản.");
      setAdminUsersSuccessMessage(`Đã xóa tài khoản @${targetUser} thành công.`);
      await fetchAdminUsers();
    } catch (err: any) {
      setAdminUsersError(err.message || "Lỗi khi xóa tài khoản.");
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const handleAdminSelectUser = (user: { username: string; fullName: string }) => {
    setAdminSelectedUser(user);
    setActiveTab("attendance");
  };

  // Load attendance data from backend when activeMonthStr, token or adminSelectedUser changes
  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const url = adminSelectedUser 
          ? `/api/admin/attendance?targetUser=${adminSelectedUser.username}&month=${activeMonthStr}`
          : `/api/attendance?month=${activeMonthStr}`;

        const response = await fetch(url, { headers });
        if (response.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          setToken(null);
          setCurrentUser(null);
          return;
        }
        if (!response.ok) throw new Error("Không thể tải dữ liệu.");
        const data = await response.json();
        
        if (active) {
          setAttendance({
            month: data.month,
            declarations: {
              study: data.declarations?.study || [],
              vacation: data.declarations?.vacation || [],
              holiday: data.declarations?.holiday || []
            },
            days: data.days || {}
          });
          setCumulativeOvertime(data.cumulativeOvertime || 0);
          setCumulativeVacation(data.cumulativeVacation || 0);
          setSyncStatus("synced");
        }
      } catch (error) {
        console.error("Error loading:", error);
        setSyncStatus("error");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [activeMonthStr, token, adminSelectedUser]);

  // Save attendance data helper
  const saveAttendance = async (updatedState: AttendanceState) => {
    setIsSaving(true);
    setSyncStatus("saving");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const url = adminSelectedUser 
        ? "/api/admin/attendance"
        : "/api/attendance";
      
      const payload = adminSelectedUser
        ? { targetUser: adminSelectedUser.username, ...updatedState }
        : updatedState;

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      if (response.status === 401) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setCurrentUser(null);
        return;
      }
      if (!response.ok) throw new Error("Lỗi khi lưu dữ liệu.");
      const resData = await response.json();
      
      setCumulativeOvertime(resData.cumulativeOvertime || 0);
      setCumulativeVacation(resData.cumulativeVacation || 0);
      setSyncStatus("synced");
    } catch (error) {
      console.error("Error saving:", error);
      setSyncStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // Month navigation
  const handlePrevMonth = () => {
    let m = activeMonth - 1;
    let y = activeYear;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    setActiveMonthStr(`${y}-${String(m).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    let m = activeMonth + 1;
    let y = activeYear;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    setActiveMonthStr(`${y}-${String(m).padStart(2, "0")}`);
  };

  // Get list of unique case numbers in the current month to assign dynamic shades of purple
  const uniqueCaseNumbers = useMemo(() => {
    const cases = new Set<string>();
    Object.values(attendance.days).forEach((day: DayAttendance) => {
      if (day.giamDinh && day.caseNumber && day.caseNumber.trim() !== "") {
        cases.add(day.caseNumber.trim());
      }
    });
    return Array.from(cases).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [attendance.days]);

  // Color mapper helper based on unique case index
  const getCaseColors = (caseNo: string) => {
    const trimmed = (caseNo || "").trim();
    if (!trimmed) return CASE_COLORS[0]; // Fallback
    const index = uniqueCaseNumbers.indexOf(trimmed);
    if (index === -1) return CASE_COLORS[0];
    return CASE_COLORS[index % CASE_COLORS.length];
  };

  // Calculate current week days (7 days, Mon to Sun)
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Open edit modal for a day
  const handleOpenEditModal = (dateStr: string) => {
    // If the day is inside Study, Vacation or Holiday, we do not allow edits (as requested)
    const isStudy = isDateInPeriods(dateStr, attendance.declarations.study);
    const isVacation = isDateInPeriods(dateStr, attendance.declarations.vacation);
    const isHoliday = isDateInPeriods(dateStr, attendance.declarations.holiday);
    
    if (isStudy || isVacation || isHoliday) {
      return; // Clicks are overridden for Study, Vacation & Holiday
    }

    const existing = attendance.days[dateStr] || {
      workingDay: isDefaultWorkingDay(dateStr),
      trucBan: false,
      giamDinh: false,
      caseNumber: "",
      gioHanhChinh: 0,
      ngoaiGio: 0
    };

    const parsed = parseLocalDate(dateStr);
    const dow = parsed.getDay();
    const isWeekend = dow === 0 || dow === 6;

    setEditingDayStr(dateStr);
    setModalTrucBan(existing.trucBan);
    setModalGiamDinh(existing.giamDinh);
    setModalCaseNumber(existing.caseNumber || "");
    if (isWeekend) {
      setModalGioHanhChinh(0);
      setModalNgoaiGio((existing.ngoaiGio ?? 0) + (existing.gioHanhChinh ?? 0));
    } else {
      setModalGioHanhChinh(existing.gioHanhChinh ?? 0);
      setModalNgoaiGio(existing.ngoaiGio ?? 0);
    }
  };

  // Save the day from modal popup
  const handleSaveDay = () => {
    if (!editingDayStr) return;

    const isWorking = isDefaultWorkingDay(editingDayStr);
    const parsed = parseLocalDate(editingDayStr);
    const dow = parsed.getDay();
    const isWeekend = dow === 0 || dow === 6;

    let finalGioHanhChinh = modalGiamDinh ? (modalGioHanhChinh || 0) : 0;
    let finalNgoaiGio = modalGiamDinh ? (modalNgoaiGio || 0) : 0;

    if (isWeekend && modalGiamDinh) {
      finalNgoaiGio = finalGioHanhChinh + finalNgoaiGio;
      finalGioHanhChinh = 0;
    }

    const updatedDays = { ...attendance.days };
    
    updatedDays[editingDayStr] = {
      workingDay: isWorking,
      trucBan: modalTrucBan,
      giamDinh: modalGiamDinh,
      caseNumber: modalGiamDinh ? modalCaseNumber.trim() : "",
      gioHanhChinh: finalGioHanhChinh,
      ngoaiGio: finalNgoaiGio
    };

    const updatedState = {
      ...attendance,
      days: updatedDays
    };

    setAttendance(updatedState);
    saveAttendance(updatedState);
    setEditingDayStr(null);
  };

  // Declaration operations
  const handleAddDeclaration = (e: FormEvent) => {
    e.preventDefault();
    setDecError("");

    if (!newDecStart || !newDecEnd) {
      setDecError("Vui lòng nhập đầy đủ ngày bắt đầu và ngày kết thúc.");
      return;
    }

    const start = new Date(newDecStart);
    const end = new Date(newDecEnd);

    if (start > end) {
      setDecError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }

    // Add new period to correct list
    const newDec: Declaration = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      startDate: newDecStart,
      endDate: newDecEnd
    };

    const updatedDeclarations = { 
      study: attendance.declarations.study || [],
      vacation: attendance.declarations.vacation || [],
      holiday: attendance.declarations.holiday || []
    };
    if (newDecType === "study") {
      updatedDeclarations.study = [...updatedDeclarations.study, newDec];
    } else if (newDecType === "vacation") {
      updatedDeclarations.vacation = [...updatedDeclarations.vacation, newDec];
    } else if (newDecType === "holiday") {
      updatedDeclarations.holiday = [...updatedDeclarations.holiday, newDec];
    }

    const updatedState = {
      ...attendance,
      declarations: updatedDeclarations
    };

    setAttendance(updatedState);
    saveAttendance(updatedState);

    // Clear inputs
    setNewDecStart("");
    setNewDecEnd("");
  };

  const handleDeleteDeclaration = (id: string, type: "study" | "vacation" | "holiday") => {
    const updatedDeclarations = { 
      study: attendance.declarations.study || [],
      vacation: attendance.declarations.vacation || [],
      holiday: attendance.declarations.holiday || []
    };
    if (type === "study") {
      updatedDeclarations.study = updatedDeclarations.study.filter(d => d.id !== id);
    } else if (type === "vacation") {
      updatedDeclarations.vacation = updatedDeclarations.vacation.filter(d => d.id !== id);
    } else if (type === "holiday") {
      updatedDeclarations.holiday = updatedDeclarations.holiday.filter(d => d.id !== id);
    }

    const updatedState = {
      ...attendance,
      declarations: updatedDeclarations
    };

    setAttendance(updatedState);
    saveAttendance(updatedState);
  };

  // Core statistical calculations for Section 4
  const statistics = useMemo(() => {
    let weekendDutyDaysCount = 0;
    let monthlyOvertimeHours = 0;

    // Scan all days of the current month
    const totalDaysInMonth = getDaysInMonth(activeYear, activeMonth);
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${activeYear}-${String(activeMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      
      // If overridden by Study, Vacation or Holiday, skip statistics for this day
      const isStudy = isDateInPeriods(dateStr, attendance.declarations.study);
      const isVacation = isDateInPeriods(dateStr, attendance.declarations.vacation);
      const isHoliday = isDateInPeriods(dateStr, attendance.declarations.holiday);

      if (isStudy || isVacation || isHoliday) continue;

      const dayData = attendance.days[dateStr];
      if (dayData) {
        // Condition for weekend duty: Checked "Trực ban" AND day is Saturday or Sunday
        if (dayData.trucBan) {
          const parsed = parseLocalDate(dateStr);
          const dow = parsed.getDay(); // 0 = Sun, 6 = Sat
          if (dow === 0 || dow === 6) {
            weekendDutyDaysCount++;
          }
        }

        // Sum overtime hours
        if (dayData.giamDinh) {
          const parsed = parseLocalDate(dateStr);
          const dow = parsed.getDay(); // 0 = Sun, 6 = Sat
          const isWeekend = dow === 0 || dow === 6;
          const ngoaiGio = typeof dayData.ngoaiGio === "number" ? dayData.ngoaiGio : 0;
          const gioHanhChinh = typeof dayData.gioHanhChinh === "number" ? dayData.gioHanhChinh : 0;
          if (isWeekend) {
            monthlyOvertimeHours += ngoaiGio + gioHanhChinh;
          } else {
            monthlyOvertimeHours += ngoaiGio;
          }
        }
      }
    }

    return {
      weekendDutyDaysCount,
      monthlyOvertimeHours
    };
  }, [attendance, activeYear, activeMonth]);

  // Generate calendar grid days for the month selector view
  const monthlyCalendarGrid = useMemo(() => {
    const totalDays = getDaysInMonth(activeYear, activeMonth);
    // Find weekday index of the first day of the month (Monday = 0 ... Sunday = 6)
    const firstDate = new Date(activeYear, activeMonth - 1, 1);
    const firstDayIndex = (firstDate.getDay() + 6) % 7;

    const grid = [];

    // Add empty cells for padding
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push(null);
    }

    // Add days
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, "0");
      const monthStr = String(activeMonth).padStart(2, "0");
      const dateStr = `${activeYear}-${monthStr}-${dayStr}`;
      grid.push(dateStr);
    }

    return grid;
  }, [activeYear, activeMonth]);

  // Check if a date string is inside the current active week
  const isDateInActiveWeek = (dateStr: string | null) => {
    if (!dateStr) return false;
    const dateFormattedList = weekDays.map(d => formatLocalDate(d));
    return dateFormattedList.includes(dateStr);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 antialiased">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-200 mx-auto">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-indigo-600 tracking-tight">
                CHẤM CÔNG PC09
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Hệ thống Quản Lý Chấm Công Cá Nhân
              </p>
            </div>
          </div>

          {authError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs sm:text-sm flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "register" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Họ và tên
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200/80 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Tên tài khoản
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Fingerprint className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="username"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200/80 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Mật khẩu
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200/80 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-md shadow-indigo-200 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer text-sm"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Vui lòng chờ...</span>
                </>
              ) : (
                <>
                  <span>{authMode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}</span>
                  <Plus className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-all cursor-pointer"
            >
              {authMode === "login"
                ? "Chưa có tài khoản? Đăng ký ngay"
                : "Đã có tài khoản? Đăng nhập"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 antialiased">
      {/* Premium Navigation Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black text-indigo-600 tracking-tight leading-none">
                CHẤM CÔNG PC09
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-mono mt-1">
                Lịch Quản Lý Chấm Công Cá Nhân
              </p>
            </div>
          </div>

          {/* Database Synchronization Status - Fits Server HDD/SSD Setup */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {currentUser && (
              <div className="flex items-center space-x-2 bg-slate-100/80 border border-slate-200/50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[10px] sm:text-xs font-bold shrink-0">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden xs:block text-left max-w-[120px] truncate">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-800 leading-tight truncate">{currentUser.fullName}</p>
                  <p className="text-[8px] sm:text-[9px] text-slate-400 font-mono leading-none">@{currentUser.username}</p>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("auth_token");
                    localStorage.removeItem("auth_user");
                    setToken(null);
                    setCurrentUser(null);
                  }}
                  className="p-1 hover:bg-slate-200/80 text-slate-500 hover:text-rose-600 rounded-md transition-all cursor-pointer shrink-0"
                  title="Đăng xuất"
                >
                  <LogOut className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                </button>
              </div>
            )}

            <div className="hidden md:flex items-center space-x-2 bg-slate-100 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-600">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>HDD: Data Storage Mount</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
            
            <div className="flex items-center space-x-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium">
              {syncStatus === "saving" ? (
                <>
                  <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                  <span className="hidden xs:inline">Đang đồng bộ...</span>
                  <span className="xs:hidden">Lưu...</span>
                </>
              ) : syncStatus === "error" ? (
                <>
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
                  <span className="text-red-600 hidden xs:inline">Lỗi lưu dữ liệu</span>
                  <span className="text-red-600 xs:hidden">Lỗi</span>
                </>
              ) : (
                <>
                  <Server className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />
                  <span className="hidden xs:inline">Đã đồng bộ HDD</span>
                  <span className="xs:hidden">Đã lưu</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* Admin Navigation Header */}
        {currentUser?.username === "admin" && (
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Hệ thống Quản trị viên PC09
              </span>
              <h2 className="text-base sm:text-lg font-bold">Bảng điều khiển Chấm công Đơn vị</h2>
              <p className="text-xs text-slate-400 font-medium">
                {adminSelectedUser 
                  ? `Đang xem lịch cán bộ: ${adminSelectedUser.fullName.toUpperCase()} (@${adminSelectedUser.username})`
                  : "Chế độ xem lịch cá nhân hoặc chuyển qua quản lý danh sách tài khoản."
                }
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2.5 justify-center">
              <button
                onClick={() => {
                  setAdminSelectedUser(null);
                  setActiveTab("attendance");
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  !adminSelectedUser && activeTab !== "admin"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/20"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                Lịch Cá nhân Admin
              </button>
              
              <button
                onClick={() => {
                  setActiveTab("admin");
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "admin"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/20"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                Danh sách & Tài khoản Cán bộ
              </button>
              
              {adminSelectedUser && (
                <button
                  onClick={() => {
                    setAdminSelectedUser(null);
                    setActiveTab("admin");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-md cursor-pointer flex items-center space-x-1"
                >
                  <span>Thoát xem hộ: @{adminSelectedUser.username}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Month Selector / Navigation Board */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex items-center justify-center gap-4">
          <div className="flex items-center space-x-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-white hover:shadow-xs rounded-lg transition-all text-slate-700 hover:text-slate-900 cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 px-3">
              <select 
                value={activeMonthStr} 
                onChange={(e) => setActiveMonthStr(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer"
              >
                {/* Generate last 2 years and next 2 years options */}
                {Array.from({ length: 5 }, (_, i) => 2024 + i).flatMap(y => 
                  Array.from({ length: 12 }, (_, m) => {
                    const val = `${y}-${String(m + 1).padStart(2, "0")}`;
                    return (
                      <option key={val} value={val}>
                        Tháng {m + 1}, {y}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <button 
              onClick={handleNextMonth}
              className="p-2 hover:bg-white hover:shadow-xs rounded-lg transition-all text-slate-700 hover:text-slate-900 cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500 font-mono">Đang tải cấu hình lưu trữ từ SSD...</p>
          </div>
        ) : activeTab === "admin" && currentUser?.username === "admin" ? (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left col: Add user form */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 block"></span>
                      Thêm cán bộ mới
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Cấp tài khoản mới cho cán bộ trong đơn vị PC09</p>
                  </div>

                  <form onSubmit={handleAdminCreateUser} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Họ và tên cán bộ</label>
                      <input
                        type="text"
                        required
                        value={adminNewFullName}
                        onChange={(e) => setAdminNewFullName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Tên tài khoản (username)</label>
                      <input
                        type="text"
                        required
                        value={adminNewUsername}
                        onChange={(e) => setAdminNewUsername(e.target.value)}
                        placeholder="nguyenvana"
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 block">Mật khẩu ban đầu</label>
                      <input
                        type="password"
                        required
                        value={adminNewPassword}
                        onChange={(e) => setAdminNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    {adminUsersError && (
                      <div className="text-xs text-red-500 font-medium bg-red-50 p-3 rounded-xl border border-red-100">
                        ⚠️ {adminUsersError}
                      </div>
                    )}

                    {adminUsersSuccessMessage && (
                      <div className="text-xs text-emerald-600 font-medium bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        ✅ {adminUsersSuccessMessage}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={adminUsersLoading}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                    >
                      {adminUsersLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang tạo...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tạo tài khoản cán bộ</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right col: Directory / Users List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
                  <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 block"></span>
                        Danh sách Cán bộ & Chiến sĩ PC09
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Danh sách cán bộ trong cơ sở dữ liệu đã được cấp tài khoản</p>
                    </div>
                    <button
                      onClick={fetchAdminUsers}
                      className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1 self-start"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Tải lại</span>
                    </button>
                  </div>

                  {adminUsersLoading && adminUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                      <p className="text-xs text-slate-400 font-mono">Đang tải danh sách tài khoản...</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 overflow-hidden">
                      {adminUsers.map((user) => (
                        <div key={user.username} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-100">
                              {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-800">{user.fullName || "Chưa đặt tên"}</span>
                                {user.role === "admin" ? (
                                  <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Admin</span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Cán bộ</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => {
                                handleAdminSelectUser(user);
                              }}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>Xem & Sửa công</span>
                            </button>
                            
                            <button
                              onClick={() => handleAdminResetPassword(user.username)}
                              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              Đổi mật khẩu
                            </button>

                            {user.username !== "admin" && (
                              <button
                                onClick={() => handleAdminDeleteUser(user.username)}
                                className="p-2 border border-rose-100 hover:bg-rose-50 text-rose-500 rounded-lg transition-all cursor-pointer"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Admin Override Alert Banner */}
            {adminSelectedUser && (
              <div className="bg-amber-500 text-slate-900 px-5 py-4 rounded-2xl font-bold flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-pulse">
                <div className="flex items-center space-x-2.5">
                  <Info className="w-5 h-5 text-slate-950 shrink-0" />
                  <span className="text-sm">
                    ĐANG XEM & CHỈNH SỬA CHẤM CÔNG CỦA CÁN BỘ: <span className="underline font-black">{adminSelectedUser.fullName.toUpperCase()} (@{adminSelectedUser.username})</span>
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAdminSelectedUser(null);
                    setActiveTab("admin");
                  }}
                  className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Trở lại Danh sách Cán bộ
                </button>
              </div>
            )}

            {/* Mobile View Switcher - Only visible on screens < lg */}
            <div className="lg:hidden flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 mb-2">
              <button
                onClick={() => setMobileTab("week")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mobileTab === "week"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Lịch Tuần</span>
              </button>
              <button
                onClick={() => setMobileTab("month")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mobileTab === "month"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Lịch Tháng</span>
              </button>
              <button
                onClick={() => setMobileTab("stats")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mobileTab === "stats"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PieChart className="w-4 h-4" />
                <span>Khai báo & Thống kê</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Weekly view and Declarations form */}
              <div className={`lg:col-span-8 space-y-8 ${(mobileTab === "week" || mobileTab === "stats") ? "block" : "hidden"} lg:block`}>
                
                {/* SECTION 1: Lịch tuần từ ngày dd/mm đến dd/mm */}
                <section id="weekly-calendar" className={`bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm relative overflow-hidden ${mobileTab === "week" ? "block" : "hidden"} lg:block`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-mono font-medium rounded-md border border-emerald-100">
                      Chế độ theo dõi hàng tuần
                    </span>
                    <h2 className="text-xl font-bold text-slate-800 mt-1.5">
                      Lịch tuần: từ {formatDayMonth(weekDays[0])} đến {formatDayMonth(weekDays[6])}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Nhấp chọn bất kỳ ngày nào để khai báo Trực ban & Giám định vụ án
                    </p>
                  </div>
                  
                  <div className="text-xs font-medium text-slate-500 self-start sm:self-center">
                    Mặc định: Thứ 2 - Thứ 6 là <span className="text-emerald-600 font-semibold">Đi làm</span>
                  </div>
                </div>

                {/* Weekly Days List - Sleek Row List for Mobile, 7-Column Grid for Desktop */}
                
                {/* Desktop View: 7-Column Grid */}
                <div className="hidden sm:grid grid-cols-7 gap-3">
                  {weekDays.map((day, idx) => {
                    const dateStr = formatLocalDate(day);
                    
                    // Identify declarations overriding other states
                    const isStudy = isDateInPeriods(dateStr, attendance.declarations.study);
                    const isVacation = isDateInPeriods(dateStr, attendance.declarations.vacation);
                    const isHoliday = isDateInPeriods(dateStr, attendance.declarations.holiday);
                    
                    // Is this day from our selected month?
                    const isCurrentMonth = day.getMonth() + 1 === activeMonth && day.getFullYear() === activeYear;

                    const dayData = attendance.days[dateStr] || {
                      workingDay: isDefaultWorkingDay(dateStr),
                      trucBan: false,
                      giamDinh: false,
                      caseNumber: "",
                      gioHanhChinh: 0,
                      ngoaiGio: 0
                    };

                    const hasTrucBan = dayData.trucBan;
                    const hasGiamDinh = dayData.giamDinh;
                    const totalGiamDinhHours = (dayData.gioHanhChinh || 0) + (dayData.ngoaiGio || 0);

                    // Check if weekend
                    const dow = day.getDay();
                    const isWeekend = dow === 0 || dow === 6;

                    return (
                      <div
                        key={dateStr}
                        id={`weekly-day-${dateStr}`}
                        onClick={() => handleOpenEditModal(dateStr)}
                        className={`group relative rounded-xl border p-3 min-h-[140px] flex flex-col justify-between transition-all duration-200 select-none ${
                          isStudy 
                            ? "bg-blue-50 border-blue-200 text-blue-900 cursor-not-allowed"
                            : isVacation
                            ? "bg-red-50 border-red-200 text-red-900 cursor-not-allowed"
                            : isHoliday
                            ? "bg-pink-50 border-pink-200 text-pink-900 cursor-not-allowed"
                            : "bg-white hover:bg-slate-50/50 hover:shadow-xs cursor-pointer border-slate-200"
                        } ${!isCurrentMonth ? "opacity-50" : ""}`}
                      >
                        {/* Day indicator header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              {getWeekdayNameVN(day)}
                            </p>
                            <p className="text-base font-extrabold text-slate-700">
                              {day.getDate()}
                            </p>
                          </div>
                          
                          {/* Indicator pill */}
                          {isStudy && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-extrabold rounded">
                              HỌC
                            </span>
                          )}
                          {isVacation && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-extrabold rounded">
                              PHÉP
                            </span>
                          )}
                          {isHoliday && (
                            <span className="px-1.5 py-0.5 bg-pink-100 text-pink-800 text-[9px] font-extrabold rounded">
                              LỄ
                            </span>
                          )}
                        </div>

                        {/* Middle display content */}
                        <div className="mt-2 space-y-1.5">
                          {isStudy ? (
                            <div className="text-[11px] font-semibold text-blue-700 font-sans">
                              Lịch học tập tập trung
                            </div>
                          ) : isVacation ? (
                            <div className="text-[11px] font-semibold text-red-700 font-sans">
                              Lịch nghỉ phép cá nhân
                            </div>
                          ) : isHoliday ? (
                            <div className="text-[11px] font-semibold text-pink-700 font-sans">
                              Nghỉ lễ theo quy định
                            </div>
                          ) : (
                            <>
                              {/* Display "Đi làm" if default weekday and not overridden */}
                              {!isWeekend && (
                                <div className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 text-center">
                                  Đi làm
                                </div>
                              )}

                              {/* Display "Trực ban" if selected */}
                              {hasTrucBan && (
                                <div className="text-[10px] font-semibold px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded border border-yellow-200 text-center">
                                  Trực ban
                                </div>
                              )}

                              {/* Display "Giám định" case card if selected */}
                              {hasGiamDinh && (
                                <div className={`text-[10px] font-semibold px-2 py-0.5 rounded border text-center ${getCaseColors(dayData.caseNumber).bg}`}>
                                  Vụ {dayData.caseNumber}: {totalGiamDinhHours}g
                                </div>
                              )}

                              {/* Prompt to click if empty */}
                              {!hasTrucBan && !hasGiamDinh && isWeekend && (
                                <div className="text-[10px] text-slate-400 italic text-center py-2 group-hover:text-indigo-500 transition-colors">
                                  Ngày nghỉ
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Visual tooltip style edit badge on hover */}
                        {!isStudy && !isVacation && !isHoliday && (
                          <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-indigo-600 font-medium bg-indigo-50 px-1 rounded">
                            Thiết lập
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Mobile View: Sleek Row List */}
                <div className="block sm:hidden space-y-2.5">
                  {weekDays.map((day, idx) => {
                    const dateStr = formatLocalDate(day);
                    const isStudy = isDateInPeriods(dateStr, attendance.declarations.study);
                    const isVacation = isDateInPeriods(dateStr, attendance.declarations.vacation);
                    const isHoliday = isDateInPeriods(dateStr, attendance.declarations.holiday);
                    const isCurrentMonth = day.getMonth() + 1 === activeMonth && day.getFullYear() === activeYear;

                    const dayData = attendance.days[dateStr] || {
                      workingDay: isDefaultWorkingDay(dateStr),
                      trucBan: false,
                      giamDinh: false,
                      caseNumber: "",
                      gioHanhChinh: 0,
                      ngoaiGio: 0
                    };

                    const hasTrucBan = dayData.trucBan;
                    const hasGiamDinh = dayData.giamDinh;
                    const totalGiamDinhHours = (dayData.gioHanhChinh || 0) + (dayData.ngoaiGio || 0);

                    const dow = day.getDay();
                    const isWeekend = dow === 0 || dow === 6;

                    // Row styling based on type
                    let rowBg = "bg-white border-slate-200 active:bg-slate-50";
                    let textColor = "text-slate-800";
                    if (isStudy) {
                      rowBg = "bg-blue-50/70 border-blue-150 active:bg-blue-100/50";
                      textColor = "text-blue-900";
                    } else if (isVacation) {
                      rowBg = "bg-red-50/70 border-red-150 active:bg-red-100/50";
                      textColor = "text-red-900";
                    } else if (isHoliday) {
                      rowBg = "bg-pink-50/70 border-pink-150 active:bg-pink-100/50";
                      textColor = "text-pink-900";
                    }

                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          if (!isStudy && !isVacation && !isHoliday) {
                            handleOpenEditModal(dateStr);
                          }
                        }}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all select-none cursor-pointer ${rowBg} ${!isCurrentMonth ? "opacity-60" : ""}`}
                      >
                        {/* Left side: Date and Day name */}
                        <div className="flex items-center space-x-3">
                          <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold ${
                            isStudy ? "bg-blue-100 text-blue-700" :
                            isVacation ? "bg-red-100 text-red-700" :
                            isHoliday ? "bg-pink-100 text-pink-700" :
                            isWeekend ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold leading-none">
                              {getWeekdayNameVN(day)}
                            </span>
                            <span className="text-sm font-black mt-0.5 leading-none">
                              {day.getDate()}
                            </span>
                          </div>

                          {/* Center: Work status / Cases */}
                          <div className="space-y-1">
                            {isStudy && (
                              <span className="inline-block px-1.5 py-0.5 bg-blue-100/80 text-blue-800 text-[9px] font-bold rounded">
                                Lịch học tập tập trung
                              </span>
                            )}
                            {isVacation && (
                              <span className="inline-block px-1.5 py-0.5 bg-red-100/80 text-red-800 text-[9px] font-bold rounded">
                                Nghỉ phép cá nhân
                              </span>
                            )}
                            {isHoliday && (
                              <span className="inline-block px-1.5 py-0.5 bg-pink-100/80 text-pink-800 text-[9px] font-bold rounded">
                                Nghỉ lễ theo quy định
                              </span>
                            )}

                            {!isStudy && !isVacation && !isHoliday && (
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {/* Base work */}
                                {!isWeekend && (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded border border-emerald-100">
                                    Đi làm
                                  </span>
                                )}
                                
                                {/* Trực ban */}
                                {hasTrucBan && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded border border-amber-200">
                                    Trực ban
                                  </span>
                                )}

                                {/* Giám định */}
                                {hasGiamDinh && (
                                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${getCaseColors(dayData.caseNumber).bg}`}>
                                    Vụ {dayData.caseNumber} ({totalGiamDinhHours}g)
                                  </span>
                                )}

                                {!hasTrucBan && !hasGiamDinh && isWeekend && (
                                  <span className="text-[11px] text-slate-400 italic">
                                    Ngày nghỉ
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right side: Action chevron/button */}
                        {!isStudy && !isVacation && !isHoliday && (
                          <div className="p-1 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg">
                            <Plus className="w-4 h-4 text-slate-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SECTION 3: Khai báo Học, Nghỉ phép & Nghỉ lễ */}
              <section id="declarations-panel" className={`bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm ${mobileTab === "stats" ? "block" : "hidden"} lg:block`}>
                <div className="flex items-center space-x-2.5 mb-5 border-b border-slate-100 pb-4">
                  <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <Briefcase className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Khai báo Lịch Học tập, Nghỉ phép & Nghỉ lễ
                    </h2>
                    <p className="text-xs text-slate-400">
                      Tự động tô màu và khóa lịch tuần/tháng (Học: xanh dương | Nghỉ phép: màu đỏ | Nghỉ lễ: màu hồng)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Form to add declaration */}
                  <form onSubmit={handleAddDeclaration} className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Thêm đợt khai báo mới
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Nội dung khai báo
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setNewDecType("vacation")}
                            className={`py-2 px-2 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center space-x-1 ${
                              newDecType === "vacation"
                                ? "bg-red-50 border-red-300 text-red-700 shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <Palmtree className="w-3 h-3" />
                            <span>Nghỉ phép (Đỏ)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewDecType("study")}
                            className={`py-2 px-2 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center space-x-1 ${
                              newDecType === "study"
                                ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <GraduationCap className="w-3 h-3" />
                            <span>Học tập (Xanh)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewDecType("holiday")}
                            className={`py-2 px-2 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center space-x-1 ${
                              newDecType === "holiday"
                                ? "bg-pink-50 border-pink-300 text-pink-700 shadow-xs"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <Gift className="w-3 h-3" />
                            <span>Nghỉ lễ (Hồng)</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Từ ngày
                          </label>
                          <input
                            type="date"
                            value={newDecStart}
                            onChange={(e) => setNewDecStart(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Đến ngày
                          </label>
                          <input
                            type="date"
                            value={newDecEnd}
                            onChange={(e) => setNewDecEnd(e.target.value)}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 font-mono"
                          />
                        </div>
                      </div>

                      {decError && (
                        <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded border border-red-100 flex items-center space-x-1">
                          <span>⚠️ {decError}</span>
                        </p>
                      )}

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Xác nhận khai báo</span>
                      </button>
                    </div>
                  </form>

                  {/* Active declarations list */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Danh sách đợt khai báo hoạt động
                    </h3>

                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {(attendance.declarations.vacation?.length || 0) === 0 && 
                       (attendance.declarations.study?.length || 0) === 0 && 
                       (attendance.declarations.holiday?.length || 0) === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <p className="text-xs text-slate-400 font-mono">Chưa có khai báo nào được ghi nhận</p>
                        </div>
                      ) : (
                        <>
                          {/* Vacation periods */}
                          {(attendance.declarations.vacation || []).map((dec) => (
                            <div
                              key={dec.id}
                              className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl text-xs"
                            >
                              <div className="flex items-center space-x-2.5">
                                <span className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                                  <Palmtree className="w-3.5 h-3.5" />
                                </span>
                                <div>
                                  <p className="font-bold text-red-800">Nghỉ phép năm</p>
                                  <p className="text-[10px] text-red-600 font-mono">
                                    {dec.startDate.split("-").reverse().join("/")} - {dec.endDate.split("-").reverse().join("/")}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteDeclaration(dec.id, "vacation")}
                                className="p-1.5 hover:bg-red-100 text-red-400 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                                title="Xóa đợt nghỉ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          {/* Study periods */}
                          {(attendance.declarations.study || []).map((dec) => (
                            <div
                              key={dec.id}
                              className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs"
                            >
                              <div className="flex items-center space-x-2.5">
                                <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                  <GraduationCap className="w-3.5 h-3.5" />
                                </span>
                                <div>
                                  <p className="font-bold text-blue-800">Học tập chuyên đề</p>
                                  <p className="text-[10px] text-blue-600 font-mono">
                                    {dec.startDate.split("-").reverse().join("/")} - {dec.endDate.split("-").reverse().join("/")}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteDeclaration(dec.id, "study")}
                                className="p-1.5 hover:bg-blue-100 text-blue-400 hover:text-blue-700 rounded-lg transition-colors cursor-pointer"
                                title="Xóa đợt học"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          {/* Holiday periods */}
                          {(attendance.declarations.holiday || []).map((dec) => (
                            <div
                              key={dec.id}
                              className="flex items-center justify-between p-3 bg-pink-50/50 border border-pink-100 rounded-xl text-xs"
                            >
                              <div className="flex items-center space-x-2.5">
                                <span className="p-1.5 bg-pink-100 text-pink-700 rounded-lg">
                                  <Gift className="w-3.5 h-3.5" />
                                </span>
                                <div>
                                  <p className="font-bold text-pink-800">Nghỉ lễ theo quy định</p>
                                  <p className="text-[10px] text-pink-600 font-mono">
                                    {dec.startDate.split("-").reverse().join("/")} - {dec.endDate.split("-").reverse().join("/")}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteDeclaration(dec.id, "holiday")}
                                className="p-1.5 hover:bg-pink-100 text-pink-400 hover:text-pink-700 rounded-lg transition-colors cursor-pointer"
                                title="Xóa đợt nghỉ lễ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

            </div>

            {/* Right Column: Monthly grid overview and Stats */}
            <div className={`lg:col-span-4 space-y-8 ${(mobileTab === "month" || mobileTab === "stats") ? "block" : "hidden"} lg:block`}>
              
              {/* SECTION 2: Lịch trong tháng mm/yyyy */}
              <section id="monthly-calendar" className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm ${mobileTab === "month" ? "block" : "hidden"} lg:block`}>
                <div className="mb-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                      <span>Lịch tháng {String(activeMonth).padStart(2, "0")}/{activeYear}</span>
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 font-mono rounded">
                      Mini Board
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Nhấp ngày để chuyển đổi Lịch Tuần tương ứng
                  </p>
                </div>

                {/* Week days headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <div>T2</div>
                  <div>T3</div>
                  <div>T4</div>
                  <div>T5</div>
                  <div>T6</div>
                  <div className="text-rose-500/70">T7</div>
                  <div className="text-rose-500/70">CN</div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {monthlyCalendarGrid.map((dateStr, idx) => {
                    if (!dateStr) {
                      return <div key={`empty-${idx}`} className="aspect-square bg-transparent rounded" />;
                    }

                    const parsed = parseLocalDate(dateStr);
                    const dayNum = parsed.getDate();
                    const dayOfWeek = parsed.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    // Active week highlighting (golden/indigo border surround)
                    const inActiveWeek = isDateInActiveWeek(dateStr);

                    // Check overrides
                    const isStudy = isDateInPeriods(dateStr, attendance.declarations.study);
                    const isVacation = isDateInPeriods(dateStr, attendance.declarations.vacation);
                    const isHoliday = isDateInPeriods(dateStr, attendance.declarations.holiday);

                    const dayData = attendance.days[dateStr] || {
                      workingDay: !isWeekend,
                      trucBan: false,
                      giamDinh: false,
                      caseNumber: "",
                      gioHanhChinh: 0,
                      ngoaiGio: 0
                    };

                    // Determine background colors & layout blend
                    // "Mỗi ô sẽ pha trộn các màu tương ứng các công việc mà tôi đã đánh dấu ở phần 1, tạo thành 1 bảng nhìn tổng thể"
                    let colorSection = null;

                    if (isStudy) {
                      // Solid blue override
                      colorSection = <div className="absolute inset-0 bg-blue-500" />;
                    } else if (isVacation) {
                      // Solid red override
                      colorSection = <div className="absolute inset-0 bg-red-500" />;
                    } else if (isHoliday) {
                      // Solid pink override
                      colorSection = <div className="absolute inset-0 bg-pink-500" />;
                    } else {
                      // Blending colored stripes or segmented layers inside the cell
                      const components = [];
                      if (!isWeekend) {
                        components.push(<div key="work" className="bg-emerald-500/95 flex-1 h-full" title="Đi làm" />);
                      }
                      if (dayData.trucBan) {
                        components.push(<div key="truc" className="bg-amber-400 flex-1 h-full" title="Trực ban" />);
                      }
                      if (dayData.giamDinh) {
                        const shade = getCaseColors(dayData.caseNumber);
                        // Extract hex or use dynamic styling fallback. We can output custom styling!
                        components.push(
                          <div 
                            key="giam" 
                            className="flex-1 h-full" 
                            style={{ backgroundColor: shade.hex }}
                            title={`Giám định vụ ${dayData.caseNumber}`} 
                          />
                        );
                      }

                      if (components.length === 0) {
                        // Empty weekend day
                        colorSection = <div className="absolute inset-0 bg-slate-100" />;
                      } else {
                        colorSection = (
                          <div className="absolute inset-0 flex flex-col sm:flex-row">
                            {components}
                          </div>
                        );
                      }
                    }

                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(parsed)}
                        className={`aspect-square relative rounded-md overflow-hidden flex flex-col items-center justify-center text-[11px] transition-all hover:scale-105 active:scale-95 cursor-pointer select-none ${
                          inActiveWeek 
                            ? "ring-2 ring-indigo-500 ring-offset-1 z-10 scale-[1.03] shadow-md shadow-indigo-100" 
                            : ""
                        }`}
                        title={`${dayNum}/${activeMonth}/${activeYear}`}
                      >
                        {/* Blended / mixed color backgrounds */}
                        {colorSection}

                        {/* Text Overlay with contrasting text */}
                        <span className={`absolute font-extrabold z-10 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] ${
                          isStudy || isVacation || isHoliday
                            ? "text-white" 
                            : isWeekend && !dayData.trucBan && !dayData.giamDinh
                            ? "text-slate-400" 
                            : "text-slate-900"
                        }`}>
                          {dayNum}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Map legend explaining custom color blending */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-medium">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-600 block"></span>
                    <span>Hành chính (Xanh lá)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-400 border border-amber-500 block"></span>
                    <span>Trực ban (Vàng)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500 border border-blue-600 block"></span>
                    <span>Đi Học (Xanh dương)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-red-500 border border-red-600 block"></span>
                    <span>Nghỉ phép (Đỏ)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-pink-500 border border-pink-600 block"></span>
                    <span>Nghỉ lễ (Hồng)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="flex space-x-[-3px] items-center">
                      <span className="w-2 h-2 rounded-full bg-purple-500 border border-white block"></span>
                      <span className="w-2 h-2 rounded-full bg-orange-500 border border-white block"></span>
                      <span className="w-2 h-2 rounded-full bg-teal-500 border border-white block"></span>
                    </span>
                    <span>Giám định (Đa sắc)</span>
                  </div>
                </div>
              </section>

              {/* SECTION 4: Ngoài giờ & Thống kê tích lũy */}
              <section id="statistics-panel" className={`bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6 ${mobileTab === "stats" ? "block" : "hidden"} lg:block`}>
                <div className="border-b border-slate-100 pb-4">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold rounded">
                    Thống kê tự động
                  </span>
                  <h2 className="text-base font-bold text-slate-800 mt-1">
                    Báo cáo & Thống kê Ngoài giờ
                  </h2>
                </div>

                {/* Sub-stat 1: Trực ban cuối tuần */}
                <div className="flex justify-between items-center p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-900">
                      Trực ban cuối tuần
                    </p>
                    <p className="text-[10px] text-amber-700">
                      Vàng + Thứ 7, Chủ Nhật trong tháng
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-amber-800">
                      {statistics.weekendDutyDaysCount}
                    </span>
                    <span className="text-xs text-amber-600 ml-1 font-medium">ngày</span>
                  </div>
                </div>

                {/* Sub-stat 3: Số ngày nghỉ phép cá nhân trong năm (lũy kế theo chu kỳ) */}
                <div className="flex justify-between items-center p-3 bg-red-50/50 border border-red-100 rounded-xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-red-900">
                      Nghỉ phép cá nhân (Chu kỳ)
                    </p>
                    <p className="text-[10px] text-red-700">
                      Cộng dồn từ 01/04/{activeMonth >= 4 ? activeYear : activeYear - 1} đến tháng {activeMonth}/{activeYear}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-red-800">
                      {cumulativeVacation}
                    </span>
                    <span className="text-xs text-red-600 ml-1 font-medium">ngày</span>
                  </div>
                </div>

                {/* Cumulative YTD Overtime with Year reset logic */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md shadow-slate-100">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        Lũy kế Giám định ngoài giờ {activeYear}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Cộng dồn từ tháng 1 đến tháng {activeMonth}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-200 rounded font-mono font-medium">
                      Hạn ngạch: 300g/năm
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-3xl font-black text-white font-mono">
                        {cumulativeOvertime}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">/ 300 giờ</span>
                    </div>
                    <span className="text-xs font-bold text-indigo-400 font-mono">
                      {Math.min(Math.round((cumulativeOvertime / 300) * 100), 100)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min((cumulativeOvertime / 300) * 100, 100)}%` }}
                    />
                  </div>

                  {/* Dynamic Alert Messages based on Year Reset & Overtime Thresholds */}
                  <div className="text-[10px] text-slate-300 pt-1 border-t border-slate-800 flex items-center space-x-1">
                    <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>
                      {cumulativeOvertime >= 300 
                        ? "⚠️ Đã đạt hoặc vượt mức 300 giờ quy định của năm!"
                        : `Còn ${300 - cumulativeOvertime} giờ trước khi đạt ngưỡng quy định.`}
                      {" Lũy kế sẽ reset về 0 vào ngày 1/1 năm sau."}
                    </span>
                  </div>
                </div>
              </section>

            </div>

          </div>
          </>
        )}

      </main>

      {/* MODAL DIALOG POPUP: Section 1 day editing */}
      <AnimatePresence>
        {editingDayStr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingDayStr(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" 
            />

            {/* Modal card content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 w-full max-w-md shadow-2xl relative z-10 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  <h3 className="text-base font-bold text-slate-800">
                    Cấu hình chấm công ngày {editingDayStr.split("-").reverse().join("/")}
                  </h3>
                </div>
                <button 
                  onClick={() => setEditingDayStr(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500">
                  Hôm nay bạn chấm công thêm những nội dung gì:
                </p>

                {/* Option 1: Trực ban */}
                <label className="flex items-start space-x-3 p-3 bg-slate-50/70 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={modalTrucBan}
                    onChange={(e) => setModalTrucBan(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Trực ban (Kíp trực cơ quan)</p>
                    <p className="text-[10px] text-slate-400">Nếu vào Thứ 7/CN sẽ được tính là trực ban cuối tuần</p>
                  </div>
                </label>

                {/* Option 2: Giám định */}
                <label className="flex items-start space-x-3 p-3 bg-slate-50/70 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={modalGiamDinh}
                    onChange={(e) => setModalGiamDinh(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Giám định chuyên môn pháp y</p>
                    <p className="text-[10px] text-slate-400 font-mono">Bổ sung thông tin vụ số & thời lượng giờ</p>
                  </div>
                </label>

                {/* Sub-form for Giám định */}
                <AnimatePresence>
                  {modalGiamDinh && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden bg-purple-50/50 border border-purple-100 p-4 rounded-xl space-y-3"
                    >
                      <div>
                        <label className="block text-xs font-bold text-purple-900 mb-1">
                          Vụ số:
                        </label>
                        <input
                          type="text"
                          value={modalCaseNumber}
                          onChange={(e) => setModalCaseNumber(e.target.value)}
                          placeholder="Ví dụ: Vụ 10, Vụ 11..."
                          className="w-full text-xs border border-purple-200 rounded-lg p-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500 font-medium text-purple-950 bg-white"
                        />
                      </div>

                      {isEditingDayWeekend ? (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-bold text-purple-900 mb-1">
                              Số giờ Giám định (Ngoài giờ):
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="24"
                              value={modalNgoaiGio === 0 ? "" : modalNgoaiGio}
                              onChange={(e) => setModalNgoaiGio(Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="Mặc định: 0"
                              className="w-full text-xs border border-purple-200 rounded-lg p-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500 font-mono text-purple-950 bg-white"
                            />
                          </div>
                          <div className="text-[10px] text-purple-700 bg-purple-100/60 p-2.5 rounded-lg border border-purple-200/50 flex items-start space-x-1">
                            <Info className="w-3.5 h-3.5 shrink-0 text-purple-600 mt-0.5" />
                            <span>Vì rơi vào ngày cuối tuần, tất cả giờ giám định sẽ được tính trực tiếp là <strong>Giờ ngoài giờ</strong>.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-purple-900 mb-1">
                              Giờ hành chính:
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="24"
                              value={modalGioHanhChinh === 0 ? "" : modalGioHanhChinh}
                              onChange={(e) => setModalGioHanhChinh(Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="Mặc định: 0"
                              className="w-full text-xs border border-purple-200 rounded-lg p-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500 font-mono text-purple-950 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-purple-900 mb-1">
                              Ngoài giờ:
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="24"
                              value={modalNgoaiGio === 0 ? "" : modalNgoaiGio}
                              onChange={(e) => setModalNgoaiGio(Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="Mặc định: 0"
                              className="w-full text-xs border border-purple-200 rounded-lg p-2 focus:outline-hidden focus:ring-2 focus:ring-purple-500/25 focus:border-purple-500 font-mono text-purple-950 bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDayStr(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveDay}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-indigo-100"
                >
                  <span>Lưu thông tin</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
