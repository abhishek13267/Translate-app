import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { languages, sttLanguages } from './languages';
import './App.css';

// Use the Vite proxy during local development to avoid backend URL drift.
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
axios.defaults.baseURL = API_BASE_URL;

const getTranslateErrorMessage = (err) => {
  if (err.response?.status === 404) {
    return 'Translation route not found. Please restart the backend server on port 5050.';
  }

  if (!err.response) {
    return 'Cannot reach the backend server. Please make sure it is running on port 5050 (or 5000) and CORS is not blocked.';
  }

  return err.response?.data?.error || 'Translation failed';
};

function App() {
  const [currentPage, setCurrentPage] = useState('auth'); // 'auth' or 'translate'
  const [isLogin, setIsLogin] = useState(true);
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [notification, setNotification] = useState(null);

  // States for Translation & Customization
  const [sourceLang, setSourceLang] = useState('en-US');
  const [targetLang, setTargetLang] = useState('hi');
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [voiceGender, setVoiceGender] = useState('NEUTRAL');
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [history, setHistory] = useState([]);
  const [audioSrc, setAudioSrc] = useState(null);
  const [viewMode, setViewMode] = useState('studio'); // 'studio' or 'chat'
  const [textInput, setTextInput] = useState(''); // Added text input state

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  // Check Local Storage for Auth
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
      setCurrentPage('translate');
      fetchHistory(token);
    }
  }, []);

  const showToast = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchHistory = async (token) => {
    try {
      const res = await axios.get('/api/history', {
        headers: { 'x-auth-token': token || localStorage.getItem('token') }
      });
      setHistory(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
      console.error('History fetch failed');
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const url = isLogin ? '/api/auth/login' : '/api/auth/signup';
    try {
      setStatus('Authorizing...');
      const res = await axios.post(url, authForm);
      const { accessToken, refreshToken, user } = res.data;
      localStorage.setItem('token', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      setCurrentPage('translate');
      fetchHistory(accessToken);
      setStatus('Ready');
      showToast('Welcome to Vaak AI!', 'success');
    } catch (err) {
      const data = err.response?.data;
      const errorMessage = data?.error || (data?.errors ? data.errors.map(e => e.msg).join(', ') : 'Authentication error');
      showToast(errorMessage, 'error');
      setStatus('Ready');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentPage('auth');
    setHistory([]);
    setTranscript('');
    setTranslatedText('');
    setAudioSrc(null);
    showToast('Logged Out Successfully');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = processAudio;
      mediaRecorder.current.start();
      setIsRecording(true);
      setStatus('Listening...');
    } catch (err) {
      setStatus('Error: Mic Access Denied');
      showToast('Microphone access required', 'error');
    }
  };

  const processAudio = async () => {
    const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = reader.result;
      try {
        setStatus('Processing...');
        const response = await axios.post('/api/translate', 
          { 
              audio: base64Audio, 
              source_lang: sourceLang, 
              target_lang: targetLang,
              speed: speakingRate,
              gender: voiceGender
          },
          { headers: { 'x-auth-token': localStorage.getItem('token') } }
        );
        setTranscript(response.data.transcript);
        setTranslatedText(response.data.translated_text);
        setAudioSrc(response.data.audio);
        setStatus('Ready');
        
        // Optimistically add to history list for immediate feedback
        const newHistoryItem = {
           _id: Date.now(),
           originalText: response.data.transcript,
           translatedText: response.data.translated_text,
           audioBase64: response.data.audio,
           createdAt: new Date().toISOString()
        };
        setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));
        if (response.data.audio) {
          new Audio(response.data.audio).play();
        } else {
          showToast('Translation completed. Audio is unavailable for this language/voice.', 'info');
        }
        fetchHistory();
        showToast('Translation successful!', 'success');
      } catch (err) {
        if (err.response?.status === 401) {
          handleLogout();
          return;
        }
        const errMsg = getTranslateErrorMessage(err);
        setStatus('Error');
        showToast(errMsg, 'error');
      }
    };
  };

  const submitText = async () => {
    if (!textInput.trim()) return;
    try {
      setStatus('Processing Text...');
      const response = await axios.post('/api/translate-text', 
        { 
            text: textInput, 
            source_lang: sourceLang, 
            target_lang: targetLang,
            speed: speakingRate,
            gender: voiceGender
        },
        { headers: { 'x-auth-token': localStorage.getItem('token') } }
      );
      setTranscript(response.data.transcript);
      setTranslatedText(response.data.translated_text);
      setAudioSrc(response.data.audio);
      setTextInput('');
      setStatus('Ready');

      // Optimistically add to history list
      const newHistoryItem = {
           _id: Date.now(),
           originalText: response.data.transcript,
           translatedText: response.data.translated_text,
           audioBase64: response.data.audio,
           createdAt: new Date().toISOString()
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 10));
      if (response.data.audio) {
        new Audio(response.data.audio).play();
      } else {
        showToast('Translation completed. Audio is unavailable for this language/voice.', 'info');
      }
      fetchHistory();
      showToast('Text translated successfully!', 'success');
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
        return;
      }
      const errMsg = getTranslateErrorMessage(err);
      setStatus('Error');
      showToast(errMsg, 'error');
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  const shareText = async (text) => {
      if (navigator.share) {
          try { await navigator.share({ text: text }); } catch (err) { console.error('Share failed'); }
      } else {
          copyToClipboard(text);
      }
  };

  const downloadMP3 = () => {
      if (!audioSrc) return;
      const link = document.createElement('a');
      link.href = audioSrc;
      link.download = `translation_${Date.now()}.mp3`;
      link.click();
      showToast('Downloading Audio...', 'info');
  };

  if (currentPage === 'auth') {
    return (
      <div className="auth-container app-container glass-morphism">
        <AnimatePresence>{notification && (<motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className={`toast toast-${notification.type}`}>{notification.message}</motion.div>)}</AnimatePresence>
        <header>
          <div className="logo"><i className="ph-fill ph-translate"></i><h1>Vaak<span>AI</span></h1></div>
          <p className="tagline">{isLogin ? 'Welcome back! Your Bodhi-powered studio awaits.' : 'Join Vaak AI and break language barriers.'}</p>
        </header>

        <form onSubmit={handleAuth} className="auth-form">
          {!isLogin && (
            <div className="input-with-icon">
              <i className="ph ph-user"></i>
              <input type="text" placeholder="Username" className="auth-input" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} required />
            </div>
          )}
          <div className="input-with-icon">
            <i className="ph ph-envelope"></i>
            <input type="email" placeholder="Email Address" className="auth-input" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required />
          </div>
          <div className="input-with-icon">
            <i className="ph ph-lock"></i>
            <input type="password" placeholder="Password" className="auth-input" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} required />
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="auth-submit record-btn inner-circle" type="submit">
            <i className={isLogin ? "ph ph-sign-in" : "ph ph-user-plus"}></i>
            {isLogin ? 'Sign In' : 'Create Account'}
          </motion.button>
        </form>

        <div className="auth-toggle">{isLogin ? "Don't have an account? " : "Already registered? "} <button className="text-btn" onClick={() => setIsLogin(!isLogin)}>{isLogin ? 'Sign Up' : 'Log In'}</button></div>
      </div>
    );
  }

  return (
    <div className={`app-container glass-morphism ${viewMode}-mode`}>
      <div className="background-blobs">
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 50, opacity: 0 }} 
              className={`toast toast-${notification.type}`}
            >
              {notification.type === 'success' && <i className="ph-fill ph-check-circle"></i>}
              {notification.type === 'error' && <i className="ph-fill ph-warning-circle"></i>}
              {notification.type === 'info' && <i className="ph-fill ph-info"></i>}
              <span>{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div animate={{ x: [0, 80, -40, 0], y: [0, 50, 100, 0], scale: [1, 1.2, 0.8, 1] }} transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }} className="blob blob-1" />
        <motion.div animate={{ x: [0, -100, 50, 0], y: [0, -70, -30, 0], rotate: [0, 45, 0] }} transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }} className="blob blob-2" />
        <motion.div animate={{ scale: [1, 1.4, 0.9, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 25, repeat: Infinity }} className="blob blob-3" />
      </div>

      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="header-top">
          <div className="logo"><motion.i whileHover={{ scale: 1.2, rotate: 15 }} className="ph-fill ph-translate"></motion.i><h1>Vaak<span>AI</span></h1></div>
          <div className="user-controls">
            <span className="user-name">Welcome, {user?.username}</span>
            <button className="icon-btn logout-btn" title="Logout" aria-label="Logout" onClick={handleLogout}><i className="ph ph-sign-out"></i></button>
          </div>
        </div>

        <div className="sub-header">
            <div className="mode-toggle">
                <button className={viewMode === 'studio' ? 'active' : ''} onClick={() => setViewMode('studio')}>
                  <i className="ph ph-monitor" style={{ marginRight: '6px' }}></i>
                  Studio
                </button>
                <button className={viewMode === 'chat' ? 'active' : ''} onClick={() => setViewMode('chat')}>
                  <i className="ph ph-chats-teardrop" style={{ marginRight: '6px' }}></i>
                  Conversation
                </button>
            </div>
        </div>
        <p className="tagline">The ultimate Bodhi-powered full-stack studio.</p>
      </motion.header>

      {viewMode === 'studio' ? (
        <section className="studio-interface">
          <div className="lang-selector-group">
            <div className="lang-select-wrapper"><label>From</label><div className="custom-select"><select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>{sttLanguages.map((l) => (<option key={l.code} value={l.code}>{l.name}</option>))}</select></div></div>
            <motion.div 
              whileHover={{ rotate: 180 }} 
              onClick={() => { 
                const oldSource = sourceLang;
                const oldTarget = targetLang;
                
                // Find matching STT code for the target language (e.g., 'hi' -> 'hi-IN')
                const newSourceEntry = sttLanguages.find(l => l.code.startsWith(oldTarget)) || sttLanguages.find(l => l.code === 'auto');
                // Find matching Translate code for the source language (e.g., 'en-US' -> 'en')
                const newTargetEntry = languages.find(l => oldSource.startsWith(l.code)) || languages.find(l => l.code === 'hi');
                
                if (newSourceEntry) setSourceLang(newSourceEntry.code);
                if (newTargetEntry) setTargetLang(newTargetEntry.code);
              }} 
              className="swap-icon"
            >
              <i className="ph ph-arrows-left-right"></i>
            </motion.div>
            <div className="lang-select-wrapper"><label>To</label><div className="custom-select"><select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>{languages.map((l) => (<option key={l.code} value={l.code}>{l.name}</option>))}</select></div></div>
          </div>

          <div className="interaction-zone">
            <div className="transcript-box glass-panel">
              <div className="box-header">
                <span>Original Input</span>
                <div className="box-actions">
                  <button className="icon-btn" onClick={() => { setTextInput(''); setTranscript(''); setTranslatedText(''); setAudioSrc(null); setStatus('Ready'); }} title="Clear All"><i className="ph ph-trash"></i></button>
                  <button className="icon-btn" onClick={() => copyToClipboard(transcript || textInput)} title="Copy All"><i className="ph ph-copy"></i></button>
                  <button className="icon-btn" onClick={() => shareText(transcript || textInput)}><i className="ph ph-share"></i></button>
                </div>
              </div>
              <textarea 
                className="text-input-area" 
                placeholder="Type English (or any other language) here and press Enter to translate to Hindi..." 
                value={textInput} 
                onChange={(e) => setTextInput(e.target.value)} 
                onFocus={() => { if(status === 'Error') setStatus('Ready'); }}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitText(); } }}
              />
              {transcript && !textInput && <div className="content-area already-transcript">{transcript}</div>}
              {textInput && (
                <button className="auth-submit record-btn inner-circle submit-text-btn" onClick={submitText} style={{ height: '40px' }}>
                  <i className="ph ph-translate" style={{ marginRight: '8px' }}></i>
                  Translate Text
                </button>
              )}
            </div>
            <div className="center-controls">
              <button className={isRecording ? 'record-btn recording' : 'record-btn'} aria-label="Start Recording" onClick={() => isRecording ? mediaRecorder.current.stop() : startRecording()}><div className="inner-circle"><i className={isRecording ? 'ph-fill ph-stop' : 'ph-fill ph-microphone'}></i></div><AnimatePresence>{isRecording && (<motion.div initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.8, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 2, repeat: Infinity }} className="pulse-ring" />)}</AnimatePresence></button>
              <p className="status-msg">
                {status === 'Ready' && <i className="ph ph-check-circle" style={{ marginRight: '5px' }}></i>}
                {status.includes('...') && <i className="ph ph-circle-notch animate-spin" style={{ marginRight: '5px' }}></i>}
                {status.includes('Error') && <i className="ph ph-warning-octagon" style={{ marginRight: '5px' }}></i>}
                {status}
              </p>
            </div>
            <div className="translation-box glass-panel">
              <div className="box-header"><span>Translated</span><div className="box-actions"><button className="icon-btn" title="Download MP3" onClick={downloadMP3} disabled={!audioSrc}><i className="ph ph-download"></i></button><button className="icon-btn" onClick={() => audioSrc && new Audio(audioSrc).play()} disabled={!audioSrc}><i className="ph ph-speaker-high"></i></button><button className="icon-btn" onClick={() => copyToClipboard(translatedText)}><i className="ph ph-copy"></i></button></div></div>
              <div className={translatedText ? 'content-area' : 'content-area placeholder-text'}>{translatedText || "Result will appear here."}</div>
            </div>
          </div>

          <div className="voice-customization glass-panel">
              <div className="control-item">
                <label><i className="ph ph-broadcast"></i> Speech Speed: {speakingRate}x</label>
                <input type="range" min="0.5" max="2.0" step="0.25" value={speakingRate} onChange={e => setSpeakingRate(parseFloat(e.target.value))} />
              </div>
              <div className="control-item">
                <label><i className="ph ph-user-circle"></i> Voice Tone</label>
                <div className="custom-select">
                  <select value={voiceGender} onChange={e => setVoiceGender(e.target.value)}>
                    <option value="NEUTRAL">Neural Neutral</option>
                    <option value="MALE">Male Authority</option>
                    <option value="FEMALE">Female Smooth</option>
                  </select>
                </div>
              </div>
          </div>
        </section>
      ) : (
        <section className="chat-interface">
            <div className="chat-history glass-panel"><div className="history-list chat-bubbles">{history.map((item, idx) => (<div key={item._id || idx} className="chat-bubble"><div className="bubble-content"><p className="bubble-orig">{item.originalText}</p><p className="bubble-trans">{item.translatedText}</p></div><button className="bubble-play icon-btn" onClick={() => item.audioBase64 && new Audio(item.audioBase64).play()}><i className="ph ph-play"></i></button></div>))}</div></div>
            <div className="chat-bottom-bar glass-morphism">
                <div className="chat-langs"><span>{(sttLanguages.find(l => l.code === sourceLang)?.name || languages.find(l => l.code === sourceLang)?.name || 'Language').split(' ')[0]}</span> <i className="ph ph-arrow-right"></i> <span>{languages.find(l => l.code === targetLang)?.name || sttLanguages.find(l => l.code === targetLang)?.name || 'Language'}</span></div>
                <input type="text" className="chat-text-input" placeholder="Type a message..." value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') submitText(); }} />
                <button className="icon-btn" title="Send Text" onClick={submitText} disabled={!textInput.trim()}><i className="ph-fill ph-paper-plane-right"></i></button>
                <button className={isRecording ? 'record-btn recording tiny' : 'record-btn tiny'} onClick={() => isRecording ? mediaRecorder.current.stop() : startRecording()}><div className="inner-circle"><i className={isRecording ? 'ph-fill ph-stop' : 'ph-fill ph-microphone'}></i></div></button>
            </div>
        </section>
      )}

      {viewMode === 'studio' && history.length > 0 && (
          <section className="recent-history glass-panel"><h3><i className="ph ph-clock-counter-clockwise"></i> Latest Sessions</h3><div className="history-list">{history.map((item, idx) => (<div key={item._id || idx} className="history-item"><div className="texts"><p className="orig">{item.originalText}</p><p className="trans">{item.translatedText}</p></div><button className="icon-btn" onClick={() => item.audioBase64 && new Audio(item.audioBase64).play()}><i className="ph ph-play-circle"></i></button></div>))}</div></section>
      )}
      <footer><p>© 2026 Vaak AI | Bodhi Full-Stack Studio.</p></footer>
    </div>
  );
}

export default App;
