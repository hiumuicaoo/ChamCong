import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Resolve data directory. Default to a 'data' directory in workspace root.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());

// Session security config
const SECRET = process.env.SESSION_SECRET || "some-permanent-secret-key-123";
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Helper: load and save users
function loadUsers(): Record<string, { username: string; passwordHash: string; fullName?: string; role?: string }> {
  let users: Record<string, any> = {};
  if (fs.existsSync(USERS_FILE)) {
    try {
      users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    } catch (e) {
      users = {};
    }
  }
  // Seed admin user if it doesn't exist
  if (!users["admin"]) {
    users["admin"] = {
      username: "admin",
      passwordHash: hashPassword("admin@pc09"),
      fullName: "Quản trị viên PC09",
      role: "admin"
    };
    saveUsers(users);
  }
  return users;
}

function saveUsers(users: any) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

// Helper: hash password
function hashPassword(password: string): string {
  return crypto.createHmac("sha256", SECRET).update(password).digest("hex");
}

// Helper: generate stable signed token for user sessions
function generateToken(username: string): string {
  const signature = crypto.createHmac("sha256", SECRET).update(username).digest("hex");
  return Buffer.from(JSON.stringify({ username, signature })).toString("base64");
}

// Helper: verify and return username from token
function verifyToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64").toString("utf-8");
    const { username, signature } = JSON.parse(raw);
    const expectedSignature = crypto.createHmac("sha256", SECRET).update(username).digest("hex");
    if (signature === expectedSignature) {
      return username;
    }
  } catch (e) {}
  return null;
}

// Helper function to get filename for a given month and user (e.g. "attendance-user-2026-07.json")
function getMonthFilePathForUser(username: string, month: string): string {
  const parts = month.split("-");
  if (parts.length !== 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
    throw new Error("Invalid month format");
  }
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `attendance-${safeUsername}-${month}.json`);
}

// Check if a date string is within any period in the list of periods
function isDateInPeriods(dateStr: string, periods: Array<{ startDate: string; endDate: string }>): boolean {
  if (!periods || !Array.isArray(periods)) return false;
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  return periods.some(period => {
    if (!period.startDate || !period.endDate) return false;
    const start = new Date(period.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(period.endDate);
    end.setHours(0, 0, 0, 0);
    return targetDate >= start && targetDate <= end;
  });
}

// Helper function to get filename for user-specific unified declarations
function getDeclarationsFilePath(username: string): string {
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `declarations-${safeUsername}.json`);
}

// Load unified declarations, migrating from existing month-specific files if first-time setup
function loadDeclarations(username: string): { study: any[]; vacation: any[]; holiday: any[] } {
  const filePath = getDeclarationsFilePath(username);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return {
        study: data.study || [],
        vacation: data.vacation || [],
        holiday: data.holiday || []
      };
    } catch (e) {
      console.error("Error reading declarations file:", e);
    }
  }

  // Fallback / One-time migration: crawl existing monthly files to collect previous declarations
  const declarations = { study: [] as any[], vacation: [] as any[], holiday: [] as any[] };
  try {
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "");
    if (fs.existsSync(DATA_DIR)) {
      const files = fs.readdirSync(DATA_DIR);
      const prefix = `attendance-${safeUsername}-`;
      const seenIds = new Set<string>();

      files.forEach(file => {
        if (file.startsWith(prefix) && file.endsWith(".json")) {
          try {
            const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
            const data = JSON.parse(content);
            if (data.declarations) {
              ["study", "vacation", "holiday"].forEach(type => {
                if (Array.isArray(data.declarations[type])) {
                  data.declarations[type].forEach((dec: any) => {
                    if (dec && dec.id && !seenIds.has(dec.id)) {
                      seenIds.add(dec.id);
                      (declarations as any)[type].push(dec);
                    }
                  });
                }
              });
            }
          } catch (err) {
            // ignore corrupt files
          }
        }
      });

      // If we recovered any declarations, save them now to establish the central file
      if (declarations.study.length > 0 || declarations.vacation.length > 0 || declarations.holiday.length > 0) {
        saveDeclarations(username, declarations);
      }
    }
  } catch (e) {
    console.error("Migration of declarations failed:", e);
  }

  return declarations;
}

// Save unified declarations to separate file
function saveDeclarations(username: string, declarations: { study: any[]; vacation: any[]; holiday: any[] }) {
  const filePath = getDeclarationsFilePath(username);
  fs.writeFileSync(filePath, JSON.stringify(declarations, null, 2), "utf-8");
}

