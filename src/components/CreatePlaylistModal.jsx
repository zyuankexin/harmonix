import { useState } from 'react';

function CreatePlaylistModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');

    if (!name.trim()) {
      setMsg('请输入歌单名称');
      setSubmitting(false);
      return;
    }

    onCreate(name.trim(), description.trim());
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2 className="modal-title">创建歌单</h2>
        <p className="modal-subtitle">
          创建一个新的歌单，填写名称和介绍
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>歌单名称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入歌单名称"
              required
              maxLength={50}
            />
          </div>
          <div className="form-group">
            <label>歌单介绍</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="输入歌单介绍（可选）"
              rows={3}
              maxLength={200}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#e8e6f0',
                fontFamily: 'inherit',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.3s',
                resize: 'none'
              }}
            />
          </div>

          {msg && <div className={`auth-msg${msg.includes('成功') ? ' success' : ''}`}>{msg}</div>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? '创建中…' : '创建歌单'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreatePlaylistModal;
