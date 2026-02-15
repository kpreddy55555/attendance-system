# Complete Setup Guide - Student Attendance System

## Step-by-Step Setup Instructions

### Phase 1: Initial Setup (15 minutes)

#### 1.1 Install Dependencies
```bash
cd attendance-system
npm install
```

#### 1.2 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Project name: "Student Attendance System"
   - Database password: (save this securely)
   - Region: (choose nearest to your users)
4. Wait for project creation (~2 minutes)

#### 1.3 Setup Database Schema
1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy entire contents of `database/schema.sql`
4. Paste and click **Run**
5. Wait for completion message

#### 1.4 Setup Row Level Security
1. Still in SQL Editor, click **New Query**
2. Copy entire contents of `database/rls-policies.sql`
3. Paste and click **Run**
4. Verify no errors

#### 1.5 Configure Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

Find these in: Supabase Dashboard → Settings → API

### Phase 2: Create Super Admin (10 minutes)

#### 2.1 Sign Up First User
```bash
npm run dev
```

Open http://localhost:3000 and sign up with:
- Email: your-email@domain.com
- Password: (secure password)

#### 2.2 Make User Super Admin
In Supabase Dashboard → SQL Editor:
```sql
-- Replace 'your-email@domain.com' with your actual email
UPDATE users 
SET role = 'super_admin'
WHERE email = 'your-email@domain.com';
```

#### 2.3 Verify Super Admin Access
1. Logout and login again
2. You should see "Super Admin Dashboard"
3. Access to "Manage Institutions"

### Phase 3: Create First Institution (20 minutes)

#### 3.1 Add Institution
1. Navigate to **Super Admin** → **Institutions**
2. Click **Add New Institution**
3. Fill in:
   - Name: "Demo Junior College"
   - Code: "DEMO001"
   - Type: "junior_college"
   - Board: "State Board"
   - Contact details

#### 3.2 Create Academic Year
1. Go to **Admin Dashboard** (switch institution)
2. Navigate to **Settings** → **Academic Years**
3. Add:
   - Year: "2024-25"
   - Start Date: 2024-06-01
   - End Date: 2025-05-31
   - Mark as Current: Yes

#### 3.3 Add Classes
1. Navigate to **Classes** → **Add Class**
2. Create multiple classes:
   - 11th Science A
   - 11th Science B
   - 11th Commerce A
   - 12th Science A
   (Customize based on your needs)

#### 3.4 Add Subjects
1. Navigate to **Subjects** → **Add Subject**
2. Create subjects:
   - Physics (PHY101) - Core
   - Chemistry (CHEM101) - Core
   - Mathematics (MATH101) - Core
   - Biology (BIO101) - Optional
   - Computer Science (CS101) - Optional

#### 3.5 Assign Subjects to Classes
1. Navigate to **Classes** → Select a class
2. Click **Manage Subjects**
3. Assign subjects and mark optionals

### Phase 4: Add Users (30 minutes)

#### 4.1 Create Institution Admin
1. Navigate to **Users** → **Add User**
2. Fill in:
   - Role: Institution Admin
   - Name: "Admin Name"
   - Email: admin@democollege.edu
   - Phone: +91xxxxxxxxxx
3. Admin receives invitation email

#### 4.2 Add Faculty Members
1. Navigate to **Faculty** → **Add Faculty**
2. Create multiple faculty:
   - Employee ID
   - Name
   - Email
   - Department
   - Subjects they teach
3. Repeat for all faculty

#### 4.3 Bulk Import Students
1. Navigate to **Students** → **Import Students**
2. Download CSV template
3. Fill in student data:
   ```
   admission_number,roll_number,full_name,email,class_id,date_of_birth,gender
   2024001,1,John Doe,john@example.com,class-uuid,2008-01-15,male
   2024002,2,Jane Smith,jane@example.com,class-uuid,2008-03-22,female
   ```
4. Upload CSV
5. Verify and confirm import

#### 4.4 Add Parents (Optional)
1. Navigate to **Parents** → **Add Parent**
2. Link to students
3. Mark primary contact for notifications

### Phase 5: Configure Attendance Settings (15 minutes)

