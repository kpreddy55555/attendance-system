import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function decodeToken(token: string, secret: string): any | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const crypto = require('crypto');
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // 1. Validate session
  const token = req.cookies.get('student_session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const secret = process.env.STUDENT_AUTH_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'edutrack-secret-key';
  const session = decodeToken(token, secret);
  if (!session) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  // 2. Create admin client (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const url = new URL(req.url);
  const childId = url.searchParams.get('child_id') || session.student_id;
  const month = url.searchParams.get('month') || formatMonth(new Date());

  try {
    // 3. Fetch student record
    let student: any = null;
    const fullQuery = await supabase
      .from('students')
      .select('id, first_name, last_name, class_id, institution_id, academic_year_id, roll_number, gr_number, admission_number, parent_name, parent_phone, gender, date_of_birth')
      .eq('id', childId)
      .single();

    if (fullQuery.data) {
      student = fullQuery.data;
    } else {
      // Fallback: basic columns
      const basicQuery = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id, institution_id, academic_year_id, roll_number, admission_number, date_of_birth')
        .eq('id', childId)
        .single();
      student = basicQuery.data;
    }

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Security: parent can only view their own children
    if (session.role === 'parent' && childId !== session.student_id) {
      const primaryQuery = await supabase
        .from('students')
        .select('parent_phone')
        .eq('id', session.student_id)
        .single();
      if (!primaryQuery.data?.parent_phone || primaryQuery.data.parent_phone !== student.parent_phone) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // 4. Fetch institution, academic year, class, holidays in parallel
    let inst: any = null;
    let ay: any = null;
    let cls: any = null;
    let holidays: any[] = [];

    // Fetch institution, class, holidays in parallel (NOT academic year - handled separately)
    const results = await Promise.allSettled([
      supabase.from('institutions').select('id, name, weekly_off_days').eq('id', student.institution_id).single(),
      supabase.from('classes').select('id, name, grade, division, classes_start_date, classes_end_date, class_teacher_id').eq('id', student.class_id).single(),
      supabase.from('holidays').select('date, holiday_type, name').eq('institution_id', student.institution_id),
    ]);

    if (results[0].status === 'fulfilled' && results[0].value.data) {
      inst = results[0].value.data;
    } else {
      var instFB = await supabase.from('institutions').select('id, name').eq('id', student.institution_id).single();
      inst = instFB.data;
    }

    // Academic year: try student's ID first, then current for institution, then latest
    if (student.academic_year_id) {
      var ayDirect = await supabase
        .from('academic_years')
        .select('id, year_name, start_date, end_date')
        .eq('id', student.academic_year_id)
        .single();
      ay = ayDirect.data;
    }
    if (!ay) {
      var ayCurrent = await supabase
        .from('academic_years')
        .select('id, year_name, start_date, end_date')
        .eq('institution_id', student.institution_id)
        .eq('is_current', true)
        .single();
      ay = ayCurrent.data;
    }
    if (!ay) {
      var ayLatest = await supabase
        .from('academic_years')
        .select('id, year_name, start_date, end_date')
        .eq('institution_id', student.institution_id)
        .order('start_date', { ascending: false })
        .limit(1);
      ay = (ayLatest.data && ayLatest.data.length > 0) ? ayLatest.data[0] : null;
    }

    if (results[1].status === 'fulfilled' && results[1].value.data) {
      cls = results[1].value.data;
    } else {
      var clsFB = await supabase.from('classes').select('id, name, grade, division').eq('id', student.class_id).single();
      cls = clsFB.data;
    }

    if (results[2].status === 'fulfilled' && results[2].value.data) {
      holidays = results[2].value.data;
    }

    // 5. Build working day logic
    const offDays: number[] = Array.isArray(inst?.weekly_off_days) ? inst.weekly_off_days : [0];
    const classStart = cls?.classes_start_date || ay?.start_date || '2025-06-15';
    const classEnd = cls?.classes_end_date || ay?.end_date;
    const today = new Date().toISOString().split('T')[0];

    const holSet = new Set(holidays.filter(function(h: any) { return h.holiday_type !== 'working_override'; }).map(function(h: any) { return h.date; }));
    const overrideSet = new Set(holidays.filter(function(h: any) { return h.holiday_type === 'working_override'; }).map(function(h: any) { return h.date; }));

    // 6. Fetch ALL attendance for this student
    const attQuery = await supabase
      .from('attendance')
      .select('date, status, is_late')
      .eq('student_id', childId)
      .gte('date', classStart)
      .lte('date', today)
      .order('date', { ascending: true });

    var allAtt = attQuery.data || [];
    var attMap: Record<string, { status: string; is_late: boolean }> = {};
    for (var i = 0; i < allAtt.length; i++) {
      attMap[allAtt[i].date] = { status: allAtt[i].status, is_late: !!allAtt[i].is_late };
    }

    // 7. Calculate cumulative working days
    var cumWD = 0;
    var cursor = new Date(classStart + 'T00:00:00');
    var todayD = new Date(today + 'T00:00:00');
    var endD = classEnd ? new Date(classEnd + 'T00:00:00') : todayD;
    var effectiveEnd = todayD < endD ? todayD : endD;

    while (cursor <= effectiveEnd) {
      var ds = cursor.toISOString().split('T')[0];
      var isWeeklyOff = offDays.includes(cursor.getDay());
      var isHoliday = holSet.has(ds);
      var isOverride = overrideSet.has(ds);
      if ((!isWeeklyOff && !isHoliday) || isOverride) {
        cumWD++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    var cumPresent = allAtt.filter(function(a: any) { return a.status === 'present'; }).length;
    var cumAbsent = cumWD - cumPresent;
    var overallPct = cumWD > 0 ? Math.round((cumPresent / cumWD) * 1000) / 10 : 0;

    // Streak
    var streak = 0;
    var sorted = allAtt.slice().sort(function(a: any, b: any) { return b.date.localeCompare(a.date); });
    for (var j = 0; j < sorted.length; j++) {
      if (sorted[j].status === 'present') { streak++; } else { break; }
    }

    // 8. Monthly calendar
    var parts = month.split('-');
    var yr = parseInt(parts[0]);
    var mo = parseInt(parts[1]);
    var nd = new Date(yr, mo, 0).getDate();
    var days: any[] = [];
    var mWD = 0;
    var mP = 0;

    for (var d = 1; d <= nd; d++) {
      var dateStr = month + '-' + String(d).padStart(2, '0');
      var dt = new Date(yr, mo - 1, d);
      var status = '';

      if (dateStr < classStart) {
        status = '';
      } else if (dateStr > today) {
        status = 'F';
      } else if (overrideSet.has(dateStr)) {
        mWD++;
        var att1 = attMap[dateStr];
        if (att1 && att1.status === 'present') { status = att1.is_late ? 'L' : 'P'; mP++; } else { status = 'A'; }
      } else if (offDays.includes(dt.getDay())) {
        status = 'S';
      } else if (holSet.has(dateStr)) {
        status = 'H';
      } else {
        mWD++;
        var att2 = attMap[dateStr];
        if (att2 && att2.status === 'present') { status = att2.is_late ? 'L' : 'P'; mP++; } else { status = 'A'; }
      }
      days.push({ date: dateStr, day: d, status: status });
    }

    var monthPct = mWD > 0 ? Math.round((mP / mWD) * 1000) / 10 : 0;

    // 9. Subject-wise attendance
    var subjectAtt: any[] = [];
    try {
      var enrollQuery = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', childId)
        .eq('is_active', true);

      var enrollments = enrollQuery.data;
      if (enrollments && enrollments.length > 0) {
        var subIds = enrollments.map(function(e: any) { return e.subject_id; });
        var subsQuery = await supabase.from('subjects').select('id, name').in('id', subIds);
        var sessQuery = await supabase.from('lecture_sessions')
          .select('id, subject_id')
          .eq('class_id', student.class_id)
          .in('subject_id', subIds)
          .gte('date', classStart)
          .lte('date', today);

        var subMap: Record<string, string> = {};
        (subsQuery.data || []).forEach(function(s: any) { subMap[s.id] = s.name; });

        var sessionIds = (sessQuery.data || []).map(function(s: any) { return s.id; });
        var lectAtt: any[] = [];

        if (sessionIds.length > 0) {
          for (var k = 0; k < sessionIds.length; k += 100) {
            var chunk = sessionIds.slice(k, k + 100);
            var chunkQuery = await supabase
              .from('lecture_attendance')
              .select('lecture_session_id, status')
              .eq('student_id', childId)
              .in('lecture_session_id', chunk);
            lectAtt = lectAtt.concat(chunkQuery.data || []);
          }
        }

        var attBySession: Record<string, string> = {};
        lectAtt.forEach(function(a: any) { attBySession[a.lecture_session_id] = a.status; });

        var subStats: Record<string, { total: number; present: number }> = {};
        (sessQuery.data || []).forEach(function(s: any) {
          if (!subStats[s.subject_id]) { subStats[s.subject_id] = { total: 0, present: 0 }; }
          subStats[s.subject_id].total++;
          if (attBySession[s.id] === 'present') { subStats[s.subject_id].present++; }
        });

        subjectAtt = Object.entries(subStats).map(function(entry) {
          var sid = entry[0];
          var stat = entry[1];
          return {
            subjectName: subMap[sid] || 'Unknown',
            totalLectures: stat.total,
            attended: stat.present,
            pct: stat.total > 0 ? Math.round((stat.present / stat.total) * 1000) / 10 : 0,
          };
        }).sort(function(a, b) { return a.pct - b.pct; });
      }
    } catch (subErr) {
      console.log('Subject-wise skipped:', subErr);
    }

    // 10. Class teacher
    var classTeacher: any = null;
    try {
      if (cls && cls.class_teacher_id) {
        var teacherQuery = await supabase
          .from('faculty')
          .select('first_name, last_name, phone, email')
          .eq('id', cls.class_teacher_id)
          .single();
        classTeacher = teacherQuery.data;
      }
    } catch (ctErr) {
      console.log('Class teacher skipped:', ctErr);
    }

    // 11. Siblings (for parent portal)
    var siblings: any[] = [];
    try {
      if (session.role === 'parent' && student.parent_phone) {
        var sibQuery = await supabase
          .from('students')
          .select('id, first_name, last_name, class_id, roll_number, gr_number, admission_number, academic_year_id')
          .eq('institution_id', student.institution_id)
          .eq('parent_phone', student.parent_phone)
          .eq('is_active', true);

        var sibs = sibQuery.data;
        if (sibs && sibs.length > 1) {
          var sibClassIds = sibs.map(function(s: any) { return s.class_id; });
          var uniqueClassIds = sibClassIds.filter(function(id: string, idx: number, arr: string[]) { return arr.indexOf(id) === idx; });
          var sibClassQuery = await supabase.from('classes').select('id, name').in('id', uniqueClassIds);
          var clsMap: Record<string, string> = {};
          (sibClassQuery.data || []).forEach(function(c: any) { clsMap[c.id] = c.name; });
          siblings = sibs.map(function(s: any) {
            return {
              id: s.id,
              first_name: s.first_name,
              last_name: s.last_name,
              class_id: s.class_id,
              class_name: clsMap[s.class_id] || '',
              roll_number: s.roll_number,
              gr_number: s.gr_number || s.admission_number,
            };
          });
        }
      }
    } catch (sibErr) {
      console.log('Siblings skipped:', sibErr);
    }

    // 12. Return everything
    return NextResponse.json({
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        roll_number: student.roll_number,
        gr_number: student.gr_number || student.admission_number,
        class_name: cls?.name || '',
        gender: student.gender || '',
        parent_name: student.parent_name || '',
        parent_phone: student.parent_phone || '',
      },
      institution: { name: inst?.name || '' },
      academicYear: { name: ay?.year_name || ay?.name || '' },
      cumulative: {
        workingDays: cumWD,
        present: cumPresent,
        absent: cumAbsent,
        pct: overallPct,
        streak: streak,
      },
      monthly: {
        workingDays: mWD,
        present: mP,
        pct: monthPct,
        days: days,
      },
      subjectAtt: subjectAtt,
      classTeacher: classTeacher,
      siblings: siblings,
      role: session.role,
    });

  } catch (err: any) {
    console.error('Dashboard data error:', err);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}

function formatMonth(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