// Calculate cumulative YTD overtime hours for a given month and user (from Jan of that year up to the current month)
function calculateCumulativeOvertime(username: string, targetMonthStr: string): number {
  try {
    const parts = targetMonthStr.split("-");
    const year = parseInt(parts[0]);
    const targetMonth = parseInt(parts[1]);

    if (isNaN(year) || isNaN(targetMonth)) return 0;

    let totalOvertime = 0;

    // Load centralized/unified declarations
    const declarations = loadDeclarations(username);
    const studyPeriods = declarations.study || [];
    const vacationPeriods = declarations.vacation || [];
    const holidayPeriods = declarations.holiday || [];

    // Scan months from 01 up to targetMonth
    for (let m = 1; m <= targetMonth; m++) {
      const monthStr = `${year}-${String(m).padStart(2, "0")}`;
      const filePath = getMonthFilePathForUser(username, monthStr);

      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const monthData = JSON.parse(fileContent);

        if (monthData.days) {
          Object.entries(monthData.days).forEach(([dateStr, dayData]: [string, any]) => {
            // Check if overridden by study, vacation or holiday
            const isOverridden = isDateInPeriods(dateStr, studyPeriods) || isDateInPeriods(dateStr, vacationPeriods) || isDateInPeriods(dateStr, holidayPeriods);
            if (!isOverridden && dayData && dayData.giamDinh) {
              const ngoaiGio = typeof dayData.ngoaiGio === "number" ? dayData.ngoaiGio : 0;
              const gioHanhChinh = typeof dayData.gioHanhChinh === "number" ? dayData.gioHanhChinh : 0;
              
              const dateParts = dateStr.split("-").map(Number);
              const dow = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay(); // 0 = Sun, 6 = Sat
              const isWeekend = dow === 0 || dow === 6;
              
              if (isWeekend) {
                totalOvertime += ngoaiGio + gioHanhChinh;
              } else {
                totalOvertime += ngoaiGio;
              }
            }
          });
        }
      }
    }

    return totalOvertime;
  } catch (err) {
    console.error("Error calculating cumulative overtime:", err);
    return 0;
  }
}

// Calculate cumulative vacation days for the current vacation cycle (April 1st to March 31st of the following year) up to the target month for user
function calculateCumulativeVacationDays(username: string, targetMonthStr: string): number {
  try {
    const parts = targetMonthStr.split("-");
    const year = parseInt(parts[0]);
    const targetMonth = parseInt(parts[1]);

    if (isNaN(year) || isNaN(targetMonth)) return 0;

    let totalVacationDays = 0;

    // Load centralized/unified declarations
    const declarations = loadDeclarations(username);
    const vacationPeriods = declarations.vacation || [];

    // Determine the list of year-month pairs to scan for the cycle
    const monthsToScan: { y: number; m: number }[] = [];
    if (targetMonth >= 4) {
      // Cycle started April of the current calendar year
      for (let m = 4; m <= targetMonth; m++) {
        monthsToScan.push({ y: year, m });
      }
    } else {
      // Cycle started April of the previous calendar year
      for (let m = 4; m <= 12; m++) {
        monthsToScan.push({ y: year - 1, m });
      }
      for (let m = 1; m <= targetMonth; m++) {
        monthsToScan.push({ y: year, m });
      }
    }

    // Scan each month in the cycle checking for vacation day status
    for (const { y, m } of monthsToScan) {
      const totalDaysInM = new Date(y, m, 0).getDate();
      for (let day = 1; day <= totalDaysInM; day++) {
        const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (isDateInPeriods(dateStr, vacationPeriods)) {
          totalVacationDays++;
        }
      }
    }

    return totalVacationDays;
  } catch (err) {
    console.error("Error calculating cumulative vacation days:", err);
    return 0;
  }
}

// API Routes

// Helper middleware-like function to authenticate requests
function getAuthenticatedUser(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}

// 1. Register User
app.post("/api/register", (req, res) => {
  const { username, password, fullName } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username và mật khẩu là bắt buộc" });
    return;
  }

  const trimmedUsername = String(username).trim().toLowerCase();
  if (trimmedUsername.length < 3) {
    res.status(400).json({ error: "Username phải từ 3 ký tự trở lên" });
    return;
  }

  const users = loadUsers();
  if (users[trimmedUsername]) {
    res.status(400).json({ error: "Tên tài khoản này đã được sử dụng" });
    return;
  }

  const passwordHash = hashPassword(password);
  users[trimmedUsername] = {
    username: trimmedUsername,
    passwordHash,
    fullName: fullName || username
  };

  saveUsers(users);

  const token = generateToken(trimmedUsername);
  res.json({
    success: true,
    message: "Đăng ký thành công!",
    token,
    user: {
      username: trimmedUsername,
      fullName: fullName || username
    }
  });
});

