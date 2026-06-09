import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart2,
  Calendar,
  CheckSquare,
  Clock,
  Database,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  MessageSquare,
  FileText,
  LogOut,
  Lock,
  Mail,
  ChevronRight,
  RefreshCw,
  User,
  Activity,
  Settings,
  HelpCircle,
  Hash,
  Server,
  Terminal,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  UploadCloud,
  Check,
  Shield,
  ExternalLink
} from 'lucide-react';

// MUST use import.meta.env for Vite! process.env will NOT work.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function App() {
  // Authentication & Auth State
  const [token, setToken] = useState(localStorage.getItem('access_token') || '');
  const [userId, setUserId] = useState(parseInt(localStorage.getItem('userId')) || null);
  const [userEmail, setUserEmail] = useState(localStorage.getItem('user_email') || '');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Navigation View: "dashboard" | "meetings" | "action-items" | "system-health"
  const [currentView, setCurrentView] = useState('dashboard');

  // Ingestion Modal Drawer visibility
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  // Data State
  const [meetings, setMeetings] = useState([]);
  const [meetingsTotal, setMeetingsTotal] = useState(0);
  const [meetingsPage, setMeetingsPage] = useState(1);
  const [meetingsPageSize] = useState(5);

  const [actionItems, setActionItems] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingAnalysis, setMeetingAnalysis] = useState(null);
  const [overdueCount, setOverdueCount] = useState(0);

  // Ingestion Inputs
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestDate, setIngestDate] = useState(new Date().toISOString().split('T')[0]);
  const [ingestTranscript, setIngestTranscript] = useState(
    `[00:10] Alice: Welcome everyone to the product synchronization. We need to decide on our deployment platform.\n` +
    `[00:30] Bob: I recommend we go with Render. It handles Python API lifecycles and background schedulers natively.\n` +
    `[01:00] Alice: Excellent, I decide we go with Render for deployment. Let's write down the actions.\n` +
    `[01:20] Bob: Understood. I will handle the Docker configuration and file setup by tomorrow.\n` +
    `[02:00] Alice: Sounds good. We should also follow up with security audits next week.`
  );

  // Loading & Trace State
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestTraceId, setIngestTraceId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');

  // UI Interactive Citation Highlighting State
  const [activeCitationTimestamp, setActiveCitationTimestamp] = useState(null);
  const transcriptRefs = useRef({});

  // Toast Pipeline State
  const [toasts, setToasts] = useState([]);

  // Toast dispatcher
  const showToast = (message, type = 'success', traceId = '') => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts((prev) => [...prev, { id, message, type, traceId }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // Tab State inside Meeting Details ("summary" | "actions" | "follow ups")
  const [detailsTab, setDetailsTab] = useState('summary');

  // Check Backend Connection Status
  useEffect(() => {
    const checkHealth = () => {
      fetch(`${API_BASE_URL}/health`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data.status === "UP") {
            setBackendStatus('connected');
          } else {
            setBackendStatus('error');
          }
        })
        .catch(() => setBackendStatus('disconnected'));
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Data on Authentication or View changes
  useEffect(() => {
    if (token) {
      fetchMeetings();
      fetchActionItems();
      fetchOverdueCount();
    }
  }, [token, meetingsPage, currentView]);

  // Auth Submit Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? "/auth/register" : "/auth/login";
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (isRegistering) {
          showToast("Account created successfully! Please sign in.", "success", data.traceId);
          setIsRegistering(false);
        } else {
          localStorage.setItem('access_token', data.data.access_token);
          localStorage.setItem('userId', data.data.userId);
          localStorage.setItem('user_email', authEmail);
          setToken(data.data.access_token);
          setUserId(data.data.userId);
          setUserEmail(authEmail);
          showToast("Successfully authenticated with JWT token.", "success", data.traceId);
        }
      } else {
        const errorMsg = data.error?.message || "Authentication failed.";
        showToast(errorMsg, "error", data.traceId);
      }
    } catch (err) {
      showToast("Backend connection refused. Make sure backend service is up.", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user_email');
    setToken('');
    setUserId(null);
    setUserEmail('');
    setMeetings([]);
    setActionItems([]);
    setSelectedMeeting(null);
    setMeetingAnalysis(null);
    setCurrentView('dashboard');
    showToast("Session credentials cleared.", "success");
  };

  // Authenticated API Fetch Helper with Automatic 401 / Stale Token Redirection Gate
  const fetchWithAuth = async (endpoint, options = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
      if (response.status === 401) {
        handleLogout();
        showToast("Session expired or invalid credentials. Please log in again.", "error");
        return null;
      }
      return response;
    } catch (err) {
      console.error("Auth fetch failed:", err);
      throw err;
    }
  };

  // API Call: Fetch Meetings
  const fetchMeetings = async () => {
    try {
      const response = await fetchWithAuth(`/meetings?page=${meetingsPage}&pageSize=${meetingsPageSize}`);
      if (!response) return;
      const data = await response.json();
      if (response.ok && data.success) {
        setMeetings(data.data.items);
        setMeetingsTotal(data.data.total);
        // Default select the first meeting if none is selected
        if (data.data.items.length > 0 && !selectedMeeting) {
          handleViewMeetingDetails(data.data.items[0]);
        }
      } else {
        showToast(data.error?.message || "Failed to load meetings list.", "error", data.traceId);
      }
    } catch (err) {
      showToast("Failed to fetch meetings from server.", "error");
    }
  };

  // API Call: Fetch Action Items
  const fetchActionItems = async () => {
    try {
      const response = await fetchWithAuth(`/action-items`);
      if (!response) return;
      const data = await response.json();
      if (response.ok && data.success) {
        setActionItems(data.data);
      } else {
        showToast(data.error?.message || "Failed to load action items.", "error", data.traceId);
      }
    } catch (err) {
      showToast("Failed to fetch action items from server.", "error");
    }
  };

  // API Call: Fetch Overdue Count
  const fetchOverdueCount = async () => {
    try {
      const response = await fetchWithAuth(`/action-items/overdue`);
      if (!response) return;
      const data = await response.json();
      if (response.ok && data.success) {
        setOverdueCount(data.data.length);
      }
    } catch (err) { }
  };

  // Parser: [Timestamp] Speaker: Phrase
  const parseTranscriptText = (rawText) => {
    const lines = rawText.split('\n');
    const parsed = [];
    const regex = /^\[(\d{2}:\d{2})\]\s*([^:]+):\s*(.*)$/;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(regex);
      if (match) {
        parsed.push({
          timestamp: match[1],
          speaker: match[2].trim(),
          text: match[3].trim()
        });
      } else {
        parsed.push({
          timestamp: "00:00",
          speaker: "Speaker",
          text: trimmed
        });
      }
    }
    return parsed;
  };

  // API Call: Ingest Meeting and Trigger Gemini AI
  const handleIngestMeeting = async (e) => {
    e.preventDefault();
    if (!ingestTitle) {
      showToast("Meeting Title is required.", "error");
      return;
    }

    setIsIngestModalOpen(false);
    setIsIngesting(true);
    const tempTraceId = Math.random().toString(36).substring(2, 10);
    setIngestTraceId(tempTraceId);
    setCurrentView('meetings');

    const parsedTranscript = parseTranscriptText(ingestTranscript);

    try {
      // 1. Create meeting
      const createResponse = await fetchWithAuth(`/meetings`, {
        method: 'POST',
        body: JSON.stringify({
          title: ingestTitle,
          userId: userId,
          meetingDate: new Date(ingestDate).toISOString(),
          transcript: parsedTranscript
        })
      });
      if (!createResponse) return;
      const createData = await createResponse.json();
      setIngestTraceId(createData.traceId || tempTraceId);

      if (createResponse.ok && createData.success) {
        showToast("Transcript ingested. Invoking Gemini AI parser...", "success", createData.traceId);

        // 2. Perform AI transcript analysis
        setIsAnalyzing(true);
        const analyzeResponse = await fetchWithAuth(`/ai/analyze?meetingId=${createData.data.id}`, {
          method: 'POST',
          body: JSON.stringify({
            transcript: parsedTranscript,
            focus: "General summaries, decisions, and action items"
          })
        });
        if (!analyzeResponse) return;
        const analyzeData = await analyzeResponse.json();

        if (analyzeResponse.ok && analyzeData.success) {
          showToast("Gemini analysis completed successfully.", "success", analyzeData.traceId);

          // 3. Write extracted action items to DB
          if (analyzeData.data.actionItems && analyzeData.data.actionItems.length > 0) {
            for (const action of analyzeData.data.actionItems) {
              await fetchWithAuth(`/action-items`, {
                method: 'POST',
                body: JSON.stringify({
                  meetingId: createData.data.id,
                  task: action.task,
                  assignee: action.assignee,
                  dueDate: new Date(Date.now() + 86400000 * 3).toISOString() // default +3 days
                })
              });
            }
          }

          // Reset Ingestion States
          setIngestTitle('');
          setMeetingsPage(1);

          // Refresh statistics
          fetchMeetings();
          fetchActionItems();
          fetchOverdueCount();

          // Immediately redirect to Detail View
          setSelectedMeeting(createData.data);
          setMeetingAnalysis(analyzeData.data);
        } else {
          showToast(analyzeData.error?.message || "AI Extraction failed.", "error", analyzeData.traceId);
        }
      } else {
        showToast(createData.error?.message || "Ingestion failed.", "error", createData.traceId);
      }
    } catch (err) {
      showToast("Network error parsing meeting files.", "error");
    } finally {
      setIsIngesting(false);
      setIsAnalyzing(false);
      setIngestTraceId('');
    }
  };

  // API Call: View Details
  const handleViewMeetingDetails = async (meeting) => {
    setSelectedMeeting(meeting);
    setIsAnalyzing(true);
    setMeetingAnalysis(null);
    setDetailsTab('summary');

    try {
      const response = await fetchWithAuth(`/ai/analyze?meetingId=${meeting.id}`, {
        method: 'POST',
        body: JSON.stringify({
          transcript: meeting.transcript
        })
      });
      if (!response) return;
      const data = await response.json();
      if (response.ok && data.success) {
        setMeetingAnalysis(data.data);
      } else {
        showToast(data.error?.message || "AI analysis failed.", "error", data.traceId);
      }
    } catch (err) {
      showToast("Failed to fetch meeting analysis results.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // API Call: Update Action Item Status
  const handleUpdateStatus = async (itemId, newStatus) => {
    try {
      const response = await fetchWithAuth(`/action-items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (!response) return;
      const data = await response.json();
      if (response.ok && data.success) {
        showToast(`Task status set to: ${newStatus}`, "success", data.traceId);
        fetchActionItems();
        fetchOverdueCount();
      } else {
        showToast(data.error?.message || "Failed to edit task status.", "error", data.traceId);
      }
    } catch (err) {
      showToast("Database communication failure.", "error");
    }
  };


  // Citation Scrolling/Highlighting Trigger
  const handleTriggerCitation = (timestamp) => {
    setActiveCitationTimestamp(timestamp);
    const element = transcriptRefs.current[timestamp];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Remove pulse overlay after 3 seconds
    setTimeout(() => {
      setActiveCitationTimestamp((prev) => prev === timestamp ? null : prev);
    }, 3000);
  };

  // Unauthenticated Login/Register Card UI (Elegant Fluid Monochrome)
  if (!token) {
    return (
      <LoginForm
        isRegistering={isRegistering}
        setIsRegistering={setIsRegistering}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        handleAuth={handleAuth}
        toasts={toasts}
      />
    );
  }

  // Detailed Tab-Specific Gradient Pulse Skeleton Loader
  const renderSkeletonLoader = () => {
    return (
      <div className="space-y-6 animate-pulse mt-2">
        {detailsTab === 'summary' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="h-3.5 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-full w-1/4"></div>
              <div className="space-y-2.5">
                <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-full"></div>
                <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-5/6"></div>
                <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-11/12"></div>
              </div>
            </div>
            <div className="space-y-3 pt-6 border-t border-neutral-100">
              <div className="h-3.5 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-full w-1/3"></div>
              <div className="space-y-2.5">
                <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-full"></div>
                <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-4/5"></div>
              </div>
            </div>
          </div>
        )}

        {detailsTab === 'actions' && (
          <div className="space-y-4">
            <div className="h-3.5 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-full w-1/4 mb-4"></div>
            {[1, 2, 3].map((n) => (
              <div key={n} className="border border-neutral-100/60 p-4 rounded-2xl space-y-3 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 w-full">
                    <div className="h-5 w-5 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-md shrink-0"></div>
                    <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-2/3 mt-1"></div>
                  </div>
                  <div className="h-4 w-8 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-full shrink-0"></div>
                </div>
                <div className="h-2.5 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-1/3 mt-2"></div>
              </div>
            ))}
          </div>
        )}

        {detailsTab === 'follow ups' && (
          <div className="space-y-4">
            <div className="h-3.5 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-full w-1/4 mb-4"></div>
            {[1, 2].map((n) => (
              <div key={n} className="flex items-start space-x-3">
                <div className="h-3.5 w-3.5 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-full shrink-0 mt-0.5"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-full"></div>
                  <div className="h-3 bg-gradient-to-r from-neutral-100 to-neutral-200 rounded-lg w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Dashboard Stats Calculations
  const pendingItemsCount = actionItems.filter(item => item.status === 'PENDING').length;
  const inProgressItemsCount = actionItems.filter(item => item.status === 'IN_PROGRESS').length;

  return (
    <div className="flex flex-col h-screen bg-neutral-50 text-neutral-805 overflow-hidden font-sans select-none">

      {/* 1. Floating Glassy Top Navigation Bar */}
      <div className="w-full max-w-7xl mx-auto px-6 pt-4 shrink-0">
        <header className="w-full px-6 h-16 flex items-center justify-between bg-white/80 backdrop-blur-md border border-neutral-100 rounded-full shadow-lg shadow-black/[0.03]">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center font-bold text-white text-xs shadow-sm hover:scale-105 active:scale-95 transition-transform duration-300">
              H
            </div>
            <h1 className="font-extrabold text-sm tracking-tight text-black uppercase font-display">
              Hintro Intel
            </h1>
          </div>

          {/* Center Navigation Pill-menu */}
          <div className="flex items-center gap-1 bg-neutral-100/80 p-1 rounded-full border border-neutral-200/40 shrink-0">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
              { id: 'meetings', label: 'Meetings Library', icon: Calendar },
              { id: 'action-items', label: 'Action Items', icon: CheckSquare },
              { id: 'system-health', label: 'System Health', icon: Server }
            ].map(view => {
              const Icon = view.icon;
              const isActive = currentView === view.id || (view.id === 'meetings' && currentView === 'meeting-detail');
              return (
                <button
                  key={view.id}
                  id={`nav-${view.id}-btn`}
                  onClick={() => setCurrentView(view.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 active:scale-95 transition-all duration-300 ${isActive ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{view.label}</span>
                </button>
              );
            })}
          </div>


          {/* User profile dropdown and status light */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-neutral-50 border border-neutral-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-black animate-pulse' : 'bg-neutral-300'}`}></span>
              <span className="text-neutral-500 font-semibold">GATEWAY</span>
            </div>

            <div className="relative">
              {/* Dynamic Initials Avatar Button */}
              <button
                id="profile-menu-trigger"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center justify-center h-8 w-8 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-full shadow active:scale-95 transition-all duration-300 focus:outline-none border border-black"
              >
                {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
              </button>

              {isProfileOpen && (
                <>
                  {/* Backdrop overlay for capturing click-outside */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent cursor-default"
                    onClick={() => setIsProfileOpen(false)}
                  />

                  {/* Dynamic Animated Menu */}
                  <div
                    id="profile-dropdown-card"
                    className="absolute right-0 mt-3 w-56 bg-white border border-neutral-100 rounded-2xl shadow-2xl shadow-neutral-900/10 py-2 z-50 animate-fade-in-up"
                  >
                    <div className="px-4 py-2 border-b border-neutral-100">
                      <p className="text-[9px] text-neutral-400 uppercase tracking-widest font-bold">Account Session</p>
                      <p className="text-xs font-bold text-black truncate mt-1">{userEmail}</p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setCurrentView('system-health');
                          setIsProfileOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-neutral-600 hover:text-black hover:bg-neutral-50 rounded-xl transition-colors duration-200 font-semibold flex items-center space-x-2"
                      >
                        <Settings className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Config Details</span>
                      </button>
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsProfileOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-neutral-600 hover:bg-rose-50/50 hover:text-rose-600 rounded-xl transition-colors duration-200 font-semibold flex items-center space-x-2"
                      >
                        <LogOut className="h-3.5 w-3.5 text-rose-500" />
                        <span>Clear Session</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden w-full max-w-7xl mx-auto px-6 py-6 flex flex-col min-h-0">

        {/* VIEW A: Dashboard Overview */}
        {currentView === 'dashboard' && (
          <div className="space-y-8 h-full overflow-y-auto pr-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-black font-display uppercase">Overview</h2>
                <p className="text-neutral-400 text-xs uppercase tracking-wider font-bold mt-1">Structured telemetry and audit logs</p>
              </div>
              <button
                onClick={() => setIsIngestModalOpen(true)}
                className="flex items-center space-x-2 bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-full border border-black shadow-lg shadow-black/10 active:scale-95 transition-all duration-300"
              >
                <Plus className="h-4 w-4" />
                <span>Ingest Transcript</span>
              </button>
            </div>
            {/* Stat Cards (Animated Entry) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Meetings Processed"
                value={meetingsTotal}
                icon={Calendar}
                sparkline={true}
              />
              <StatCard
                title="Active Action Items"
                value={pendingItemsCount + inProgressItemsCount}
                icon={CheckSquare}
                breakdown={{ pending: pendingItemsCount, inProgress: inProgressItemsCount }}
              />
              <StatCard
                title="Overdue Items"
                value={overdueCount}
                icon={AlertTriangle}
                isOverdue={true}
              />
            </div>

            {/* Quick Ingestion Widget */}
            <div className="mt-8 animate-fade-in-up stagger-4">
              <h3 className="text-xs font-bold tracking-widest text-neutral-400 uppercase mb-4">Ingestion Gateway</h3>
              <div
                onClick={() => setIsIngestModalOpen(true)}
                className="bg-white border-2 border-dashed border-neutral-200 hover:border-solid hover:border-black p-8 rounded-3xl flex flex-col items-center justify-center text-center cursor-pointer shadow-xl shadow-black/5 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group"
              >
                <div className="h-12 w-12 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-650 mb-4 group-hover:scale-110 transition-all duration-300">
                  <UploadCloud className="h-5 w-5 group-hover:animate-gentle-bounce text-neutral-700" />
                </div>
                <h4 className="text-base font-bold text-black uppercase tracking-wider mb-1">Analyze New Meeting Transcript</h4>
                <p className="text-xs text-neutral-500 max-w-md">
                  Click to paste conversation transcript data blocks and invoke Gemini AI parsing to map summaries, decisions, and citation indices.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW B: Meeting Library & Intelligence Hub (3-Column Layout View) */}
        {currentView === 'meetings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-6rem)] overflow-hidden">

            {/* COLUMN 1: Ingested Meetings Library Feed (3 Columns) */}
            <div className="lg:col-span-3 h-full overflow-y-auto pr-2 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100/60">
                <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase font-bold">Meetings Archive</span>
                <button
                  onClick={() => setIsIngestModalOpen(true)}
                  className="p-1.5 rounded-full bg-black text-white hover:bg-neutral-850 active:scale-95 transition focus:outline-none shadow-sm"
                  title="Upload meeting"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Ingesting Skeleton Loader */}
              {isIngesting && (
                <div className="bg-white border border-neutral-100 p-4 rounded-2xl space-y-3 animate-pulse shadow-sm">
                  <div className="h-4 bg-neutral-100 rounded w-2/3"></div>
                  <div className="h-3 bg-neutral-100 rounded w-full"></div>
                  <div className="pt-2 border-t border-neutral-50 text-[9px] text-neutral-400 font-mono">
                    <span>Processing Trace: {ingestTraceId}</span>
                  </div>
                </div>
              )}

              {meetings.length === 0 && !isIngesting ? (
                <p className="text-xs text-neutral-450 italic uppercase font-bold py-4">No meetings indexed.</p>
              ) : (
                <div className="space-y-3.5">
                  {meetings.map((meeting, index) => {
                    const isSelected = selectedMeeting?.id === meeting.id;
                    return (
                      <div
                        key={meeting.id}
                        onClick={() => handleViewMeetingDetails(meeting)}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className={`p-4 border border-neutral-100/60 rounded-2xl cursor-pointer hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up transition-all duration-300 flex flex-col justify-between group ${isSelected ? 'bg-neutral-100 text-black shadow-sm border-neutral-200/50' : 'bg-white text-neutral-700'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wide truncate group-hover:text-black transition">{meeting.title}</h4>
                          <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:translate-x-0.5 transition shrink-0" />
                        </div>
                        <div className="flex items-center space-x-1 text-[9px] text-neutral-400 font-mono mt-3">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(meeting.meetingDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* COLUMN 2: Transcript Console (4 Columns) */}
            <div className="lg:col-span-4 h-full bg-white border border-neutral-100 rounded-3xl p-6 shadow-xl shadow-neutral-900/5 flex flex-col min-h-0 overflow-hidden">
              <div className="pb-3 border-b border-neutral-100 shrink-0">
                <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase font-bold">Transcript Console</span>
                {selectedMeeting && (
                  <p className="text-[9px] text-neutral-500 mt-0.5 uppercase font-bold tracking-wider">Grounding analysis logs active</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-3.5 pr-1 min-h-0">
                {selectedMeeting ? (
                  selectedMeeting.transcript.map((line, index) => {
                    const isHighlighted = activeCitationTimestamp === line.timestamp;
                    return (
                      <div
                        key={index}
                        ref={(el) => transcriptRefs.current[line.timestamp] = el}
                        style={{ animationDelay: `${index * 30}ms` }}
                        className={`p-3 rounded-2xl border transition-all duration-350 animate-fade-in-up ${isHighlighted ? 'animate-flash-pulse border-neutral-350 scale-[1.01] shadow-sm' : 'bg-neutral-50/50 border-neutral-100/80'}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-bold tracking-widest text-neutral-500 bg-neutral-100 border border-neutral-200/50 px-2 py-0.5 rounded-full font-mono">
                            {line.timestamp}
                          </span>
                          <span className="text-[10px] font-bold text-black uppercase">{line.speaker}</span>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed leading-relaxed">{line.text}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <Calendar className="h-8 w-8 text-neutral-300 mb-2" />
                    <p className="text-xs text-neutral-450 font-bold uppercase tracking-wider">Select a meeting from the archive list to view transcripts</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: Glassy AI Extraction Panel (5 Columns) */}
            <div className="lg:col-span-5 h-full bg-white/95 backdrop-blur-md border border-neutral-100 rounded-3xl p-6 shadow-xl shadow-neutral-900/5 flex flex-col min-h-0 overflow-hidden relative">
              <div className="border-b border-neutral-100 shrink-0">
                <div className="flex space-x-1.5 pb-2">
                  {['summary', 'actions', 'follow ups'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDetailsTab(tab)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-all duration-300 ${detailsTab === tab ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Panel with Glassy Cross-fade Transitions */}
              <div className="flex-1 relative mt-4 min-h-0 w-full overflow-hidden">
                {isAnalyzing && !meetingAnalysis ? (
                  renderSkeletonLoader()
                ) : meetingAnalysis && selectedMeeting ? (
                  <>
                    {/* TAB A: Summary & Decisions (Cross-fade overlay) */}
                    <div className={`absolute inset-0 overflow-y-auto pr-1 transition-all duration-300 ease-out flex flex-col space-y-6 ${detailsTab === 'summary' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Highlights Summary</h4>
                        <ul className="space-y-3">
                          {meetingAnalysis.summary && meetingAnalysis.summary.map((point, index) => (
                            <li key={index} className="text-xs leading-relaxed text-neutral-600 flex items-start space-x-2">
                              <span className="text-black mt-1 select-none font-bold font-mono">•</span>
                              <span>
                                {point.text}{' '}
                                {point.citations && point.citations.map((cite, cIdx) => (
                                  <CitationButton key={cIdx} cite={cite} onClick={() => handleTriggerCitation(cite)} />
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-3 pt-5 border-t border-neutral-100">
                        <h4 className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Decisions Made</h4>
                        {meetingAnalysis.decisions && meetingAnalysis.decisions.length > 0 ? (
                          <ul className="space-y-3">
                            {meetingAnalysis.decisions.map((dec, index) => (
                              <li key={index} className="text-xs leading-relaxed text-neutral-600 flex items-start space-x-2">
                                <span className="text-neutral-900 mt-1 select-none font-bold">✓</span>
                                <span>
                                  {dec.text}{' '}
                                  {dec.citations && dec.citations.map((cite, cIdx) => (
                                    <CitationButton key={cIdx} cite={cite} onClick={() => handleTriggerCitation(cite)} />
                                  ))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[10px] text-neutral-450 italic uppercase font-bold">No decisions detected.</p>
                        )}
                      </div>
                    </div>

                    {/* TAB B: Action Items Checklist (Cross-fade overlay) */}
                    <div className={`absolute inset-0 overflow-y-auto pr-1 transition-all duration-300 ease-out flex flex-col space-y-4 ${detailsTab === 'actions' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                      <h4 className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Extracted Tasks</h4>
                      <div className="space-y-3">
                        {/* Render active checklist items bound to database and actions */}
                        {(() => {
                          const dbActions = actionItems.filter(item => item.meetingId === selectedMeeting.id);
                          if (dbActions.length > 0) {
                            return dbActions.map((item) => (
                              <MeetingDetailActionItem
                                key={item.id}
                                item={item}
                                selectedMeeting={selectedMeeting}
                                meetingAnalysis={meetingAnalysis}
                                onUpdateStatus={handleUpdateStatus}
                                onTriggerCitation={handleTriggerCitation}
                              />
                            ));
                          } else if (meetingAnalysis.actionItems && meetingAnalysis.actionItems.length > 0) {
                            // Fallback raw parsed items
                            return meetingAnalysis.actionItems.map((action, index) => (
                              <div key={index} className="bg-neutral-50/50 border border-neutral-100 p-4 rounded-2xl space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start space-x-2.5">
                                    <CheckCircle2 className="h-4 w-4 text-black shrink-0 mt-0.5" />
                                    <h5 className="text-xs font-semibold text-neutral-800 leading-relaxed">{action.task}</h5>
                                  </div>
                                  {action.citations && action.citations.map((cite, cIdx) => (
                                    <CitationButton key={cIdx} cite={cite} onClick={() => handleTriggerCitation(cite)} />
                                  ))}
                                </div>
                                <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-100/60">
                                  <span>Assignee: <strong className="text-neutral-800 font-semibold">{action.assignee}</strong></span>
                                  <span className="bg-white border border-neutral-200 text-neutral-500 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                                    INGESTED
                                  </span>
                                </div>
                              </div>
                            ));
                          } else {
                            return <p className="text-[10px] text-neutral-450 italic uppercase font-bold">No action items extracted.</p>;
                          }
                        })()}
                      </div>
                    </div>

                    {/* TAB C: Follow-ups (Cross-fade overlay) */}
                    <div className={`absolute inset-0 overflow-y-auto pr-1 transition-all duration-300 ease-out flex flex-col space-y-4 ${detailsTab === 'follow ups' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                      <h4 className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Follow-up Tasks</h4>
                      {meetingAnalysis.followUps && meetingAnalysis.followUps.length > 0 ? (
                        <ul className="space-y-3">
                          {meetingAnalysis.followUps.map((pt, index) => (
                            <li key={index} className="text-xs leading-relaxed text-neutral-600 flex items-start space-x-2">
                              <span className="text-black mt-1 select-none font-bold">→</span>
                              <span>
                                {pt.text}{' '}
                                {pt.citations && pt.citations.map((cite, cIdx) => (
                                  <CitationButton key={cIdx} cite={cite} onClick={() => handleTriggerCitation(cite)} />
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[10px] text-neutral-450 italic uppercase font-bold">No follow-ups suggested.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 absolute inset-0">
                    <Database className="h-8 w-8 text-neutral-300 mb-2 animate-pulse" />
                    <p className="text-xs text-neutral-450 font-bold uppercase tracking-wider">No analysis parsed. Select a meeting record.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* VIEW C: Action Items List */}
        {currentView === 'action-items' && (
          <div className="max-w-6xl mx-auto space-y-6 h-full overflow-y-auto pr-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-black font-display uppercase font-display">Action Items</h2>
              <p className="text-neutral-400 text-xs uppercase tracking-wider font-bold mt-1">Lifecycle updates and task checklists</p>
            </div>

            {actionItems.length === 0 ? (
              <div className="bg-white border border-neutral-100 p-12 rounded-3xl text-center space-y-4 shadow-xl shadow-black/5">
                <CheckSquare className="h-12 w-12 text-neutral-300 mx-auto" />
                <h3 className="text-lg font-bold text-black uppercase">No deliverables logged</h3>
                <p className="text-neutral-500 text-xs max-w-md mx-auto uppercase tracking-wider font-semibold">
                  Action items appear here automatically after meeting transcribing analysis.
                </p>
                <button
                  onClick={() => setIsIngestModalOpen(true)}
                  className="bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-widest px-5 py-2.5 rounded-full border border-black shadow-lg shadow-black/10 active:scale-95 transition-all duration-300"
                >
                  Ingest Meeting
                </button>
              </div>
            ) : (
              <div className="bg-white border border-neutral-100 rounded-3xl overflow-hidden shadow-xl shadow-black/5 animate-fade-in-up">
                <div className="divide-y divide-neutral-100">
                  {actionItems.map((item) => (
                    <ActionListItem
                      key={item.id}
                      item={item}
                      onUpdateStatus={handleUpdateStatus}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW D: System Health Tab */}
        {currentView === 'system-health' && (
          <div className="max-w-6xl mx-auto space-y-8 h-full overflow-y-auto pr-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-black font-display uppercase">System Health</h2>
              <p className="text-neutral-400 text-xs uppercase tracking-wider font-bold mt-1">Live configuration parameters and audit logs</p>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in-up">
              <div className="bg-white border border-neutral-100 p-5 rounded-3xl shadow-xl shadow-black/5 hover:-translate-y-1 transition-all duration-300">
                <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider">Gateway Connection</span>
                <div className="flex items-center space-x-2 mt-2">
                  <span className={`h-2.5 w-2.5 rounded-full border border-neutral-300 ${backendStatus === 'connected' ? 'bg-black animate-pulse' : 'bg-neutral-250'}`}></span>
                  <span className="text-sm font-bold text-black uppercase">{backendStatus}</span>
                </div>
              </div>

              <div className="bg-white border border-neutral-100 p-5 rounded-3xl shadow-xl shadow-black/5 hover:-translate-y-1 transition-all duration-300">
                <span className="text-[10px] font-bold text-neutral-455 uppercase tracking-wider">Environment Config</span>
                <p className="text-sm font-bold text-black mt-2 uppercase">Development</p>
              </div>

              <div className="bg-white border border-neutral-100 p-5 rounded-3xl shadow-xl shadow-black/5 hover:-translate-y-1 transition-all duration-300">
                <span className="text-[10px] font-bold text-neutral-455 uppercase tracking-wider">FastAPI Port</span>
                <p className="text-sm font-bold text-black mt-2">8000 (Local)</p>
              </div>

              <div className="bg-white border border-neutral-100 p-5 rounded-3xl shadow-xl shadow-black/5 hover:-translate-y-1 transition-all duration-300">
                <span className="text-[10px] font-bold text-neutral-455 uppercase tracking-wider">Database Engine</span>
                <p className="text-sm font-bold text-black mt-2 uppercase">SQLite (test.db)</p>
              </div>
            </div>

            {/* Integrations panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up stagger-1">
              <ConfigCard
                icon={Settings}
                title="Webhook Configurations"
                description="Apscheduler runs periodic scans on active action items. Configured Discord and Slack endpoints trigger overdue task payloads automatically."
                items={[
                  { label: "Slack Webhook URL", value: "Configured (Masked)" },
                  { label: "Discord Webhook URL", value: "Configured (Masked)" }
                ]}
              />
              <ConfigCard
                icon={Shield}
                title="Security & Keys"
                description="FastAPI security validation maps Authorization bearer headers. Token decoding relies on custom HS256 HMAC operations."
                items={[
                  { label: "Hashing Type", value: "HS256 (HMAC-SHA256)" },
                  { label: "Access Expiry limit", value: "30 Minutes" }
                ]}
              />
            </div>

            {/* Log Panel */}
            <div className="bg-white border border-neutral-100 rounded-3xl p-6 shadow-xl shadow-black/5 animate-fade-in-up stagger-2">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center space-x-2 mb-4">
                <Terminal className="h-4.5 w-4.5 text-neutral-600" />
                <span>Diagnostics Monitor Logs Feed</span>
              </h3>
              <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-4 font-mono text-[10px] text-neutral-500 space-y-2 h-44 overflow-y-auto leading-relaxed">
                <p className="text-black font-bold">{"[SYSTEM] Activating periodic scan timers..."}</p>
                <p className="text-black font-bold">{"[SYSTEM] Overdue alerts dispatcher armed."}</p>
                <p className="text-neutral-400">{`[HTTP] 127.0.0.1 - GET /health HTTP/1.1 - 200 OK`}</p>
                <p className="text-neutral-400">{`[SQL] Executed query: count meetings`}</p>
                <p className="text-neutral-400">{`[SQL] Executed query: filter active action_items`}</p>
                {overdueCount > 0 ? (
                  <p className="text-black font-extrabold uppercase animate-pulse">{`[WARNING] Flagged ${overdueCount} overdue items. Webhook execution armed.`}</p>
                ) : (
                  <p className="text-neutral-450">{"[INFO] Background scan completed: 0 overdue tasks found."}</p>
                )}
                <p className="text-neutral-450">{"[SYSTEM] Listening for events..."}</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 2. Drawer Creator Form Ingest Modal */}
      <IngestModal
        isIngestModalOpen={isIngestModalOpen}
        setIsIngestModalOpen={setIsIngestModalOpen}
        ingestTitle={ingestTitle}
        setIngestTitle={setIngestTitle}
        ingestDate={ingestDate}
        setIngestDate={setIngestDate}
        ingestTranscript={ingestTranscript}
        setIngestTranscript={setIngestTranscript}
        handleIngestMeeting={handleIngestMeeting}
      />

      {/* Unified Notification Toast Pipeline */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

// Subcomponent: Toast UI (Floating from bottom right, glassy, heavy shadow)
function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto p-4 rounded-2xl border border-neutral-100 bg-white/95 backdrop-blur-md text-neutral-850 shadow-2xl shadow-neutral-900/10 flex items-start space-x-3 animate-slide-in-right transition-all duration-300"
        >
          {toast.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-neutral-800 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider leading-relaxed text-black">{toast.message}</p>
            {toast.traceId && (
              <p className="text-[9px] font-mono text-neutral-400 select-all border-t border-neutral-50 pt-1 mt-1 font-semibold">
                Trace: {toast.traceId}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Subcomponent: Citation button wrapper
function CitationButton({ cite, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center space-x-0.5 bg-neutral-100 hover:bg-black hover:text-white transition-colors duration-300 rounded-full px-2 py-0.5 font-mono text-[9px] text-neutral-500 ml-1.5 align-middle focus:outline-none border border-neutral-200/40 shrink-0 select-none"
    >
      <Hash className="h-2 w-2" />
      <span>{cite}</span>
    </button>
  );
}

// Subcomponent: Reusable settings/keys card
function ConfigCard({ icon: Icon, title, description, badge = "Active", items = [] }) {
  return (
    <div className="bg-white border border-neutral-100 p-6 rounded-3xl shadow-xl shadow-black/5">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-50 mb-4">
        <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center space-x-2">
          <Icon className="h-4.5 w-4.5 text-neutral-600" />
          <span>{title}</span>
        </h3>
        <span className="bg-neutral-50 border border-neutral-200 text-neutral-605 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{badge}</span>
      </div>
      <p className="text-xs text-neutral-500 leading-relaxed uppercase font-semibold">
        {description}
      </p>
      <div className="space-y-2 text-xs font-mono pt-4">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between py-1 border-b border-neutral-50">
            <span className="text-neutral-400">{item.label}</span>
            <span className="text-black font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Subcomponent: Login and Register Form (monochrome theme)
function LoginForm({
  isRegistering,
  setIsRegistering,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  handleAuth,
  toasts
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white border border-neutral-100 p-8 rounded-3xl shadow-xl shadow-neutral-900/5 relative overflow-hidden transition-all duration-300">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-black mb-2 font-display">
            H I N T R O
          </h1>
          <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">
            Fluid Meeting Intelligence & Grounding
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-neutral-455" />
              <input
                type="email"
                required
                id="auth-email-input"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200/60 text-neutral-800 rounded-2xl pl-11 pr-4 py-3 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-neutral-400 text-sm transition-all duration-300"
                placeholder="name@company.com"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-neutral-455" />
              <input
                type="password"
                required
                id="auth-password-input"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200/60 text-neutral-800 rounded-2xl pl-11 pr-4 py-3 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-neutral-400 text-sm transition-all duration-300"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            id="auth-submit-btn"
            className="group relative flex w-full justify-center rounded-full bg-black text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 active:scale-95 transition-all duration-300 shadow-md shadow-neutral-950/10 border border-black"
          >
            {isRegistering ? "Register Workspace Account" : "Access Workspace"}
          </button>
        </form>

        <div className="text-center text-xs mt-6 text-neutral-400 font-bold uppercase tracking-wider">
          {isRegistering ? "Registered?" : "New Account?"}
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            id="auth-toggle-btn"
            className="text-black hover:underline font-bold ml-1.5 focus:outline-none"
          >
            {isRegistering ? "Sign In" : "Register Now"}
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// Subcomponent: Stat card for overview dashboards
function StatCard({ title, value, icon: Icon, sparkline, breakdown, overdue, isOverdue }) {
  if (isOverdue) {
    return (
      <div className="bg-neutral-100/70 border border-neutral-200/55 p-6 rounded-3xl flex flex-col justify-between shadow-lg shadow-black/[0.02] hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group animate-fade-in-up stagger-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">{title}</span>
            <h3 className="text-4xl font-extrabold text-black mt-2 font-display">{value}</h3>
          </div>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center border bg-white border-neutral-200 text-neutral-800 transition duration-300 ${value > 0 ? 'animate-pulse' : ''}`}>
            <Icon className={`h-4.5 w-4.5 ${value > 0 ? 'text-black' : 'text-neutral-400'}`} />
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-neutral-200/50">
          <p className="text-xs text-neutral-450 uppercase font-semibold">
            {value > 0 ? "⚠️ Webhooks queue armed. Urgent attention required." : "No overdue items flagged."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-neutral-100 p-6 rounded-3xl flex flex-col justify-between shadow-xl shadow-black/5 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group animate-fade-in-up`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">{title}</span>
          <h3 className="text-4xl font-extrabold text-black mt-2 font-display">{value}</h3>
        </div>
        <div className="h-10 w-10 bg-neutral-50 rounded-full flex items-center justify-center border border-neutral-100 text-neutral-600 group-hover:scale-110 transition duration-300">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>

      {sparkline && (
        <div className="mt-4 h-12 w-full">
          <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path
              d="M0,25 Q15,5 30,20 T60,10 T90,5 L100,5 L100,30 L0,30 Z"
              fill="url(#sparkline-gradient-fluid)"
              opacity="0.06"
            />
            <path
              d="M0,25 Q15,5 30,20 T60,10 T90,5 L100,5"
              fill="none"
              stroke="#000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="sparkline-gradient-fluid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#000" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}

      {breakdown && (
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-neutral-100">
          <div className="bg-neutral-50 p-2 rounded-2xl border border-neutral-100/50 flex flex-col items-center">
            <span className="text-[9px] font-bold text-neutral-450 uppercase tracking-wider">Pending</span>
            <span className="text-sm font-extrabold text-black mt-0.5">{breakdown.pending}</span>
          </div>
          <div className="bg-neutral-50 p-2 rounded-2xl border border-neutral-100/50 flex flex-col items-center">
            <span className="text-[9px] font-bold text-neutral-450 uppercase tracking-wider">In Progress</span>
            <span className="text-sm font-extrabold text-black mt-0.5">{breakdown.inProgress}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Ingestion Modal Drawer overlay
function IngestModal({
  isIngestModalOpen,
  setIsIngestModalOpen,
  ingestTitle,
  setIngestTitle,
  ingestDate,
  setIngestDate,
  ingestTranscript,
  setIngestTranscript,
  handleIngestMeeting
}) {
  if (!isIngestModalOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-white border border-neutral-100 rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-6 relative overflow-hidden transition-all duration-300 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-black uppercase tracking-wider">Ingest Audio Transcript</h3>
          <button
            onClick={() => setIsIngestModalOpen(false)}
            className="text-neutral-500 hover:text-black text-xs font-bold uppercase focus:outline-none"
          >
            [Close]
          </button>
        </div>

        <form onSubmit={handleIngestMeeting} className="space-y-4">
          <div>
            <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Meeting Title</label>
            <input
              type="text"
              required
              value={ingestTitle}
              onChange={(e) => setIngestTitle(e.target.value)}
              placeholder="e.g., Sprint 4 Engineering Sync"
              className="w-full bg-neutral-50 border border-neutral-200/60 text-neutral-850 rounded-2xl px-4 py-3 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 text-xs transition"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Meeting Date</label>
            <input
              type="date"
              required
              value={ingestDate}
              onChange={(e) => setIngestDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200/60 text-neutral-850 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10 text-xs transition"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Transcript Input</label>
            <span className="block text-[9px] text-neutral-450 font-bold uppercase tracking-wider mb-1">Format: [MM:SS] Speaker: Phrase</span>
            <textarea
              rows={6}
              required
              value={ingestTranscript}
              onChange={(e) => setIngestTranscript(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200/60 text-neutral-850 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/10 text-xs font-mono leading-relaxed transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-black hover:bg-neutral-850 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-full border border-black shadow active:scale-95 transition-all duration-300"
            >
              <span>Ingest & Process AI</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Subcomponent: Action Item details checklist mapper inside tab panels
function MeetingDetailActionItem({ item, selectedMeeting, meetingAnalysis, onUpdateStatus, onTriggerCitation }) {
  const isCompleted = item.status === 'COMPLETED';
  const matchAnalysisAction = meetingAnalysis.actionItems?.find(
    ai => ai.task.toLowerCase().substring(0, 15) === item.task.toLowerCase().substring(0, 15)
  );
  const citations = matchAnalysisAction?.citations || [];

  return (
    <div
      onClick={() => onUpdateStatus(item.id, isCompleted ? 'PENDING' : 'COMPLETED')}
      className={`p-4 rounded-2xl border border-neutral-100 hover:border-neutral-250 cursor-pointer bg-neutral-50/40 hover:bg-neutral-50 transition-all duration-300 flex items-start space-x-3 group ${isCompleted ? 'checked' : ''}`}
    >
      <div className="shrink-0 mt-0.5 relative flex items-center justify-center">
        <div className={`h-5 w-5 rounded-md border transition-all duration-300 flex items-center justify-center ${isCompleted ? 'bg-black border-black' : 'border-neutral-300 bg-white group-hover:border-neutral-400'}`}>
          {isCompleted && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
              <path className="checkmark-path" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h5 className="text-xs font-semibold strike-text leading-relaxed select-none">{item.task}</h5>
          {citations.map((cite, cIdx) => (
            <CitationButton
              key={cIdx}
              cite={cite}
              onClick={(e) => {
                e.stopPropagation();
                onTriggerCitation(cite);
              }}
            />
          ))}
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <span className="text-[9px] text-neutral-455 font-bold uppercase tracking-wider">Assignee: {item.assignee}</span>
          <span className="text-[9px] text-neutral-300 font-bold">•</span>
          <span className="bg-white border border-neutral-200 text-neutral-500 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest font-mono">
            {item.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Main Action Items tab delivery rows
function ActionListItem({ item, onUpdateStatus }) {
  const isOverdue = new Date(item.dueDate) < new Date() && item.status !== 'COMPLETED';
  const isCompleted = item.status === 'COMPLETED';
  return (
    <div
      className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-350 hover:bg-neutral-50/50 ${isOverdue ? 'bg-neutral-50/40' : 'bg-white'} ${isCompleted ? 'checked' : ''}`}
    >
      <div className="flex items-start space-x-4 max-w-2xl">
        <div
          onClick={() => onUpdateStatus(item.id, isCompleted ? 'PENDING' : 'COMPLETED')}
          className="shrink-0 mt-1 relative flex items-center justify-center cursor-pointer"
        >
          <div className={`h-5 w-5 rounded-md border transition-all duration-300 flex items-center justify-center ${isCompleted ? 'bg-black border-black' : 'border-neutral-300 bg-white hover:border-neutral-450'}`}>
            {isCompleted && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                <path className="checkmark-path" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center space-x-3.5">
            <h4 className="text-sm font-semibold strike-text leading-relaxed select-none">{item.task}</h4>
            {isOverdue && (
              <span className="bg-neutral-100 border border-neutral-300 text-black text-[9px] px-2.5 py-0.5 rounded-full font-bold tracking-widest uppercase">
                OVERDUE
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-neutral-450 uppercase tracking-wider font-bold">
            <span>Assignee: <strong className="text-neutral-800 font-semibold">{item.assignee}</strong></span>
            <span>Due Date: <strong className="text-neutral-800 font-semibold">{new Date(item.dueDate).toLocaleDateString()}</strong></span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4 shrink-0 pl-9 md:pl-0">
        <select
          value={item.status}
          onChange={(e) => onUpdateStatus(item.id, e.target.value)}
          className="bg-neutral-50 border border-neutral-200/60 text-neutral-700 rounded-xl px-3 py-1.5 focus:outline-none text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-black/10 transition"
        >
          <option value="PENDING">PENDING</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>
      </div>
    </div>
  );
}
