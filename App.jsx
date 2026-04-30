import React, { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';

// Web Audio API for zero-dependency atmospheric sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playSound = (type) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'start') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'stop') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'upload') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.1); 
    osc.frequency.setValueAtTime(659.25, now + 0.2);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    osc.start(now);
    osc.stop(now + 1);
  }
};

const playAmbientDrone = () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 55; // Low atmospheric hum
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.value = 0.02;
  osc.start();
  return { osc, gain };
};

export default function App() {
  const [appState, setAppState] = useState('splash'); // splash, record, upload, feed
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [time, setTime] = useState(0);
  const [recordings, setRecordings] = useState([]);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const ambientRef = useRef(null);

  const MAX_TIME = 50;

  // Initialize Splash Screen and Camera
  useEffect(() => {
    const initApp = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' }, 
          audio: true 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        // Splash screen duration
        setTimeout(() => {
          setAppState('record');
          ambientRef.current = playAmbientDrone();
        }, 4000);

      } catch (err) {
        setError('Camera access is required to proceed. Please check permissions.');
      }
    };

    initApp();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (ambientRef.current) ambientRef.current.osc.stop();
    };
  }, []);

  // Re-attach stream when returning to record view
  useEffect(() => {
    if (appState === 'record' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [appState, stream]);

  // Handle Recording Logic
  const startRecording = useCallback(() => {
    if (!stream) return;
    playSound('start');
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordings(prev => [url, ...prev]);
      handleUploadPhase();
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setTime(0);

    timerRef.current = setInterval(() => {
      setTime(prev => {
        if (prev >= MAX_TIME - 1) {
          stopRecording();
          return MAX_TIME;
        }
        return prev + 1;
      });
    }, 1000);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      playSound('stop');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const handleUploadPhase = () => {
    setAppState('upload');
    setTimeout(() => {
      playSound('upload');
      setAppState('feed');
    }, 3000); // Simulate 3 second upload
  };

  // Render Splash Screen
  if (appState === 'splash') {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <svg className="hands-icon" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M30 80 Q30 50 45 40 T50 20 T55 40 T70 50 Q70 80 50 80 Z" opacity="0.8" />
            <path d="M40 80 L40 60 M60 80 L60 60" opacity="0.5" />
          </svg>
          <h1 className="title-kor">키리고</h1>
          <p className="subtitle">Make your wish</p>
        </div>
      </div>
    );
  }

  // Render Error State
  if (error) {
    return <div className="error-screen">{error}</div>;
  }

  return (
    <div className="app-container">
      {appState === 'record' && (
        <div className="record-view">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="camera-preview"
          />
          
          <div className="ui-overlay">
            {isRecording && (
              <div className="recording-status">
                <div className="red-dot"></div>
                <span className="timer">00:{time.toString().padStart(2, '0')}</span>
              </div>
            )}
            
            <div className="controls">
              <button 
                className={`record-btn ${isRecording ? 'recording' : ''}`}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              >
                <div className="inner-circle"></div>
              </button>
              <p className="instruction">Hold to record your wish</p>
            </div>
          </div>
        </div>
      )}

      {appState === 'upload' && (
        <div className="upload-view">
          <h2 className="upload-text">Processing Wish...</h2>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      )}

      {appState === 'feed' && (
        <div className="feed-view">
          <header className="feed-header">
            <h1 className="title-kor-small">키리고</h1>
            <button className="back-btn" onClick={() => setAppState('record')}>
              New Wish
            </button>
          </header>
          <div className="video-grid">
            {recordings.map((url, index) => (
              <div key={index} className="video-card">
                <video src={url} controls playsInline className="feed-video" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}