// 2. Login User
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username và mật khẩu là bắt buộc" });
    return;
  }

  const trimmedUsername = String(username).trim().toLowerCase();
  const users = loadUsers();
  const user = users[trimmedUsername];

  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác" });
    return;
  }

  const token = generateToken(trimmedUsername);
  res.json({
    success: true,
    message: "Đăng nhập thành công!",
    token,
    user: {
      username: trimmedUsername,
      fullName: user.fullName || trimmedUsername
    }
  });
});

// 3. Get profile
app.get("/api/me", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (!username) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = loadUsers();
  const user = users[username];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    username,
    fullName: user.fullName || username
  });
});

// 4. Get attendance data for a month (Authenticated)
app.get("/api/attendance", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (!username) {
    res.status(401).json({ error: "Vui lòng đăng nhập để truy cập dữ liệu." });
    return;
  }

  const { month } = req.query;
  if (!month || typeof month !== "string") {
    res.status(400).json({ error: "Month query parameter is required (YYYY-MM)" });
    return;
  }

  try {
    const filePath = getMonthFilePathForUser(username, month);
    let data: any = {
      month,
      days: {}
    };

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(fileContent);
    }

    // Load centralized declarations instead of month-specific ones
    const declarations = loadDeclarations(username);

    // Calculate YTD cumulative overtime
    const cumulativeOvertime = calculateCumulativeOvertime(username, month);
    // Calculate YTD cumulative vacation days
    const cumulativeVacation = calculateCumulativeVacationDays(username, month);

    res.json({
      month,
      declarations,
      days: data.days || {},
      cumulativeOvertime,
      cumulativeVacation
    });
  } catch (error: any) {
    console.error("Error loading attendance:", error);
    res.status(500).json({ error: error.message || "Failed to load attendance data" });
  }
});

// 5. Save attendance data for a month (Authenticated)
app.post("/api/attendance", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (!username) {
    res.status(401).json({ error: "Vui lòng đăng nhập để lưu dữ liệu." });
    return;
  }

  const { month, declarations, days } = req.body;
  if (!month || typeof month !== "string") {
    res.status(400).json({ error: "Month is required (YYYY-MM)" });
    return;
  }

  try {
    // Save to centralized declarations
    if (declarations) {
      saveDeclarations(username, declarations);
    }

    const filePath = getMonthFilePathForUser(username, month);

    const dataToSave = {
      month,
      days: days || {}
    };

    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");

    // Recalculate YTD cumulative overtime to return to client
    const cumulativeOvertime = calculateCumulativeOvertime(username, month);
    // Recalculate YTD cumulative vacation days to return to client
    const cumulativeVacation = calculateCumulativeVacationDays(username, month);

    res.json({
      success: true,
      message: "Lưu thông tin thành công!",
      cumulativeOvertime,
      cumulativeVacation
    });
  } catch (error: any) {
    console.error("Error saving attendance:", error);
    res.status(500).json({ error: error.message || "Failed to save attendance data" });
  }
});


// 6. Get list of users (Admin only)
app.get("/api/admin/users", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (username !== "admin") {
    res.status(403).json({ error: "Chỉ quản trị viên mới có quyền truy cập." });
    return;
  }

  const users = loadUsers();
  const userList = Object.values(users).map(u => ({
    username: u.username,
    fullName: u.fullName || u.username,
    role: u.username === "admin" ? "admin" : "user"
  }));

  res.json(userList);
});

// 7. Reset user password (Admin only)
app.post("/api/admin/users/reset-password", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (username !== "admin") {
    res.status(403).json({ error: "Chỉ quản trị viên mới có quyền truy cập." });
    return;
  }

  const { targetUser, newPassword } = req.body;
  if (!targetUser || !newPassword) {
    res.status(400).json({ error: "Username và mật khẩu mới là bắt buộc." });
    return;
  }

  const targetUsername = String(targetUser).trim().toLowerCase();
  const users = loadUsers();
  if (!users[targetUsername]) {
    res.status(404).json({ error: "Không tìm thấy người dùng." });
    return;
  }

  users[targetUsername].passwordHash = hashPassword(newPassword);
  saveUsers(users);

  res.json({ success: true, message: `Đặt lại mật khẩu cho @${targetUsername} thành công.` });
});

