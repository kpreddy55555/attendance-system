# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Supabase
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run `database/schema.sql` in SQL Editor
4. Get your credentials from Settings → API

### 3. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### 4. Run Development Server
```bash
npm run dev
```

Open http://localhost:3000

### 5. Create Super Admin
After signing up, run in Supabase SQL Editor:
```sql
UPDATE users 
SET role = 'super_admin'
WHERE email = 'your-email@domain.com';
```

## 📚 Next Steps

1. Read `SETUP-GUIDE.md` for complete setup
2. Check `README.md` for full documentation
3. Review `database/schema.sql` for database structure

## 🎯 Key Features to Try

1. **Create Institution** - Super Admin Dashboard
2. **Add Students** - Import via CSV
3. **Mark Attendance** - Faculty Dashboard
4. **View Reports** - Analytics Dashboard
5. **QR Scanning** - Student Dashboard

## 🆘 Need Help?

- Check `SETUP-GUIDE.md` for detailed instructions
- Review `README.md` for troubleshooting
- Email: support@yourcompany.com

Happy coding! 🎉
