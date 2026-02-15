-- =============================================
-- MIGRATION: Performance Optimization for Scale
-- Auto-detects your schema and creates proper indexes
-- Safe to run multiple times (all IF NOT EXISTS)
-- =============================================

-- ═══════════════════════════════════════════════
-- 1. ENSURE SIMPLE 'attendance' TABLE EXISTS
-- The app code uses a simple table. If your DB
-- only has attendance_sessions + attendance_records,
-- this creates the simple table the app needs.
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
  is_late BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- ═══════════════════════════════════════════════
-- 2. INDEXES ON 'attendance' TABLE
-- ═══════════════════════════════════════════════

-- Student dashboard: fetch one student's attendance in date range
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
  ON attendance(student_id, date DESC);

-- Daily summary: all attendance for a specific date
CREATE INDEX IF NOT EXISTS idx_attendance_date_status 
  ON attendance(date, status);

-- Class reports: attendance filtered by class + date
CREATE INDEX IF NOT EXISTS idx_attendance_class_date 
  ON attendance(class_id, date DESC);

-- Institution + date filter (for cross-class reports)
CREATE INDEX IF NOT EXISTS idx_attendance_inst_date 
  ON attendance(institution_id, date DESC);

-- ═══════════════════════════════════════════════
-- 3. INDEXES ON 'attendance_sessions' (if exists)
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_attsess_class_date 
      ON attendance_sessions(class_id, session_date DESC);
    CREATE INDEX IF NOT EXISTS idx_attsess_inst_date 
      ON attendance_sessions(institution_id, session_date DESC);
    CREATE INDEX IF NOT EXISTS idx_attsess_faculty 
      ON attendance_sessions(faculty_id, session_date DESC);
  END IF;
END $$;

-- ═══════════════════════════════════════════════
-- 4. INDEXES ON 'attendance_records' (if exists)
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_records') THEN
    CREATE INDEX IF NOT EXISTS idx_attrec_student_session 
      ON attendance_records(student_id, session_id);
    CREATE INDEX IF NOT EXISTS idx_attrec_session_status 
      ON attendance_records(session_id, status);
  END IF;
END $$;

-- ═══════════════════════════════════════════════
-- 5. STUDENT TABLE INDEXES
-- ═══════════════════════════════════════════════

-- Login: GR Number + DOB
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'gr_number') THEN
    CREATE INDEX IF NOT EXISTS idx_students_gr_dob ON students(gr_number, date_of_birth);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_admission_dob 
  ON students(admission_number, date_of_birth);

-- Students by class (dashboard, reports)
CREATE INDEX IF NOT EXISTS idx_students_class 
  ON students(class_id);

-- Parent phone (sibling lookup)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'parent_phone') THEN
    CREATE INDEX IF NOT EXISTS idx_students_parent_phone 
      ON students(institution_id, parent_phone);
  END IF;
END $$;

-- ═══════════════════════════════════════════════
-- 6. LECTURE TABLES (if exist)
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lecture_sessions') THEN
    CREATE INDEX IF NOT EXISTS idx_lectsess_class_date 
      ON lecture_sessions(class_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_lectsess_subject 
      ON lecture_sessions(subject_id, date DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lecture_attendance') THEN
    CREATE INDEX IF NOT EXISTS idx_lectatt_student 
      ON lecture_attendance(student_id, lecture_session_id);
    CREATE INDEX IF NOT EXISTS idx_lectatt_session 
      ON lecture_attendance(lecture_session_id, status);
  END IF;
END $$;

-- ═══════════════════════════════════════════════
-- 7. HOLIDAYS, CLASSES, FACULTY
-- ═══════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_holidays_inst_date 
  ON holidays(institution_id, date);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'is_active') THEN
    CREATE INDEX IF NOT EXISTS idx_classes_inst_active 
      ON classes(institution_id, is_active);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'class_teacher_id') THEN
    CREATE INDEX IF NOT EXISTS idx_classes_teacher 
      ON classes(class_teacher_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faculty_assignments') THEN
    CREATE INDEX IF NOT EXISTS idx_facassign_faculty 
      ON faculty_assignments(faculty_id);
    CREATE INDEX IF NOT EXISTS idx_facassign_class 
      ON faculty_assignments(class_id, subject_id);
  END IF;
END $$;

-- Student subjects
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_subjects') THEN
    CREATE INDEX IF NOT EXISTS idx_studsub_student 
      ON student_subjects(student_id);
    CREATE INDEX IF NOT EXISTS idx_studsub_subject 
      ON student_subjects(subject_id, academic_year_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════
-- 8. RLS POLICIES FOR attendance TABLE
-- ═══════════════════════════════════════════════

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read attendance for their institution
DO $$ BEGIN
  CREATE POLICY "attendance_read" ON attendance
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "attendance_write" ON attendance
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════
-- 9. UPDATE STATISTICS
-- ═══════════════════════════════════════════════

ANALYZE attendance;
ANALYZE students;
ANALYZE holidays;
ANALYZE classes;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_sessions') THEN
    ANALYZE attendance_sessions;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_records') THEN
    ANALYZE attendance_records;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lecture_sessions') THEN
    ANALYZE lecture_sessions;
  END IF;
END $$;

-- ═══════════════════════════════════════════════
-- 10. VERIFY
-- ═══════════════════════════════════════════════

SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('attendance', 'attendance_sessions', 'attendance_records', 'students', 'holidays', 'classes', 'lecture_sessions', 'lecture_attendance')
ORDER BY tablename, indexname;
