# Project Structure Documentation

## 📁 Complete Directory Structure

```
attendance-system/
├── 📄 Configuration Files
│   ├── package.json              # Dependencies and scripts
│   ├── tsconfig.json             # TypeScript configuration
│   ├── next.config.js            # Next.js configuration
│   ├── tailwind.config.ts        # Tailwind CSS configuration
│   ├── postcss.config.js         # PostCSS configuration
│   ├── .env.example              # Environment variables template
│   ├── .gitignore                # Git ignore rules
│   └── middleware.ts             # Next.js middleware for auth
│
├── 📖 Documentation
│   ├── README.md                 # Main documentation
│   ├── QUICK-START.md            # 5-minute setup guide
│   ├── SETUP-GUIDE.md            # Complete setup instructions
│   ├── PROJECT-STRUCTURE.md      # This file
│   └── LICENSE                   # MIT License
│
├── 🗄️ database/
│   ├── schema.sql                # Complete database schema
│   └── rls-policies.sql          # Row Level Security policies
│
├── 🎨 app/                       # Next.js 14 App Router
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── page.tsx                  # Home page (redirects to login)
│   │
│   ├── 🔐 (auth)/               # Authentication routes
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   ├── register/
│   │   │   └── page.tsx          # Registration page
│   │   └── layout.tsx            # Auth layout
│   │
│   ├── 📊 (dashboard)/          # Dashboard routes
│   │   ├── layout.tsx            # Dashboard layout
│   │   │
│   │   ├── super-admin/         # Super Admin Dashboard
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── institutions/     # Manage institutions
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── new/
│   │   │   │       └── page.tsx
│   │   │   └── analytics/        # Platform analytics
│   │   │       └── page.tsx
│   │   │
│   │   ├── admin/               # Institution Admin Dashboard
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # Admin home
│   │   │   ├── students/         # Student management
│   │   │   │   ├── page.tsx      # Student list
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx  # Student details
│   │   │   │   └── import/
│   │   │   │       └── page.tsx  # Bulk import
│   │   │   ├── faculty/          # Faculty management
│   │   │   ├── classes/          # Class management
│   │   │   ├── subjects/         # Subject management
│   │   │   ├── attendance/       # Attendance overview
│   │   │   │   ├── overview/
│   │   │   │   ├── reports/
│   │   │   │   └── defaulters/
│   │   │   ├── devices/          # Biometric devices
│   │   │   └── settings/         # Institution settings
│   │   │
│   │   ├── faculty/             # Faculty Dashboard
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # Faculty home
│   │   │   ├── attendance/       # Attendance marking
│   │   │   │   ├── mark/         # Mark attendance
│   │   │   │   ├── sessions/     # View sessions
│   │   │   │   └── reports/      # Generate reports
│   │   │   ├── students/         # View students
│   │   │   └── schedule/         # Class schedule
│   │   │
│   │   ├── student/             # Student Dashboard
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # Student home
│   │   │   ├── attendance/       # View attendance
│   │   │   │   └── page.tsx
│   │   │   ├── qr-scan/          # QR scanner
│   │   │   │   └── page.tsx
│   │   │   └── leave/            # Leave requests
│   │   │       ├── page.tsx
│   │   │       └── new/
│   │   │           └── page.tsx
│   │   │
│   │   └── parent/              # Parent Dashboard
│   │       ├── dashboard/
│   │       │   └── page.tsx      # Parent home
│   │       ├── children/         # View children
│   │       │   └── [id]/
│   │       │       ├── attendance/
│   │       │       └── reports/
│   │       └── notifications/    # View notifications
│   │
│   └── 🔌 api/                  # API Routes
│       ├── attendance/
│       │   ├── sessions/         # Session management
│       │   │   ├── route.ts      # GET, POST sessions
│       │   │   └── [id]/
│       │   │       └── route.ts  # GET, PATCH, DELETE
│       │   ├── mark/
│       │   │   └── route.ts      # Mark attendance
│       │   ├── bulk-mark/
│       │   │   └── route.ts      # Bulk marking
│       │   ├── qr/
│       │   │   ├── generate/
│       │   │   │   └── route.ts  # Generate QR
│       │   │   └── verify/
│       │   │       └── route.ts  # Verify QR
│       │   └── reports/
│       │       └── route.ts      # Generate reports
│       ├── biometric/
│       │   ├── sync/             # Sync biometric data
│       │   └── webhook/          # Biometric webhooks
│       ├── notifications/
│       │   ├── send/             # Send notifications
│       │   └── mark-read/        # Mark as read
│       ├── analytics/
│       │   ├── summary/          # Analytics summary
│       │   └── trends/           # Trends data
│       └── export/
│           ├── pdf/              # Export to PDF
│           └── excel/            # Export to Excel
│
├── 🧩 components/               # React Components
│   ├── ui/                      # Base UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   └── ...
│   │
│   ├── attendance/              # Attendance components
│   │   ├── AttendanceMarkingGrid.tsx
│   │   ├── AttendanceCalendar.tsx
│   │   ├── AttendanceChart.tsx
│   │   ├── SessionCard.tsx
│   │   ├── QRScanner.tsx
│   │   └── QuickMarkButtons.tsx
│   │
│   ├── students/                # Student components
│   │   ├── StudentList.tsx
│   │   ├── StudentCard.tsx
│   │   ├── StudentImport.tsx
│   │   └── StudentAttendanceProfile.tsx
│   │
│   ├── reports/                 # Report components
│   │   ├── AttendanceReport.tsx
│   │   ├── DefaultersList.tsx
│   │   ├── MonthlyReport.tsx
│   │   └── ExportButtons.tsx
│   │
│   ├── notifications/           # Notification components
│   │   ├── NotificationBell.tsx
│   │   ├── NotificationList.tsx
│   │   └── NotificationCard.tsx
│   │
│   ├── layout/                  # Layout components
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── UserMenu.tsx
│   │   └── MobileNav.tsx
│   │
│   └── shared/                  # Shared components
│       ├── LoadingSpinner.tsx
│       ├── ErrorBoundary.tsx
│       ├── DatePicker.tsx
│       └── StatCard.tsx
│
├── 📚 lib/                      # Utility Libraries
│   ├── supabase/
│   │   ├── client.ts            # Client-side Supabase client
│   │   ├── server.ts            # Server-side Supabase client
│   │   └── middleware.ts        # Supabase middleware
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useUser.ts           # User hook
│   │   ├── useAttendance.ts     # Attendance hook
│   │   ├── useStudents.ts       # Students hook
│   │   ├── useNotifications.ts  # Notifications hook
│   │   └── useRealtime.ts       # Realtime subscriptions
│   │
│   ├── services/                # Business logic services
│   │   ├── attendanceService.ts # Attendance operations
│   │   ├── notificationService.ts # Notification operations
│   │   ├── reportService.ts     # Report generation
│   │   ├── qrService.ts         # QR code operations
│   │   └── biometricService.ts  # Biometric integration
│   │
│   ├── utils/                   # Utility functions
│   │   ├── dateUtils.ts         # Date formatting
│   │   ├── exportUtils.ts       # Export helpers
│   │   ├── validationUtils.ts   # Validation functions
│   │   └── formatters.ts        # Data formatters
│   │
│   └── constants/               # Constants
│       ├── routes.ts            # Route definitions
│       ├── roles.ts             # Role definitions
│       └── config.ts            # App configuration
│
├── 🎯 types/                    # TypeScript types
│   ├── database.types.ts        # Database types
│   ├── api.types.ts             # API types
│   └── component.types.ts       # Component types
│
└── 🌐 public/                   # Static assets
    ├── images/
    ├── icons/
    └── favicon.ico
```

