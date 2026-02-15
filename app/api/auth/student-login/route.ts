import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Simple token encoding (not full JWT, but signed for security)
function encodeToken(payload: any, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const crypto = require('crypto');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const { gr_number, date_of_birth, login_as } = await req.json();

    if (!gr_number || !date_of_birth) {
      return NextResponse.json({ error: 'GR Number and Date of Birth are required' }, { status: 400 });
    }

    // Create Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Find student by GR number (try gr_number first, then admission_number)
    let students: any[] | null = null;

    // Try with gr_number column first
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, gr_number, date_of_birth, roll_number, class_id, institution_id, academic_year_id, parent_name, parent_phone, gender')
        .or(`admission_number.eq.${gr_number},gr_number.eq.${gr_number}`);
      if (!error) students = data;
    } catch (e) { /* skip */ }

    // Fallback: if gr_number column doesn't exist, search only admission_number
    if (!students) {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, admission_number, date_of_birth, roll_number, class_id, institution_id, academic_year_id, gender')
          .eq('admission_number', gr_number);
        if (!error) students = data;
      } catch (e) { /* skip */ }
    }

    if (!students || students.length === 0) {
      // Try broader search
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, date_of_birth, roll_number, class_id, institution_id, academic_year_id')
        .eq('admission_number', gr_number);
      students = data;
    }

    if (!students || students.length === 0) {
      return NextResponse.json({ error: 'Invalid GR Number. Student not found.' }, { status: 401 });
    }

    // Find matching student with correct DOB
    const student = (students || []).find(s => {
      const sDate = s.date_of_birth;
      if (!sDate) return false;
      // Compare dates (handle both YYYY-MM-DD string and Date object)
      const sDob = typeof sDate === 'string' ? sDate : new Date(sDate).toISOString().split('T')[0];
      return sDob === date_of_birth;
    });

    if (!student) {
      return NextResponse.json({ error: 'Invalid GR Number or Date of Birth. Please check and try again.' }, { status: 401 });
    }

    // Load class and institution info
    const { data: classInfo } = await supabase.from('classes').select('name, grade, division').eq('id', student.class_id).single();
    const { data: instInfo } = await supabase.from('institutions').select('name').eq('id', student.institution_id).single();

    const role = login_as === 'parent' ? 'parent' : 'student';
    const secret = process.env.STUDENT_AUTH_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'edutrack-secret-key';

    const payload = {
      student_id: student.id,
      role,
      gr_number: student.gr_number || student.admission_number,
      first_name: student.first_name,
      last_name: student.last_name,
      class_id: student.class_id,
      class_name: classInfo?.name || '',
      institution_id: student.institution_id,
      institution_name: instInfo?.name || '',
      academic_year_id: student.academic_year_id,
      roll_number: student.roll_number,
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      gender: student.gender,
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    const token = encodeToken(payload, secret);

    const response = NextResponse.json({
      success: true,
      role,
      student: {
        name: `${student.first_name} ${student.last_name}`,
        class: classInfo?.name || '',
        institution: instInfo?.name || '',
      }
    });

    // Set HTTP-only cookie
    response.cookies.set('student_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Student login error:', err);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
