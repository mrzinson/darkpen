import React, { useEffect, useState } from 'react';
import { Trash2, FileText, Image as ImageIcon, Edit, X } from 'lucide-react';
import { API_URL } from '../config';

interface UploadItem {
  id: string;
  title: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  type: 'upload' | 'edit';
}

export default function ExamsPanel() {
  const [exams, setExams] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', category: 'Biology', grade: 'Form 4', year: '2025', country: 'Somaliland' });
  const [image, setImage] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  
  // Background Uploads Queue State
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  // Edit States
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'Biology', grade: 'Form 4', year: '2025', country: 'Somaliland' });
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPdf, setEditPdf] = useState<File | null>(null);

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

  const startUpload = (formData: FormData, title: string, mode: 'upload' | 'edit', editId?: number) => {
    const uploadId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    
    // Add to background uploads queue
    setUploads(prev => [{ id: uploadId, title, progress: 0, status: 'uploading', type: mode }, ...prev]);
    
    const xhr = new XMLHttpRequest();
    const url = mode === 'edit' ? `${API_URL}/admin/exams/${editId}` : `${API_URL}/admin/exams`;
    const method = mode === 'edit' ? 'PATCH' : 'POST';
    
    xhr.open(method, url);
    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('adminToken')}`);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        setUploads(prev => prev.map(item => item.id === uploadId ? { ...item, progress: percentage } : item));
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploads(prev => prev.map(item => item.id === uploadId ? { ...item, status: 'completed', progress: 100 } : item));
        fetchExams();
      } else {
        setUploads(prev => prev.map(item => item.id === uploadId ? { ...item, status: 'failed' } : item));
        let errMsg = 'Upload failed';
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.message) errMsg = res.message;
        } catch(e) {}
        alert(`Cilad: ${errMsg}`);
      }
    };
    
    xhr.onerror = () => {
      setUploads(prev => prev.map(item => item.id === uploadId ? { ...item, status: 'failed' } : item));
      alert('Cilad khadka internet-ka ah ayaa dhacday inta uu upload-ku socday.');
    };
    
    xhr.send(formData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !pdf) return alert('Fadlan geli cinwaanka iyo faylka PDF-ka');

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('category', form.category);
    formData.append('grade', form.grade);
    formData.append('year', form.year);
    formData.append('country', form.country);
    formData.append('region_state', '');
    if (image) formData.append('image', image);
    formData.append('pdf', pdf);

    // Start background upload
    startUpload(formData, form.title, 'upload');

    // Reset upload form immediately
    setForm({ title: '', description: '', category: 'Biology', grade: 'Form 4', year: '2025', country: 'Somaliland' });
    setImage(null);
    setPdf(null);

    // Reset file inputs on page
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input: any) => { input.value = ''; });
  };

  const handleEditClick = (exam: any) => {
    setEditingItem(exam);
    setEditForm({
      title: exam.title || '',
      description: exam.description || '',
      category: exam.category || 'Biology',
      grade: exam.grade || 'Form 4',
      year: exam.year || '2025',
      country: exam.country || 'Somaliland'
    });
    setEditImage(null);
    setEditPdf(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.title) return alert('Fadlan geli cinwaanka');

    const formData = new FormData();
    formData.append('title', editForm.title);
    formData.append('description', editForm.description);
    formData.append('category', editForm.category);
    formData.append('grade', editForm.grade);
    formData.append('year', editForm.year);
    formData.append('country', editForm.country);
    formData.append('region_state', '');
    if (editImage) formData.append('image', editImage);
    if (editPdf) formData.append('pdf', editPdf);

    // Start background upload
    startUpload(formData, `Edit: ${editForm.title}`, 'edit', editingItem.id);

    setEditingItem(null);
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
        <div>
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
              <button className="btn primary">
                Upload Exam
              </button>
            </form>
          </div>

          {/* Active / Background Uploads Queue */}
          {uploads.length > 0 && (
            <div className="card upload-queue-card">
              <h3>Background Uploads Queue</h3>
              <div style={{ marginTop: '10px' }}>
                {uploads.map(item => (
                  <div key={item.id} className="upload-queue-item">
                    <div className="flex-between">
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{item.title}</span>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 'bold',
                        color: item.status === 'completed' ? '#32D74B' : item.status === 'failed' ? '#FF453A' : '#0A84FF' 
                      }}>
                        {item.status === 'uploading' ? `${item.progress}%` : item.status === 'completed' ? 'Done' : 'Failed'}
                      </span>
                    </div>
                    {item.status === 'uploading' && (
                      <div className="progress-container">
                        <div className="progress-bar" style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="icon-btn" onClick={() => handleEditClick(e)} style={{ color: '#0A84FF' }}>
                    <Edit size={18} />
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDelete(e.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Modal popup */}
      {editingItem && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3>Edit Exam: {editingItem.title}</h3>
              <button onClick={() => setEditingItem(null)} style={{ color: '#FF453A' }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="admin-form">
              <div className="input-group">
                <label>Exam Title</label>
                <input 
                  type="text" 
                  value={editForm.title} 
                  onChange={e => setEditForm({...editForm, title: e.target.value})} 
                />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea 
                  value={editForm.description} 
                  onChange={e => setEditForm({...editForm, description: e.target.value})} 
                />
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label>Category (Subject)</label>
                  <select 
                    value={editForm.category} 
                    onChange={e => setEditForm({...editForm, category: e.target.value})}
                    className="admin-select"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Year</label>
                  <input 
                    type="text" 
                    value={editForm.year} 
                    onChange={e => setEditForm({...editForm, year: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label>Class / Grade</label>
                  <select
                    value={editForm.grade}
                    onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                    className="admin-select"
                  >
                    <option value="Class 8">Class 8</option>
                    <option value="Form 4">Form 4</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Country (Wadanka)</label>
                  <select
                    value={editForm.country}
                    onChange={e => setEditForm({ ...editForm, country: e.target.value })}
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
                  <label><ImageIcon size={16} /> Cover Image (Ogow: dooro kaliya hadii aad badalayso)</label>
                  <input type="file" accept="image/*" onChange={e => setEditImage(e.target.files?.[0] || null)} />
                </div>
                <div className="file-input">
                  <label><FileText size={16} /> Exam PDF (Ogow: dooro kaliya hadii aad badalayso)</label>
                  <input type="file" accept="application/pdf" onChange={e => setEditPdf(e.target.files?.[0] || null)} />
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn primary" style={{ flex: 1 }}>
                  Save Changes (Background)
                </button>
                <button type="button" className="btn secondary" onClick={() => setEditingItem(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
