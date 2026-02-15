# Attendance Management System — Deployment Guide

## Quick Deploy: GitHub → Vercel

### Step 1: Push to GitHub

```bash
# In your project folder (E:\attendance-system)
git init
git add .
git commit -m "Initial production release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance-system.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Select your `attendance-system` repository
4. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
5. Add **Environment Variables** (click "Environment Variables" section):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key (Settings → API) |
| `STUDENT_AUTH_SECRET` | Any strong random string (e.g., `openssl rand -hex 32`) |

6. Click **Deploy**

### Step 3: Configure Custom Domain (Optional)

1. In Vercel dashboard → Settings → Domains
2. Add your domain (e.g., `attendance.yourschool.edu`)
3. Update DNS records as shown

---

## Supabase Setup

### Required Migrations (Run in Order)

Go to **Supabase Dashboard → SQL Editor** and run each file:

```
1. database/schema.sql                    — Core tables
2. database/migration-holidays.sql        — Holiday system
3. database/migration-weekly-off-days.sql — Weekly off days
4. database/migration-class-dates.sql     — Class start/end dates
5. database/migration-student-auth.sql    — Student/Parent login support
6. database/migration-performance.sql     — Indexes for 50K+ students
7. database/migration-lecture-sessions.sql — Subject-wise lecture tracking
8. database/migration-logo.sql            — Institution logo support
9. database/migration-periods-fix.sql     — Period configuration
```

### Supabase Storage Setup

After running `migration-logo.sql`, verify the storage bucket:
1. Go to **Storage** in Supabase dashboard
2. You should see `institution-logos` bucket
3. If not, create it manually: Name = `institution-logos`, Public = Yes

### Environment Variables (Where to Find)

- **Supabase URL**: Dashboard → Settings → API → Project URL
- **Anon Key**: Dashboard → Settings → API → anon/public key
- **Service Role Key**: Dashboard → Settings → API → service_role key (keep secret!)

---

## Post-Deploy Checklist

### 1. Create Admin User
```sql
-- In Supabase SQL Editor, after creating a user via Auth:
UPDATE users SET role = 'super_admin' WHERE email = 'your-admin@email.com';
```

### 2. Set Up Institution
- Login at `/login` with admin credentials
- Go to Super Admin → Institutions → Add New
- Upload institution logo (appears on all reports)
- Set weekly off days (Settings → Weekly Off Days)

### 3. Configure Academic Year
- Super Admin → Academic Years → Add (e.g., 2025-26)
- Set `is_current = true`

### 4. Add Classes
- Super Admin → Classes → Add classes (XII Sci A, XII Com A, etc.)
- Set class start/end dates in Class Configuration

### 5. Add Faculty
- Super Admin → Faculty → Add faculty members
- Assign class teachers in Class Teachers page
- Assign subjects in Faculty Assignment page

### 6. Import Students
- Super Admin → Students → Add students
- Required fields: first_name, last_name, class_id, admission_number
- For student/parent portal: gr_number, date_of_birth, parent_phone

### 7. Test Student Portal
- Visit `/student-login`
- Login with GR Number + Date of Birth
- Verify dashboard shows attendance data

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Vercel (Frontend)           │
│  Next.js 14 App Router                  │
│  ├── /login (Faculty/Admin)             │
│  ├── /student-login (Student/Parent)    │
│  ├── /super-admin/* (Admin Dashboard)   │
│  ├── /faculty/* (Faculty Dashboard)     │
│  ├── /student/* (Student Dashboard)     │
│  └── /parent/* (Parent Dashboard)       │
├─────────────────────────────────────────┤
│          Supabase (Backend)             │
│  ├── PostgreSQL Database                │
│  ├── Auth (Admin/Faculty)               │
│  ├── Storage (Logos)                    │
│  └── Row Level Security                │
└─────────────────────────────────────────┘
```

### Key Design Decisions
- **Admin/Faculty Auth**: Supabase Auth (email/password)
- **Student/Parent Auth**: Custom cookie-based (GR + DOB, no email needed)
- **Student Dashboard API**: Server-side with service_role key (bypasses RLS)
- **Reports**: Client-side rendering with print CSS + HTML export
- **Performance**: Indexed for 50,000+ students

---

## Updating the App

After making changes:

```bash
git add .
git commit -m "Description of changes"
git push
```

Vercel auto-deploys on every push to `main`.

### To deploy specific branches:
```bash
git checkout -b staging
git push origin staging
```
Vercel creates preview deployments for branches.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Failed to compile: Expected semicolon" | Check for `catch {}` — change to `catch (e) {}` |
| Student login shows 0% | Run `migration-student-auth.sql` + `migration-performance.sql` |
| Reports show "table not found" | Run the relevant migration SQL file |
| Logo not uploading | Run `migration-logo.sql`, check Storage bucket exists |
| 401 on student dashboard | Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars |
| Attendance > 100% | Run `migration-performance.sql` for UNIQUE constraint |

---

## File Structure

```
attendance-system/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          — Faculty/Admin login
│   │   └── student-login/page.tsx  — Student/Parent login
│   ├── (dashboard)/
│   │   ├── super-admin/            — Admin pages
│   │   ├── faculty/                — Faculty pages
│   │   ├── student/dashboard/      — Student dashboard
│   │   └── parent/dashboard/       — Parent dashboard
│   └── api/
│       ├── auth/student-login/     — Student auth API
│       └── student/dashboard-data/ — Student dashboard API
├── database/
│   └── *.sql                       — Migration files
├── lib/
│   ├── supabase/                   — Supabase clients
│   └── hooks/                      — Shared hooks
├── middleware.ts                    — Auth routing
└── .env.local                      — Local environment vars
```
