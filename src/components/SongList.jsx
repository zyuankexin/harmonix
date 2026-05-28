import { useEffect, useRef } from 'react';

function SongList({ songs, currentIndex, loading, error, searchText, onSearchChange, onSelectTrack, onRecommend, onAddToPlaylist, playlists, user, addToPlaylistTarget, onSelectPlaylist, onClosePlaylistPicker }) {
  const pickerRef = useRef(null);

  // 点击外部关闭弹窗
  useEffect(() => {
    if (!addToPlaylistTarget) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClosePlaylistPicker();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addToPlaylistTarget, onClosePlaylistPicker]);
  // 搜索过滤
  const lower = searchText.toLowerCase();
  const filtered = songs.filter(
    t => t.title.toLowerCase().includes(lower) || t.artist.toLowerCase().includes(lower)
  );

  // 格式化数字（如 1234 -> 1.2k）
  const formatCount = (n) => {
    if (n == null) return '0';
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
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
                  <div className="pl-stats">
                    <span className="pl-stat" title="播放">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      {formatCount(track.plays)}
                    </span>
                    <span 
                      className="pl-stat clickable" 
                      title="推荐"
                      onClick={(e) => { e.stopPropagation(); onRecommend && onRecommend(track.id); }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>
                      {formatCount(track.recommends)}
                    </span>
                    <span className="pl-stat" title="收藏">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {formatCount(track.likes)}
                    </span>
                    <span className="pl-stat" title="评论">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      {formatCount(track.comments)}
                    </span>
                  </div>
                </div>
                <span className="pl-duration">{track.duration || '--:--'}</span>
                {user && (
                  <button
                    className="pl-add-playlist"
                    title="添加到歌单"
                    onClick={(e) => { e.stopPropagation(); onAddToPlaylist && onAddToPlaylist(track.id, e); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 添加到歌单弹窗 */}
      {addToPlaylistTarget && (
        <div 
          className="playlist-picker-overlay"
          ref={pickerRef}
          style={{ position: 'fixed', left: addToPlaylistTarget.x + 'px', top: addToPlaylistTarget.y + 'px', zIndex: 1000 }}
        >
          <div className="playlist-picker">
            <div className="playlist-picker-header">
              <span>添加到歌单</span>
              <button className="playlist-picker-close" onClick={onClosePlaylistPicker}>×</button>
            </div>
            <div className="playlist-picker-list">
              {(!playlists || playlists.length === 0) ? (
                <div className="playlist-picker-empty">暂无歌单</div>
              ) : (
                playlists.map(pl => (
                  <div 
                    key={pl.id}
                    className="playlist-picker-item"
                    onClick={() => onSelectPlaylist(pl.id)}
                  >
                    <span className="picker-icon">🎵</span>
                    <span className="picker-name">{pl.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SongList;
