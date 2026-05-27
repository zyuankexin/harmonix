import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import SongList from './components/SongList';
import AuthModal from './components/AuthModal';

// ========== 备用数据（Supabase 不可用时） ==========
const fallbackPlaylist = [
  { id: '1', title: '星空下的漫步', artist: 'Lune Blanche',  duration: '3:42', color: '#1a2a4a' },
  { id: '2', title: '城市夜曲',     artist: 'Neon Pulse',   duration: '4:15', color: '#2a1a3a' },
  { id: '3', title: '雨中即景',     artist: 'Violet Rain',  duration: '2:58', color: '#1a3a3a' },
  { id: '4', title: '远方的风',     artist: 'Horizon',      duration: '5:03', color: '#3a2a1a' },
  { id: '5', title: '午夜蓝调',     artist: 'Blue Hour',    duration: '3:31', color: '#1a1a3a' },
  { id: '6', title: '晨光熹微',     artist: 'Aurora Dawn',  duration: '4:47', color: '#3a3a1a' },
  { id: '7', title: '思绪漂流',     artist: 'Mindwave',     duration: '3:18', color: '#2a3a1a' },
  { id: '8', title: '黄昏咖啡馆',   artist: 'Golden Hour',  duration: '4:02', color: '#3a1a2a' },
];

