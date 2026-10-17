"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, set, update, remove, get } from "firebase/database";
import {
  Key,
  ShieldCheck,
  Clock,
  Smartphone,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Search,
  Filter,
  AlertCircle,
  ExternalLink,
  Lock,
  Unlock,
  Calendar,
  Zap,
  Activity,
  Send,
  Sparkles,
  LogOut,
  User,
  ShieldAlert
} from "lucide-react";
import {
  verifyAdminCredentials,
  saveSession,
  checkSession,
  clearSession,
  getStoredSession
} from "@/lib/auth";

export default function Home() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState("admin");

  // Database & Key states
  const [keys, setKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedKey, setCopiedKey] = useState(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Form states - Custom duration & manual device input
  const [customKey, setCustomKey] = useState("");
  const [durationValue, setDurationValue] = useState(30);
  const [durationUnit, setDurationUnit] = useState("days"); // "minutes", "hours", "days", "weeks", "months", "lifetime"
  const [deviceLimit, setDeviceLimit] = useState(1);
  const [customerNote, setCustomerNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedSuccessKey, setGeneratedSuccessKey] = useState(null);

  // Realtime Firebase listener on admin_config:
  // Forces immediate instant logout across ALL open devices if password is changed!
  useEffect(() => {
    const adminConfigRef = ref(db, "admin_config");
    
    // Core function to check if current stored session is still valid against Firebase config
    const enforceAuthAgainstConfig = (config) => {
      const stored = getStoredSession();
      if (!stored || !stored.adminId) {
        setIsAuthenticated(false);
        setAuthChecking(false);
        return;
      }

      if (config && config.updatedAt) {
        // If stored session does not have authEpoch, or was created BEFORE the last password update
        if (!stored.authEpoch || config.updatedAt > stored.authEpoch) {
          clearSession();
          setIsAuthenticated(false);
          setKeys({});
          setLoginError("🔒 Admin password was changed. You have been automatically logged out from all devices. Please log in with the new password.");
          setAuthChecking(false);
          return;
        }
      }

      // Check timeout (2 hours)
      const now = Date.now();
      if (stored.loginTime && now - stored.loginTime < 2 * 60 * 60 * 1000) {
        setIsAuthenticated(true);
        setCurrentAdminId(stored.adminId);
      } else {
        clearSession();
        setIsAuthenticated(false);
        setKeys({});
      }
      setAuthChecking(false);
    };

    // 1. Instant WebSocket push listener from Firebase RTDB
    const unsubscribe = onValue(
      adminConfigRef,
      (snapshot) => {
        if (snapshot.exists()) {
          enforceAuthAgainstConfig(snapshot.val());
        } else {
          enforceAuthAgainstConfig(null);
        }
      },
      (error) => {
        console.error("Firebase admin_config error:", error);
        setAuthChecking(false);
      }
    );

    // 2. Storage event listener to sync logout across all tabs on the same device immediately
    const handleStorageChange = (e) => {
      if (e.key === "lexxa_admin_session" || !e.newValue) {
        const session = getStoredSession();
        if (!session) {
          setIsAuthenticated(false);
          setKeys({});
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // 3. Tab focus & visibility listener (instantly detects password change if device was asleep/minimized)
    const handleRecheck = async () => {
      const stored = getStoredSession();
      if (stored) {
        try {
          const snap = await get(ref(db, "admin_config"));
          if (snap.exists()) {
            enforceAuthAgainstConfig(snap.val());
          }
        } catch (e) {
          console.warn("Visibility re-check failed:", e);
        }
      }
    };
    window.addEventListener("focus", handleRecheck);
    document.addEventListener("visibilitychange", handleRecheck);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleRecheck);
      document.removeEventListener("visibilitychange", handleRecheck);
    };
  }, []);

  // Keep a ticking clock on client side
  useEffect(() => {
    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen to Firebase RTDB keys in realtime only when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const keysRef = ref(db, "keys");
    const unsubscribe = onValue(
      keysRef,
      (snapshot) => {
        setDbConnected(true);
        setLoading(false);
        if (snapshot.exists()) {
          setKeys(snapshot.val());
        } else {
          setKeys({});
        }
      },
      (error) => {
        console.error("Firebase RTDB Error:", error);
        setDbConnected(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    try {
      const authResult = await verifyAdminCredentials(loginId, loginPass);
      if (authResult.valid) {
        saveSession(loginId.trim(), authResult.authEpoch);
        setIsAuthenticated(true);
        setCurrentAdminId(loginId.trim());
        setLoginPass("");
      } else {
        setLoginError("⚠️ Invalid Admin ID or Password. Access Denied!");
      }
    } catch (err) {
      setLoginError("Verification failed: " + err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    clearSession();
    setIsAuthenticated(false);
    setKeys({});
    setLoginId("");
    setLoginPass("");
    setLoginError("");
  };

  // Helper to generate a 10-character random key like "CDS544SDF9"
  const generateRandomKey = (length = 10) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let res = "";
    for (let i = 0; i < length; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const handleRandomize = () => {
    setCustomKey(generateRandomKey(10));
  };

  // Calculate dynamic expiry timestamp based on number & unit
  const calculateExpiry = () => {
    const now = Date.now();
    const val = Math.max(1, parseInt(durationValue, 10) || 1);
    switch (durationUnit) {
      case "minutes":
        return now + val * 60 * 1000;
      case "hours":
        return now + val * 60 * 60 * 1000;
      case "days":
        return now + val * 24 * 60 * 60 * 1000;
      case "weeks":
        return now + val * 7 * 24 * 60 * 60 * 1000;
      case "months":
        return now + val * 30 * 24 * 60 * 60 * 1000;
      case "lifetime":
        return now + 3650 * 24 * 60 * 60 * 1000; // ~10 years
      default:
        return now + val * 24 * 60 * 60 * 1000;
    }
  };

  // Human readable label for duration
  const getDurationLabel = () => {
    if (durationUnit === "lifetime") return "Lifetime VIP";
    const val = Math.max(1, parseInt(durationValue, 10) || 1);
    const unitNames = {
      minutes: val === 1 ? "1 Minute" : `${val} Minutes`,
      hours: val === 1 ? "1 Hour" : `${val} Hours`,
      days: val === 1 ? "1 Day" : `${val} Days`,
      weeks: val === 1 ? "1 Week" : `${val} Weeks`,
      months: val === 1 ? "1 Month" : `${val} Months`,
    };
    return unitNames[durationUnit] || `${val} ${durationUnit}`;
  };

  // Safe clipboard helper
  const copyToClipboard = (text) => {
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
          fallbackCopyText(text);
        });
      } else {
        fallbackCopyText(text);
      }
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      fallbackCopyText(text);
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const fallbackCopyText = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch (e) {
      console.warn("Fallback copy failed", e);
    }
  };

  // Create Key in Firebase
  const handleCreateKey = async (e) => {
    e.preventDefault();
    setGenerating(true);

    const finalKey = (customKey.trim() || generateRandomKey(10)).toUpperCase();
    const expiresAt = calculateExpiry();
    const now = Date.now();
    const label = getDurationLabel();
    const noteText = customerNote.trim();
    const parsedDevices = Math.max(1, parseInt(deviceLimit, 10) || 1);

    const keyData = {
      key: finalKey,
      status: "active",
      createdAt: now,
      expiresAt: expiresAt,
      expiresAtFormatted: new Date(expiresAt).toLocaleString(),
      durationValue: durationUnit === "lifetime" ? 0 : parseInt(durationValue, 10) || 1,
      durationUnit: durationUnit,
      durationLabel: label,
      deviceLimit: parsedDevices,
      boundDeviceId: "", // Bound upon Android device login
      boundDeviceModel: "",
      note: noteText || "VIP Member",
      telegramId: noteText || "", // Synced for Lua app header
      lastLoginAt: null
    };

    try {
      await set(ref(db, `keys/${finalKey}`), keyData);
      setGeneratedSuccessKey(keyData);
      setCustomKey("");
      setCustomerNote("");
      copyToClipboard(finalKey);
    } catch (err) {
      alert("Error saving key: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Toggle active / revoked status
  const toggleKeyStatus = async (keyString, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "revoked" : "active";
    try {
      await update(ref(db, `keys/${keyString}`), {
        status: nextStatus
      });
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  // Reset bound device
  const resetDeviceBinding = async (keyString) => {
    if (confirm(`Reset device HWID binding for key ${keyString}? The user can re-bind on their new Android device.`)) {
      try {
        await update(ref(db, `keys/${keyString}`), {
          boundDeviceId: "",
          boundDeviceModel: ""
        });
      } catch (err) {
        alert("Error resetting HWID: " + err.message);
      }
    }
  };

  // Extend key expiry
  const extendExpiry = async (keyString, currentExpiry, additionalDays) => {
    const base = Math.max(currentExpiry, Date.now());
    const newExpiry = base + additionalDays * 24 * 60 * 60 * 1000;
    try {
      await update(ref(db, `keys/${keyString}`), {
        expiresAt: newExpiry,
        expiresAtFormatted: new Date(newExpiry).toLocaleString(),
        status: "active"
      });
    } catch (err) {
      alert("Error extending expiry: " + err.message);
    }
  };

  // Delete key
  const handleDeleteKey = async (keyString) => {
    if (confirm(`Are you sure you want to permanently delete key: ${keyString}?`)) {
      try {
        await remove(ref(db, `keys/${keyString}`));
      } catch (err) {
        alert("Error deleting key: " + err.message);
      }
    }
  };

  // Process keys list and statistics
  const now = currentTime || 0;
  const keyList = Object.entries(keys || {}).map(([key, data]) => {
    const k = data || {};
    const isExpired = k.expiresAt && now > 0 && k.expiresAt < now;
    let computedStatus = k.status || "active";
    if (computedStatus === "active" && isExpired) {
      computedStatus = "expired";
    }

    return {
      key,
      ...k,
      computedStatus,
      isExpired
    };
  });

  const totalKeys = keyList.length;
  const activeKeys = keyList.filter((k) => k.computedStatus === "active").length;
  const expiredKeys = keyList.filter((k) => k.computedStatus === "expired").length;
  const revokedKeys = keyList.filter((k) => k.status === "revoked").length;

  // Filter and search
  const filteredKeys = keyList
    .filter((k) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return k.computedStatus === "active";
      if (statusFilter === "expired") return k.computedStatus === "expired";
      if (statusFilter === "revoked") return k.status === "revoked";
      if (statusFilter === "bound") return Boolean(k.boundDeviceId);
      return true;
    })
    .filter((k) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        k.key.toLowerCase().includes(term) ||
        (k.note && k.note.toLowerCase().includes(term)) ||
        (k.telegramId && k.telegramId.toLowerCase().includes(term)) ||
        (k.boundDeviceId && k.boundDeviceId.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const formatRemainingTime = (expiresAt) => {
    if (!expiresAt) return "Lifetime";
    const diff = expiresAt - now;
    if (diff <= 0) return "Expired";
    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);

    if (d > 0) return `${d}d ${h}h remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  };

  // ========================================================
  // RENDER: INITIAL CHECKING / LOADING
  // ========================================================
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#070b12] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs text-slate-400 font-mono">Verifying security session...</span>
        </div>
      </div>
    );
  }

  // ========================================================
  // RENDER: ADMIN LOGIN PAGE (DISPLAYED WHEN NOT LOGGED IN)
  // ========================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-slate-900/85 border border-slate-800/90 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl shadow-cyan-950/20">
            {/* Brand Header */}
            <div className="flex flex-col items-center text-center mb-7">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/40 mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                LEXXA VIP <span className="text-cyan-400 text-sm font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800">ADMIN</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1.5">
                License Key Control Center — Admin Verification Required
              </p>
            </div>

            {/* Error banner */}
            {loginError && (
              <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Admin ID
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="Enter Admin ID (default: admin)"
                    required
                    autoFocus
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="Enter Password (default: admin123)"
                    required
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Credentials...
                  </>
                ) : (
                  <>Unlock Control Center</>
                )}
              </button>
            </form>
          </div>

          <div className="text-center text-[11px] text-slate-500 mt-5">
            Synchronized with Firebase Realtime Database
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // RENDER: MAIN CONTROL DASHBOARD (WHEN AUTHENTICATED)
  // ========================================================
  return (
    <div className="min-h-screen text-slate-100 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Navigation / Brand */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                LEXXA VIP <span className="text-cyan-400 font-mono text-sm px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/80">AUTH HUB</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Firebase Realtime License Key Management System for Android Lua Panel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end flex-wrap">
          {/* Admin Identity Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-300">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono">{currentAdminId}</span>
          </div>

          {/* Database status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                dbConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-rose-500"
              }`}
            />
            <span className="text-slate-300 font-mono">
              {dbConnected ? "RTDB Connected" : "Connecting..."}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors"
            title="Log out of Control Center"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Keys</span>
            <Key className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white">{totalKeys}</div>
          <div className="mt-1 text-xs text-slate-500">All generated license records</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Keys</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-400">{activeKeys}</div>
          <div className="mt-1 text-xs text-slate-500">Currently valid for login</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expired Keys</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-rose-400">{expiredKeys}</div>
          <div className="mt-1 text-xs text-slate-500">Auto-stopped & logged out</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Revoked Keys</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-400">{revokedKeys}</div>
          <div className="mt-1 text-xs text-slate-500">Admin blocked access</div>
        </div>
      </div>

      {/* Main Grid: Generator (Left) + Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Key Generator */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-panel rounded-2xl p-5 sm:p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Generate VIP License Key</h2>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                AES-Format
              </span>
            </div>

            <form onSubmit={handleCreateKey} className="mt-5 space-y-4">
              {/* Custom Key / Auto Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Custom Key String (Optional)</span>
                  <button
                    type="button"
                    onClick={handleRandomize}
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-Random
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
                    placeholder="Auto-generated if left blank (e.g. VIP-ABCD123)"
                    className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              </div>

              {/* Dynamic Number of Time & Unit Selector (No hardcoded pre-written buttons) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Key Validity Duration</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{getDurationLabel()}</span>
                </label>
                <div className="grid grid-cols-12 gap-2">
                  {/* Number of Time Input */}
                  <div className="col-span-5">
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      disabled={durationUnit === "lifetime"}
                      value={durationUnit === "lifetime" ? "" : durationValue}
                      onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      placeholder={durationUnit === "lifetime" ? "∞" : "e.g. 5"}
                      className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-40"
                      required={durationUnit !== "lifetime"}
                    />
                  </div>

                  {/* Unit Selector: Minutes, Hours, Days, Weeks, Months, Lifetime */}
                  <div className="col-span-7">
                    <select
                      value={durationUnit}
                      onChange={(e) => setDurationUnit(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                      <option value="lifetime">Lifetime (No Expiry)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Number of Devices (Manual numeric entry) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Number of Allowed Devices (HWID)</span>
                  <span className="text-[11px] text-cyan-400 font-normal">Manual Input</span>
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={deviceLimit}
                    onChange={(e) => setDeviceLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    placeholder="Enter device limit (e.g. 1, 2, or 5)"
                    className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Enter 1 for single phone lock, or 2+ to allow the same key across multiple devices.
                </p>
              </div>

              {/* Customer Note / Telegram ID (Displayed at top of Lua App) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>User Note / Telegram ID</span>
                  <span className="text-[11px] text-emerald-400 font-normal">Shows at top of Lua App</span>
                </label>
                <input
                  type="text"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="e.g. @rahul_vip or Buyer #102"
                  className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={generating}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl py-3 px-4 text-sm tracking-wide flex items-center justify-center gap-2 mt-4 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Storing to Firebase...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" /> Generate & Store Key
                  </>
                )}
              </button>
            </form>

            {/* Success Banner */}
            {generatedSuccessKey && (
              <div className="mt-5 p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold mb-2">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" /> Key Created & Copied!
                  </span>
                  <span>{generatedSuccessKey.durationLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 font-mono text-sm text-cyan-200 select-all">
                  <span className="font-bold tracking-wider">{generatedSuccessKey.key}</span>
                  <button
                    onClick={() => copyToClipboard(generatedSuccessKey.key)}
                    className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-300 hover:text-white"
                    title="Copy Key"
                  >
                    {copiedKey === generatedSuccessKey.key ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 mt-2 flex justify-between">
                  <span>Expires: {generatedSuccessKey.expiresAtFormatted}</span>
                  <span>Devices: {generatedSuccessKey.deviceLimit} Allowed</span>
                </div>
                {generatedSuccessKey.note && (
                  <div className="text-[11px] text-emerald-400 mt-1">
                    App User Title: {generatedSuccessKey.note}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Info Box */}
          <div className="glass-panel rounded-2xl p-5 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-200 font-semibold mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Realtime REST Verification</span>
            </div>
            <p className="mb-2">
              The Lua Android app verifies keys directly via Firebase RTDB:
            </p>
            <div className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 break-all select-all">
              {process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://<your-rtdb>.firebasedatabase.app"}/keys/&lt;KEY&gt;.json
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Auto HWID binding on login</span>
              <span className="text-emerald-400 font-medium">Real-time sync</span>
            </div>
          </div>
        </div>

        {/* Right Column: Key List Table */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="glass-panel rounded-2xl p-5 sm:p-6">
            {/* Header + Search & Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Active Keys Database</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {filteredKeys.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Manage, extend, or revoke license access</p>
              </div>

              {/* Search input */}
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search keys, notes..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 pb-3 mb-4 border-b border-slate-800 overflow-x-auto">
              {[
                { id: "all", label: "All Keys" },
                { id: "active", label: "Active" },
                { id: "expired", label: "Expired" },
                { id: "revoked", label: "Revoked" },
                { id: "bound", label: "Bound HWID" }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === f.id
                      ? "bg-slate-700 text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* List */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <span>Loading keys from Firebase...</span>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <span>No license keys match your query</span>
                <span className="text-xs text-slate-600">Use the generator on the left to create one.</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                {filteredKeys.map((item) => {
                  const isExpired = item.computedStatus === "expired";
                  const isRevoked = item.status === "revoked";
                  const isActive = item.computedStatus === "active";

                  return (
                    <div
                      key={item.key}
                      className="p-3.5 sm:p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-3"
                    >
                      {/* Top Bar: Key string, status badge, copy */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(item.key)}
                            className="font-mono text-sm sm:text-base font-bold text-white tracking-wide hover:text-cyan-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>{item.key}</span>
                            {copiedKey === item.key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                            )}
                          </button>
                          {item.durationLabel && (
                            <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                              {item.durationLabel}
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              ACTIVE
                            </span>
                          )}
                          {isExpired && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">
                              EXPIRED
                            </span>
                          )}
                          {isRevoked && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">
                              REVOKED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details row: expiry, countdown, note, devices */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                        <div>
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Expires: {item.expiresAtFormatted || "N/A"}</span>
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-cyan-400">
                            {formatRemainingTime(item.expiresAt)}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                            <span>
                              HWID ({item.deviceLimit || 1} Device{item.deviceLimit > 1 ? "s" : ""}):{" "}
                              {item.boundDeviceId ? (
                                <span className="font-mono text-[11px] text-indigo-300">
                                  {item.boundDeviceId.length > 15 ? `${item.boundDeviceId.substring(0, 15)}...` : item.boundDeviceId}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">Unbound</span>
                              )}
                            </span>
                          </div>
                          {(item.note || item.telegramId) && (
                            <div className="mt-1 text-[11px] text-emerald-400 truncate">
                              User: {item.telegramId || item.note}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Extend buttons */}
                          <button
                            onClick={() => extendExpiry(item.key, item.expiresAt, 1)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                            title="Add 1 Day"
                          >
                            +1 Day
                          </button>
                          <button
                            onClick={() => extendExpiry(item.key, item.expiresAt, 7)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                            title="Add 7 Days"
                          >
                            +7 Days
                          </button>
                          <button
                            onClick={() => extendExpiry(item.key, item.expiresAt, 30)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                            title="Add 30 Days"
                          >
                            +30 Days
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Reset HWID button */}
                          {item.boundDeviceId && (
                            <button
                              onClick={() => resetDeviceBinding(item.key)}
                              className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] transition-colors flex items-center gap-1"
                              title="Reset HWID binding"
                            >
                              <Smartphone className="w-3 h-3" />
                              <span>Reset HWID</span>
                            </button>
                          )}

                          {/* Revoke / Unrevoke button */}
                          <button
                            onClick={() => toggleKeyStatus(item.key, item.status)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                              item.status === "revoked"
                                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {item.status === "revoked" ? (
                              <>
                                <Unlock className="w-3 h-3" /> Activate
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> Revoke
                              </>
                            )}
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteKey(item.key)}
                            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Key Permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
