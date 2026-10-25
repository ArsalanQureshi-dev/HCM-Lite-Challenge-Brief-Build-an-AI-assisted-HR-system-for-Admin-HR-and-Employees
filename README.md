# HCM Lite

A complete HR & Payroll web application built with vanilla HTML5, CSS3, and modern JavaScript. No framework, no external server or database required: everything operates seamlessly in the browser using `localStorage`.

> **Saylani Hackathon (Beginner Track)** submission ready &mdash; featuring high testability, clean business rules, responsive mobile-first UI, and an interactive Smart AI helper.

---

## Quick Start & Evaluation
1. Double click and open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Brave, etc.), or host it on GitHub Pages, Vercel, or Netlify.
2. **Instant Demo Mode:** On the welcome screen, click **"⚡ Load Demo Company & Users"** to immediately populate full company data, realistic employees, attendance records, leaves, and announcements.
3. **One-Click Logins:**
   - **Admin:** `admin@company.com` / `password123` (Full control over settings, staff, leaves, attendance adjustments & payroll)
   - **Employee:** `ali@company.com` / `password123` (Check-in/out, leave applications, smart AI assistant, payslips)

---

## Core Features & Workflow

### 1. Setup & Authentication
- **First Run Setup:** Create company name and Admin login.
- **Role-Based Routing:** Admin and Employee dashboards are protected by route guards.
- **Forgot Password (Demo Mode):** Generates a time-limited 6-digit verification code on-screen with quick auto-fill.
- **Password Visibility:** Toggle show/hide eye icon on all password inputs.
- **Dark Mode:** One-click toggle in the navigation bar persisted across sessions.

### 2. Admin Capabilities
- **Live Attendance Monitor:** View real-time who is present, on time, late, on leave, or missing.
- **Attendance Corrections:** Admin can manually edit, record, or clear check-in/out times for any employee.
- **Staff Directory:** Add new employees (which automatically creates their login credentials), search by name/department, edit salaries, or delete.
- **Leave Management:** Filter leave requests by Pending, Approved, or Rejected. One-click approve or reject with custom feedback comments.
- **Company Broadcasts:** Post company-wide announcements instantly visible on employee dashboards.
- **Configurable Settings:** Office start time, grace minutes (default 15 mins), yearly leave quota, and selectable working days (e.g. Mon–Fri).

### 3. Employee Self-Service
- **Shift Tracker:** One-click Check In & Check Out with live shift duration timer and office policy notifications.
- **Weekend / Day-Off Detection:** Automatically disables check-in on weekends and when on approved leave with friendly notices.
- **Leave Applications:** Interactive date range picker that live-calculates working days, skipping weekends and checking remaining yearly quotas.
- **Smart Helper (AI):** Interactive chat helper answering in both English and Roman Urdu (e.g., *"How many leaves do I have left?"*, *"Was I late today?"*, *"Office timing"*).
- **Salary Statements:** Monthly breakdown of work days, late arrivals, absences, deductions, and final net pay with print / PDF export support.

---

## Business Logic & Rules
- **Late Arrivals:** Check-in after `Office Start Time + Grace Minutes` is flagged as Late.
- **Half Day Rule:** Working shifts under 5 hours between Check In and Check Out are counted as half days.
- **Absence Calculation:** Unexcused non-attendance on official working days is marked absent.
- **Leave Policy:** Skips non-working days/weekends, prevents overlapping dates, and validates against annual quota.
- **Payroll Formula:**
  $$\text{Per Day Rate} = \frac{\text{Monthly Salary}}{\text{Official Working Days}}$$
  $$\text{Deduction} = \text{Per Day Rate} \times (\text{Absences} + 0.5 \times \text{Half Days})$$
  $$\text{Net Salary} = \max(0, \text{Monthly Salary} - \text{Deduction})$$

---

## Code Architecture
- `index.html` &mdash; Authentication portal (Login, First-run setup, Demo loader, Forgot password)
- `pages/*.html` &mdash; Admin dashboard, Employee dashboard, Employees, Leave requests, Payslips, Settings
- `css/style.css` &mdash; Design tokens, mobile drawer, print styles, dark mode, responsive cards & tables
- `js/storage.js` &mdash; Safe `localStorage` layer, demo seeder, date and currency helpers
- `js/ui.js` &mdash; Navigation shell, modals, toasts, badge synchronization, password toggles
- `js/auth.js` &mdash; Session management, login authentication, role guards
- `js/attendance.js` &mdash; Shift check-in/out, live rules, monthly statistics, payslip generation
- `js/leave.js` &mdash; Leave request validation, working day calculations, approval workflows
- `js/helper.js` &mdash; Smart AI chatbot with bilingual keyword comprehension
- `js/employees.js` &mdash; CRUD management of employees and department filtering
- `js/pages.js` &mdash; Main dashboard view logic, announcements, and configuration settings