// 8. Delete user (Admin only)
app.post("/api/admin/users/delete", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (username !== "admin") {
    res.status(403).json({ error: "Chỉ quản trị viên mới có quyền truy cập." });
    return;
  }

  const { targetUser } = req.body;
  if (!targetUser) {
    res.status(400).json({ error: "Username cần xóa là bắt buộc." });
    return;
  }

  const targetUsername = String(targetUser).trim().toLowerCase();
  if (targetUsername === "admin") {
    res.status(400).json({ error: "Không thể xóa tài khoản quản trị viên tối cao." });
    return;
  }

  const users = loadUsers();
  if (!users[targetUsername]) {
    res.status(404).json({ error: "Không tìm thấy người dùng." });
    return;
  }

  delete users[targetUsername];
  saveUsers(users);

  res.json({ success: true, message: `Đã xóa tài khoản @${targetUsername}.` });
});

// 9. Create user as Admin (Admin only)
app.post("/api/admin/users/create", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (username !== "admin") {
    res.status(403).json({ error: "Chỉ quản trị viên mới có quyền truy cập." });
    return;
  }

  const { targetUser, password, fullName } = req.body;
  if (!targetUser || !password) {
    res.status(400).json({ error: "Tên tài khoản và mật khẩu là bắt buộc." });
    return;
  }

  const targetUsername = String(targetUser).trim().toLowerCase();
  if (targetUsername.length < 3) {
    res.status(400).json({ error: "Username phải từ 3 ký tự trở lên." });
    return;
  }

  const users = loadUsers();
  if (users[targetUsername]) {
    res.status(400).json({ error: "Tên tài khoản này đã được sử dụng." });
    return;
  }

  users[targetUsername] = {
    username: targetUsername,
    passwordHash: hashPassword(password),
    fullName: fullName || targetUsername
  };

  saveUsers(users);

  res.json({ success: true, message: `Đã tạo tài khoản @${targetUsername} thành công.` });
});

// 10. Get any user's attendance for a month (Admin only)
app.get("/api/admin/attendance", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (username !== "admin") {
    res.status(403).json({ error: "Chỉ quản trị viên mới có quyền truy cập." });
    return;
  }

  const { targetUser, month } = req.query;
  if (!targetUser || typeof targetUser !== "string" || !month || typeof month !== "string") {
    res.status(400).json({ error: "Thiếu targetUser hoặc month." });
    return;
  }

  const targetUsername = targetUser.trim().toLowerCase();
  try {
    const filePath = getMonthFilePathForUser(targetUsername, month);
    let data: any = {
      month,
      days: {}
    };

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(fileContent);
    }

    // Load centralized declarations instead of month-specific ones
    const declarations = loadDeclarations(targetUsername);

    const cumulativeOvertime = calculateCumulativeOvertime(targetUsername, month);
    const cumulativeVacation = calculateCumulativeVacationDays(targetUsername, month);

    res.json({
      month,
      declarations,
      days: data.days || {},
      cumulativeOvertime,
      cumulativeVacation
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load target user attendance data." });
  }
});

// 11. Save/Override any user's attendance for a month (Admin only)
app.post("/api/admin/attendance", (req, res) => {
  const username = getAuthenticatedUser(req);
  if (username !== "admin") {
    res.status(403).json({ error: "Chỉ quản trị viên mới có quyền truy cập." });
    return;
  }

  const { targetUser, month, declarations, days } = req.body;
  if (!targetUser || typeof targetUser !== "string" || !month || typeof month !== "string") {
    res.status(400).json({ error: "Thiếu targetUser hoặc month." });
    return;
  }

  const targetUsername = targetUser.trim().toLowerCase();
  try {
    // Save to centralized declarations
    if (declarations) {
      saveDeclarations(targetUsername, declarations);
    }

    const filePath = getMonthFilePathForUser(targetUsername, month);

    const dataToSave = {
      month,
      days: days || {}
    };

    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");

    const cumulativeOvertime = calculateCumulativeOvertime(targetUsername, month);
    const cumulativeVacation = calculateCumulativeVacationDays(targetUsername, month);

    res.json({
      success: true,
      message: `Đã lưu thông tin chấm công cho @${targetUsername}!`,
      cumulativeOvertime,
      cumulativeVacation
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save target user attendance data." });
  }
});


// Mount Vite middleware or static files
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

setupFrontend();
