-- =============================================
-- MIGRATION: Lecture Sessions & Lecture Attendance
-- Run this in Supabase SQL Editor
-- Required for: Subject-wise Report, Faculty Summary,
--   Lecture Attendance marking, Daily Overview
-- =============================================

-- Lecture Sessions table
CREATE TABLE IF NOT EXISTS lecture_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE,
  period_from TEXT,
  period_to TEXT,
  time_from TIME,
  time_to TIME,
  batch_name TEXT,
  session_type TEXT DEFAULT 'regular' CHECK (session_type IN ('regular', 'extra', 'practical', 'tutorial')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lecture Attendance table
CREATE TABLE IF NOT EXISTS lecture_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecture_session_id UUID REFERENCES lecture_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  is_late BOOLEAN DEFAULT false,
  marked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lecture_session_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lecture_sessions_class_date ON lecture_sessions(class_id, date);
CREATE INDEX IF NOT EXISTS idx_lecture_sessions_faculty_date ON lecture_sessions(faculty_id, date);
CREATE INDEX IF NOT EXISTS idx_lecture_sessions_institution ON lecture_sessions(institution_id, date);
CREATE INDEX IF NOT EXISTS idx_lecture_attendance_session ON lecture_attendance(lecture_session_id);
CREATE INDEX IF NOT EXISTS idx_lecture_attendance_student ON lecture_attendance(student_id);

-- RLS for lecture_sessions
ALTER TABLE lecture_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view lecture sessions"
  ON lecture_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Faculty and admins can insert lecture sessions"
  ON lecture_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'institution_admin', 'faculty')
    )
  );

CREATE POLICY "Faculty and admins can update lecture sessions"
  ON lecture_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'institution_admin', 'faculty')
    )
  );

CREATE POLICY "Admins can delete lecture sessions"
  ON lecture_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'institution_admin')
    )
  );

-- RLS for lecture_attendance
ALTER TABLE lecture_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view lecture attendance"
  ON lecture_attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Faculty and admins can insert lecture attendance"
  ON lecture_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'institution_admin', 'faculty')
    )
  );

CREATE POLICY "Faculty and admins can update lecture attendance"
  ON lecture_attendance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'institution_admin', 'faculty')
    )
  );

CREATE POLICY "Admins can delete lecture attendance"
  ON lecture_attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'institution_admin')
    )
  );
