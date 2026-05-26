import React, { useEffect, useState } from 'react';
import { Trash2, Book, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../config';

export default function BooksPanel() {
  const [books, setBooks] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', author: '', category: 'Biology', grade: 'Form 4' });
  const [image, setImage] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const CATEGORIES = [
    'Biology', 'History', 'Physics', 'Chemistry', 'Geography',
    'Mathematics', 'Maths', 'Science', 'Social', 'English', 'English (sec)',
    'Somali', 'Suugaan', 'Arabic', 'Arabic (sec)', 'Islamic', 'Islamic (sec)', 'General'
  ];

  const fetchBooks = () => {
    fetch(`${API_URL}/admin/books`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
      .then(res => res.json())
      .then(data => {
        setBooks(data);
      });
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !pdf) return alert('Fadlan geli cinwaanka iyo faylka PDF-ka');

    setUploading(true);
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('author', form.author);
    formData.append('category', form.category);
    formData.append('grade', form.grade);
    if (image) formData.append('image', image);
    if (pdf) formData.append('pdf', pdf);

    try {
      const res = await fetch(`${API_URL}/admin/books`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: formData
      });
      if (res.ok) {
        setForm({ title: '', author: '', category: 'Biology', grade: 'Form 4' });
        setImage(null);
        setPdf(null);
        fetchBooks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ma hubtaa inaad tirtirto buuggan?')) return;
    await fetch(`${API_URL}/admin/books/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    });
    fetchBooks();
  };

  return (
    <div className="panel-container">
      <h2>Curriculum Books Management</h2>

      <div className="grid-2">
        <div className="card">
          <h3>Upload New Book</h3>
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="input-group">
              <label>Book Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Biology Form 4"
              />
            </div>
            <div className="input-group">
              <label>Author</label>
              <input
                type="text"
                value={form.author}
                onChange={e => setForm({ ...form, author: e.target.value })}
                placeholder="Author name..."
              />
            </div>
            <div className="grid-2">
              <div className="input-group">
                <label>Category (Subject)</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="admin-select"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Grade/Class</label>
                <input
                  type="text"
                  value={form.grade}
                  onChange={e => setForm({ ...form, grade: e.target.value })}
                  placeholder="Ex: Form 4"
                />
              </div>
            </div>
            <div className="file-inputs">
              <div className="file-input">
                <label><ImageIcon size={16} /> Cover Image</label>
                <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} />
              </div>
              <div className="file-input">
                <label><Book size={16} /> Book PDF</label>
                <input type="file" accept="application/pdf" onChange={e => setPdf(e.target.files?.[0] || null)} />
              </div>
            </div>
            <button className="btn primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Book'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Books</h3>
          <div className="list-container">
            {books.map(b => (
              <div key={b.id} className="list-item">
                <div className="item-info">
                  <strong>{b.title}</strong>
                  <span className="text-muted">{b.category} • {b.grade}</span>
                </div>
                <button className="icon-btn danger" onClick={() => handleDelete(b.id)}>
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