// ========== 工具函数 ==========
function formatTime(sec) {
  if (isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function App() {
  // ========== 状态 ==========
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');
  const [volume, setVolume] = useState(0.7);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(0); // 0=off, 1=all, 2=one
  const [searchText, setSearchText] = useState('');
  const [toast, setToast] = useState('');

  // ========== Auth 状态 ==========
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const vizBarsRef = useRef([]);
  const vizAnimRef = useRef(null);
  const vizElRef = useRef(null);
  const shuffleOrderRef = useRef([]);
  const toastTimerRef = useRef(null);
  const lastVolRef = useRef(0.7);

  const playlist = songs; // songs 即为播放列表

  // 当前曲目
  const currentTrack = playlist[currentIndex] || null;

  // ========== Toast ==========
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
  }, []);

  // ========== 从 Supabase 加载歌曲 ==========
  useEffect(() => {
    async function fetchSongs() {
      // Supabase 未配置时直接使用备用数据
      if (!supabase) {
        console.warn('Supabase 未配置，使用本地备用数据。请在 .env.local 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
        setSongs(fallbackPlaylist);
        setLoading(false);
        return;
      }

      // 关键查询语句：连接数据库的"开关"
      const { data, error } = await supabase.from('songs').select('*');

      if (error) {
        console.error('Supabase 查询失败:', error);
        setError(error.message);
        setSongs(fallbackPlaylist);
        showToast('加载歌曲失败，使用本地数据');
      } else if (!data || data.length === 0) {
        console.warn('Supabase 返回空数据');
        setSongs(fallbackPlaylist);
      } else {
        setSongs(data.map(song => ({
          id:       song.id,
          title:    song.title    || '未知曲目',
          artist:   song.artist   || '未知艺术家',
          duration: song.duration || '--:--',
          color:    song.color    || '#1a1a3e',
          coverUrl: song.cover_url || null,
          src:      song.src      || null,
        })));
      }
      setLoading(false);
    }
    fetchSongs();
  }, []); // [] 确保只在加载时运行一次

  // ========== Auth: 初始化 session + 监听登录状态变化 ==========
  useEffect(() => {
    if (!supabase) return;

    // 获取当前 session（加 try-catch 防止 key 无效时白屏）
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    }).catch((err) => {
      console.warn('getSession 失败:', err.message);
    });

    // 监听 auth 状态变化（登录/登出/Token 刷新等）
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } catch (err) {
      console.warn('onAuthStateChange 失败:', err.message);
      return () => {};
    }
  }, []);

  // ========== 登出 ==========
  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) showToast('登出失败: ' + error.message);
      else showToast('已登出');
    } catch (err) {
      showToast('登出失败: ' + err.message);
    }
  }, [showToast]);

  // ========== 发布歌曲到 Supabase（需登录） ==========
  const handlePublishSong = useCallback(async (files) => {
    if (!supabase) {
      showToast('Supabase 未配置');
      return;
    }

    // 未登录时弹出登录框
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/'));
    if (!audioFiles.length) return;

    for (const file of audioFiles) {
      const fileExt = file.name.split('.').pop();
      const filePath = `songs/${user.id}/${Date.now()}.${fileExt}`;

      showToast('正在上传 "' + file.name + '"…');

      // 1. 上传音频文件到 Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('songs')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        showToast('上传失败: ' + uploadError.message);
        continue;
      }

      // 2. 获取公开 URL
      const { data: urlData } = supabase.storage.from('songs').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || null;

      // 3. 插入 songs 表
      const title = file.name.replace(/\.[^/.]+$/, '');
      const { error: insertError } = await supabase.from('songs').insert({
        title: title,
        artist: user.email || '未知艺术家',
        duration: '--:--',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        src: publicUrl,
      });

      if (insertError) {
        showToast('发布失败: ' + insertError.message);
      } else {
        showToast('"' + title + '" 发布成功！');
        // 直接将新发布的歌曲添加到状态，无需重新查询全表
        const newSong = {
          id:       Date.now().toString(),
          title:    title,
          artist:   user.email || '未知艺术家',
          duration: '--:--',
          color:    '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
          coverUrl: null,
          src:      publicUrl,
        };
        setSongs(prev => [...prev, newSong]);
      }
    }
  }, [user, showToast]);

  // ========== AudioContext & 可视化 ==========
  const initAudioContext = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;
  }, []);

  const createVisualizerBars = useCallback(() => {
    const el = vizElRef.current;
    if (!el || !analyserRef.current) return;
    el.innerHTML = '';
    vizBarsRef.current = [];
    const count = Math.min(64, analyserRef.current.frequencyBinCount);
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div');
      bar.className = 'visualizer-bar';
      el.appendChild(bar);
      vizBarsRef.current.push(bar);
    }
  }, []);

  const updateVisualizer = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const bars = vizBarsRef.current;
    const step = Math.floor(data.length / bars.length);
    for (let i = 0; i < bars.length; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
      bars[i].style.height = Math.max(3, (sum / step / 255) * 60) + 'px';
    }
    vizAnimRef.current = requestAnimationFrame(updateVisualizer);
  }, []);

  const startVisualizer = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (analyserRef.current && !vizBarsRef.current.length) createVisualizerBars();
    if (!vizAnimRef.current) updateVisualizer();
  }, [createVisualizerBars, updateVisualizer]);

  const stopVisualizer = useCallback(() => {
    if (vizAnimRef.current) { cancelAnimationFrame(vizAnimRef.current); vizAnimRef.current = null; }
    vizBarsRef.current.forEach(b => (b.style.height = '3px'));
  }, []);

  // ========== 曲目加载 ==========
  const loadTrack = useCallback((index) => {
    if (index < 0 || index >= playlist.length) return;
    const track = playlist[index];
    setCurrentIndex(index);

    if (track.src) {
      audioRef.current.src = track.src;
      audioRef.current.load();
      audioRef.current.play().then(
        () => setIsPlaying(true),
        () => { showToast('无法加载 "' + track.title + '"'); setIsPlaying(false); }
      );
    } else {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      setIsPlaying(false);
      showToast('演示曲目 — 上传音乐文件开始播放');
    }
  }, [playlist, showToast]);

  // ========== 播放/暂停 ==========
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio.src || audio.src === window.location.href) {
      if (!playlist.length) return;
      if (currentIndex < 0) loadTrack(0);
      else if (playlist[currentIndex]?.src) loadTrack(currentIndex);
      else showToast('请上传音乐文件或选择有效曲目');
      return;
    }
    if (audio.paused) {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      audio.play().then(() => setIsPlaying(true), () => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [playlist, currentIndex, loadTrack, showToast]);

  // ========== 上一首/下一首 ==========
  const generateShuffleOrder = useCallback(() => {
    const arr = Array.from({ length: playlist.length }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr[0] === currentIndex && arr.length > 1) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  }, [playlist.length, currentIndex]);

  const playNext = useCallback(() => {
    if (!playlist.length) return;
    let next;
    if (isShuffle && shuffleOrderRef.current.length) {
      const pos = shuffleOrderRef.current.indexOf(currentIndex);
      next = pos < shuffleOrderRef.current.length - 1
        ? shuffleOrderRef.current[pos + 1]
        : (shuffleOrderRef.current = generateShuffleOrder())[0];
    } else {
      next = (currentIndex + 1) % playlist.length;
    }
    loadTrack(next);
  }, [playlist, currentIndex, isShuffle, generateShuffleOrder, loadTrack]);

  const playPrev = useCallback(() => {
    if (!playlist.length) return;
    if (audioRef.current.currentTime > 3) { audioRef.current.currentTime = 0; return; }
    let prev;
    if (isShuffle && shuffleOrderRef.current.length) {
      const pos = shuffleOrderRef.current.indexOf(currentIndex);
      prev = pos > 0 ? shuffleOrderRef.current[pos - 1] : shuffleOrderRef.current[shuffleOrderRef.current.length - 1];
    } else {
      prev = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1;
    }
    loadTrack(prev);
  }, [playlist, currentIndex, isShuffle, loadTrack]);

  // ========== 音频事件 ==========
  useEffect(() => {
    const audio = audioRef.current;

    const onPlay = () => {
      setIsPlaying(true);
      if (!audioCtxRef.current) { initAudioContext(); createVisualizerBars(); }
      startVisualizer();
    };
    const onPause = () => { setIsPlaying(false); stopVisualizer(); };
    const onEnded = () => {
      if (repeatMode === 2) { audio.currentTime = 0; audio.play(); }
      else if (repeatMode === 1 || isShuffle) playNext();
      else if (currentIndex < playlist.length - 1) playNext();
      else setIsPlaying(false);
    };
    const onLoadedMetadata = () => {
      const dur = formatTime(audio.duration);
      setDuration(dur);
    };
    const onTimeUpdate = () => {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      setProgress(pct);
      setCurrentTime(formatTime(audio.currentTime));
    };
    const onError = () => {
      showToast('无法加载曲目');
      setIsPlaying(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('error', onError);
    };
  }, [repeatMode, isShuffle, currentIndex, playlist.length, playNext, showToast, initAudioContext, createVisualizerBars, startVisualizer, stopVisualizer]);

  // ========== 键盘快捷键 ==========
  useEffect(() => {
    function onKey(e) {
      if (document.activeElement.tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space':      e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft':   e.preventDefault(); e.metaKey || e.ctrlKey ? playPrev() : (audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5)); break;
        case 'ArrowRight':  e.preventDefault(); e.metaKey || e.ctrlKey ? playNext() : (audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5)); break;
        case 'ArrowUp':     e.preventDefault(); setVolume(v => Math.min(1, v + 0.05)); break;
        case 'ArrowDown':   e.preventDefault(); setVolume(v => Math.max(0, v - 0.05)); break;
        case 'KeyS':        if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); setIsShuffle(s => !s); } break;
        case 'KeyR':        if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); setRepeatMode(m => (m + 1) % 3); } break;
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, playPrev, playNext]);

  // 同步音量到 audio 元素
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ========== 文件上传 ==========
  const handleFileUpload = useCallback((files) => {
    const newSongs = Array.from(files)
      .filter(f => f.type.startsWith('audio/'))
      .map(file => ({
        id: 'local_' + Date.now() + Math.random(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: '本地音乐',
        duration: '--:--',
        src: URL.createObjectURL(file),
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        isLocal: true,
      }));
    if (newSongs.length) {
      setSongs(prev => [...prev, ...newSongs]);
      showToast('已添加 ' + newSongs.length + ' 首歌曲');
      if (currentIndex < 0) loadTrack(0);
    }
  }, [currentIndex, loadTrack, showToast]);

  // ========== 进度条拖拽 ==========
  const handleProgressClick = useCallback((e) => {
    const bar = e.currentTarget;
    const audio = audioRef.current;
    if (!audio.duration) return;
    const pct = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
    audio.currentTime = pct * audio.duration;
  }, []);

  // ========== 音量条 ==========
  const handleVolumeClick = useCallback((e) => {
    const bar = e.currentTarget;
    const pct = Math.max(0, Math.min(1, (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth));
    setVolume(pct);
  }, []);

  // ========== 渲染 ==========
  return (
    <>
      {/* 氛围背景 */}
      <div className="bg-ambient">
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
      </div>
      <div className="grain-overlay"></div>

      {/* Toast */}
      {toast && <div className="toast show">{toast}</div>}

      {/* 登录/注册弹窗 */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={(u) => { setUser(u); setShowAuthModal(false); showToast('登录成功'); }}
        />
      )}

      {/* 全局布局：Sidebar + Main + Bottom Player */}
      <div className="app-layout">

        {/* 左侧 Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="brand-icon">🎵</span>
            <span className="brand-name">Aurhythm</span>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section">
              <div className="nav-item active">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span>发现音乐</span>
              </div>
              <div className="nav-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><polygon points="10 8 16 12 10 16 10 8"/>
                </svg>
                <span>我的歌单</span>
              </div>
            </div>
          </nav>

          <div className="sidebar-footer">
            {user ? (
              <div className="sidebar-user" onClick={handleLogout} title="点击登出">
                <span className="user-avatar">{user.email.charAt(0).toUpperCase()}</span>
                <span className="user-email">{user.email}</span>
              </div>
            ) : (
              <button className="sidebar-login" onClick={() => setShowAuthModal(true)}>登录</button>
            )}
          </div>
        </aside>

        {/* 主内容区 */}
        <div className="main-content">
          {/* Header */}
          <header className="main-header">
            <div className="header-search">
              <span className="header-search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input
                type="text"
                placeholder="搜索歌曲..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
          </header>

          {/* 内容 */}
          <div className="content-body">
            <SongList
              songs={playlist}
              currentIndex={currentIndex}
              loading={loading}
              error={error}
              searchText={searchText}
              onSearchChange={setSearchText}
              onSelectTrack={(idx) => { if (idx === currentIndex && audioRef.current.src) togglePlay(); else loadTrack(idx); }}
              onFileUpload={handleFileUpload}
              onPublishSong={handlePublishSong}
              user={user}
              onLoginClick={() => setShowAuthModal(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>

      {/* 可视化条（在底部播放条上方） */}
      <div className="visualizer" ref={vizElRef}></div>

      {/* 底部固定播放条 */}
      <div className="bottom-player">
        {/* 左侧：歌曲信息 */}
        <div className="bp-left">
          <div className={`bp-cover${isPlaying ? ' spinning' : ''}`}>
            {currentTrack?.coverUrl
              ? <img src={currentTrack.coverUrl} alt="" />
              : <div className="bp-cover-placeholder">🎵</div>
            }
          </div>
          <div className="bp-info">
            <div className="bp-title">{currentTrack?.title || '未在播放'}</div>
            <div className="bp-artist">{currentTrack?.artist || ''}</div>
          </div>
        </div>

        {/* 中间：播放控制 */}
        <div className="bp-center">
          <div className="bp-controls">
            <button
              className={`bp-btn bp-shuffle${isShuffle ? ' active' : ''}`}
              onClick={() => { setIsShuffle(s => { const v = !s; if (v) { shuffleOrderRef.current = generateShuffleOrder(); showToast('随机播放已开启'); } else showToast('顺序播放'); return v; }); }}
              title="随机播放 (S)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
                <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
                <line x1="4" y1="4" x2="9" y2="9"/>
              </svg>
            </button>

            <button className="bp-btn" onClick={playPrev} title="上一首">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>

            <button className="bp-btn-play" onClick={togglePlay} title="播放 / 暂停 (Space)">
              {isPlaying
                ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>

            <button className="bp-btn" onClick={playNext} title="下一首">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>

            <button
              className={`bp-btn bp-repeat${repeatMode >= 1 ? ' active' : ''}${repeatMode === 2 ? ' repeat-one' : ''}`}
              onClick={() => setRepeatMode(m => { const v = (m + 1) % 3; if (v === 1) showToast('列表循环'); else if (v === 2) showToast('单曲循环'); else showToast('循环关闭'); return v; })}
              title="循环模式 (R)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
              </svg>
            </button>
          </div>
          <div className="bp-progress" onClick={handleProgressClick}>
            <span className="bp-time">{currentTime}</span>
            <div className="bp-progress-bar">
              <div className="bp-progress-fill" style={{ width: progress + '%' }}></div>
            </div>
            <span className="bp-time">{duration}</span>
          </div>
        </div>

        {/* 右侧：音量 */}
        <div className="bp-right">
          <span className="bp-volume-icon" onClick={() => { if (volume > 0) { lastVolRef.current = volume; setVolume(0); } else setVolume(lastVolRef.current || 0.7); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              {volume === 0
                ? <><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                : volume < 0.5
                  ? <path d="M15.54 8.46a5 5 0 010 7.07"/>
                  : <><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></>
              }
            </svg>
          </span>
          <div className="bp-volume-slider" onClick={handleVolumeClick}>
            <div className="bp-volume-fill" style={{ width: (volume * 100) + '%' }}></div>
          </div>
        </div>
      </div>

      {/* 隐藏 Audio 元素 */}
      <audio ref={audioRef} preload="auto" />
    </>
  );
}

export default App;
