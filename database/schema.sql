-- =============================================
-- STUDENT ATTENDANCE SYSTEM - DATABASE SCHEMA
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SUPER ADMIN & INSTITUTIONS
-- =============================================

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('school', 'junior_college', 'college', 'university')),
  board TEXT,
  address JSONB,
  contact JSONB,
  settings JSONB DEFAULT '{}',
  subscription_plan TEXT,
  subscription_valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACADEMIC STRUCTURE
-- =============================================

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  year_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, year_name)
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  stream TEXT,
  division TEXT,
  class_teacher_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, academic_year_id, name)
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  subject_type TEXT CHECK (subject_type IN ('core', 'optional', 'practical', 'lab')),
  credits DECIMAL(3,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

CREATE TABLE class_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID,
  is_optional BOOLEAN DEFAULT false,
  total_lectures INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, subject_id)
);

-- =============================================
-- USERS & AUTHENTICATION
-- =============================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('super_admin', 'institution_admin', 'faculty', 'student', 'parent')),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  profile_photo TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  admission_number TEXT NOT NULL,
  roll_number TEXT,
  date_of_birth DATE,
  gender TEXT,
  blood_group TEXT,
  address JSONB,
  emergency_contact JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, admission_number)
);

CREATE TABLE student_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, academic_year_id)
);

CREATE TABLE faculty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  department TEXT,
  designation TEXT,
  joining_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, employee_id)
);

CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  relation TEXT CHECK (relation IN ('father', 'mother', 'guardian')),
  occupation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  is_primary_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, parent_id)
);

-- =============================================
-- ATTENDANCE CORE
-- =============================================

CREATE TABLE attendance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  faculty_id UUID REFERENCES faculty(id),
  session_date DATE NOT NULL,
  session_type TEXT CHECK (session_type IN ('lecture', 'practical', 'day')),
  lecture_number INT,
  start_time TIME,
  end_time TIME,
  method TEXT CHECK (method IN ('manual', 'biometric', 'qr_code', 'mobile_app')),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  total_students INT,
  present_count INT DEFAULT 0,
  absent_count INT DEFAULT 0,
  late_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attendance_sessions_date ON attendance_sessions(institution_id, session_date);
CREATE INDEX idx_attendance_sessions_class ON attendance_sessions(class_id, session_date);

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  marked_by UUID REFERENCES users(id),
  method TEXT CHECK (method IN ('manual', 'biometric', 'qr_code', 'mobile_app')),
  device_info JSONB,
  location JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX idx_attendance_records_student ON attendance_records(student_id, marked_at);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);

-- =============================================
-- LEAVE MANAGEMENT
-- =============================================

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  leave_type TEXT CHECK (leave_type IN ('sick', 'casual', 'emergency', 'other')),
  supporting_documents TEXT[],
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('absence_alert', 'low_attendance', 'leave_status', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  sent_via TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at);

-- =============================================
-- QR CODE & BIOMETRIC
-- =============================================

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  scan_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE biometric_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  device_type TEXT CHECK (device_type IN ('fingerprint', 'face_recognition', 'card_reader')),
  location TEXT,
  api_key TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ANALYTICS & REPORTS
-- =============================================

CREATE MATERIALIZED VIEW student_attendance_summary AS
SELECT 
  s.id as student_id,
  s.institution_id,
  s.academic_year_id,
  s.class_id,
  sub.id as subject_id,
  COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_count,
  COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late_count,
  COUNT(ar.id) as total_sessions,
  ROUND(
    (COUNT(ar.id) FILTER (WHERE ar.status = 'present')::DECIMAL / 
    NULLIF(COUNT(ar.id), 0) * 100), 2
  ) as attendance_percentage
FROM students s
LEFT JOIN student_subjects ss ON s.id = ss.student_id
LEFT JOIN subjects sub ON ss.subject_id = sub.id
LEFT JOIN attendance_sessions asess ON asess.class_id = s.class_id 
  AND (asess.subject_id = sub.id OR asess.subject_id IS NULL)
LEFT JOIN attendance_records ar ON ar.session_id = asess.id AND ar.student_id = s.id
GROUP BY s.id, s.institution_id, s.academic_year_id, s.class_id, sub.id;

CREATE INDEX idx_attendance_summary_student ON student_attendance_summary(student_id);
CREATE INDEX idx_attendance_summary_class ON student_attendance_summary(class_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION refresh_attendance_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_attendance_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_present_count(session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE attendance_sessions
  SET present_count = present_count + 1,
      updated_at = NOW()
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_attendance_trends(
  p_class_id UUID DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
)
RETURNS TABLE (
  month TEXT,
  total_sessions BIGINT,
  avg_attendance_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(asess.session_date, 'YYYY-MM') as month,
    COUNT(DISTINCT asess.id) as total_sessions,
    ROUND(
      AVG(
        CASE 
          WHEN asess.total_students > 0 
          THEN (asess.present_count::NUMERIC / asess.total_students * 100)
          ELSE 0 
        END
      ), 2
    ) as avg_attendance_percentage
  FROM attendance_sessions asess
  WHERE (p_class_id IS NULL OR asess.class_id = p_class_id)
    AND (p_subject_id IS NULL OR asess.subject_id = p_subject_id)
    AND (p_from_date IS NULL OR asess.session_date >= p_from_date)
    AND (p_to_date IS NULL OR asess.session_date <= p_to_date)
  GROUP BY TO_CHAR(asess.session_date, 'YYYY-MM')
  ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql;
