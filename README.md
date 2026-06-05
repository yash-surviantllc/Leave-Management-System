# LMS - Leave Management System

A full-stack leave management platform for organizations to manage employees, attendance, and leave requests with role-based access control.

## Features

- **Authentication & Authorization**: Secure login/register with JWT and role-based permissions (Super Admin, HR Admin, Manager, Employee)
- **Employee Management**: Manage employee profiles, departments, designations, emergency contacts, and document metadata
- **Attendance Tracking**: Clock in/out, shift management, holiday calendar, work mode tracking (Office/WFH)
- **Leave Management**: Leave types, leave requests, approval workflows, leave balance tracking
- **Dashboard**: Role-aware summary with key metrics and recent notifications
- **Reports**: Employee, attendance, and leave reports with filters
- **Notifications**: In-app notification system for leave approvals and updates

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form
- **Icons**: Lucide React
- **Animations**: Framer Motion

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Zod
- **Caching**: Redis (optional)

### DevOps
- **Containerization**: Docker Compose
- **Package Management**: npm workspaces (monorepo)

## Project Structure

```
LMS-main/
├── frontend/          # Next.js frontend application
│   └── src/
│       ├── app/       # App Router pages
│       ├── components/# Reusable UI components
│       ├── hooks/     # Custom React hooks
│       └── lib/       # Utilities and API client
├── backend/           # Express backend API
│   ├── prisma/        # Database schema and migrations
│   └── src/
│       ├── modules/   # Feature modules (auth, employees, leaves, etc.)
│       ├── middleware/# Auth and permission middleware
│       └── config/    # Configuration files
└── docker-compose.yml # PostgreSQL container setup
```

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker (for PostgreSQL)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LMS-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Backend (`backend/.env`):
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env and update JWT_SECRET and other values
   ```

   Frontend (`frontend/.env.local`):
   ```bash
   cp frontend/.env.example frontend/.env.local
   # Edit frontend/.env.local if needed
   ```

4. **Start PostgreSQL**
   ```bash
   npm run db:up
   ```

5. **Run database migrations and seed**
   ```bash
   npm run setup:db
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

   The application will be available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Default Credentials (After Seeding)

- **Super Admin**: admin@company.com / Admin@12345
- **HR Admin**: hr@company.com / Hr@12345
- **Manager**: manager@company.com / Manager@12345
- **Employee**: employee@company.com / Employee@12345

## Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend
- `npm run typecheck` - Type check both workspaces
- `npm run lint` - Lint frontend code
- `npm run test:smoke` - Run backend smoke tests
- `npm run verify` - Run all checks (typecheck, lint, build, test)

### Database
- `npm run db:up` - Start PostgreSQL container
- `npm run db:down` - Stop PostgreSQL container
- `npm run db:status` - Check container status
- `npm run setup:db` - Start DB, run migrations, and seed data
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations

## User Roles & Permissions

| Role | Permissions |
|------|------------|
| **Super Admin** | Full system access, manage all users and settings |
| **HR Admin** | Manage employees, attendance, leaves, reports |
| **Manager** | View team data, approve/reject team leave requests |
| **Employee** | View own profile, clock in/out, submit leave requests |

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Employees
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Deactivate employee
- `POST /api/employees/:id/documents` - Upload document metadata

### Attendance
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out
- `GET /api/attendance/me` - Get own attendance records
- `GET /api/attendance/report` - Get attendance report

### Leaves
- `POST /api/leaves` - Submit leave request
- `GET /api/leaves` - List all leave requests
- `GET /api/leaves/me` - Get own leave requests
- `PUT /api/leaves/:id/approve` - Approve leave request
- `PUT /api/leaves/:id/reject` - Reject leave request
- `GET /api/leaves/balance` - Get leave balance

### Dashboard & Reports
- `GET /api/dashboard/summary` - Get dashboard summary
- `GET /api/reports/employees` - Employee report
- `GET /api/reports/attendance` - Attendance report
- `GET /api/reports/leaves` - Leave report

## Development

### Running Tests
```bash
npm run test:smoke
```

### Database Migrations
```bash
# Create a new migration
cd backend
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npm run prisma:migrate:deploy
```

### Code Quality
```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Full verification
npm run verify
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
