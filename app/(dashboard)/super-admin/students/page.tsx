'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Upload, Users, Search, Edit, Trash2, ArrowLeft, Download, FileText } from 'lucide-react';

interface Student {
  id: string;
  institution_id: string;
  class_id: string;
  gr_number?: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  mother_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  student_id?: string;
  aadhar?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  address?: any;
  is_active: boolean;
  created_at: string;
  classes?: {
    name: string;
    grade: string;
  };
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    institution_id: '',
    class_id: '',
    gr_number: '',
    roll_number: '',
    first_name: '',
    last_name: '',
    mother_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    student_id: '',
    aadhar: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    locality: '',
    is_active: true
  });

  useEffect(() => {
    loadInstitutions();
  }, []);

  useEffect(() => {
    if (selectedInstitution) {
      loadAcademicYears();
    }
  }, [selectedInstitution]);

  useEffect(() => {
    if (selectedInstitution && selectedYear) {
      loadClasses();
    }
  }, [selectedInstitution, selectedYear]);

  useEffect(() => {
    if (selectedInstitution && selectedYear) {
      loadStudents();
    }
  }, [selectedInstitution, selectedYear, selectedClass]);

  const loadInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setInstitutions(data || []);
      
      if (data && data.length > 0) {
        setSelectedInstitution(data[0].id);
        setFormData(prev => ({ ...prev, institution_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error loading institutions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAcademicYears = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', selectedInstitution)
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setAcademicYears(data || []);
      
      if (data && data.length > 0) {
        const currentYear = data.find(y => y.is_current) || data[0];
        setSelectedYear(currentYear.id);
      }
    } catch (error) {
      console.error('Error loading academic years:', error);
    }
  };

  const loadClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', selectedInstitution)
        .eq('academic_year_id', selectedYear)
        .eq('is_active', true)
        .order('grade')
        .order('division');

      if (error) throw error;
      setClasses(data || []);
      
      if (data && data.length > 0 && !formData.class_id) {
        setFormData(prev => ({ ...prev, class_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadStudents = async () => {
    try {
      let query = supabase
        .from('students')
        .select('*, classes(name, grade)')
        .eq('institution_id', selectedInstitution);

      if (selectedClass !== 'all') {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query.order('roll_number');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const address = {
        line1: formData.address_line1,
        line2: formData.address_line2,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        locality: formData.locality
      };

      const studentData = {
        institution_id: formData.institution_id,
        class_id: formData.class_id,
        gr_number: formData.gr_number || null,
        roll_number: formData.roll_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        mother_name: formData.mother_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        blood_group: formData.blood_group || null,
        student_id: formData.student_id || null,
        aadhar: formData.aadhar || null,
        parent_name: formData.parent_name || null,
        parent_phone: formData.parent_phone || null,
        parent_email: formData.parent_email || null,
        address,
        is_active: formData.is_active
      };

      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update(studentData)
          .eq('id', editingStudent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('students')
          .insert(studentData);

        if (error) throw error;
      }

      await loadStudents();
      resetForm();
    } catch (error: any) {
      console.error('Error saving student:', error);
      alert(error.message);
    }
  };

  const handleImportCSV = async () => {
    if (!csvFile) {
      alert('Please select a CSV file');
      return;
    }

    if (!formData.class_id || formData.class_id === '') {
      alert('Please select an import mode');
      return;
    }

    const autoDetectMode = formData.class_id === 'auto';
    
    if (!autoDetectMode && !formData.class_id) {
      alert('Please select a class for import');
      return;
    }

    setImporting(true);

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim()); // Remove empty lines
      
      if (lines.length < 2) {
        alert('CSV file is empty or has no data');
        setImporting(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Create a map of class names to IDs for auto-detection
      const classMap = new Map<string, string>();
      if (autoDetectMode) {
        classes.forEach(cls => {
          classMap.set(cls.name.toLowerCase().trim(), cls.id);
        });
      }
      
      const studentsToImport = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          if (!lines[i] || !lines[i].trim()) continue;

          // Handle CSV with proper quote handling
          const values: string[] = [];
          let currentValue = '';
          let inQuotes = false;

          for (let char of lines[i]) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim());

          const student: any = {
            institution_id: selectedInstitution,
            class_id: autoDetectMode ? null : formData.class_id,
            is_active: true
          };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            
            switch (header) {
              case 'std/div':
              case 'class':
              case 'class_name':
              case 'division':
                if (autoDetectMode && value) {
                  const className = value.toLowerCase().trim();
                  const matchedClassId = classMap.get(className);
                  if (matchedClassId) {
                    student.class_id = matchedClassId;
                  } else {
                    errors.push(`Row ${i + 1}: Class "${value}" not found in system`);
                  }
                }
                break;
              case 'gr no':
              case 'gr_no':
              case 'gr_number':
              case 'registration_number':
                student.gr_number = value || null;
                break;
              case 'roll no':
              case 'roll_no':
              case 'roll_number':
              case 'roll':
                student.roll_number = value;
                break;
              case 'student name':
              case 'name':
              case 'student_name':
                if (value) {
                  const nameParts = value.split(' ').filter(p => p);
                  student.first_name = nameParts[0] || '';
                  student.last_name = nameParts.slice(1).join(' ') || nameParts[0] || '';
                }
                break;
              case 'first_name':
              case 'firstname':
                student.first_name = value;
                break;
              case 'last_name':
              case 'lastname':
                student.last_name = value;
                break;
              case 'mother name':
              case 'mother_name':
                student.mother_name = value || null;
                break;
              case 'email':
                student.email = value || null;
                break;
              case 'phone':
              case 'mobile':
              case 'contact':
                student.phone = value || null;
                break;
              case 'date_of_birth':
              case 'dob':
                if (value && value.includes('/')) {
                  const parts = value.split('/');
                  if (parts.length === 3) {
                    // Handle DD/MM/YYYY format
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2];
                    
                    // Validate month and day
                    const monthNum = parseInt(month);
                    const dayNum = parseInt(day);
                    
                    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
                      student.date_of_birth = `${year}-${month}-${day}`;
                    } else {
                      // Invalid date, skip
                      student.date_of_birth = null;
                    }
                  }
                } else if (value) {
                  student.date_of_birth = value;
                } else {
                  student.date_of_birth = null;
                }
                break;
              case 'gender':
                if (value) {
                  const genderLower = value.toLowerCase();
                  if (genderLower === 'boy' || genderLower === 'male' || genderLower === 'm') {
                    student.gender = 'Male';
                  } else if (genderLower === 'girl' || genderLower === 'female' || genderLower === 'f') {
                    student.gender = 'Female';
                  } else {
                    student.gender = value;
                  }
                }
                break;
              case 'blood_group':
              case 'blood group':
                student.blood_group = value || null;
                break;
              case 'sid':
              case 'student_id':
              case 'student id':
                student.student_id = value || null;
                break;
              case 'aadhar':
              case 'aadhar_no':
              case 'aadhaar':
                student.aadhar = value || null;
                break;
              case 'parent_name':
              case 'father_name':
                student.parent_name = value || null;
                break;
              case 'parent_phone':
              case 'parent phone':
              case 'parent_mobile':
                student.parent_phone = value || null;
                break;
              case 'parent_email':
              case 'parent email':
                student.parent_email = value || null;
                break;
              case 'locality':
                student.locality = value || null;
                break;
              case 'address':
                student.address_line1 = value || null;
                break;
              case 'pincode':
              case 'pin':
                student.pincode = value || null;
                break;
            }
          });

          // Validate required fields
          if (!student.roll_number) {
            errors.push(`Row ${i + 1}: Missing roll number`);
            continue;
          }
          if (!student.first_name) {
            errors.push(`Row ${i + 1}: Missing student name`);
            continue;
          }
          if (!student.last_name) {
            student.last_name = student.first_name;
          }
          if (autoDetectMode && !student.class_id) {
            errors.push(`Row ${i + 1}: Could not determine class for student ${student.first_name}`);
            continue;
          }

          // Build address object
          const address = {
            line1: student.address_line1 || '',
            line2: student.address_line2 || '',
            city: student.city || '',
            state: student.state || '',
            pincode: student.pincode || '',
            locality: student.locality || ''
          };

          studentsToImport.push({
            institution_id: student.institution_id,
            class_id: student.class_id,
            gr_number: student.gr_number || null,
            roll_number: student.roll_number,
            first_name: student.first_name,
            last_name: student.last_name,
            mother_name: student.mother_name || null,
            email: student.email || null,
            phone: student.phone || null,
            date_of_birth: student.date_of_birth || null,
            gender: student.gender || null,
            blood_group: student.blood_group || null,
            student_id: student.student_id || null,
            aadhar: student.aadhar || null,
            parent_name: student.parent_name || null,
            parent_phone: student.parent_phone || null,
            parent_email: student.parent_email || null,
            address,
            is_active: true
          });
        } catch (rowError: any) {
          errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
      }

      if (studentsToImport.length === 0) {
        alert(`No valid students found in CSV.\n\nErrors:\n${errors.join('\n')}`);
        setImporting(false);
        return;
      }

      // Insert in batches of 100 to avoid timeout
      const batchSize = 100;
      let imported = 0;
      
      for (let i = 0; i < studentsToImport.length; i += batchSize) {
        const batch = studentsToImport.slice(i, i + batchSize);
        const { error } = await supabase
          .from('students')
          .insert(batch);

        if (error) throw error;
        imported += batch.length;
      }

      let message = `Successfully imported ${imported} students!`;
      if (errors.length > 0) {
        message += `\n\n${errors.length} rows had errors:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n... and ${errors.length - 5} more`;
        }
      }

      alert(message);
      await loadStudents();
      setShowImportForm(false);
      setCsvFile(null);
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'GR NO,Student Name,Mother Name,GENDER,ROLL NO,DOB,SID,AADHAR,Mobile,Locality,Address,Pincode\n7007,ARAVENI ASHISH MALLESH,NANDINI,BOY,1,14/04/2009,2014272211001480019,123456789012,9876543210,Khairatabad,House No 123,500001';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      institution_id: student.institution_id,
      class_id: student.class_id,
      gr_number: student.gr_number || '',
      roll_number: student.roll_number,
      first_name: student.first_name,
      last_name: student.last_name,
      mother_name: student.mother_name || '',
      email: student.email || '',
      phone: student.phone || '',
      date_of_birth: student.date_of_birth || '',
      gender: student.gender || '',
      blood_group: student.blood_group || '',
      student_id: student.student_id || '',
      aadhar: student.aadhar || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      parent_email: student.parent_email || '',
      address_line1: student.address?.line1 || '',
      address_line2: student.address?.line2 || '',
      city: student.address?.city || '',
      state: student.address?.state || '',
      pincode: student.address?.pincode || '',
      locality: student.address?.locality || '',
      is_active: student.is_active
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadStudents();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      institution_id: selectedInstitution,
      class_id: classes[0]?.id || '',
      gr_number: '',
      roll_number: '',
      first_name: '',
      last_name: '',
      mother_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      blood_group: '',
      student_id: '',
      aadhar: '',
      parent_name: '',
      parent_phone: '',
      parent_email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      locality: '',
      is_active: true
    });
    setShowAddForm(false);
    setEditingStudent(null);
  };

  const filteredStudents = students.filter(student =>
    student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/super-admin')}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Students</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage student records and information
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowImportForm(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Upload className="w-5 h-5 mr-2" />
                Import CSV
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Student
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Students</p>
                <p className="text-2xl font-semibold text-gray-900">{students.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {students.filter(s => s.is_active).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Classes</p>
                <p className="text-2xl font-semibold text-gray-900">{classes.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">This Year</p>
                <p className="text-2xl font-semibold text-gray-900">{students.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Institution
              </label>
              <select
                value={selectedInstitution}
                onChange={(e) => setSelectedInstitution(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Academic Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year_name} {year.is_current ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Search students by name, roll number, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Import CSV Form */}
        {showImportForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Import Students from CSV</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Import Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="importMode"
                    checked={formData.class_id !== 'auto'}
                    onChange={() => setFormData({ ...formData, class_id: classes[0]?.id || '' })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Import to a single class (all students go to one class)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="importMode"
                    checked={formData.class_id === 'auto'}
                    onChange={() => setFormData({ ...formData, class_id: 'auto' })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Auto-detect class from CSV (CSV must have "STD/DIV" or "Class" column)
                  </span>
                </label>
              </div>
            </div>

            {formData.class_id !== 'auto' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Class for Import
                </label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.class_id === 'auto' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Auto-detect mode:</strong> The system will automatically assign students to classes based on the "STD/DIV" or "Class" column in your CSV. 
                  Make sure your CSV has a column with class names that match your existing classes (e.g., "XII COM A", "XI SCI B").
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="mt-2 text-xs text-gray-500">
                CSV should include: roll_number, first_name, last_name, email, phone, date_of_birth, gender, blood_group, parent_name, parent_phone, parent_email
              </p>
            </div>

            <div className="flex justify-between">
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowImportForm(false);
                    setCsvFile(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportCSV}
                  disabled={!csvFile || importing}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import Students'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GR Number
                    </label>
                    <input
                      type="text"
                      value={formData.gr_number}
                      onChange={(e) => setFormData({ ...formData, gr_number: e.target.value })}
                      placeholder="e.g., 7007"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Roll Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.roll_number}
                      onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mother Name
                    </label>
                    <input
                      type="text"
                      value={formData.mother_name}
                      onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Class *
                    </label>
                    <select
                      required
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Blood Group
                    </label>
                    <select
                      value={formData.blood_group}
                      onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student ID (SID)
                    </label>
                    <input
                      type="text"
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      placeholder="e.g., 2014272211001480019"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aadhar Number
                    </label>
                    <input
                      type="text"
                      value={formData.aadhar}
                      onChange={(e) => setFormData({ ...formData, aadhar: e.target.value })}
                      placeholder="12 digit Aadhar number"
                      maxLength={12}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Parent Information */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3">Parent Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Name
                    </label>
                    <input
                      type="text"
                      value={formData.parent_name}
                      onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.parent_phone}
                      onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent Email
                    </label>
                    <input
                      type="email"
                      value={formData.parent_email}
                      onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-700">Active</label>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingStudent ? 'Update' : 'Create'} Student
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Students Table */}
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try a different search term' : 'Get started by adding students'}
            </p>
            {!searchTerm && (
              <div className="mt-6">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Student
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roll No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.roll_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {student.first_name} {student.last_name}
                      </div>
                      {student.email && (
                        <div className="text-sm text-gray-500">{student.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.classes?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.phone && (
                        <div className="text-sm text-gray-900">{student.phone}</div>
                      )}
                      {student.date_of_birth && (
                        <div className="text-sm text-gray-500">
                          DOB: {new Date(student.date_of_birth).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.parent_name && (
                        <div className="text-sm text-gray-900">{student.parent_name}</div>
                      )}
                      {student.parent_phone && (
                        <div className="text-sm text-gray-500">{student.parent_phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          student.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {student.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(student.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
