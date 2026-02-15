# Student Attendance System

A comprehensive multi-tenant SaaS attendance management system built for 500+ educational institutions.

## 🚀 Features

### Core Features
- **Multi-Tenancy**: Support for 500+ institutions
- **Role-Based Access**: Super Admin, Institution Admin, Faculty, Students, Parents
- **Multiple Attendance Methods**:
  - Manual entry via web interface
  - QR Code scanning
  - Biometric integration
  - Mobile app marking
- **Real-time Updates**: Live attendance tracking with Supabase subscriptions
- **Analytics & Reports**: Comprehensive attendance analysis
- **Notifications**: Email/SMS alerts for absences
- **Leave Management**: Student leave requests and approvals

### Attendance Types
- Day-wise attendance
- Lecture-wise attendance
- Subject-specific tracking
- Practical/Lab session tracking

### Reports & Analytics
- Student-wise attendance summary
- Subject-wise reports
- Class-wise defaulter lists
- Monthly/yearly trends
- Attendance percentage tracking
- Export to PDF/Excel

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- (Optional) SMTP server for email notifications
- (Optional) SMS gateway for SMS notifications

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd attendance-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database schema:
   - Go to SQL Editor in Supabase Dashboard
   - Copy and paste contents of `database/schema.sql`
   - Execute the SQL
3. Run the RLS policies:
   - Copy and paste contents of `database/rls-policies.sql`
   - Execute the SQL

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Update the following variables:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
attendance-system/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (dashboard)/         # Dashboard pages for all roles
│   ├── api/                 # API routes
│   └── layout.tsx           # Root layout
├── components/
│   ├── ui/                  # Reusable UI components
│   ├── attendance/          # Attendance-specific components
│   ├── students/            # Student management components
│   ├── reports/             # Report components
│   ├── notifications/       # Notification components
│   ├── layout/              # Layout components
│   └── shared/              # Shared components
├── lib/
│   ├── supabase/           # Supabase client configuration
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Business logic services
│   ├── utils/              # Utility functions
│   └── constants/          # Constants and configurations
├── types/                   # TypeScript type definitions
├── database/               # Database schema and migrations
└── public/                 # Static assets
```

## 🔐 User Roles & Permissions

### Super Admin
- Manage all institutions
- Platform-wide analytics
- System configuration

### Institution Admin
- Manage institution settings
- Manage faculty, students, classes
- View all reports
- Approve leave requests

### Faculty
- Create attendance sessions
- Mark attendance
- View student attendance
- Generate reports

### Student
- View own attendance
- Mark attendance via QR/mobile
- Submit leave requests

### Parent
- View child's attendance
- Receive absence notifications
- View reports

## 🔧 Configuration

### Email Notifications
Configure SMTP settings in `.env.local`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### SMS Notifications
Configure SMS gateway in `.env.local`:
```
SMS_API_KEY=your-api-key
SMS_API_URL=your-sms-gateway-url
```

### Feature Flags
Enable/disable features in `.env.local`:
```
NEXT_PUBLIC_ENABLE_QR_ATTENDANCE=true
NEXT_PUBLIC_ENABLE_BIOMETRIC=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
```

## 📊 Database Schema

The system uses PostgreSQL (via Supabase) with the following main tables:

- **institutions**: Multi-tenant institution data
- **users**: User authentication and profiles
- **students**: Student information
- **faculty**: Faculty information
- **classes**: Class/division information
- **subjects**: Subject definitions
- **attendance_sessions**: Attendance session records
- **attendance_records**: Individual attendance marks
- **notifications**: Notification queue
- **leave_requests**: Leave management

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms
The app can be deployed to any Next.js-compatible platform:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 📱 Mobile App

The system includes QR scanning functionality. For full mobile experience:
1. Build a React Native/Flutter app
2. Integrate with the same Supabase backend
3. Use the existing API endpoints

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control
- Secure authentication via Supabase Auth
- Environment variable protection
- API rate limiting (recommended to add)

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:coverage
```

## 📝 API Documentation

### Attendance Endpoints

#### Create Session
```
POST /api/attendance/sessions
```

#### Mark Attendance
```
POST /api/attendance/mark
```

#### Generate QR Code
```
POST /api/attendance/qr/generate
```

#### Verify QR Code
```
POST /api/attendance/qr/verify
```

#### Get Reports
```
GET /api/attendance/reports?type=summary&class_id=xxx
```

See full API documentation in `/docs/api.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For support, email support@yourcompany.com or join our Slack channel.

## 🙏 Acknowledgments

- Built with Next.js and Supabase
- UI components from shadcn/ui
- Icons from Lucide React

## 📈 Roadmap

- [ ] Mobile apps (iOS/Android)
- [ ] Biometric device integrations
- [ ] Advanced analytics dashboard
- [ ] Automated report scheduling
- [ ] Integration with LMS systems
- [ ] Multi-language support
- [ ] Offline mode support

---

Made with ❤️ for educational institutions
