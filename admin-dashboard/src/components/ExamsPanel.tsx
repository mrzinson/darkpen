import React, { useEffect, useState } from 'react';
import { Trash2, FileText, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../config';

export default function ExamsPanel() {
  const [exams, setExams] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', category: 'Biology', grade: 'Form 4', year: '2025', country: 'Somaliland' });
  const [image, setImage] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const CATEGORIES = [
    'Biology', 'History', 'Physics', 'Chemistry', 'Geography', 
    'Mathematics', 'Maths', 'Science', 'Social', 'English', 'English (sec)', 
    'Somali', 'Suugaan', 'Arabic', 'Arabic (sec)', 'Islamic', 'Islamic (sec)', 'General'
  ];

  const fetchExams = () => {
    fetch(`${API_URL}/admin/exams`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
      .then(res => res.json())
      .then(data => {
        setExams(data);
      });
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !pdf) return alert('Fadlan geli cinwaanka iyo faylka PDF-ka');

    setUploading(true);
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('category', form.category);
    formData.append('grade', form.grade);
    formData.append('year', form.year);
    formData.append('country', form.country);
    formData.append('region_state', '');
    if (image) formData.append('image', image);
    if (pdf) formData.append('pdf', pdf);

    try {
      const res = await fetch(`${API_URL}/admin/exams`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: formData
      });
      if (res.ok) {
        setForm({ title: '', description: '', category: 'Biology', grade: 'Form 4', year: '2025', country: 'Somaliland' });
        setImage(null);
        setPdf(null);
        fetchExams();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ma hubtaa inaad tirtirto imtixaankan?')) return;
    await fetch(`${API_URL}/admin/exams/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    });
    fetchExams();
  };

  return (
    <div className="panel-container">
      <h2>Exams Management</h2>

      <div className="grid-2">
        <div className="card">
          <h3>Upload New Exam</h3>
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="input-group">
              <label>Exam Title</label>
              <input 
                type="text" 
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})} 
                placeholder="Ex: Form 4 Math Final"
              />
            </div>
            <div className="input-group">
              <label>Description</label>
              <textarea 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                placeholder="Short description..."
              />
            </div>
            <div className="grid-2">
              <div className="input-group">
                <label>Category (Subject)</label>
                <select 
                  value={form.category} 
                  onChange={e => setForm({...form, category: e.target.value})}
                  className="admin-select"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Year</label>
                <input 
                  type="text" 
                  value={form.year} 
                  onChange={e => setForm({...form, year: e.target.value})} 
                  placeholder="Ex: 2024"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label>Class / Grade (Fasalka)</label>
                <select
                  value={form.grade}
                  onChange={e => setForm({ ...form, grade: e.target.value })}
                  className="admin-select"
                >
                  <option value="Class 8">Class 8</option>
                  <option value="Form 4">Form 4</option>
                </select>
              </div>
              <div className="input-group">
                <label>Country (Wadanka)</label>
                <select
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
                  className="admin-select"
                >
                  <option value="Somaliland">Somaliland</option>
                  <option value="Somalia">Somalia</option>
                  <option value="Puntland">Puntland</option>
                  <option value="General">General / All Countries</option>
                </select>
              </div>
            </div>
            <div className="file-inputs">
              <div className="file-input">
                <label><ImageIcon size={16} /> Cover Image</label>
                <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} />
              </div>
              <div className="file-input">
                <label><FileText size={16} /> Exam PDF</label>
                <input type="file" accept="application/pdf" onChange={e => setPdf(e.target.files?.[0] || null)} />
              </div>
            </div>
            <button className="btn primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Exam'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Exams</h3>
          <div className="list-container">
            {exams.map(e => (
              <div key={e.id} className="list-item">
                <div className="item-info">
                  <strong>{e.title}</strong>
                  <span className="text-muted">
                    {e.category} • {e.year}
                    {e.country && ` • ${e.country}`}
                    {e.region_state && ` (${e.region_state})`}
                  </span>
                </div>
                <button className="icon-btn danger" onClick={() => handleDelete(e.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