#### 5.1 Configure Biometric Devices (if applicable)
1. Navigate to **Devices** → **Add Device**
2. Fill in:
   - Device Name: "Main Gate Fingerprint"
   - Device ID: (from device)
   - Type: Fingerprint/Face Recognition
   - Location: "Main Entrance"
   - API Key: (from device manufacturer)

#### 5.2 Setup Notification Templates
1. Navigate to **Settings** → **Notifications**
2. Configure:
   - Absence alert templates
   - Low attendance warnings
   - Email/SMS settings

#### 5.3 Set Attendance Rules
1. Navigate to **Settings** → **Attendance Rules**
2. Configure:
   - Minimum attendance percentage: 75%
   - Late threshold: 5 minutes
   - Grace period for QR codes: 15 minutes
   - Defaulter alert threshold: 70%

### Phase 6: Test Attendance Marking (20 minutes)

#### 6.1 Manual Attendance (Faculty)
1. Login as Faculty
2. Navigate to **Mark Attendance**
3. Select:
   - Date: Today
   - Class: 11th Science A
   - Subject: Physics
   - Session Type: Lecture
   - Lecture Number: 1
4. Click **Create Session**
5. Mark attendance for all students
6. Save

#### 6.2 QR Code Attendance
1. Login as Faculty
2. Create attendance session
3. Click **Generate QR Code**
4. Display QR on projector/screen
5. Students scan with mobile
6. Verify attendance marks

#### 6.3 Verify Reports
1. Navigate to **Reports** → **Daily Report**
2. Check today's attendance
3. Verify present/absent counts
4. Export to PDF

### Phase 7: Production Deployment (30 minutes)

#### 7.1 Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

#### 7.2 Configure Custom Domain (Optional)
1. In Vercel Dashboard
2. Go to Settings → Domains
3. Add your domain
4. Update DNS records

#### 7.3 Setup Monitoring
1. Enable Vercel Analytics
2. Setup error tracking (Sentry)
3. Configure uptime monitoring

#### 7.4 Backup Strategy
1. Enable Supabase automatic backups
2. Schedule manual backups weekly
3. Document restore procedure

### Phase 8: User Training (Ongoing)

#### 8.1 Create Training Materials
- Faculty training guide
- Student QR scanning guide
- Parent app guide
- Admin manual

#### 8.2 Conduct Training Sessions
- Admin training: 2 hours
- Faculty training: 1 hour
- Student orientation: 30 minutes
- Parent orientation: 30 minutes

#### 8.3 Provide Support
- Setup helpdesk email
- Create FAQ document
- Establish support channels

## Common Issues & Solutions

### Issue: Students can't scan QR code
**Solution**: 
- Check QR code hasn't expired (15 min default)
- Verify student is in correct class
- Check camera permissions on mobile

### Issue: Attendance not saving
**Solution**:
- Check internet connectivity
- Verify Supabase connection
- Check browser console for errors

### Issue: Parents not receiving notifications
**Solution**:
- Verify email/phone number
- Check SMTP/SMS configuration
- Verify parent is marked as primary contact

### Issue: Reports showing incorrect data
**Solution**:
```sql
-- Refresh materialized view
SELECT refresh_attendance_summary();
```

## Performance Optimization

### For 500+ Institutions

1. **Database Optimization**
   - Add indexes on frequently queried columns
   - Regular VACUUM and ANALYZE
   - Monitor slow queries

2. **Caching Strategy**
   - Cache institution settings
   - Cache user profiles
   - Use Redis for session data

3. **CDN Setup**
   - Serve static assets via CDN
   - Cache API responses where appropriate
   - Use edge functions for QR generation

4. **Monitoring**
   - Setup performance monitoring
   - Track API response times
   - Monitor database query performance

## Security Checklist

- [ ] Enable 2FA for all admins
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Implement rate limiting
- [ ] Regular backup verification
- [ ] SSL/TLS certificates valid
- [ ] Environment variables secured
- [ ] Database access restricted
- [ ] API endpoints authenticated
- [ ] Input validation enabled

## Support Contacts

- Technical Issues: tech@yourcompany.com
- Billing: billing@yourcompany.com
- Training: training@yourcompany.com
- Emergency: +91-XXX-XXX-XXXX

---

Setup complete! 🎉 Your attendance system is ready to use.
