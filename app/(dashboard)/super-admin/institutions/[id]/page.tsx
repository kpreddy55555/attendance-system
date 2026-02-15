'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Save, Trash2, Building2, MapPin, Phone, Mail, Globe, Upload, Image } from 'lucide-react';

interface Institution {
  id: string;
  name: string;
  code: string;
  type: string;
  board?: string;
  address?: any;
  contact?: any;
  subscription_plan: string;
  is_active: boolean;
  weekly_off_days?: number[];
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export default function InstitutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'junior_college',
    board: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    phone: '',
    email: '',
    website: '',
    subscription_plan: 'basic',
    is_active: true,
    weekly_off_days: [0] as number[],
    logo_url: ''
  });

  useEffect(() => {
    loadInstitution();
  }, [params.id]);

  const loadInstitution = async () => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      
      setInstitution(data);
      
      // Populate form data
      setFormData({
        name: data.name,
        code: data.code,
        type: data.type,
        board: data.board || '',
        address_line1: data.address?.line1 || '',
        address_line2: data.address?.line2 || '',
        city: data.address?.city || '',
        state: data.address?.state || '',
        pincode: data.address?.pincode || '',
        country: data.address?.country || 'India',
        phone: data.contact?.phone || '',
        email: data.contact?.email || '',
        website: data.contact?.website || '',
        subscription_plan: data.subscription_plan,
        is_active: data.is_active,
        weekly_off_days: Array.isArray(data.weekly_off_days) ? data.weekly_off_days : [0],
        logo_url: data.logo_url || ''
      });
    } catch (error: any) {
      console.error('Error loading institution:', error);
      setError('Failed to load institution');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please upload an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2MB'); return; }

    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `logo-${params.id}.${ext}`;
      const { data, error: upError } = await supabase.storage
        .from('institution-logos')
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (upError) throw upError;
      const { data: urlData } = supabase.storage.from('institution-logos').getPublicUrl(fileName);
      const logoUrl = urlData.publicUrl;
      await supabase.from('institutions').update({ logo_url: logoUrl }).eq('id', params.id);
      setFormData(prev => ({ ...prev, logo_url: logoUrl }));
      await loadInstitution();
    } catch (err: any) {
      console.error('Logo upload error:', err);
      alert('Failed to upload logo: ' + (err.message || 'Unknown error') + '\n\nMake sure you ran migration-logo.sql first.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const address = {
        line1: formData.address_line1,
        line2: formData.address_line2,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        country: formData.country
      };

      const contact = {
        phone: formData.phone,
        email: formData.email,
        website: formData.website
      };

      const { error: updateError } = await supabase
        .from('institutions')
        .update({
          name: formData.name,
          code: formData.code,
          type: formData.type,
          board: formData.board || null,
          address,
          contact,
          subscription_plan: formData.subscription_plan,
          is_active: formData.is_active,
          weekly_off_days: formData.weekly_off_days,
          logo_url: formData.logo_url || null
        })
        .eq('id', params.id);

      if (updateError) throw updateError;

      await loadInstitution();
      setEditing(false);
    } catch (error: any) {
      console.error('Error updating institution:', error);
      setError(error.message || 'Failed to update institution');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this institution? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('institutions')
        .delete()
        .eq('id', params.id);

      if (error) throw error;

      router.push('/super-admin/institutions');
    } catch (error: any) {
      console.error('Error deleting institution:', error);
      setError(error.message || 'Failed to delete institution');
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      school: 'School',
      junior_college: 'Junior College',
      college: 'College',
      university: 'University'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading institution...</div>
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Institution Not Found</h2>
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Go Back
          </button>
        </div>
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
                onClick={() => router.back()}
                className="mr-4 p-2 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{institution.name}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {institution.code} • {getTypeLabel(institution.type)}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditing(false);
                      loadInstitution();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {editing ? (
          /* Edit Form */
          <div className="space-y-6">
            {/* Logo Upload */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Institution Logo</h2>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Image className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <label className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer text-sm font-medium">
                    <Upload className="w-4 h-4 mr-2" />
                    {logoUploading ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 2MB. Appears on all reports.</p>
                  {formData.logo_url && (
                    <button onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))} className="text-xs text-red-500 hover:text-red-700 mt-1">Remove Logo</button>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Institution Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Institution Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    required
                    value={formData.code}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="school">School</option>
                    <option value="junior_college">Junior College</option>
                    <option value="college">College</option>
                    <option value="university">University</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Board/Affiliation
                  </label>
                  <input
                    type="text"
                    name="board"
                    value={formData.board}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription Plan
                  </label>
                  <select
                    name="subscription_plan"
                    value={formData.subscription_plan}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              {/* Weekly Off Days */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Weekly Off Days
                </label>
                <p className="text-xs text-gray-500 mb-3">Select which days of the week are non-working for this institution</p>
                <div className="flex flex-wrap gap-2">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const current = formData.weekly_off_days || [];
                        const updated = current.includes(idx)
                          ? current.filter(d => d !== idx)
                          : [...current, idx].sort();
                        setFormData(prev => ({ ...prev, weekly_off_days: updated }));
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        (formData.weekly_off_days || []).includes(idx)
                          ? 'bg-red-50 border-red-400 text-red-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Selected: {(formData.weekly_off_days || []).length === 0 ? 'None' : 
                    (formData.weekly_off_days || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                </p>
              </div>
            </div>

            {/* Address */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Address</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    name="address_line1"
                    value={formData.address_line1}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    name="address_line2"
                    value={formData.address_line2}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Active (institution can use the system)
                </label>
              </div>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="space-y-6">
            {/* Logo */}
            {institution.logo_url && (
              <div className="bg-white shadow rounded-lg p-6 flex items-center gap-4">
                <img src={institution.logo_url} alt="Institution Logo" className="w-16 h-16 object-contain rounded" />
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Institution Logo</h3>
                  <p className="text-xs text-gray-400">Displayed on all reports</p>
                </div>
              </div>
            )}

            {/* Status Badge */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <span
                    className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      institution.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {institution.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Subscription Plan</h3>
                  <p className="mt-1 text-lg font-semibold text-gray-900 capitalize">
                    {institution.subscription_plan}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Weekly Off Days</h3>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(Array.isArray(institution.weekly_off_days) ? institution.weekly_off_days : [0]).map((d: number) => (
                      <span key={d} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                Basic Information
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Institution Code</dt>
                  <dd className="mt-1 text-sm text-gray-900">{institution.code}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{getTypeLabel(institution.type)}</dd>
                </div>
                {institution.board && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Board/Affiliation</dt>
                    <dd className="mt-1 text-sm text-gray-900">{institution.board}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(institution.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Address */}
            {institution.address && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Address
                </h2>
                <address className="not-italic text-sm text-gray-900">
                  {institution.address.line1 && <div>{institution.address.line1}</div>}
                  {institution.address.line2 && <div>{institution.address.line2}</div>}
                  {institution.address.city && institution.address.state && (
                    <div>
                      {institution.address.city}, {institution.address.state} {institution.address.pincode}
                    </div>
                  )}
                  {institution.address.country && <div>{institution.address.country}</div>}
                </address>
              </div>
            )}

            {/* Contact */}
            {institution.contact && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
                <dl className="space-y-3">
                  {institution.contact.phone && (
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-3 text-gray-400" />
                      <dd className="text-sm text-gray-900">{institution.contact.phone}</dd>
                    </div>
                  )}
                  {institution.contact.email && (
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-3 text-gray-400" />
                      <dd className="text-sm text-gray-900">{institution.contact.email}</dd>
                    </div>
                  )}
                  {institution.contact.website && (
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 mr-3 text-gray-400" />
                      <dd className="text-sm">
                        <a
                          href={institution.contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          {institution.contact.website}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
