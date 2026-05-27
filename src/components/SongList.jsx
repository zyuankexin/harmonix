import { useRef } from 'react';

function SongList({ songs, currentIndex, loading, error, searchText, onSearchChange, onSelectTrack, onFileUpload, onPublishSong, user, onLoginClick }) {
  const fileInputRef = useRef(null);
  const publishInputRef = useRef(null);

  // 搜索过滤
  const lower = searchText.toLowerCase();
  const filtered = songs.filter(
    t => t.title.toLowerCase().includes(lower) || t.artist.toLowerCase().includes(lower)
  );

  // 本地文件上传（仅本地播放）
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length) onFileUpload(e.dataTransfer.files);
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleFileChange = (e) => {
    if (e.target.files.length) { onFileUpload(e.target.files); e.target.value = ''; }
  };

  // 发布到平台（需登录）
  const handlePublishChange = (e) => {
    if (e.target.files.length) { onPublishSong(e.target.files); e.target.value = ''; }
  };

  return (
    <div className="playlist-panel">
      <div className="playlist-header">
        <h2>播放列表</h2>
      </div>

      <div className="playlist-list">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <div>正在加载歌曲列表…</div>
          </div>
        ) : !filtered.length ? (
          <div className="no-results">{searchText ? '未找到匹配歌曲' : '播放列表为空'}</div>
        ) : (
          filtered.map(track => {
            const realIdx = songs.indexOf(track);
            return (
              <div
                key={track.id}
                className={`playlist-item${realIdx === currentIndex ? ' active' : ''}`}
                onClick={() => onSelectTrack(realIdx)}
              >
                <div className="pl-thumb">
                  {track.coverUrl
                    ? <img src={track.coverUrl} alt="" />
                    : <div className="pl-placeholder" style={{ background: track.color || '#1a1a3e' }}>🎵</div>
                  }
                </div>
                <div className="pl-info">
                  <div className="pl-title">{track.title}</div>
                  <div className="pl-artist">{track.artist}</div>
                </div>
                <span className="pl-duration">{track.duration || '--:--'}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="upload-zone">
        {/* 本地播放上传（所有人可用） */}
        <label className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>本地播放：拖拽或点击上传</span>
          <input ref={fileInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
        </label>

        {/* 发布到平台（需登录） */}
        {user ? (
          <label className="upload-area publish-area" onClick={() => publishInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2"/>
            </svg>
            <span>发布歌曲到平台</span>
            <span className="disclaimer">上传即代表您同意《服务协议》，并确认拥有该内容的版权。</span>
            <input ref={publishInputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={handlePublishChange} />
          </label>
        ) : (
          <div className="upload-area publish-area disabled" onClick={onLoginClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span>登录后可发布歌曲</span>
          </div>
        )}
      </div>

      {/* 拖拽区域 */}
      <div style={{ display: 'none' }} onDrop={handleDrop} onDragOver={handleDragOver} />
    </div>
  );
}

export default SongList;
