'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Subtitles,
  ChevronDown,
  ChevronUp,
  Database,
  Film,
  Key,
  Copy,
  Info,
  Save,
  Check,
  Wand2,
  HelpCircle,
  Lock,
  LogOut,
  ArrowLeft,
  Upload,
  Tv,
  ListVideo,
  HardDrive,
  Server
} from 'lucide-react';

function getYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match) return match[1];
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

// File ID from a Google Drive link (or an old /api/stream/gdrive?id= link). Only real Drive links count,
// so other links that happen to contain "id=" (e.g. Backblaze native URLs with fileId=) are left alone.
function getGoogleDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('drive.google.com') && !url.startsWith('/api/stream/gdrive')) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [dbStatus, setDbStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('movies'); // 'movies' | 'form' | 'supabase' | 'buckets'

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Sci-Fi / Action');
  const [releaseYear, setReleaseYear] = useState('2024');
  const [duration, setDuration] = useState('1h 45m');
  const [rating, setRating] = useState('HD 1080p');
  const [isFeatured, setIsFeatured] = useState(false);
  const [subtitles, setSubtitles] = useState([
    { name: 'English (CC)', url: '', isDefault: true }
  ]);
  const [contentType, setContentType] = useState('movie'); // 'movie' | 'series'
  const [episodes, setEpisodes] = useState([]);
  const [bulkEpisodesText, setBulkEpisodesText] = useState('');
  const [showBulkImporter, setShowBulkImporter] = useState(false);

  function addEpisode() {
    const nextNum = episodes.length + 1;
    setEpisodes((prev) => [
      ...prev,
      {
        id: `ep-${nextNum}`,
        episode_number: nextNum,
        title: `Episode ${nextNum}`,
        stream_url: '',
        duration: '1h 00m',
        subtitles: [],
      }
    ]);
  }

  function removeEpisode(idx) {
    setEpisodes((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.map((ep, i) => ({
        ...ep,
        episode_number: i + 1,
        title: ep.title && !ep.title.startsWith('Episode ') ? ep.title : `Episode ${i + 1}`,
      }));
    });
  }

  function updateEpisode(idx, field, value) {
    setEpisodes((prev) => {
      const updated = [...prev];
      let finalVal = value;
      if (field === 'stream_url' && typeof value === 'string') {
        const trimmed = value.trim();
        const gdriveId = getGoogleDriveId(trimmed);
        const okMatch = trimmed.match(/ok\.ru\/(?:video|videoembed)\/(\d+)/);
        const b2Match = trimmed.match(/backblazeb2\.com\/file\/([^/]+)\/([^?#]+)/) ||
          trimmed.match(/s3\.[^/]+\.backblazeb2\.com\/([^/]+)\/([^?#]+)/);

        if (gdriveId) {
          finalVal = `https://drive.google.com/file/d/${gdriveId}/view`;
        } else if (okMatch) {
          finalVal = `https://ok.ru/videoembed/${okMatch[1]}`;
        } else if (b2Match && !trimmed.startsWith('/api/stream/b2')) {
          finalVal = `/api/stream/b2/${b2Match[1]}/${b2Match[2]}`;
        }
      }
      updated[idx] = { ...updated[idx], [field]: finalVal };
      return updated;
    });
  }

  function handleBulkImportEpisodes() {
    if (!bulkEpisodesText.trim()) return;
    const lines = bulkEpisodesText.split('\n').map((l) => l.trim()).filter(Boolean);
    const newEpisodes = lines.map((line, idx) => {
      let epTitle = `Episode ${idx + 1}`;
      let url = line;

      if (line.includes('|')) {
        const parts = line.split('|');
        epTitle = parts[0].trim();
        url = parts[1].trim();
      }

      const gdriveId = getGoogleDriveId(url);
      const okMatch = url.match(/ok\.ru\/(?:video|videoembed)\/(\d+)/);
      const b2Match = url.match(/backblazeb2\.com\/file\/([^/]+)\/([^?#]+)/) ||
        url.match(/s3\.[^/]+\.backblazeb2\.com\/([^/]+)\/([^?#]+)/);

      if (gdriveId) {
        url = `https://drive.google.com/file/d/${gdriveId}/view`;
      } else if (okMatch) {
        url = `https://ok.ru/videoembed/${okMatch[1]}`;
      } else if (b2Match && !url.startsWith('/api/stream/b2')) {
        url = `/api/stream/b2/${b2Match[1]}/${b2Match[2]}`;
      }

      return {
        id: `ep-${idx + 1}`,
        episode_number: idx + 1,
        title: epTitle,
        stream_url: url,
        duration: '1h 00m',
        subtitles: [],
      };
    });

    setEpisodes(newEpisodes);
    setShowBulkImporter(false);
    setBulkEpisodesText('');
    setStatusMessage({
      text: `Successfully created playlist of ${newEpisodes.length} episodes!`,
      type: 'success',
    });
  }

  // Quick Stream Edit Modal State
  const [quickEditMovie, setQuickEditMovie] = useState(null);
  const [quickStreamUrl, setQuickStreamUrl] = useState('');

  // Video Test Preview State
  const [testStreamUrl, setTestStreamUrl] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Smart Link Importer & Guide State
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [showF12Guide, setShowF12Guide] = useState(false);

  // Storage Buckets (Backblaze B2 Multi-Account) State
  const [buckets, setBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState(null);
  const [bucketLabel, setBucketLabel] = useState('');
  const [bucketName, setBucketName] = useState('');
  const [bucketKeyId, setBucketKeyId] = useState('');
  const [bucketAppKey, setBucketAppKey] = useState('');
  const [bucketEndpoint, setBucketEndpoint] = useState('s3.us-east-005.backblazeb2.com');
  const [bucketIsActive, setBucketIsActive] = useState(true);
  const [bucketIsDefault, setBucketIsDefault] = useState(false);
  const [bucketTestingId, setBucketTestingId] = useState(null);
  const [bucketTestResults, setBucketTestResults] = useState({});

  // Direct Storage Upload, YouTube, Google Drive & Backblaze B2 State
  const [sourceMode, setSourceMode] = useState('youtube'); // 'youtube' | 'upload' | 'gdrive' | 'link' | 'b2'
  const [youtubeInputUrl, setYoutubeInputUrl] = useState('');
  const [gdriveInputUrl, setGdriveInputUrl] = useState('');
  const [selectedB2BucketId, setSelectedB2BucketId] = useState('');
  const [b2FileKey, setB2FileKey] = useState('');
  const [b2DiscoveredFiles, setB2DiscoveredFiles] = useState([]);
  const [b2LoadingFiles, setB2LoadingFiles] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const videoInputRef = useRef(null);
  const videoUploadEpisodeRef = useRef(null);
  const subInputRef = useRef(null);
  const subUploadTargetRef = useRef(null);
  const subUploadEpisodeRef = useRef(null);
  const [subUploadIndex, setSubUploadIndex] = useState(null);
  const [subSearchId, setSubSearchId] = useState('');
  const [subSearching, setSubSearching] = useState(false);
  const [activeSubtitleTab, setActiveSubtitleTab] = useState('ep-0');
  const [expandedEpisodeSubs, setExpandedEpisodeSubs] = useState({});

  function detectSubLanguage(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('_en') || lower.includes('.en.') || lower.includes('-en') || lower.includes('eng')) return 'English';
    if (lower.includes('_es') || lower.includes('.es.') || lower.includes('-es') || lower.includes('spa')) return 'Español';
    if (lower.includes('_fr') || lower.includes('.fr.') || lower.includes('-fr') || lower.includes('fre')) return 'Français';
    if (lower.includes('_de') || lower.includes('.de.') || lower.includes('-de') || lower.includes('ger')) return 'Deutsch';
    if (lower.includes('_hi') || lower.includes('.hi.') || lower.includes('-hi') || lower.includes('hin')) return 'हिन्दी (Hindi)';
    if (lower.includes('_ar') || lower.includes('.ar.') || lower.includes('-ar') || lower.includes('ara')) return 'العربية (Arabic)';
    if (lower.includes('_it') || lower.includes('.it.') || lower.includes('-it') || lower.includes('ita')) return 'Italiano';
    if (lower.includes('_pt') || lower.includes('.pt.') || lower.includes('-pt') || lower.includes('por')) return 'Português';
    if (lower.includes('_ru') || lower.includes('.ru.') || lower.includes('-ru') || lower.includes('rus')) return 'Русский';
    if (lower.includes('_ja') || lower.includes('.ja.') || lower.includes('-ja') || lower.includes('jpn')) return '日本語 (Japanese)';
    return filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim() || 'Custom Subtitles';
  }

  function handleConnectYouTube() {
    if (!youtubeInputUrl.trim()) return;
    const parsedId = getYouTubeId(youtubeInputUrl);
    if (parsedId) {
      setStreamUrl(`https://www.youtube.com/watch?v=${parsedId}`);
      setStatusMessage({ text: `Connected Ad-Free YouTube Cinema Stream (ID: ${parsedId})! Zero quota limits and instant 1080p playback ready.`, type: 'success' });
    } else {
      setStatusMessage({ text: 'Could not detect a valid YouTube Video ID or URL. Please paste the full YouTube link or 11-digit Video ID.', type: 'error' });
    }
  }

  function handleConnectGDrive() {
    if (!gdriveInputUrl.trim()) return;
    const match = gdriveInputUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      gdriveInputUrl.match(/id=([a-zA-Z0-9_-]+)/) ||
      gdriveInputUrl.match(/^([a-zA-Z0-9_-]{20,})$/);
    if (match) {
      const fileId = match[1];
      setStreamUrl(`https://drive.google.com/file/d/${fileId}/view`);
      setStatusMessage({ text: "Connected Google Drive video! It will play in Google Drive's own player.", type: 'success' });
    } else {
      setStreamUrl(gdriveInputUrl.trim());
    }
  }

  async function handleFetchSubtitles() {
    const queryId = subSearchId.trim() || id || (title ? title.toLowerCase() : '') || '969681';
    setSubSearching(true);
    try {
      const res = await fetch(`/api/subtitles/search?id=${encodeURIComponent(queryId)}&title=${encodeURIComponent(title || '')}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        setSubtitles(data.subtitles);
        setStatusMessage({ text: `Auto-fetched ${data.subtitles.length} international subtitle tracks!`, type: 'success' });
      } else {
        setStatusMessage({ text: 'No external subtitles found for this ID.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Subtitle fetch error: ${err.message}`, type: 'error' });
    } finally {
      setSubSearching(false);
    }
  }

  async function handleFileUpload(file, folder = 'videos', targetIndex = null, episodeIndex = null) {
    if (!file) return;
    setUploadLoading(true);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setUploadStatus(`Uploading ${file.name} (${sizeMb} MB) to Supabase Storage...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.publicUrl) {
        if (folder === 'videos') {
          if (episodeIndex !== null && episodeIndex !== undefined) {
            setEpisodes((prev) => {
              const updated = [...prev];
              if (updated[episodeIndex]) {
                updated[episodeIndex] = { ...updated[episodeIndex], stream_url: data.publicUrl };
              }
              return updated;
            });
            setUploadStatus(`✅ Video uploaded and attached to Episode ${episodeIndex + 1}!`);
            setStatusMessage({ text: `Video uploaded and attached to Episode ${episodeIndex + 1}!`, type: 'success' });
          } else {
            setStreamUrl(data.publicUrl);
            setUploadStatus(`✅ Video uploaded successfully! Public link: ${data.publicUrl}`);
          }
          videoUploadEpisodeRef.current = null;
        } else if (folder === 'subtitles') {
          const detectedLang = detectSubLanguage(file.name);
          if (episodeIndex !== null && episodeIndex !== undefined) {
            setEpisodes((prev) => {
              const updated = [...prev];
              const ep = { ...updated[episodeIndex] };
              const curSubs = Array.isArray(ep.subtitles) ? [...ep.subtitles] : [];
              if (targetIndex !== null && curSubs[targetIndex]) {
                curSubs[targetIndex] = {
                  ...curSubs[targetIndex],
                  url: data.publicUrl,
                  name: curSubs[targetIndex].name && curSubs[targetIndex].name !== 'English (CC)' ? curSubs[targetIndex].name : detectedLang,
                };
              } else {
                const emptyIdx = curSubs.findIndex((s) => !s.url || !s.url.trim());
                if (emptyIdx !== -1) {
                  curSubs[emptyIdx] = {
                    name: detectedLang,
                    url: data.publicUrl,
                    isDefault: emptyIdx === 0,
                  };
                } else {
                  curSubs.push({
                    name: detectedLang,
                    url: data.publicUrl,
                    isDefault: curSubs.length === 0,
                  });
                }
              }
              ep.subtitles = curSubs;
              updated[episodeIndex] = ep;
              return updated;
            });
            setUploadStatus(`✅ Subtitle "${file.name}" uploaded and attached to Episode ${episodeIndex + 1}!`);
            setStatusMessage({ text: `Subtitle "${file.name}" uploaded and attached to Episode ${episodeIndex + 1}!`, type: 'success' });
          } else {
            setSubtitles((prev) => {
              const updated = [...prev];
              if (targetIndex !== null && updated[targetIndex]) {
                updated[targetIndex] = {
                  ...updated[targetIndex],
                  url: data.publicUrl,
                  name: updated[targetIndex].name && updated[targetIndex].name !== 'English (CC)' ? updated[targetIndex].name : detectedLang,
                };
              } else {
                const emptyIdx = updated.findIndex((s) => !s.url || !s.url.trim());
                if (emptyIdx !== -1) {
                  updated[emptyIdx] = {
                    name: detectedLang,
                    url: data.publicUrl,
                    isDefault: emptyIdx === 0,
                  };
                } else {
                  updated.push({
                    name: detectedLang,
                    url: data.publicUrl,
                    isDefault: updated.length === 0,
                  });
                }
              }
              return updated;
            });
            setUploadStatus(`✅ Subtitle "${file.name}" uploaded, converted to WebVTT, and added!`);
            setStatusMessage({ text: `Subtitle "${file.name}" uploaded and added!`, type: 'success' });
          }
        }
      } else {
        setUploadStatus(`❌ Upload failed: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      setUploadStatus(`❌ Upload error: ${err.message}`);
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleAutoExtract() {
    if (!importUrl || !importUrl.trim()) return;
    setImportLoading(true);
    setImportStatus('Inspecting link for video stream & subtitle tracks...');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.title && !title) {
          setTitle(data.title);
          if (!id) setId(data.title.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        }
        if (data.stream_url) {
          setStreamUrl(data.stream_url);
        }
        if (Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          setSubtitles(data.subtitles);
        }
        setImportStatus(`Success: ${data.message || 'Stream link and subtitles auto-populated!'}`);
      } else {
        setImportStatus(`Notice: ${data.message || data.error || 'Could not auto-extract. You can paste the .m3u8 directly or use Embed mode.'}`);
      }
    } catch (err) {
      setImportStatus(`Error: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  }

  // Verify existing session from localStorage
  useEffect(() => {
    async function verifyStoredAuth() {
      try {
        const savedKey = localStorage.getItem('watchbox_admin_key') || localStorage.getItem('cinemahub_admin_key');
        if (savedKey) {
          const res = await fetch('/api/movies?verifyKey=1', {
            headers: { Authorization: `Bearer ${savedKey}` },
          });
          if (res.ok) {
            setAdminKey(savedKey);
            setIsAuthenticated(true);
            loadMovies();
            loadBuckets();
            checkDbStatus();
            setAuthChecking(false);
            return;
          }
        }
      } catch { }
      setIsAuthenticated(false);
      setAuthChecking(false);
    }
    verifyStoredAuth();
  }, []);

  async function handleLogin(e) {
    if (e) e.preventDefault();
    if (!loginInput.trim()) {
      setLoginError('Please enter your admin secret key.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/movies?verifyKey=1', {
        headers: { Authorization: `Bearer ${loginInput.trim()}` },
      });
      if (res.ok) {
        const key = loginInput.trim();
        setAdminKey(key);
        try {
          localStorage.setItem('watchbox_admin_key', key);
        } catch { }
        setIsAuthenticated(true);
        loadMovies();
        loadBuckets();
        checkDbStatus();
      } else {
        setLoginError('Invalid secret key. Please check your password.');
      }
    } catch (err) {
      setLoginError(`Connection error: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem('watchbox_admin_key');
      localStorage.removeItem('cinemahub_admin_key');
    } catch { }
    setAdminKey('');
    setIsAuthenticated(false);
    setLoginInput('');
    setLoginError('');
  }

  async function checkDbStatus() {
    try {
      const res = await fetch('/api/movies?checkStatus=1');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data.status);
      }
    } catch { }
  }

  async function loadMovies() {
    try {
      setLoading(true);
      const res = await fetch('/api/movies?fresh=1', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMovies(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setLoading(false);
    }
  }

  // Backblaze B2 Multi-Account Storage Functions
  async function loadBuckets() {
    setLoadingBuckets(true);
    try {
      const savedKey = localStorage.getItem('watchbox_admin_key') || localStorage.getItem('cinemahub_admin_key') || adminKey;
      const res = await fetch('/api/buckets', {
        headers: savedKey ? { Authorization: `Bearer ${savedKey}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.buckets) ? data.buckets : [];
        setBuckets(list);
        if (list.length > 0) {
          setSelectedB2BucketId((prev) => {
            if (prev && list.some((b) => b.id === prev)) return prev;
            const def = list.find((b) => b.is_default) || list[0];
            return def ? def.id : '';
          });
        }
      }
    } catch (err) {
      console.error('Failed to load buckets:', err);
    } finally {
      setLoadingBuckets(false);
    }
  }

  function resetBucketForm() {
    setEditingBucket(null);
    setBucketLabel('');
    setBucketName('');
    setBucketKeyId('');
    setBucketAppKey('');
    setBucketEndpoint('s3.us-east-005.backblazeb2.com');
    setBucketIsActive(true);
    setBucketIsDefault(false);
  }

  function openEditBucketModal(bucket) {
    setEditingBucket(bucket);
    setBucketLabel(bucket.label || '');
    setBucketName(bucket.bucket_name || '');
    setBucketKeyId(bucket.key_id || '');
    setBucketAppKey(''); // leave empty to retain existing
    setBucketEndpoint(bucket.endpoint || 's3.us-east-005.backblazeb2.com');
    setBucketIsActive(bucket.is_active !== false);
    setBucketIsDefault(Boolean(bucket.is_default));
    setBucketModalOpen(true);
  }

  async function handleSaveBucket(e) {
    e.preventDefault();
    if (!bucketName.trim() || !bucketKeyId.trim() || !bucketEndpoint.trim()) {
      setStatusMessage({ text: 'Please fill in Bucket Name, Key ID, and Endpoint.', type: 'error' });
      return;
    }
    if (!editingBucket && !bucketAppKey.trim()) {
      setStatusMessage({ text: 'Application Key is required for new buckets.', type: 'error' });
      return;
    }

    try {
      const payload = {
        id: editingBucket?.id,
        label: bucketLabel.trim() || bucketName.trim(),
        bucket_name: bucketName.trim(),
        key_id: bucketKeyId.trim(),
        application_key: bucketAppKey.trim(),
        endpoint: bucketEndpoint.trim(),
        is_active: bucketIsActive,
        is_default: bucketIsDefault,
      };

      const res = await fetch('/api/buckets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ text: `Storage bucket "${payload.label}" saved successfully!`, type: 'success' });
        setBucketModalOpen(false);
        resetBucketForm();
        loadBuckets();
      } else {
        setStatusMessage({ text: data.error || 'Failed to save bucket.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Bucket save error: ${err.message}`, type: 'error' });
    }
  }

  async function handleDeleteBucket(id, label) {
    if (!confirm(`Are you sure you want to remove storage bucket "${label}"?`)) return;
    try {
      const res = await fetch(`/api/buckets?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ text: 'Bucket deleted.', type: 'success' });
        loadBuckets();
      } else {
        setStatusMessage({ text: data.error || 'Failed to delete bucket.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Delete error: ${err.message}`, type: 'error' });
    }
  }

  async function handleTestBucket(bucket) {
    const testId = bucket?.id || 'manual';
    setBucketTestingId(testId);
    try {
      const payload = bucket
        ? { id: bucket.id }
        : {
          bucket_name: bucketName.trim(),
          key_id: bucketKeyId.trim(),
          application_key: bucketAppKey.trim(),
          endpoint: bucketEndpoint.trim(),
        };

      const res = await fetch('/api/buckets/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setBucketTestResults((prev) => ({
        ...prev,
        [testId]: data,
      }));

      if (data.success) {
        setStatusMessage({
          text: `Verified "${bucket?.label || bucketName}"! Found ${data.filesFound?.length || 0} file(s).`,
          type: 'success',
        });
        if (Array.isArray(data.filesFound) && data.filesFound.length > 0) {
          setB2DiscoveredFiles(data.filesFound);
        }
      } else {
        setStatusMessage({
          text: `Bucket test failed: ${data.message || data.error}`,
          type: 'error',
        });
      }
    } catch (err) {
      setBucketTestResults((prev) => ({
        ...prev,
        [testId]: { success: false, message: err.message },
      }));
      setStatusMessage({ text: `Test error: ${err.message}`, type: 'error' });
    } finally {
      setBucketTestingId(null);
    }
  }

  async function handleFetchBucketFiles(bucketId) {
    if (!bucketId) return;
    setB2LoadingFiles(true);
    try {
      const res = await fetch('/api/buckets/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ id: bucketId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.filesFound)) {
        setB2DiscoveredFiles(data.filesFound);
        setStatusMessage({
          text: `Found ${data.filesFound.length} file(s) in this bucket. Click any file below to select it!`,
          type: 'success',
        });
      } else {
        setB2DiscoveredFiles([]);
        setStatusMessage({
          text: data.message || data.error || 'No files detected in this bucket.',
          type: data.success ? 'info' : 'error',
        });
      }
    } catch (err) {
      setStatusMessage({ text: `Failed to list files: ${err.message}`, type: 'error' });
    } finally {
      setB2LoadingFiles(false);
    }
  }

  function handleSaveAdminKey(val) {
    setAdminKey(val);
    try {
      localStorage.setItem('watchbox_admin_key', val);
    } catch { }
  }

  // Subtitles Management inside form
  function addSubtitleField() {
    setSubtitles((prev) => [...prev, { name: 'Español', url: '', isDefault: false }]);
    if (contentType === 'series' && episodes.length > 0) {
      setEpisodes((prev) => {
        const updated = [...prev];
        const ep0 = { ...updated[0] };
        const curSubs = Array.isArray(ep0.subtitles) ? [...ep0.subtitles] : [];
        curSubs.push({ name: 'Español', url: '', isDefault: false });
        ep0.subtitles = curSubs;
        updated[0] = ep0;
        return updated;
      });
    }
  }

  function removeSubtitleField(index) {
    setSubtitles((prev) => prev.filter((_, i) => i !== index));
    if (contentType === 'series' && episodes.length > 0) {
      setEpisodes((prev) => {
        const updated = [...prev];
        const ep0 = { ...updated[0] };
        const curSubs = Array.isArray(ep0.subtitles) ? [...ep0.subtitles] : [];
        ep0.subtitles = curSubs.filter((_, i) => i !== index);
        updated[0] = ep0;
        return updated;
      });
    }
  }

  function updateSubtitleField(index, field, value) {
    setSubtitles((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
        if (field === 'isDefault' && value) {
          updated.forEach((s, i) => {
            if (i !== index) s.isDefault = false;
          });
        }
      }
      return updated;
    });
    if (contentType === 'series' && episodes.length > 0) {
      setEpisodes((prev) => {
        const updated = [...prev];
        const ep0 = { ...updated[0] };
        const curSubs = Array.isArray(ep0.subtitles) ? [...ep0.subtitles] : [];
        if (curSubs[index]) {
          curSubs[index] = { ...curSubs[index], [field]: value };
          if (field === 'isDefault' && value) {
            curSubs.forEach((s, i) => {
              if (i !== index) s.isDefault = false;
            });
          }
        } else {
          curSubs[index] = { name: 'English (CC)', url: '', isDefault: false, [field]: value };
        }
        ep0.subtitles = curSubs;
        updated[0] = ep0;
        return updated;
      });
    }
  }

  // Episode Subtitle Handlers
  function toggleEpisodeSubs(idx) {
    setExpandedEpisodeSubs((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }

  function addEpisodeSubtitle(epIdx) {
    setEpisodes((prev) => {
      const updated = [...prev];
      const ep = { ...updated[epIdx] };
      const curSubs = Array.isArray(ep.subtitles) ? [...ep.subtitles] : [];
      curSubs.push({
        name: curSubs.length === 0 ? 'English (CC)' : 'Español',
        url: '',
        isDefault: curSubs.length === 0,
      });
      ep.subtitles = curSubs;
      updated[epIdx] = ep;
      return updated;
    });
    // Auto expand accordion if collapsed
    setExpandedEpisodeSubs((prev) => ({ ...prev, [epIdx]: true }));

    if (epIdx === 0) {
      setSubtitles((prev) => [
        ...prev,
        {
          name: prev.length === 0 ? 'English (CC)' : 'Español',
          url: '',
          isDefault: prev.length === 0,
        }
      ]);
    }
  }

  function updateEpisodeSubtitle(epIdx, subIdx, field, value) {
    setEpisodes((prev) => {
      const updated = [...prev];
      const ep = { ...updated[epIdx] };
      const curSubs = Array.isArray(ep.subtitles) ? [...ep.subtitles] : [];
      if (curSubs[subIdx]) {
        curSubs[subIdx] = { ...curSubs[subIdx], [field]: value };
        if (field === 'isDefault' && value) {
          curSubs.forEach((s, i) => {
            if (i !== subIdx) s.isDefault = false;
          });
        }
      }
      ep.subtitles = curSubs;
      updated[epIdx] = ep;
      return updated;
    });

    if (epIdx === 0) {
      setSubtitles((prev) => {
        const updated = [...prev];
        if (updated[subIdx]) {
          updated[subIdx] = { ...updated[subIdx], [field]: value };
          if (field === 'isDefault' && value) {
            updated.forEach((s, i) => {
              if (i !== subIdx) s.isDefault = false;
            });
          }
        } else {
          updated[subIdx] = { name: 'English (CC)', url: '', isDefault: false, [field]: value };
        }
        return updated;
      });
    }
  }

  function removeEpisodeSubtitle(epIdx, subIdx) {
    setEpisodes((prev) => {
      const updated = [...prev];
      const ep = { ...updated[epIdx] };
      const curSubs = Array.isArray(ep.subtitles) ? [...ep.subtitles] : [];
      ep.subtitles = curSubs.filter((_, i) => i !== subIdx);
      updated[epIdx] = ep;
      return updated;
    });

    if (epIdx === 0) {
      setSubtitles((prev) => prev.filter((_, i) => i !== subIdx));
    }
  }

  function triggerEpisodeSubUpload(epIdx, subIdx = null) {
    subUploadEpisodeRef.current = epIdx;
    subUploadTargetRef.current = subIdx;
    subInputRef.current?.click();
  }

  async function handleFetchEpisodeSubtitles(epIdx) {
    const ep = episodes[epIdx];
    const queryTitle = ep?.title || title || '';
    const queryId = id || '969681';
    setSubSearching(true);
    try {
      const res = await fetch(`/api/subtitles/search?id=${encodeURIComponent(queryId)}&title=${encodeURIComponent(queryTitle)}`);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        setEpisodes((prev) => {
          const updated = [...prev];
          updated[epIdx] = {
            ...updated[epIdx],
            subtitles: data.subtitles,
          };
          return updated;
        });
        setExpandedEpisodeSubs((prev) => ({ ...prev, [epIdx]: true }));
        setStatusMessage({ text: `Auto-fetched ${data.subtitles.length} subtitle tracks for Episode ${epIdx + 1}!`, type: 'success' });
      } else {
        setStatusMessage({ text: `No external subtitles found for Episode ${epIdx + 1}.`, type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Subtitle fetch error: ${err.message}`, type: 'error' });
    } finally {
      setSubSearching(false);
    }
  }

  // Reset form
  function resetForm() {
    setIsEditing(false);
    setContentType('movie');
    setEpisodes([]);
    setBulkEpisodesText('');
    setShowBulkImporter(false);
    setId('');
    setTitle('');
    setStreamUrl('');
    setPosterUrl('');
    setBackdropUrl('');
    setDescription('');
    setGenre('Sci-Fi / Action');
    setReleaseYear('2024');
    setDuration('1h 45m');
    setRating('HD 1080p');
    setIsFeatured(false);
    setSubtitles([{ name: 'English (CC)', url: '', isDefault: true }]);
    setTestStreamUrl('');
    setSourceMode('youtube');
    setYoutubeInputUrl('');
    setUploadStatus('');
    setGdriveInputUrl('');
    setB2FileKey('');
    setB2DiscoveredFiles([]);
    setImportUrl('');
    setImportStatus('');
    setSubSearchId('');
    setActiveSubtitleTab('ep-0');
    setExpandedEpisodeSubs({});
  }

  // Populate form for editing
  function handleStartEdit(movie) {
    setIsEditing(true);
    const isSeries = Boolean(movie.type === 'series' || (Array.isArray(movie.episodes) && movie.episodes.length > 0));
    setContentType(isSeries ? 'series' : 'movie');

    const loadedEpisodes = Array.isArray(movie.episodes)
      ? movie.episodes.map((ep, idx) => {
        let epSubs = Array.isArray(ep.subtitles) ? ep.subtitles : [];
        // If Episode 1 has no subtitles, but movie has legacy subtitles, sync it to Episode 1!
        if (idx === 0 && epSubs.length === 0 && Array.isArray(movie.subtitles) && movie.subtitles.length > 0) {
          epSubs = [...movie.subtitles];
        }
        let epStream = ep.stream_url || '';
        const b2Match = epStream.match(/backblazeb2\.com\/file\/([^/]+)\/([^?#]+)/) ||
          epStream.match(/s3\.[^/]+\.backblazeb2\.com\/([^/]+)\/([^?#]+)/);
        if (b2Match && !epStream.startsWith('/api/stream/b2')) {
          epStream = `/api/stream/b2/${b2Match[1]}/${b2Match[2]}`;
        }
        return {
          ...ep,
          stream_url: epStream,
          subtitles: epSubs,
        };
      })
      : [];

    setEpisodes(loadedEpisodes);
    setActiveSubtitleTab('ep-0');
    setExpandedEpisodeSubs({});
    setBulkEpisodesText('');
    setShowBulkImporter(false);
    setId(movie.id);
    setTitle(movie.title || '');
    setStreamUrl(movie.stream_url || '');
    const ytId = getYouTubeId(movie.stream_url);
    const isB2 = Boolean(
      movie.stream_url && (
        movie.stream_url.includes('/api/stream/b2') ||
        movie.stream_url.includes('backblazeb2.com')
      )
    );
    const isGDrive = Boolean(
      movie.stream_url && (
        movie.stream_url.includes('drive.google.com') ||
        movie.stream_url.includes('/api/stream/gdrive')
      )
    );
    const isDirectStorage = Boolean(
      movie.stream_url && (
        movie.stream_url.includes('supabase.co') ||
        movie.stream_url.endsWith('.mp4') ||
        movie.stream_url.endsWith('.webm')
      )
    );
    if (ytId) {
      setSourceMode('youtube');
      setYoutubeInputUrl(movie.stream_url);
    } else if (isB2) {
      setSourceMode('b2');
      const b2Match = movie.stream_url.match(/\/api\/stream\/b2\/([^\/]+)(?:\/(.+))?$/);
      if (b2Match) {
        if (b2Match[2]) {
          setSelectedB2BucketId(b2Match[1]);
          setB2FileKey(decodeURIComponent(b2Match[2]));
        } else {
          setB2FileKey(decodeURIComponent(b2Match[1]));
        }
      }
    } else if (isGDrive) {
      setSourceMode('gdrive');
      setGdriveInputUrl(movie.stream_url);
    } else if (isDirectStorage) {
      setSourceMode('upload');
    } else {
      setSourceMode('link');
    }
    setUploadStatus('');
    setSubSearchId(movie.id || '');
    setPosterUrl(movie.poster_url || '');
    setBackdropUrl(movie.backdrop_url || '');
    setDescription(movie.description || '');
    setGenre(movie.genre || (isSeries ? 'Drama / Series' : 'Action'));
    setReleaseYear(movie.release_year?.toString() || '2024');
    setDuration(movie.duration || (isSeries ? `${movie.episodes?.length || 1} Episodes` : '2h'));
    setRating(movie.rating || 'HD 1080p');
    setIsFeatured(Boolean(movie.is_featured));
    setSubtitles(
      Array.isArray(movie.subtitles) && movie.subtitles.length > 0
        ? movie.subtitles
        : [{ name: 'English (CC)', url: '', isDefault: true }]
    );
    setActiveTab('form');
  }

  // Save / Update Movie or Series
  async function handleSubmit(e) {
    e.preventDefault();
    setStatusMessage({ text: 'Saving content...', type: 'info' });

    if (contentType === 'series') {
      if (episodes.length === 0) {
        setStatusMessage({ text: 'Please add at least 1 episode to the series playlist.', type: 'error' });
        return;
      }
      const hasAnyStream = episodes.some((ep) => ep.stream_url && ep.stream_url.trim());
      if (!hasAnyStream) {
        setStatusMessage({ text: 'Please provide a stream URL or Google Drive link for at least Episode 1.', type: 'error' });
        return;
      }
    } else {
      if (!streamUrl.trim()) {
        setStatusMessage({ text: 'Please provide a stream link or connect a video.', type: 'error' });
        return;
      }
    }

    // Filter valid subtitles
    const validSubs = subtitles
      .filter((s) => s.url && s.url.trim().length > 0)
      .map((s) => ({
        name: s.name.trim() || 'Subtitle',
        url: s.url.trim(),
        isDefault: Boolean(s.isDefault),
      }));

    const movieSlug = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const validEpisodes = episodes.map((ep, idx) => {
      let epStream = ep.stream_url?.trim() || '';
      const b2Match = epStream.match(/backblazeb2\.com\/file\/([^/]+)\/([^?#]+)/) ||
        epStream.match(/s3\.[^/]+\.backblazeb2\.com\/([^/]+)\/([^?#]+)/);
      if (b2Match && !epStream.startsWith('/api/stream/b2')) {
        epStream = `/api/stream/b2/${b2Match[1]}/${b2Match[2]}`;
      }
      let epSubs = Array.isArray(ep.subtitles)
        ? ep.subtitles.filter((s) => s.url && s.url.trim().length > 0).map((s) => ({
            name: s.name.trim() || 'Subtitle',
            url: s.url.trim(),
            isDefault: Boolean(s.isDefault),
          }))
        : [];
      if (idx === 0 && epSubs.length === 0 && validSubs.length > 0) {
        epSubs = validSubs;
      }
      return {
        id: ep.id || `ep-${idx + 1}`,
        episode_number: idx + 1,
        title: ep.title?.trim() || `Episode ${idx + 1}`,
        stream_url: epStream,
        duration: ep.duration?.trim() || '1h 00m',
        subtitles: epSubs,
      };
    });

    const primaryStreamUrl = streamUrl.trim() || (validEpisodes[0] ? validEpisodes[0].stream_url : '');
    const seriesFallbackSubs = (contentType === 'series' && validEpisodes[0]?.subtitles?.length > 0)
      ? validEpisodes[0].subtitles
      : validSubs;

    const payload = {
      id: movieSlug,
      title: title.trim(),
      type: contentType,
      episodes: contentType === 'series' ? validEpisodes : [],
      stream_url: primaryStreamUrl,
      poster_url: posterUrl.trim(),
      backdrop_url: backdropUrl.trim(),
      description: description.trim(),
      genre: genre.trim(),
      release_year: parseInt(releaseYear, 10) || 2024,
      duration: contentType === 'series' ? `${validEpisodes.length} Episodes` : duration.trim(),
      rating: rating.trim(),
      is_featured: isFeatured,
      subtitles: validSubs,
    };

    try {
      const endpoint = `/api/movies/${movieSlug}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatusMessage({
          text: `Success: "${title}" saved and live!`,
          type: 'success',
        });
        loadMovies();
        setActiveTab('movies');
        resetForm();
      } else {
        const data = await res.json();
        setStatusMessage({
          text: `Error: ${data.error || 'Failed to save'}`,
          type: 'error',
        });
      }
    } catch (err) {
      setStatusMessage({ text: `Network Error: ${err.message}`, type: 'error' });
    }
  }

  // Quick stream recovery save
  async function handleQuickStreamSave(e) {
    e.preventDefault();
    if (!quickEditMovie) return;

    setStatusMessage({ text: 'Updating stream link...', type: 'info' });
    let finalUrl = quickStreamUrl.trim();
    const ytId = getYouTubeId(finalUrl);
    if (ytId) {
      finalUrl = `https://www.youtube.com/watch?v=${ytId}`;
    }

    try {
      const res = await fetch(`/api/movies/${quickEditMovie.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          stream_url: finalUrl,
        }),
      });

      if (res.ok) {
        setStatusMessage({
          text: `Stream link for "${quickEditMovie.title}" successfully updated!`,
          type: 'success',
        });
        setQuickEditMovie(null);
        loadMovies();
      } else {
        const data = await res.json();
        setStatusMessage({ text: `Error: ${data.error}`, type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Error: ${err.message}`, type: 'error' });
    }
  }

  // Delete movie
  async function handleDelete(movieId, movieTitle) {
    if (!confirm(`Are you sure you want to delete "${movieTitle}"? This cannot be undone.`)) {
      return;
    }

    setStatusMessage({ text: 'Deleting movie...', type: 'info' });
    try {
      const res = await fetch(`/api/movies/${movieId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
      });

      if (res.ok) {
        setStatusMessage({ text: `Deleted "${movieTitle}"`, type: 'success' });
        loadMovies();
      } else {
        const data = await res.json();
        setStatusMessage({ text: `Delete failed: ${data.error}`, type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: `Delete error: ${err.message}`, type: 'error' });
    }
  }

  const supabaseSql = `-- Supabase Table & RLS Setup
create table if not exists movies (
  id text primary key,
  title text not null,
  stream_url text not null,
  poster_url text default '',
  backdrop_url text default '',
  description text default '',
  genre text default 'Sci-Fi',
  release_year integer default 2024,
  duration text default '2h 10m',
  rating text default 'PG-13',
  subtitles jsonb default '[]'::jsonb,
  is_featured boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table movies enable row level security;

create policy "Allow public read"
  on movies for select
  using (true);

create policy "Allow service role full access"
  on movies for all
  using (auth.role() = 'service_role');`;

  function copySqlToClipboard() {
    navigator.clipboard.writeText(supabaseSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  }

  if (authChecking) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <RefreshCw size={32} className="spin" style={{ animation: 'spin 1.2s linear infinite', color: '#6366f1' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Verifying administrative credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 30px',
          boxShadow: 'var(--shadow-lg), 0 0 40px rgba(99, 102, 241, 0.1)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#818cf8',
            }}>
              <Lock size={26} />
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: 8 }}>WatchBox Admin</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Enter your secret admin key to access stream recovery and movie controls.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: 0.5 }}>
                ADMIN SECRET KEY
              </label>
              <input
                type="password"
                value={loginInput}
                onChange={(e) => { setLoginInput(e.target.value); setLoginError(''); }}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: '#07090e',
                  border: loginError ? '1px solid #ef4444' : '1px solid var(--border)',
                  color: '#fff',
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                autoFocus
                id="admin-login-key-input"
              />
              {loginError && (
                <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> {loginError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-play-hero"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px',
                fontSize: '0.95rem',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                opacity: loginLoading ? 0.7 : 1,
              }}
              id="admin-login-submit-btn"
            >
              {loginLoading ? (
                <>
                  <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Verifying Key...</span>
                </>
              ) : (
                <>
                  <Key size={16} />
                  <span>Unlock Admin Panel</span>
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={14} /> Back to WatchBox
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-icon" style={{ width: 34, height: 34 }}>
              <Shield size={18} />
            </div>
            <h1>Admin Control Panel</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.92rem' }}>
            Instant stream URL recovery, subtitle tracks manager, and movie catalog controls.
          </p>
        </div>

        {/* Admin Key Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <Key size={16} color="#6366f1" />
            <input
              type="password"
              placeholder="Admin Secret Key"
              value={adminKey}
              onChange={(e) => handleSaveAdminKey(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '0.88rem', width: 140 }}
              id="admin-key-input"
            />
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Active</span>
          </div>

          <button
            onClick={handleLogout}
            className="nav-btn nav-btn-ghost"
            title="Lock Admin Panel"
            style={{ fontSize: '0.82rem', padding: '8px 12px', color: '#f87171' }}
            id="admin-logout-btn"
          >
            <LogOut size={15} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Database Connection Status Banner */}
      <div className={`status-banner ${dbStatus?.isSupabase ? 'connected' : 'fallback'}`}>
        <Database size={18} />
        <div style={{ flex: 1 }}>
          <strong>Database Status:</strong> {dbStatus ? dbStatus.provider : 'Checking connection...'}
          {!dbStatus?.isSupabase && (
            <span style={{ marginLeft: 8, fontSize: '0.82rem', opacity: 0.9 }}>
              (Saving to local storage. Connect Supabase anytime for free cloud deployment).
            </span>
          )}
        </div>
        <button
          onClick={() => setActiveTab('supabase')}
          className="nav-btn nav-btn-ghost"
          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
        >
          View Supabase SQL Guide &rarr;
        </button>
      </div>

      {/* Status Notifications */}
      {statusMessage.text && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.9rem',
            background:
              statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : statusMessage.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
            border: `1px solid ${statusMessage.type === 'success'
              ? 'rgba(16, 185, 129, 0.3)'
              : statusMessage.type === 'error'
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(99, 102, 241, 0.3)'
              }`,
            color:
              statusMessage.type === 'success'
                ? '#86efac'
                : statusMessage.type === 'error'
                  ? '#fca5a5'
                  : '#c7d2fe',
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'movies' ? 'active' : ''}`}
          onClick={() => setActiveTab('movies')}
          id="tab-movies-list"
        >
          <Film size={16} style={{ display: 'inline', marginRight: 6 }} />
          Movie Library ({movies.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => {
            if (!isEditing) resetForm();
            setActiveTab('form');
          }}
          id="tab-add-movie"
        >
          <Plus size={16} style={{ display: 'inline', marginRight: 6 }} />
          {isEditing ? `Edit: ${title}` : 'Add New Movie'}
        </button>
        <button
          className={`tab-btn ${activeTab === 'buckets' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('buckets');
            loadBuckets();
          }}
          id="tab-buckets"
        >
          <HardDrive size={16} style={{ display: 'inline', marginRight: 6 }} />
          Storage Buckets ({buckets.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'supabase' ? 'active' : ''}`}
          onClick={() => setActiveTab('supabase')}
          id="tab-supabase-guide"
        >
          <Database size={16} style={{ display: 'inline', marginRight: 6 }} />
          Supabase Free Tier Setup
        </button>
      </div>

      {/* TAB 1: MOVIES LIST */}
      {activeTab === 'movies' && (
        <div>
          {/* Quick Stream Recovery Action Box */}
          <div className="recovery-card">
            <div className="recovery-info">
              <h3>⚡ Quick Stream Recovery</h3>
              <p>
                If a movie stream link breaks or goes down, simply click "Update Stream Link" on the movie below to instantly fix it for all viewers!
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setActiveTab('form');
              }}
              className="nav-btn nav-btn-primary"
            >
              <Plus size={16} /> Add Another Movie
            </button>
          </div>

          <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Movie</th>
                    <th>Genre & Year</th>
                    <th>Stream Source</th>
                    <th>Subtitles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {movies.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                        No movies in database. Click "Add New Movie" above to add your first film.
                      </td>
                    </tr>
                  ) : (
                    movies.map((m) => {
                      const subs = Array.isArray(m.subtitles) ? m.subtitles : [];
                      return (
                        <tr key={m.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <img
                                src={m.poster_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=100&auto=format&fit=crop&q=80'}
                                alt=""
                                style={{ width: 44, height: 60, objectFit: 'cover', borderRadius: 4, background: '#1e293b' }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{m.title}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID: {m.id}</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                  {m.type === 'series' || (Array.isArray(m.episodes) && m.episodes.length > 0) ? (
                                    <span className="badge badge-featured" style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
                                      📺 Series ({m.episodes?.length || 0} Eps)
                                    </span>
                                  ) : (
                                    <span className="badge badge-hd" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                      🎬 Movie
                                    </span>
                                  )}
                                  {m.is_featured && (
                                    <span className="badge badge-featured" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                      Featured Hero
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ color: 'var(--text-secondary)' }}>{m.genre}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.release_year} • {m.duration}</div>
                          </td>

                          <td style={{ maxWidth: 260 }}>
                            <div style={{
                              fontSize: '0.78rem',
                              fontFamily: 'monospace',
                              color: '#a5b4fc',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              background: 'rgba(0,0,0,0.3)',
                              padding: '4px 8px',
                              borderRadius: 4
                            }}>
                              {m.stream_url}
                            </div>
                            <button
                              onClick={() => {
                                setQuickEditMovie(m);
                                setQuickStreamUrl(m.stream_url || '');
                              }}
                              style={{
                                fontSize: '0.75rem',
                                color: '#f87171',
                                fontWeight: 600,
                                marginTop: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              id={`quick-update-btn-${m.id}`}
                            >
                              <RefreshCw size={12} /> Replace Broken Link
                            </button>
                          </td>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: subs.length > 0 ? '#34d399' : 'var(--text-muted)' }}>
                              <Subtitles size={14} />
                              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{subs.length} Tracks</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {subs.map((s) => s.name).join(', ') || 'No subtitles'}
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Link
                                href={`/watch/${m.id}`}
                                className="nav-btn nav-btn-ghost"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                title="Open in Player"
                                target="_blank"
                              >
                                <Play size={14} />
                              </Link>

                              <button
                                onClick={() => handleStartEdit(m)}
                                className="nav-btn nav-btn-ghost"
                                style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#93c5fd' }}
                                title="Full Edit"
                                id={`edit-movie-btn-${m.id}`}
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                onClick={() => handleDelete(m.id, m.title)}
                                className="nav-btn nav-btn-ghost"
                                style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#f87171' }}
                                title="Delete"
                                id={`delete-movie-btn-${m.id}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADD / EDIT MOVIE FORM */}
      {activeTab === 'form' && (
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {isEditing ? `Edit Movie: ${title}` : 'Add New Movie Stream'}
            </h2>
            {isEditing && (
              <button onClick={resetForm} className="nav-btn nav-btn-ghost" style={{ fontSize: '0.85rem' }}>
                Cancel Edit
              </button>
            )}
          </div>

          {/* Quick Smart Link Importer Box */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '26px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wand2 size={18} color="#a5b4fc" />
                <strong style={{ color: '#fff', fontSize: '0.98rem' }}>Smart Link Importer & Subtitle Extractor</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowF12Guide(!showF12Guide)}
                style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
              >
                <HelpCircle size={14} />
                <span>{showF12Guide ? 'Hide F12 Guide' : 'How to grab direct .m3u8 & .vtt from HDToday (F12)?'}</span>
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Paste a movie link (like <code>hdtoday24.at/watch-movie/...</code>, an embed URL, or a direct <code>.m3u8</code>) and click Auto-Detect.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="url"
                className="form-input"
                style={{ flex: 1, minWidth: 280, background: 'rgba(0,0,0,0.4)' }}
                placeholder="https://hdtoday24.at/watch-movie/spider-man... or direct stream link"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAutoExtract}
                disabled={importLoading || !importUrl.trim()}
                className="nav-btn nav-btn-primary"
                style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
              >
                {importLoading ? <RefreshCw size={15} className="spin" /> : <Wand2 size={15} />}
                <span>{importLoading ? 'Detecting...' : 'Auto-Detect Stream & CC'}</span>
              </button>
            </div>

            {importStatus && (
              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '0.82rem',
                background: importStatus.startsWith('Success') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: importStatus.startsWith('Success') ? '#86efac' : '#c7d2fe',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {importStatus}
              </div>
            )}

            {/* F12 DevTools Step-by-Step Guide */}
            {showF12Guide && (
              <div style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.84rem',
                color: '#cbd5e1',
                lineHeight: 1.6
              }}>
                <h4 style={{ color: '#fff', marginBottom: 8, fontSize: '0.92rem' }}>
                  🎯 How to get the 100% Clean, Ad-Free HD Stream (.m3u8) & Subtitles (.vtt) from HDToday:
                </h4>
                <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li>
                    <strong>Open the movie on HDToday</strong> (the page shown in your screenshot).
                  </li>
                  <li>
                    Press <strong>F12</strong> (or right-click anywhere &rarr; <em>Inspect</em>) to open Developer Tools.
                  </li>
                  <li>
                    Click the <strong>Network</strong> tab at the top.
                  </li>
                  <li>
                    In the filter box, type <code>m3u8</code>, then press <strong>Play</strong> on the video.
                  </li>
                  <li>
                    Right-click the <code>master.m3u8</code> or <code>index.m3u8</code> request &rarr; <strong>Copy &rarr; Copy URL</strong>. Paste it below into <em>Stream URL</em>.
                  </li>
                  <li>
                    Now type <code>vtt</code> in the filter box &rarr; Right-click any subtitle (English, Spanish, etc.) &rarr; <strong>Copy URL</strong>. Paste it into <em>Subtitle URL</em> below!
                  </li>
                </ol>
                <div style={{ marginTop: 10, padding: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6, color: '#6ee7b7' }}>
                  ✨ <strong>Benefit:</strong> Your site streams the exact movie and subtitles directly with <strong>ZERO popups, ads, or redirects</strong> for your viewers!
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Content Format Selector: Single Movie vs TV Series / Drama */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label" style={{ marginBottom: 8 }}>
                Content Format *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setContentType('movie')}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: contentType === 'movie' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: contentType === 'movie' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: '0.15s ease'
                  }}
                  id="format-type-movie-btn"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: contentType === 'movie' ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}>
                      <Film size={20} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.96rem', color: '#fff' }}>🎬 Single Movie</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Single stream feature film</span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setContentType('series');
                    if (episodes.length === 0) addEpisode();
                  }}
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: contentType === 'series' ? '2px solid #818cf8' : '1px solid var(--border)',
                    background: contentType === 'series' ? 'rgba(129, 140, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: '0.15s ease'
                  }}
                  id="format-type-series-btn"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: contentType === 'series' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff'
                    }}>
                      <Tv size={20} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.96rem', color: '#fff' }}>📺 TV Series / Drama Playlist</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Multi-episode playlist with auto-next</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="form-grid">
              {/* Content Title */}
              <div>
                <label className="input-label">
                  {contentType === 'series' ? 'Series / Drama Title *' : 'Movie Title *'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={contentType === 'series' ? "e.g. Queen of Tears, Breaking Bad" : "e.g. Inception, Interstellar"}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!isEditing && !id) {
                      setId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                  required
                  id="form-title"
                />
              </div>

              {/* ID / Slug */}
              <div>
                <label className="input-label">URL Slug / ID * (URL-friendly)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={contentType === 'series' ? "e.g. queen-of-tears-2024" : "e.g. interstellar-2014"}
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                  disabled={isEditing}
                  id="form-id"
                />
              </div>

              {/* IF SERIES: TV Series & Drama Episodes Manager */}
              {contentType === 'series' ? (
                <div className="form-group-full">
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.06))',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Tv size={20} color="#a5b4fc" />
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                            Series Episodes Playlist ({episodes.length} Episodes)
                          </h3>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          Paste Google Drive links, YouTube links, or MP4 files for each episode. Auto-detects 1080p proxy streaming!
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setShowBulkImporter(!showBulkImporter)}
                          className="nav-btn nav-btn-primary"
                          style={{ fontSize: '0.8rem', padding: '6px 14px', background: '#0284c7' }}
                          id="btn-toggle-bulk-importer"
                        >
                          <Wand2 size={14} />
                          <span>{showBulkImporter ? 'Hide Bulk Importer' : '⚡ Quick Bulk Links Importer'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={addEpisode}
                          className="btn-add-sub"
                          style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                          id="btn-add-episode"
                        >
                          <Plus size={15} /> Add Episode
                        </button>
                      </div>
                    </div>

                    {/* Bulk Links Importer Drawer */}
                    {showBulkImporter && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        borderRadius: 'var(--radius-md)',
                        padding: '18px',
                        marginBottom: '18px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <strong style={{ fontSize: '0.88rem', color: '#38bdf8' }}>
                            ⚡ Paste Episode Links (One link per line)
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Paste Google Drive share links, YouTube, or MP4 files
                          </span>
                        </div>
                        <textarea
                          rows={5}
                          className="form-input"
                          placeholder="https://drive.google.com/file/d/1wc90mCmm.../view?usp=sharing&#10;https://drive.google.com/file/d/1y7EQ24RA.../view?usp=sharing&#10;Episode 3 - The Truth | https://drive.google.com/file/d/...&#10;Episode 4 | https://youtu.be/..."
                          value={bulkEpisodesText}
                          onChange={(e) => setBulkEpisodesText(e.target.value)}
                          style={{ fontFamily: 'monospace', fontSize: '0.82rem', marginBottom: 10 }}
                          id="bulk-episodes-textarea"
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => setShowBulkImporter(false)}
                            className="nav-btn nav-btn-ghost"
                            style={{ fontSize: '0.78rem' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkImportEpisodes}
                            disabled={!bulkEpisodesText.trim()}
                            className="nav-btn nav-btn-primary"
                            style={{ fontSize: '0.78rem' }}
                            id="btn-confirm-bulk-import"
                          >
                            <Check size={14} /> Auto-Generate Playlist
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Episodes List Items */}
                    {episodes.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '36px 20px', background: 'rgba(0,0,0,0.25)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: 12 }}>
                          No episodes added yet. Add Episode 1 or use the bulk importer above to paste all links at once!
                        </p>
                        <button type="button" onClick={addEpisode} className="nav-btn nav-btn-primary" style={{ fontSize: '0.82rem' }}>
                          <Plus size={14} /> Add Episode 1
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {episodes.map((ep, idx) => (
                          <div
                            key={ep.id || idx}
                            style={{
                              background: 'rgba(7, 9, 14, 0.75)',
                              border: expandedEpisodeSubs[idx] ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              padding: '12px 16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              transition: 'border-color 0.2s ease'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flexWrap: 'wrap',
                                width: '100%'
                              }}
                            >
                              <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: 'rgba(99, 102, 241, 0.25)',
                                color: '#a5b4fc',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {idx + 1}
                              </div>

                              <input
                                type="text"
                                className="form-input"
                                placeholder={`Episode ${idx + 1} Title`}
                                value={ep.title}
                                onChange={(e) => updateEpisode(idx, 'title', e.target.value)}
                                style={{ width: 180, flexShrink: 0 }}
                              />

                              <input
                                type="text"
                                className="form-input"
                                placeholder="Duration (1h 05m)"
                                value={ep.duration}
                                onChange={(e) => updateEpisode(idx, 'duration', e.target.value)}
                                style={{ width: 120, flexShrink: 0 }}
                              />

                              <input
                                type="text"
                                className="form-input"
                                placeholder="Google Drive link (1wc90...) or Video URL"
                                value={ep.stream_url}
                                onChange={(e) => updateEpisode(idx, 'stream_url', e.target.value)}
                                style={{ flex: 1, minWidth: 200 }}
                              />

                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                {b2DiscoveredFiles.length > 0 && (
                                  <select
                                    className="form-input"
                                    style={{
                                      width: 145,
                                      fontSize: '0.76rem',
                                      padding: '5px 8px',
                                      background: 'rgba(2, 132, 199, 0.15)',
                                      border: '1px solid rgba(56, 189, 248, 0.35)',
                                      color: '#38bdf8',
                                      cursor: 'pointer'
                                    }}
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const fileKey = e.target.value;
                                        const encoded = fileKey.split('/').map(encodeURIComponent).join('/');
                                        const path = `/api/stream/b2/${selectedB2BucketId || 'default'}/${encoded}`;
                                        updateEpisode(idx, 'stream_url', path);
                                        setStatusMessage({ text: `Assigned "${fileKey}" to Episode ${idx + 1}!`, type: 'success' });
                                      }
                                    }}
                                    title={`Pick a Backblaze B2 video file for Episode ${idx + 1}`}
                                  >
                                    <option value="">📦 B2 Bucket File...</option>
                                    {b2DiscoveredFiles.map((f) => (
                                      <option key={f} value={f}>
                                        {f}
                                      </option>
                                    ))}
                                  </select>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    videoUploadEpisodeRef.current = idx;
                                    videoInputRef.current?.click();
                                  }}
                                  disabled={uploadLoading}
                                  className="nav-btn nav-btn-ghost"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                    cursor: 'pointer'
                                  }}
                                  title={`Upload an MP4 or WEBM video file directly for Episode ${idx + 1}`}
                                >
                                  <Upload size={13} />
                                  <span>Upload Video</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleEpisodeSubs(idx)}
                                  className="nav-btn nav-btn-ghost"
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '0.78rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    borderRadius: 6,
                                    background: (ep.subtitles && ep.subtitles.length > 0)
                                      ? 'rgba(56, 189, 248, 0.15)'
                                      : (expandedEpisodeSubs[idx] ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)'),
                                    color: (ep.subtitles && ep.subtitles.length > 0) ? '#38bdf8' : '#cbd5e1',
                                    border: (ep.subtitles && ep.subtitles.length > 0)
                                      ? '1px solid rgba(56, 189, 248, 0.4)'
                                      : '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer'
                                  }}
                                  title="Manage Subtitles for this episode"
                                >
                                  <Subtitles size={13} />
                                  <span>Subs ({ep.subtitles?.length || 0})</span>
                                  {expandedEpisodeSubs[idx] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>

                                {ep.stream_url && (
                                  <button
                                    type="button"
                                    onClick={() => setTestStreamUrl(ep.stream_url)}
                                    className="nav-btn nav-btn-ghost"
                                    style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                                    title="Preview Episode Video"
                                  >
                                    <Play size={13} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeEpisode(idx)}
                                  className="btn-remove-sub"
                                  title="Delete Episode"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Inline Expandable Episode Subtitles Drawer */}
                            {expandedEpisodeSubs[idx] && (
                              <div style={{
                                width: '100%',
                                marginTop: 6,
                                padding: '12px 14px',
                                background: 'rgba(11, 15, 25, 0.95)',
                                borderRadius: 8,
                                border: '1px solid rgba(99, 102, 241, 0.35)',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e0e7ff' }}>
                                      💬 Subtitles for Episode {idx + 1}: {ep.title || `Episode ${idx + 1}`}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                      (Syncs automatically when viewers watch Ep {idx + 1})
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => triggerEpisodeSubUpload(idx, null)}
                                      disabled={uploadLoading}
                                      className="nav-btn nav-btn-primary"
                                      style={{ fontSize: '0.74rem', padding: '5px 10px', background: '#0284c7' }}
                                    >
                                      <Upload size={12} />
                                      <span>Upload (.SRT / .VTT)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleFetchEpisodeSubtitles(idx)}
                                      disabled={subSearching}
                                      className="nav-btn nav-btn-primary"
                                      style={{ fontSize: '0.74rem', padding: '5px 10px' }}
                                    >
                                      <Wand2 size={12} />
                                      <span>Auto-Fetch Subs</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => addEpisodeSubtitle(idx)}
                                      className="btn-add-sub"
                                      style={{ fontSize: '0.74rem', padding: '5px 10px' }}
                                    >
                                      <Plus size={12} /> Add Row
                                    </button>
                                  </div>
                                </div>

                                {(!ep.subtitles || ep.subtitles.length === 0) ? (
                                  <div style={{ padding: '12px', textAlign: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.1)' }}>
                                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      No subtitle tracks configured for this episode yet. Click <b>Upload (.SRT / .VTT)</b> or <b>Add Row</b> above to add one!
                                    </p>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {ep.subtitles.map((sub, sIdx) => (
                                      <div key={sIdx} className="sub-item-row" style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
                                        <input
                                          type="text"
                                          placeholder="Language (e.g. English, Español)"
                                          className="form-input"
                                          style={{ width: 150, fontSize: '0.8rem' }}
                                          value={sub.name}
                                          onChange={(e) => updateEpisodeSubtitle(idx, sIdx, 'name', e.target.value)}
                                        />
                                        <input
                                          type="url"
                                          placeholder="Subtitle URL (.vtt / .srt or Supabase link)"
                                          className="form-input"
                                          style={{ flex: 1, fontSize: '0.8rem' }}
                                          value={sub.url}
                                          onChange={(e) => updateEpisodeSubtitle(idx, sIdx, 'url', e.target.value)}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => triggerEpisodeSubUpload(idx, sIdx)}
                                          style={{
                                            fontSize: '0.74rem',
                                            padding: '5px 8px',
                                            borderRadius: 5,
                                            background: 'rgba(255,255,255,0.06)',
                                            color: '#38bdf8',
                                            border: '1px solid rgba(56, 189, 248, 0.3)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            whiteSpace: 'nowrap'
                                          }}
                                          title="Upload file for this row"
                                        >
                                          <Upload size={12} />
                                          <span>Upload</span>
                                        </button>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                          <input
                                            type="checkbox"
                                            checked={Boolean(sub.isDefault)}
                                            onChange={(e) => updateEpisodeSubtitle(idx, sIdx, 'isDefault', e.target.checked)}
                                          />
                                          Default
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => removeEpisodeSubtitle(idx, sIdx)}
                                          className="btn-remove-sub"
                                          title="Remove track"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* IF MOVIE: Stream Source Mode Selector */
                <div className="form-group-full">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <label className="input-label" style={{ margin: 0 }}>
                      Stream Source Mode *
                    </label>
                    <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 8, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setSourceMode('youtube')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: sourceMode === 'youtube' ? '#ef4444' : 'transparent',
                          color: sourceMode === 'youtube' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: '0.15s ease'
                        }}
                      >
                        <Play size={14} /> ▶️ YouTube (Unlisted • Zero Ads)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('upload')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: sourceMode === 'upload' ? 'var(--primary)' : 'transparent',
                          color: sourceMode === 'upload' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: '0.15s ease'
                        }}
                      >
                        <Upload size={14} /> ☁️ Supabase Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('gdrive')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: sourceMode === 'gdrive' ? 'var(--primary)' : 'transparent',
                          color: sourceMode === 'gdrive' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: '0.15s ease'
                        }}
                      >
                        <Film size={14} /> 📁 Google Drive (5TB Account)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSourceMode('b2');
                          if (selectedB2BucketId) handleFetchBucketFiles(selectedB2BucketId);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: sourceMode === 'b2' ? '#0284c7' : 'transparent',
                          color: sourceMode === 'b2' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: '0.15s ease'
                        }}
                        id="source-mode-b2-btn"
                      >
                        <HardDrive size={14} /> 🪣 Backblaze B2 (Multi-Account)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('link')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: sourceMode === 'link' ? 'var(--primary)' : 'transparent',
                          color: sourceMode === 'link' ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: '0.15s ease'
                        }}
                      >
                        <ExternalLink size={14} /> 🔗 External Link / Embed
                      </button>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={videoInputRef}
                    style={{ display: 'none' }}
                    accept="video/mp4,video/webm,video/x-matroska"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        const epIdx = videoUploadEpisodeRef.current;
                        handleFileUpload(e.target.files[0], 'videos', null, epIdx);
                        e.target.value = '';
                      }
                    }}
                  />

                  {/* MODE 1: YouTube Unlisted Video (Zero Ads Cinema) */}
                  {sourceMode === 'youtube' ? (
                    <div>
                      {streamUrl && getYouTubeId(streamUrl) ? (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(153, 27, 27, 0.2))',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          borderRadius: 'var(--radius-md)',
                          padding: '18px 20px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#fca5a5', fontSize: '0.98rem' }}>
                                <CheckCircle2 size={19} color="#ef4444" />
                                <span>Active Ad-Free YouTube Cinema Stream Connected</span>
                              </div>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Video ID: <strong style={{ color: '#fff' }}>{getYouTubeId(streamUrl)}</strong> • Ultra-fast Google CDN, zero bandwidth limits, 100% ad-free playback.
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setTestStreamUrl(streamUrl)}
                                className="nav-btn nav-btn-ghost"
                                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                <Play size={14} /> Preview Stream
                              </button>
                              <button
                                type="button"
                                onClick={() => { setStreamUrl(''); setYoutubeInputUrl(''); }}
                                className="nav-btn nav-btn-ghost"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#f87171' }}
                              >
                                <Trash2 size={14} /> Disconnect
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 'var(--radius-md)',
                          padding: '24px 20px',
                          background: 'rgba(239, 68, 68, 0.05)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <Play size={22} color="#ef4444" />
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                              Connect YouTube Video (Unlisted • 100% Ad-Free)
                            </div>
                          </div>
                          <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                            <div style={{ marginBottom: 4 }}>
                              💡 <strong>Zero Ads Guarantee:</strong> Upload your movie to YouTube and set visibility to <strong>Unlisted</strong> with monetization off.
                            </div>
                            <div>
                              YouTube unlisted videos never show advertisements, have unlimited Google CDN streaming speed, and never hit Google Drive's "too many users" quota limit.
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Paste YouTube link (https://youtu.be/... or https://youtube.com/watch?v=...) or Video ID"
                              value={youtubeInputUrl}
                              onChange={(e) => setYoutubeInputUrl(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={handleConnectYouTube}
                              className="nav-btn nav-btn-primary"
                              style={{ whiteSpace: 'nowrap', padding: '0 20px', background: '#ef4444', borderColor: '#dc2626' }}
                            >
                              Connect Video
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : sourceMode === 'upload' ? (
                    /* MODE 2: Direct Storage Upload */
                    <div>
                      {streamUrl && (streamUrl.includes('supabase.co') || streamUrl.endsWith('.mp4') || streamUrl.endsWith('.webm')) ? (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.2))',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          borderRadius: 'var(--radius-md)',
                          padding: '18px 20px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#86efac', fontSize: '0.98rem' }}>
                                <CheckCircle2 size={19} color="#10b981" />
                                <span>Active Video File in Supabase Storage</span>
                              </div>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                100% Ad-Free Native Cinema Stream ready. Viewers enjoy pure HTML5 playback with multi-language subtitle tracks.
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setTestStreamUrl(streamUrl)}
                                className="nav-btn nav-btn-ghost"
                                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                <Play size={14} /> Preview Stream
                              </button>
                              <button
                                type="button"
                                onClick={() => videoInputRef.current?.click()}
                                disabled={uploadLoading}
                                className="nav-btn nav-btn-primary"
                                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                {uploadLoading ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
                                <span>Replace Video</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setStreamUrl('')}
                                className="nav-btn nav-btn-ghost"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#f87171' }}
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => videoInputRef.current?.click()}
                          style={{
                            border: '2px dashed rgba(99, 102, 241, 0.45)',
                            borderRadius: 'var(--radius-md)',
                            padding: '36px 20px',
                            textAlign: 'center',
                            cursor: uploadLoading ? 'not-allowed' : 'pointer',
                            background: 'rgba(99, 102, 241, 0.05)',
                            transition: '0.2s ease'
                          }}
                        >
                          {uploadLoading ? (
                            <RefreshCw size={36} className="spin" color="#818cf8" style={{ margin: '0 auto 12px' }} />
                          ) : (
                            <Upload size={36} color="#818cf8" style={{ margin: '0 auto 12px' }} />
                          )}
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>
                            {uploadLoading ? 'Uploading Movie to Supabase Storage...' : 'Click to Upload MP4 Movie File'}
                          </div>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 6 }}>
                            Stored permanently in your Supabase bucket. Enables full 1080p Artplayer with zero ads, zero popups, and no token expiration.
                          </p>
                        </div>
                      )}
                      {uploadStatus && (
                        <div style={{
                          marginTop: 10,
                          padding: '8px 14px',
                          borderRadius: 6,
                          fontSize: '0.82rem',
                          background: uploadStatus.startsWith('✅') ? 'rgba(16, 185, 129, 0.18)' : 'rgba(99, 102, 241, 0.18)',
                          color: uploadStatus.startsWith('✅') ? '#86efac' : '#c7d2fe',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          {uploadStatus}
                        </div>
                      )}
                    </div>
                  ) : sourceMode === 'gdrive' ? (
                    /* MODE 3: Google Drive 5TB Account */
                    <div>
                      {streamUrl && (streamUrl.includes('gdrive') || streamUrl.includes('drive.google.com')) ? (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(30, 58, 138, 0.2))',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          borderRadius: 'var(--radius-md)',
                          padding: '18px 20px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#93c5fd', fontSize: '0.98rem' }}>
                                <CheckCircle2 size={19} color="#3b82f6" />
                                <span>Active 5TB Google Drive Pro Stream Connected</span>
                              </div>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                Direct 1080p proxy stream with byte-range seeking (HTTP 206) and zero ads. Stored in your Google Drive.
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setTestStreamUrl(streamUrl)}
                                className="nav-btn nav-btn-ghost"
                                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                              >
                                <Play size={14} /> Preview Stream
                              </button>
                              <button
                                type="button"
                                onClick={() => { setStreamUrl(''); setGdriveInputUrl(''); }}
                                className="nav-btn nav-btn-ghost"
                                style={{ fontSize: '0.8rem', padding: '6px 12px', color: '#f87171' }}
                              >
                                <Trash2 size={14} /> Disconnect
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: 'var(--radius-md)',
                          padding: '24px 20px',
                          background: 'rgba(59, 130, 246, 0.05)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <Film size={22} color="#60a5fa" />
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                              Connect Video from your 5TB Google Drive Pro
                            </div>
                          </div>
                          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                            1. In Google Drive, right-click your MP4 movie and set Share to <strong>"Anyone with the link can view"</strong>.<br />
                            2. Paste the share link below. WatchBox will stream it directly in full 1080p with zero ads, high-speed buffering, and custom subtitles.
                          </p>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="https://drive.google.com/file/d/1XyZ.../view?usp=sharing or File ID"
                              value={gdriveInputUrl}
                              onChange={(e) => setGdriveInputUrl(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={handleConnectGDrive}
                              className="nav-btn nav-btn-primary"
                              style={{ whiteSpace: 'nowrap', padding: '0 20px' }}
                            >
                              Connect Video
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : sourceMode === 'b2' ? (
                    /* MODE: Backblaze B2 Multi-Account Storage */
                    <div style={{
                      border: '1px solid rgba(2, 132, 199, 0.35)',
                      borderRadius: 'var(--radius-md)',
                      padding: '22px 20px',
                      background: 'rgba(2, 132, 199, 0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <HardDrive size={22} color="#38bdf8" />
                          <div>
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                              Backblaze B2 Multi-Account Storage Stream
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                              Zero ads, native 1080p Artplayer with byte-range seeking, 100% free accounts.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('buckets');
                            loadBuckets();
                          }}
                          className="nav-btn nav-btn-ghost"
                          style={{ fontSize: '0.78rem', padding: '6px 12px', color: '#38bdf8' }}
                        >
                          Manage Buckets &rarr;
                        </button>
                      </div>

                      {buckets.length === 0 ? (
                        <div style={{ padding: 18, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, color: '#fca5a5', fontSize: '0.88rem' }}>
                          No storage buckets configured yet. Please open the <strong>"Storage Buckets"</strong> tab to configure your first free Backblaze B2 account!
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                            <div>
                              <label className="input-label" style={{ marginBottom: 6 }}>
                                Select Storage Bucket / Account *
                              </label>
                              <select
                                className="form-input"
                                value={selectedB2BucketId}
                                onChange={(e) => {
                                  const newBucketId = e.target.value;
                                  setSelectedB2BucketId(newBucketId);
                                  if (b2FileKey.trim()) {
                                    const encoded = b2FileKey.trim().split('/').map(encodeURIComponent).join('/');
                                    setStreamUrl(`/api/stream/b2/${newBucketId}/${encoded}`);
                                  }
                                  handleFetchBucketFiles(newBucketId);
                                }}
                                style={{ width: '100%', cursor: 'pointer' }}
                              >
                                {buckets.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.label} ({b.bucket_name} • {b.endpoint}) {b.is_default ? '★ Default' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="input-label" style={{ marginBottom: 6 }}>
                                File Key (Filename in Bucket) *
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. myfile.mp4 or movies/avatar.mp4"
                                  value={b2FileKey}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setB2FileKey(val);
                                    if (val.trim()) {
                                      const encoded = val.trim().split('/').map(encodeURIComponent).join('/');
                                      setStreamUrl(`/api/stream/b2/${selectedB2BucketId || 'default'}/${encoded}`);
                                    } else {
                                      setStreamUrl('');
                                    }
                                  }}
                                  style={{ flex: 1 }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleFetchBucketFiles(selectedB2BucketId)}
                                  disabled={b2LoadingFiles || !selectedB2BucketId}
                                  className="nav-btn nav-btn-primary"
                                  style={{ whiteSpace: 'nowrap', padding: '0 16px', background: '#0284c7' }}
                                  title="Query bucket files using S3 list"
                                >
                                  {b2LoadingFiles ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
                                  <span>{b2LoadingFiles ? 'Checking...' : 'List Files'}</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Quick-clickable detected files pills */}
                          {b2DiscoveredFiles.length > 0 && (
                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                                Detected files in this bucket (click to select):
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {b2DiscoveredFiles.map((file) => (
                                  <button
                                    key={file}
                                    type="button"
                                    onClick={() => {
                                      setB2FileKey(file);
                                      const encoded = file.split('/').map(encodeURIComponent).join('/');
                                      const path = `/api/stream/b2/${selectedB2BucketId || 'default'}/${encoded}`;
                                      setStreamUrl(path);
                                      if (contentType === 'series' && episodes.length > 0) {
                                        const epTarget = (activeSubtitleTab && activeSubtitleTab.startsWith('ep-'))
                                          ? parseInt(activeSubtitleTab.replace('ep-', ''), 10)
                                          : 0;
                                        if (episodes[epTarget]) {
                                          updateEpisode(epTarget, 'stream_url', path);
                                          setStatusMessage({ text: `Selected "${file}" and attached to Episode ${epTarget + 1}!`, type: 'success' });
                                          return;
                                        }
                                      }
                                      setStatusMessage({ text: `Selected "${file}"! Stream URL set to ${path}`, type: 'success' });
                                    }}
                                    style={{
                                      fontSize: '0.78rem',
                                      padding: '5px 12px',
                                      borderRadius: 16,
                                      background: b2FileKey === file ? '#0284c7' : 'rgba(255,255,255,0.07)',
                                      color: b2FileKey === file ? '#fff' : '#cbd5e1',
                                      border: b2FileKey === file ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      transition: '0.15s ease'
                                    }}
                                  >
                                    <Film size={12} />
                                    <span>{file}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Active Gateway Stream Info */}
                          {streamUrl && (streamUrl.includes('/api/stream/b2') || streamUrl.includes('backblazeb2.com')) && (
                            <div style={{
                              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(12, 74, 110, 0.25))',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              borderRadius: 'var(--radius-md)',
                              padding: '14px 16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 10
                            }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#7dd3fc', fontSize: '0.92rem' }}>
                                  <CheckCircle2 size={18} color="#38bdf8" />
                                  <span>Connected WatchBox Dynamic B2 Gateway</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: 3, wordBreak: 'break-all' }}>
                                  Gateway URL: <code>{streamUrl}</code>
                                </p>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => setTestStreamUrl(streamUrl)}
                                  className="nav-btn nav-btn-ghost"
                                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                                >
                                  <Play size={14} /> Preview Stream
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setStreamUrl(''); setB2FileKey(''); }}
                                  className="nav-btn nav-btn-ghost"
                                  style={{ fontSize: '0.8rem', padding: '6px 10px', color: '#f87171' }}
                                >
                                  <Trash2 size={14} /> Clear
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* MODE 4: External Stream / Embed Link */
                    <div>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://ok.ru/video/123456789 or https://vidlink.pro/movie/969681"
                        value={streamUrl}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const okMatch = val.match(/ok\.ru\/(?:video|videoembed)\/(\d+)/);
                          if (okMatch) {
                            setStreamUrl(`https://ok.ru/videoembed/${okMatch[1]}`);
                          } else {
                            setStreamUrl(e.target.value);
                          }
                        }}
                        required={sourceMode === 'link'}
                        id="form-stream-url"
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                          Enter an embed URL or third-party manifest. Viewers will use the Web Embed Player.
                        </p>
                        {streamUrl && (
                          <button
                            type="button"
                            onClick={() => setTestStreamUrl(streamUrl)}
                            style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            Test Play Link &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inline Video Tester */}
                  {testStreamUrl && (
                    <div className="stream-tester-box" style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          {getYouTubeId(testStreamUrl) ? 'Previewing Ad-Free YouTube Cinema Stream:' : 'Previewing Video File:'}
                        </span>
                        <button type="button" onClick={() => setTestStreamUrl('')} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Close Preview
                        </button>
                      </div>
                      {getYouTubeId(testStreamUrl) ? (
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(testStreamUrl)}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&fs=1&controls=1&color=white`}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                            title="Preview"
                          />
                        </div>
                      ) : (
                        <video
                          src={testStreamUrl}
                          controls
                          autoPlay
                          className="stream-tester-video"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Subtitles Management */}
              <div className="form-group-full">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <label className="input-label" style={{ margin: 0 }}>
                      Subtitle Tracks (International Multi-Language Standards)
                    </label>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Supports WebVTT (.vtt) & SubRip (.srt). Automatically converted and CORS-enabled.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const isSeriesMode = contentType === 'series' && episodes.length > 0;
                        const currentEpIdx = (isSeriesMode && activeSubtitleTab.startsWith('ep-'))
                          ? parseInt(activeSubtitleTab.replace('ep-', ''), 10)
                          : null;
                        if (currentEpIdx !== null && episodes[currentEpIdx]) {
                          triggerEpisodeSubUpload(currentEpIdx, null);
                        } else {
                          subUploadEpisodeRef.current = null;
                          subUploadTargetRef.current = null;
                          subInputRef.current?.click();
                        }
                      }}
                      disabled={uploadLoading}
                      className="nav-btn nav-btn-primary"
                      style={{ fontSize: '0.78rem', padding: '6px 14px', background: '#0284c7' }}
                    >
                      <Upload size={13} />
                      <span>☁️ Upload Subtitle (.SRT / .VTT)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const isSeriesMode = contentType === 'series' && episodes.length > 0;
                        const currentEpIdx = (isSeriesMode && activeSubtitleTab.startsWith('ep-'))
                          ? parseInt(activeSubtitleTab.replace('ep-', ''), 10)
                          : null;
                        if (currentEpIdx !== null && episodes[currentEpIdx]) {
                          handleFetchEpisodeSubtitles(currentEpIdx);
                        } else {
                          handleFetchSubtitles();
                        }
                      }}
                      disabled={subSearching}
                      className="nav-btn nav-btn-primary"
                      style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                    >
                      {subSearching ? <RefreshCw size={13} className="spin" /> : <Wand2 size={13} />}
                      <span>{subSearching ? 'Fetching Subs...' : '🌐 Auto-Fetch Online Subs'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const isSeriesMode = contentType === 'series' && episodes.length > 0;
                        const currentEpIdx = (isSeriesMode && activeSubtitleTab.startsWith('ep-'))
                          ? parseInt(activeSubtitleTab.replace('ep-', ''), 10)
                          : null;
                        if (currentEpIdx !== null && episodes[currentEpIdx]) {
                          addEpisodeSubtitle(currentEpIdx);
                        } else {
                          addSubtitleField();
                        }
                      }}
                      className="btn-add-sub"
                      id="add-subtitle-track-btn"
                    >
                      <Plus size={14} /> Add Row
                    </button>
                  </div>
                </div>

                {/* If Series: Show Episode Switcher Tabs */}
                {contentType === 'series' && episodes.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 14,
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    overflowX: 'auto',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginRight: 4, whiteSpace: 'nowrap' }}>
                      Select Target Episode:
                    </span>
                    {episodes.map((ep, idx) => {
                      const isSelected = activeSubtitleTab === `ep-${idx}`;
                      const count = ep.subtitles?.length || 0;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveSubtitleTab(`ep-${idx}`)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255,255,255,0.04)',
                            color: isSelected ? '#a5b4fc' : '#cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span>📺 Ep {idx + 1}: {ep.title ? (ep.title.length > 18 ? ep.title.slice(0, 18) + '...' : ep.title) : `Episode ${idx + 1}`}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: 10,
                            background: count > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.1)',
                            color: count > 0 ? '#38bdf8' : '#94a3b8',
                            fontWeight: 700
                          }}>
                            {count} {count === 1 ? 'sub' : 'subs'}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setActiveSubtitleTab('global')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: activeSubtitleTab === 'global' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                        background: activeSubtitleTab === 'global' ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255,255,255,0.04)',
                        color: activeSubtitleTab === 'global' ? '#a5b4fc' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>🎬 Fallback / Global ({subtitles.length})</span>
                    </button>
                  </div>
                )}

                <input
                  type="file"
                  ref={subInputRef}
                  style={{ display: 'none' }}
                  accept=".vtt,.srt,.sub,.txt,text/vtt,application/x-subrip,text/plain"
                  onChange={(e) => {
                    const pickedFile = e.target.files?.[0];
                    if (pickedFile) {
                      const targetIdx = subUploadTargetRef.current;
                      const targetEpIdx = subUploadEpisodeRef.current;
                      handleFileUpload(pickedFile, 'subtitles', targetIdx, targetEpIdx);
                      e.target.value = '';
                      subUploadTargetRef.current = null;
                      subUploadEpisodeRef.current = null;
                    }
                  }}
                />

                {(() => {
                  const isSeriesMode = contentType === 'series' && episodes.length > 0;
                  const currentEpIdx = (isSeriesMode && activeSubtitleTab.startsWith('ep-'))
                    ? parseInt(activeSubtitleTab.replace('ep-', ''), 10)
                    : null;
                  const currentEp = (currentEpIdx !== null && episodes[currentEpIdx])
                    ? episodes[currentEpIdx]
                    : null;

                  if (currentEp) {
                    const epSubs = Array.isArray(currentEp.subtitles) ? currentEp.subtitles : [];
                    return (
                      <div className="subtitle-manager">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', background: 'rgba(99, 102, 241, 0.12)', borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                          <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 600 }}>
                            Editing Subtitles for: Episode {currentEpIdx + 1} - {currentEp.title || `Episode ${currentEpIdx + 1}`}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {epSubs.length} track{epSubs.length === 1 ? '' : 's'} assigned (syncs automatically with Ep {currentEpIdx + 1})
                          </span>
                        </div>

                        {epSubs.length === 0 ? (
                          <div style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                              No subtitle tracks added for Episode {currentEpIdx + 1} ({currentEp.title || `Episode ${currentEpIdx + 1}`}) yet.
                            </p>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => triggerEpisodeSubUpload(currentEpIdx, null)}
                                className="nav-btn nav-btn-primary"
                                style={{ fontSize: '0.78rem', padding: '6px 14px', background: '#0284c7' }}
                              >
                                <Upload size={13} /> Upload .SRT / .VTT for Ep {currentEpIdx + 1}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFetchEpisodeSubtitles(currentEpIdx)}
                                className="nav-btn nav-btn-primary"
                                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                              >
                                <Wand2 size={13} /> Auto-Fetch Online Subs
                              </button>
                              <button
                                type="button"
                                onClick={() => addEpisodeSubtitle(currentEpIdx)}
                                className="btn-add-sub"
                                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                              >
                                <Plus size={13} /> Add Row
                              </button>
                            </div>
                          </div>
                        ) : (
                          epSubs.map((sub, index) => (
                            <div key={index} className="sub-item-row">
                              <input
                                type="text"
                                placeholder="Language (e.g. English, Español)"
                                className="form-input"
                                style={{ width: 160 }}
                                value={sub.name}
                                onChange={(e) => updateEpisodeSubtitle(currentEpIdx, index, 'name', e.target.value)}
                              />
                              <input
                                type="url"
                                placeholder="Subtitle URL (.vtt / .srt or Supabase link)"
                                className="form-input"
                                style={{ flex: 1 }}
                                value={sub.url}
                                onChange={(e) => updateEpisodeSubtitle(currentEpIdx, index, 'url', e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => triggerEpisodeSubUpload(currentEpIdx, index)}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  background: 'rgba(255,255,255,0.06)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                                title="Upload .vtt or .srt file for this track"
                              >
                                <Upload size={13} />
                                <span>Upload</span>
                              </button>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(sub.isDefault)}
                                  onChange={(e) => updateEpisodeSubtitle(currentEpIdx, index, 'isDefault', e.target.checked)}
                                />
                                Default
                              </label>
                              <button
                                type="button"
                                onClick={() => removeEpisodeSubtitle(currentEpIdx, index)}
                                className="btn-remove-sub"
                                title="Remove Subtitle Track"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}

                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Tip: Subtitles configured for Episode {currentEpIdx + 1} will automatically load and sync whenever a viewer plays Episode {currentEpIdx + 1}!
                        </p>
                      </div>
                    );
                  }

                  // Default / Global Fallback Subtitles Manager
                  return (
                    <div className="subtitle-manager">
                      {contentType === 'series' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Global / Fallback Subtitles (Used as fallback if an episode doesn't have its own custom tracks)
                          </span>
                        </div>
                      )}
                      {subtitles.map((sub, index) => (
                        <div key={index} className="sub-item-row">
                          <input
                            type="text"
                            placeholder="Language (e.g. English, Español)"
                            className="form-input"
                            style={{ width: 160 }}
                            value={sub.name}
                            onChange={(e) => updateSubtitleField(index, 'name', e.target.value)}
                          />
                          <input
                            type="url"
                            placeholder="Subtitle URL (.vtt / .srt or Supabase link)"
                            className="form-input"
                            style={{ flex: 1 }}
                            value={sub.url}
                            onChange={(e) => updateSubtitleField(index, 'url', e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              subUploadEpisodeRef.current = null;
                              subUploadTargetRef.current = index;
                              subInputRef.current?.click();
                            }}
                            style={{
                              fontSize: '0.75rem',
                              padding: '6px 10px',
                              borderRadius: 6,
                              background: 'rgba(255,255,255,0.06)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title="Upload .vtt or .srt file to Supabase"
                          >
                            <Upload size={13} />
                            <span>Upload</span>
                          </button>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(sub.isDefault)}
                              onChange={(e) => updateSubtitleField(index, 'isDefault', e.target.checked)}
                            />
                            Default
                          </label>
                          {subtitles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSubtitleField(index)}
                              className="btn-remove-sub"
                              title="Remove Subtitle Track"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Tip: Any third-party subtitle link is automatically proxied with CORS headers so browsers will never block it!
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Poster Image URL */}
              <div>
                <label className="input-label">Poster Image URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  id="form-poster-url"
                />
              </div>

              {/* Backdrop Image URL */}
              <div>
                <label className="input-label">Backdrop / Landscape Image URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={backdropUrl}
                  onChange={(e) => setBackdropUrl(e.target.value)}
                  id="form-backdrop-url"
                />
              </div>

              {/* Genre & Rating */}
              <div>
                <label className="input-label">Genre</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sci-Fi / Action"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Quality Badge</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 4K Ultra HD, HD 1080p"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                />
              </div>

              {/* Year & Duration */}
              <div>
                <label className="input-label">Release Year</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="2024"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Duration</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2h 15m or 15 min"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="form-group-full">
                <label className="input-label">Plot Overview / Synopsis</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Write a brief synopsis of the movie..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Featured in Hero checkbox */}
              <div className="form-group-full">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem', color: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Feature as Main Hero Banner on Homepage</span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', gap: 14 }}>
              <button
                type="submit"
                className="nav-btn nav-btn-primary"
                style={{ padding: '12px 28px', fontSize: '1rem' }}
                id="save-movie-submit-btn"
              >
                <Save size={18} />
                <span>{isEditing ? 'Save Changes' : 'Publish Movie'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab('movies');
                }}
                className="nav-btn nav-btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: STORAGE BUCKETS (BACKBLAZE B2 MULTI-ACCOUNT) */}
      {activeTab === 'buckets' && (
        <div>
          {/* Header Action Banner */}
          <div className="recovery-card" style={{ marginBottom: 20 }}>
            <div className="recovery-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <HardDrive size={22} color="#38bdf8" />
                <h3 style={{ margin: 0 }}>Backblaze B2 Multi-Account Storage Manager</h3>
              </div>
              <p>
                Connect multiple free Backblaze B2 accounts (10 GB free each). Attach movies and TV series to specific buckets with zero ads, high-speed CDN, and native 1080p Artplayer streaming.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={loadBuckets}
                disabled={loadingBuckets}
                className="nav-btn nav-btn-ghost"
              >
                <RefreshCw size={15} className={loadingBuckets ? 'spin' : ''} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => {
                  resetBucketForm();
                  setBucketModalOpen(true);
                }}
                className="nav-btn nav-btn-primary"
                style={{ background: '#0284c7', borderColor: '#0369a1' }}
                id="btn-add-storage-bucket"
              >
                <Plus size={16} />
                <span>Add Storage Bucket</span>
              </button>
            </div>
          </div>

          {/* Buckets Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18, marginBottom: 28 }}>
            {buckets.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '48px 24px',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-lg)'
              }}>
                <HardDrive size={40} color="#64748b" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: 6 }}>No Storage Buckets Configured</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 500, margin: '0 auto 18px' }}>
                  Add your first free Backblaze B2 account to start hosting movie MP4 files with zero ads and unlimited scalability.
                </p>
                <button
                  onClick={() => {
                    resetBucketForm();
                    setBucketModalOpen(true);
                  }}
                  className="nav-btn nav-btn-primary"
                  style={{ margin: '0 auto' }}
                >
                  <Plus size={16} /> Configure First Bucket
                </button>
              </div>
            ) : (
              buckets.map((b) => {
                const testRes = bucketTestResults[b.id];
                const isTesting = bucketTestingId === b.id;
                return (
                  <div
                    key={b.id}
                    className="admin-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: b.is_default ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border)',
                      background: b.is_default ? 'linear-gradient(180deg, rgba(2, 132, 199, 0.08) 0%, var(--bg-surface) 100%)' : 'var(--bg-surface)'
                    }}
                  >
                    <div>
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                              {b.label}
                            </h4>
                            {b.is_default && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                                ★ Default
                              </span>
                            )}
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: b.is_active !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)', color: b.is_active !== false ? '#86efac' : '#94a3b8' }}>
                              {b.is_active !== false ? '● Active' : '○ Inactive'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            ID: <code>{b.id}</code>
                          </div>
                        </div>
                      </div>

                      {/* Details Box */}
                      <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 8,
                        padding: '12px 14px',
                        fontSize: '0.82rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginBottom: 14
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Bucket Name:</span>
                          <strong style={{ color: '#fff' }}>{b.bucket_name}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>S3 Endpoint:</span>
                          <span style={{ color: '#93c5fd', wordBreak: 'break-all' }}>{b.endpoint}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Key ID:</span>
                          <code style={{ color: '#cbd5e1' }}>{b.key_id ? `${b.key_id.slice(0, 6)}...${b.key_id.slice(-4)}` : '—'}</code>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Application Key:</span>
                          <code style={{ color: '#94a3b8' }}>{b.application_key_masked || '••••••••'}</code>
                        </div>
                      </div>

                      {/* Test Connection Banner */}
                      {testRes && (
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          marginBottom: 14,
                          fontSize: '0.8rem',
                          background: testRes.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          border: testRes.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          color: testRes.success ? '#86efac' : '#fca5a5'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            {testRes.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            <span>{testRes.success ? 'Connection Verified & Active' : 'Connection Failed'}</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: '0.76rem', color: testRes.success ? '#bbf7d0' : '#fecaca' }}>
                            {testRes.message || testRes.error}
                          </div>
                          {testRes.filesFound && testRes.filesFound.length > 0 && (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>
                                Files found ({testRes.filesFound.length}):
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {testRes.filesFound.map((f) => (
                                  <span key={f} style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff' }}>
                                    📄 {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleTestBucket(b)}
                        disabled={isTesting}
                        className="nav-btn nav-btn-primary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#0284c7', borderColor: '#0369a1' }}
                        title="Run live AWS S3 listing and probe test"
                      >
                        {isTesting ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
                        <span>{isTesting ? 'Testing...' : '⚡ Test Connection'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditBucketModal(b)}
                        className="nav-btn nav-btn-ghost"
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBucket(b.id, b.label)}
                        className="nav-btn nav-btn-ghost"
                        style={{ fontSize: '0.8rem', padding: '6px 10px', color: '#f87171' }}
                        title="Delete bucket"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Setup Instructions Card */}
          <div className="admin-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Server size={22} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                How to Create Unlimited Free Backblaze B2 Accounts (10 GB Free Each)
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h5 style={{ color: '#38bdf8', marginBottom: 6 }}>1. Register Free B2 Account</h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Sign up at <a href="https://www.backblaze.com/b2/cloud-storage.html" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>backblaze.com/b2</a>. Every account receives <strong>10 GB free cloud storage forever</strong> and free egress.
                </p>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h5 style={{ color: '#38bdf8', marginBottom: 6 }}>2. Create a Bucket</h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  In your Backblaze dashboard, click <strong>Buckets &rarr; Create a Bucket</strong>. Choose any unique bucket name (e.g. <code>mycinemabox</code>). Set to <strong>Private</strong> (our gateway presigns URLs securely).
                </p>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h5 style={{ color: '#38bdf8', marginBottom: 6 }}>3. Generate Application Key</h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Go to <strong>Application Keys &rarr; Add a New Application Key</strong>. Give it Read and Write access. Copy the <code>keyID</code> and <code>applicationKey</code>. Note the S3 Endpoint under Bucket Details.
                </p>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h5 style={{ color: '#38bdf8', marginBottom: 6 }}>4. Connect in WatchBox</h5>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Click <strong>"Add Storage Bucket"</strong> above and paste your credentials. WatchBox will stream all MP4 videos directly through its dynamic AWS SigV4 signed gateway with byte-range seeking!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUPABASE SETUP GUIDE */}
      {activeTab === 'supabase' && (
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Database size={24} color="#6366f1" />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Supabase Free Tier Cloud Database Setup</h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            Follow these 3 easy steps to connect a 100% free PostgreSQL database on Supabase for your Vercel deployment:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <h4 style={{ color: '#fff', marginBottom: 6 }}>1. Create Free Project</h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>supabase.com</a>, log in with GitHub, and create a new free project.
              </p>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ color: '#fff' }}>2. Run SQL Schema in Supabase SQL Editor</h4>
                <button
                  onClick={copySqlToClipboard}
                  className="nav-btn nav-btn-ghost"
                  style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                >
                  {copiedSql ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL'}</span>
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                In your Supabase project dashboard, click <strong>SQL Editor</strong> &rarr; <strong>New Query</strong>, paste the code below, and click <strong>Run</strong>:
              </p>
              <pre className="code-block">{supabaseSql}</pre>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <h4 style={{ color: '#fff', marginBottom: 6 }}>3. Add Keys to .env.local or Vercel Environment Variables</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Find your API URL and Service Role Key under <strong>Project Settings &rarr; API</strong>, and add them:
              </p>
              <pre className="code-block">
                {`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_SECRET_KEY=admin123`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* QUICK STREAM EDIT MODAL */}
      {quickEditMovie && (
        <div className="modal-overlay" onClick={() => setQuickEditMovie(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: '#f87171' }}>
                  Replace Broken Stream Link
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Movie: <strong>{quickEditMovie.title}</strong>
                </p>
              </div>
              <button onClick={() => setQuickEditMovie(null)} className="btn-close-modal">✕</button>
            </div>

            <form onSubmit={handleQuickStreamSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="input-label">New Working Stream (YouTube Link / Video ID, MP4, or Google Drive)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. YouTube link (https://youtu.be/...), 11-digit Video ID, or .mp4 URL"
                  value={quickStreamUrl}
                  onChange={(e) => setQuickStreamUrl(e.target.value)}
                  required
                  id="modal-quick-stream-input"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  className="nav-btn nav-btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  id="modal-quick-save-btn"
                >
                  <Save size={16} /> Save & Fix Stream
                </button>
                <button
                  type="button"
                  onClick={() => setQuickEditMovie(null)}
                  className="nav-btn nav-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUCKET ADD / EDIT MODAL */}
      {bucketModalOpen && (
        <div className="modal-overlay" onClick={() => setBucketModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ color: '#38bdf8' }}>
                  {editingBucket ? 'Edit Storage Bucket' : 'Add Backblaze B2 Storage Bucket'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Configure credentials for a Backblaze B2 free account or custom S3 bucket.
                </p>
              </div>
              <button onClick={() => setBucketModalOpen(false)} className="btn-close-modal">✕</button>
            </div>

            <form onSubmit={handleSaveBucket} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="input-label">Friendly Label * (e.g. Account 1 - Free 10GB)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Account 1 - Action Films"
                  value={bucketLabel}
                  onChange={(e) => setBucketLabel(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="input-label">Bucket Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. alibox"
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="input-label">S3 Endpoint *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. s3.us-east-005.backblazeb2.com"
                    value={bucketEndpoint}
                    onChange={(e) => setBucketEndpoint(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="input-label">keyID (Application Key ID) *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 005127ef731bad70000000002"
                  value={bucketKeyId}
                  onChange={(e) => setBucketKeyId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="input-label">
                  applicationKey (Secret Access Key) {editingBucket ? '(Leave blank to keep existing)' : '*'}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={editingBucket ? '•••••••••••••••••••••••••••' : 'e.g. K005wWuDf04WXTidhNgx0k25wJzmGXE'}
                  value={bucketAppKey}
                  onChange={(e) => setBucketAppKey(e.target.value)}
                  required={!editingBucket}
                />
              </div>

              <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bucketIsDefault}
                    onChange={(e) => setBucketIsDefault(e.target.checked)}
                  />
                  <span>Set as Default Bucket</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: '#fff', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bucketIsActive}
                    onChange={(e) => setBucketIsActive(e.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => handleTestBucket(null)}
                  disabled={bucketTestingId === 'manual' || !bucketName || !bucketKeyId}
                  className="nav-btn nav-btn-ghost"
                  style={{ fontSize: '0.85rem' }}
                >
                  {bucketTestingId === 'manual' ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
                  <span>Test Credentials</span>
                </button>

                <button
                  type="submit"
                  className="nav-btn nav-btn-primary"
                  style={{ flex: 1, justifyContent: 'center', background: '#0284c7', borderColor: '#0369a1' }}
                >
                  <Save size={16} /> Save Bucket
                </button>

                <button
                  type="button"
                  onClick={() => setBucketModalOpen(false)}
                  className="nav-btn nav-btn-ghost"
                >
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