## 🔑 Key Files Explained

### Configuration Files

**package.json** - Defines all project dependencies and npm scripts
- Dependencies: Next.js, React, Supabase, Tailwind CSS, etc.
- Scripts: dev, build, start, lint

**tsconfig.json** - TypeScript compiler configuration
- Strict mode enabled
- Path aliases configured (@/*)

**tailwind.config.ts** - Tailwind CSS customization
- Custom color palette
- Component variants
- Animation utilities

**middleware.ts** - Authentication middleware
- Checks user session
- Redirects unauthenticated users
- Refreshes tokens

### Database Files

**schema.sql** - Complete database schema
- All tables with relationships
- Indexes for performance
- Materialized views for analytics
- Helper functions

**rls-policies.sql** - Security policies
- Row-level security for multi-tenancy
- Role-based access control
- Data isolation between institutions

### API Routes

All API routes follow REST conventions:
- GET: Retrieve data
- POST: Create new records
- PATCH: Update existing records
- DELETE: Remove records

### Components

**UI Components** - Reusable interface elements
**Feature Components** - Specific feature implementations
**Layout Components** - Page structure components
**Shared Components** - Cross-feature utilities

## 🔄 Data Flow

1. **User Action** → Component
2. **Component** → Custom Hook
3. **Hook** → Service Layer
4. **Service** → API Route
5. **API** → Supabase Database
6. **Response** ← Back through chain
7. **UI Update** ← React re-render

## 🛡️ Security Layers

1. **Authentication** - Supabase Auth
2. **Authorization** - RLS Policies
3. **Validation** - Zod schemas
4. **HTTPS** - SSL/TLS encryption
5. **Environment** - Secrets in .env.local

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: sm, md, lg, xl, 2xl
- Tailwind responsive utilities
- Mobile-optimized components

## ⚡ Performance

- Server-side rendering (SSR)
- Static generation where possible
- Image optimization (Next.js Image)
- Code splitting
- Lazy loading
- Caching strategies

## 🧪 Testing Structure (To Implement)

```
tests/
├── unit/
│   ├── components/
│   ├── hooks/
│   └── utils/
├── integration/
│   └── api/
└── e2e/
    └── flows/
```

## 📦 Build & Deployment

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🔄 Git Workflow

1. Feature branch from main
2. Make changes
3. Commit with conventional commits
4. Create pull request
5. Code review
6. Merge to main
7. Auto-deploy to Vercel

---

This structure provides:
✅ Scalability for 500+ institutions
✅ Clear separation of concerns
✅ Easy maintenance and updates
✅ Team collaboration friendly
✅ Production-ready architecture
