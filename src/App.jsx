import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Coffee, RotateCcw, BarChart3, Moon, Sun, Clock, Settings, X, ArrowLeft } from 'lucide-react';

// Storage keys
const STORAGE = {
  SESSIONS: 'ratiotimer-sessions',
  SETTINGS: 'ratiotimer-settings'
};

export default function App() {
  const [isStudying, setIsStudying] = useState(false);
  const [isStudyPaused, setIsStudyPaused] = useState(false);
  const [studySeconds, setStudySeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [totalBreakSeconds, setTotalBreakSeconds] = useState(0);
  const [isBreak, setIsBreak] = useState(false);
  const [isBreakPaused, setIsBreakPaused] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [view, setView] = useState('timer');
  const [isDark, setIsDark] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [studyRatio, setStudyRatio] = useState(4);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const intervalRef = useRef(null);
  const audioContextRef = useRef(null);

  // Calculate dynamic examples based on current ratio
  const getDynamicExamples = () => {
    const example1 = studyRatio * 2; // e.g., 4:1 → 8 minutes
    const example2 = studyRatio * 10; // e.g., 4:1 → 40 minutes
    const break1 = 2;  // 2 minute break for first example
    const break2 = 10; // 10 minute break for second example
    
    return { example1, example2, break1, break2 };
  };

  // Warn before page reload/close if study session is active
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isStudying || isBreak) {
        e.preventDefault();
        e.returnValue = 'Changes that you made may not be saved.';
        return 'Changes that you made may not be saved.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isStudying, isBreak]);

  // Load saved data
  useEffect(() => {
    const savedSessions = localStorage.getItem(STORAGE.SESSIONS);
    const savedSettings = localStorage.getItem(STORAGE.SETTINGS);
    
    if (savedSessions) {
      try {
        setSessions(JSON.parse(savedSessions));
      } catch (e) {
        console.error('Failed to load sessions:', e);
      }
    }
    
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setStudyRatio(settings.studyRatio ?? 4);
        setIsSoundOn(settings.isSoundOn ?? true);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem(STORAGE.SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE.SETTINGS, JSON.stringify({ studyRatio, isSoundOn }));
  }, [studyRatio, isSoundOn]);

  // Update page title and favicon
  useEffect(() => {
    if (isStudying && !isStudyPaused) {
      document.title = `${formatTime(studySeconds)} - Studying | RatioTimer`;
    } else if (isBreak && !isBreakPaused) {
      document.title = `${formatTime(breakSeconds)} - Break | RatioTimer`;
    } else if (isStudyPaused) {
      document.title = `${formatTime(studySeconds)} - Paused | RatioTimer`;
    } else {
      document.title = 'RatioTimer - Smart Study Timer';
    }
  }, [isStudying, isStudyPaused, isBreak, isBreakPaused, studySeconds, breakSeconds]);

  // Timer logic
  useEffect(() => {
    if (isStudying && !isStudyPaused) {
      intervalRef.current = setInterval(() => {
        setStudySeconds(prev => prev + 1);
      }, 1000);
    } else if (isBreak && !isBreakPaused && breakSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setBreakSeconds(prev => {
          if (prev <= 1) {
            setIsBreak(false);
            setIsBreakPaused(false);
            setTotalBreakSeconds(0);
            if (isSoundOn) {
              playNotificationSound();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isStudying, isStudyPaused, isBreak, isBreakPaused, breakSeconds, isSoundOn]);

  // Keyboard shortcuts - FIXED SPACE BAR RESUME
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (showSettings || e.target.tagName === 'INPUT') return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isStudying && !isBreak) {
          // Start studying if not started
          handleStart();
        } else if (isStudying) {
          // Pause/Resume studying
          handlePauseResume();
        } else if (isBreak) {
          // Pause/Resume break
          handleToggleBreakPause();
        }
      } else if (e.code === 'KeyR' && isStudying) {
        handleReset();
      } else if (e.code === 'KeyB' && isStudying && studySeconds >= studyRatio) {
        handleNeedBreak();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isStudying, isStudyPaused, isBreak, isBreakPaused, studySeconds, studyRatio, showSettings]);

  const playNotificationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio failed:', e);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const earnedBreak = Math.floor(studySeconds / studyRatio);

  const handleStart = () => {
    setIsStudying(true);
    setIsStudyPaused(false);
    setStudySeconds(0);
  };

  const handlePauseResume = () => {
    setIsStudyPaused(!isStudyPaused);
  };

  const handleNeedBreak = () => {
    if (studySeconds >= studyRatio) {
      const earned = Math.floor(studySeconds / studyRatio);
      const session = {
        study: studySeconds,
        break: earned,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        timestamp: new Date().toISOString()
      };
      setSessions([session, ...sessions]);
      setBreakSeconds(earned);
      setTotalBreakSeconds(earned);
      setIsBreak(true);
      setIsStudying(false);
      setIsStudyPaused(false);
      setStudySeconds(0);
    }
  };

  // CHANGED: Added confirmation for reset when study time > 10 minutes
  const handleReset = () => {
    if (studySeconds > 600) { // 10 minutes = 600 seconds
      if (!window.confirm('Are you sure you want to reset? You have more than 10 minutes of study time that will be lost.')) {
        return;
      }
    }
    setIsStudying(false);
    setIsStudyPaused(false);
    setStudySeconds(0);
    setIsBreak(false);
    setBreakSeconds(0);
    setIsBreakPaused(false);
    setTotalBreakSeconds(0);
  };

  const handleSkipBreak = () => {
    setIsBreak(false);
    setBreakSeconds(0);
    setIsBreakPaused(false);
    setTotalBreakSeconds(0);
  };

  const handleToggleBreakPause = () => {
    setIsBreakPaused(!isBreakPaused);
  };

  const handleClearSessions = () => {
    if (window.confirm('Are you sure you want to clear all study history? This cannot be undone.')) {
      setSessions([]);
      localStorage.removeItem(STORAGE.SESSIONS);
    }
  };

  const handleSettingsChange = () => {
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const totalStudy = sessions.reduce((acc, s) => acc + s.study, 0);
  const totalBreak = sessions.reduce((acc, s) => acc + s.break, 0);

  const today = new Date().toDateString();
  const todayStudyTime = sessions
    .filter(session => new Date(session.timestamp).toDateString() === today)
    .reduce((acc, session) => acc + session.study, 0);

  // Clean monochrome theme
  const bgColor = isDark ? 'bg-black' : 'bg-white';
  const cardBg = isDark ? 'bg-zinc-900' : 'bg-zinc-50';
  const textColor = isDark ? 'text-white' : 'text-black';
  const mutedText = isDark ? 'text-zinc-500' : 'text-zinc-600';
  const borderColor = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const primaryBtn = isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800';
  const secondaryBtn = isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-200 text-black hover:bg-zinc-300';

  const examples = getDynamicExamples();

  return (
    <div className={`min-h-screen flex flex-col ${bgColor} ${textColor} transition-colors duration-200`}>
      {/* Header */}
      <div className={`${cardBg} border-b ${borderColor} flex-shrink-0`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* CHANGED: Updated name to RatioTimer */}
          <div 
            onClick={() => setView('timer')}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className={`w-9 h-9 ${primaryBtn} rounded-lg flex items-center justify-center transition-colors`}>
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">RatioTimer</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            {/* CHANGED: Always show BarChart3 icon and highlight when in stats view */}
            <button
              onClick={() => setView(view === 'timer' ? 'stats' : 'timer')}
              className={`p-2 rounded-lg transition-colors ${
                isDark 
                  ? `hover:bg-zinc-800 ${view === 'stats' ? 'bg-zinc-800' : ''}`
                  : `hover:bg-zinc-100 ${view === 'stats' ? 'bg-zinc-200' : ''}`
              }`}
              title={view === 'timer' ? 'Statistics' : 'Timer'}
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
              title={isDark ? 'Light' : 'Dark'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className={`${cardBg} rounded-2xl max-w-md w-full p-6 border ${borderColor} relative shadow-2xl`}>
            <button
              onClick={() => setShowSettings(false)}
              className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            
            {settingsSaved && (
              <div className="mb-4 p-3 bg-green-500 bg-opacity-10 border border-green-500 rounded-lg text-green-600 dark:text-green-400 text-sm font-medium">
                Settings saved
              </div>
            )}
            
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold mb-3">Study to Break Ratio</h3>
                <div className="space-y-2">
                  {[3, 4, 5].map((ratio) => (
                    <label key={ratio} className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="studyRatio"
                        value={ratio}
                        checked={studyRatio === ratio}
                        onChange={(e) => {
                          setStudyRatio(parseInt(e.target.value));
                          handleSettingsChange();
                        }}
                        className="w-5 h-5 accent-black dark:accent-white"
                      />
                      <span className={`group-hover:${textColor} transition-colors`}>
                        Study {ratio} min = 1 min break ({ratio}:1 ratio)
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-3">Sound</h3>
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isSoundOn}
                    onChange={(e) => {
                      setIsSoundOn(e.target.checked);
                      handleSettingsChange();
                    }}
                    className="w-5 h-5 accent-black dark:accent-white rounded"
                  />
                  <span className={`group-hover:${textColor} transition-colors`}>
                    Break end notification
                  </span>
                </label>
              </div>

              <div className={`p-3 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'} text-sm ${mutedText}`}>
                <div className="font-medium mb-1">Keyboard Shortcuts</div>
                <div className="space-y-1 text-xs">
                  <div>Space - Start/Pause/Resume</div>
                  <div>R - Reset</div>
                  <div>B - Need Break</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className={`w-full mt-6 py-3 ${primaryBtn} rounded-xl font-semibold transition-colors`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto px-4 py-8 md:py-12 w-full">
        {view === 'timer' ? (
          <div className="h-full flex flex-col">
            {/* Timer Card - Takes prominent space */}
            <div className={`${cardBg} rounded-2xl p-8 md:p-12 text-center border ${borderColor} flex-1 flex flex-col justify-center`}>
              {!isBreak ? (
                <>
                  <div className={`text-xs font-semibold tracking-widest ${mutedText} mb-6 uppercase`}>
                    {isStudying ? (isStudyPaused ? 'Paused' : 'Focus Time') : 'Ready'}
                  </div>
                  
                  <div className="text-6xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter tabular-nums">
                    {formatTime(studySeconds)}
                  </div>
                  
                  {/* UPDATED: Added ratio display (e.g., "4:1") */}
                  <div className={`mb-8 px-4 py-3 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'} max-w-sm mx-auto border ${borderColor}`}>
                    <div className="font-medium text-sm">
                      Study {studyRatio} min = Earn 1 min break <span className="font-bold">({studyRatio}:1)</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 max-w-xl mx-auto justify-center">
                    {!isStudying ? (
                      <button
                        onClick={handleStart}
                        className={`px-8 py-3 ${primaryBtn} rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg`}
                      >
                        <Play className="w-5 h-5" />
                        Start
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handlePauseResume}
                          className={`px-5 py-3 ${secondaryBtn} rounded-xl font-medium transition-all flex items-center gap-2`}
                        >
                          {isStudyPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                          {isStudyPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={handleReset}
                          className={`px-5 py-3 ${secondaryBtn} rounded-xl font-medium transition-all flex items-center gap-2`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reset
                        </button>
                        <button
                          onClick={handleNeedBreak}
                          disabled={studySeconds < studyRatio}
                          className={`px-5 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                            studySeconds >= studyRatio
                              ? `${primaryBtn} shadow-lg`
                              : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          <Coffee className="w-4 h-4" />
                          Break
                        </button>
                      </>
                    )}
                  </div>
                  
                  {isStudying && studySeconds < studyRatio && (
                    <div className={`text-xs ${mutedText} mt-3`}>
                      {studyRatio - studySeconds}s until break unlocks
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className={`text-xs font-semibold tracking-widest ${mutedText} mb-6 uppercase`}>
                    Break Time
                  </div>
                  <div className="text-6xl sm:text-7xl md:text-8xl font-bold mb-6 tracking-tighter tabular-nums">
                    {formatTime(breakSeconds)}
                  </div>
                  <div className={`text-sm ${mutedText} mb-8`}>
                    Well done. Relax and recharge.
                  </div>
                  <div className={`w-full max-w-sm mx-auto ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'} rounded-full h-2 mb-8 overflow-hidden`}>
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${isDark ? 'bg-white' : 'bg-black'}`}
                      style={{ width: `${((totalBreakSeconds - breakSeconds) / (totalBreakSeconds || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleToggleBreakPause}
                      className={`px-5 py-3 ${secondaryBtn} rounded-xl transition-all flex items-center gap-2 font-medium`}
                    >
                      {isBreakPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {isBreakPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      onClick={handleSkipBreak}
                      className={`px-5 py-3 ${secondaryBtn} rounded-xl transition-all font-medium`}
                    >
                      Skip
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* UPDATED: New "How RatioTimer works" section - positioned lower */}
            <div className="mt-12 md:mt-16">
              <div className={`${cardBg} rounded-2xl p-6 border ${borderColor}`}>
                <h3 className="text-xl font-bold mb-4">How RatioTimer works</h3>
                <div className="space-y-4 text-sm">
                  <p className="font-medium">
                    Tired of timers that interrupt you mid-thought?
                  </p>
                  
                  <p>
                    <strong>Here's the deal:</strong> Every {studyRatio} minutes you study = 1 minute break earned.
                  </p>
                  
                  <p className="font-medium">
                    The longer you study, the longer you rest.
                  </p>
                  
                  <div className={`p-4 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                    <p className="font-medium mb-2">For example,</p>
                    <div className="space-y-1">
                      <p>{examples.example1} min study = {examples.break1} min break</p>
                      <p>{examples.example2} min study = {examples.break2} min break</p>
                    </div>
                  </div>
                  
                  <p className="font-medium">
                    Break when YOU'RE ready, not when a timer tells you.
                  </p>
                  
                  <p className={`text-xs ${mutedText} mt-4`}>
                    You can also change the ratio in settings
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Stats View */
          <div className="space-y-6">
            <div className={`${cardBg} rounded-2xl p-6 md:p-8 border ${borderColor}`}>
              {/* ADDED: Back button for stats view (icon only) */}
              <button
                onClick={() => setView('timer')}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'} mb-4`}
                title="Back to Timer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              
              <h2 className="text-2xl font-bold mb-6">Your Progress</h2>
              
              {/* Today's Study Time */}
              {todayStudyTime > 0 && (
                <div className={`mb-6 p-5 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'} border ${borderColor}`}>
                  <div className="text-center">
                    <div className={`text-sm font-medium ${mutedText} mb-1`}>Today</div>
                    <div className="text-3xl font-bold tabular-nums">{formatTime(todayStudyTime)}</div>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className={`text-center p-5 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                  <div className="text-3xl font-bold tabular-nums mb-1">{sessions.length}</div>
                  <div className={`text-xs font-medium ${mutedText}`}>Sessions</div>
                </div>
                <div className={`text-center p-5 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                  <div className="text-3xl font-bold tabular-nums mb-1">{formatTime(totalStudy)}</div>
                  <div className={`text-xs font-medium ${mutedText}`}>Total Study</div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Recent</h3>
                {sessions.length > 0 && (
                  <button
                    onClick={handleClearSessions}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${secondaryBtn}`}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {sessions.length === 0 ? (
                <div className={`text-center py-12 ${mutedText}`}>
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No sessions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 10).map((session, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl ${
                        isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      } flex justify-between items-center border ${borderColor}`}
                    >
                      <div>
                        <div className="font-semibold text-sm">Session #{sessions.length - idx}</div>
                        <div className={`text-xs ${mutedText}`}>
                          {session.date} at {session.time}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">{formatTime(session.study)}</div>
                        <div className={`text-xs ${mutedText}`}>{formatTime(session.break)} break</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer - UPDATED */}
      <div className={`py-6 text-center ${mutedText} text-xs flex-shrink-0`}>
        Made with ❤️ For everyone chasing their dreams
      </div>
    </div>
  );
}