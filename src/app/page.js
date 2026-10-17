"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, set, update, remove } from "firebase/database";
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
  Sparkles
} from "lucide-react";

export default function Home() {
  const [keys, setKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedKey, setCopiedKey] = useState(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Keep a ticking clock on client side
  useEffect(() => {
    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Form states
  const [customKey, setCustomKey] = useState("");
  const [durationPreset, setDurationPreset] = useState("30d");
  const [customDateTime, setCustomDateTime] = useState("");
  const [deviceLimit, setDeviceLimit] = useState("1");
  const [customerNote, setCustomerNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedSuccessKey, setGeneratedSuccessKey] = useState(null);

  // Listen to Firebase RTDB keys in realtime
  useEffect(() => {
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
  }, []);

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

  // Calculate expiry timestamp
  const calculateExpiry = () => {
    const now = Date.now();
    switch (durationPreset) {
      case "1h":
        return now + 1 * 60 * 60 * 1000;
      case "12h":
        return now + 12 * 60 * 60 * 1000;
      case "24h":
        return now + 24 * 60 * 60 * 1000;
      case "3d":
        return now + 3 * 24 * 60 * 60 * 1000;
      case "7d":
        return now + 7 * 24 * 60 * 60 * 1000;
      case "15d":
        return now + 15 * 24 * 60 * 60 * 1000;
      case "30d":
        return now + 30 * 24 * 60 * 60 * 1000;
      case "90d":
        return now + 90 * 24 * 60 * 60 * 1000;
      case "365d":
        return now + 365 * 24 * 60 * 60 * 1000;
      case "lifetime":
        return now + 3650 * 24 * 60 * 60 * 1000; // ~10 years
      case "custom":
        if (customDateTime) {
          const parsed = new Date(customDateTime).getTime();
          return isNaN(parsed) ? now + 30 * 24 * 60 * 60 * 1000 : parsed;
        }
        return now + 30 * 24 * 60 * 60 * 1000;
      default:
        return now + 30 * 24 * 60 * 60 * 1000;
    }
  };

  const getDurationLabel = (preset) => {
    switch (preset) {
      case "1h": return "1 Hour (Trial)";
      case "12h": return "12 Hours";
      case "24h": return "24 Hours (1 Day)";
      case "3d": return "3 Days";
      case "7d": return "7 Days (1 Week)";
      case "15d": return "15 Days";
      case "30d": return "30 Days (1 Month)";
      case "90d": return "90 Days (3 Months)";
      case "365d": return "1 Year (Annual)";
      case "lifetime": return "Lifetime VIP";
      case "custom": return "Custom Date";
      default: return preset;
    }
  };

  // Create Key in Firebase
  const handleCreateKey = async (e) => {
    e.preventDefault();
    setGenerating(true);

    const finalKey = (customKey.trim() || generateRandomKey(10)).toUpperCase();
    const expiresAt = calculateExpiry();
    const now = Date.now();

    const keyData = {
      key: finalKey,
      status: "active",
      createdAt: now,
      expiresAt: expiresAt,
      expiresAtFormatted: new Date(expiresAt).toLocaleString(),
      durationPreset: durationPreset,
      durationLabel: getDurationLabel(durationPreset),
      deviceLimit: parseInt(deviceLimit, 10) || 1,
      boundDeviceId: "", // Bound upon first login
      boundDeviceModel: "",
      note: customerNote.trim() || "VIP Member",
      lastLoginAt: null
    };

    try {
      await set(ref(db, `keys/${finalKey}`), keyData);
      setGeneratedSuccessKey(keyData);
      setCustomKey("");
      setCustomerNote("");
      // Safely auto-copy without crashing on HTTP / mobile contexts
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
    if (confirm(`Reset device binding for key ${keyString}? The user can re-bind on a new device.`)) {
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

  const fallbackCopyText = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "-9999px";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch (e) {
      console.warn("Fallback copy failed:", e);
      return false;
    }
  };

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

  // Process keys list and statistics
  const now = currentTime || 0;
  const keysArray = Object.values(keys || {}).map((k) => {
    const isExpired = k.expiresAt && now > 0 && k.expiresAt < now;
    let computedStatus = k.status;
    if (k.status === "active" && isExpired) {
      computedStatus = "expired";
    }
    return {
      ...k,
      computedStatus,
      isExpired
    };
  });

  const totalKeys = keysArray.length;
  const activeKeys = keysArray.filter((k) => k.computedStatus === "active").length;
  const expiredKeys = keysArray.filter((k) => k.computedStatus === "expired").length;
  const boundDevices = keysArray.filter((k) => k.boundDeviceId && k.boundDeviceId !== "").length;

  const filteredKeys = keysArray.filter((k) => {
    const matchesSearch =
      k.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (k.note && k.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (k.boundDeviceId && k.boundDeviceId.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return k.computedStatus === "active";
    if (statusFilter === "expired") return k.computedStatus === "expired";
    if (statusFilter === "revoked") return k.status === "revoked";
    if (statusFilter === "bound") return Boolean(k.boundDeviceId);
    return true;
  });

  const formatRemainingTime = (expiresAt) => {
    const diff = expiresAt - now;
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

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

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
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

          <a
            href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tg-hack-1c3ca"}/database`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors border border-slate-700"
          >
            <span>Firebase Console</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
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
          <div className="mt-1 text-xs text-slate-500">Valid & non-expired access</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expired Keys</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-rose-400">{expiredKeys}</div>
          <div className="mt-1 text-xs text-slate-500">Require subscription renewal</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bound HWIDs</span>
            <Smartphone className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-indigo-300">{boundDevices}</div>
          <div className="mt-1 text-xs text-slate-500">Locked to Android hardware</div>
        </div>
      </div>

      {/* Main Grid: Generator Card + Key List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Key Generator */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-panel-glow rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Create New Key</h2>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                VIP Access
              </span>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              {/* Custom or Random Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    License Key String
                  </label>
                  <button
                    type="button"
                    onClick={handleRandomize}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Randomize
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="Custom key (or leave blank to auto-generate)"
                    className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition-all uppercase"
                  />
                </div>
              </div>

              {/* Expiry Duration Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Duration & Expiry
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "1h", label: "1 Hour" },
                    { id: "24h", label: "24 Hours" },
                    { id: "3d", label: "3 Days" },
                    { id: "7d", label: "7 Days" },
                    { id: "30d", label: "30 Days" },
                    { id: "90d", label: "90 Days" },
                    { id: "365d", label: "1 Year" },
                    { id: "lifetime", label: "Lifetime" },
                    { id: "custom", label: "Custom" }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDurationPreset(preset.id)}
                      className={`text-xs font-medium py-2 px-2.5 rounded-xl border transition-all ${
                        durationPreset === preset.id
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {durationPreset === "custom" && (
                  <div className="mt-3">
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Device Limit / Binding */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Device Hardware Lock (HWID)
                </label>
                <select
                  value={deviceLimit}
                  onChange={(e) => setDeviceLimit(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                >
                  <option value="1">1 Device (Locked to first Android device)</option>
                  <option value="2">2 Devices</option>
                  <option value="999">Unlimited Devices (No HWID Lock)</option>
                </select>
              </div>

              {/* Customer Note / Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  User Note / Telegram ID
                </label>
                <input
                  type="text"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="e.g. @rahul_vip or Buyer #1024"
                  className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={generating}
                className="w-full btn-gradient rounded-xl py-3 px-4 font-bold text-sm tracking-wide flex items-center justify-center gap-2 mt-4"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Saving to Firebase...
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
                  <span>HWID: Ready to bind</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Info / REST Endpoint Box */}
          <div className="glass-panel rounded-2xl p-5 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-200 font-semibold mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Realtime REST Verification</span>
            </div>
            <p className="mb-2">
              The Lua Android app verifies keys directly via the Firebase RTDB REST API:
            </p>
            <div className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 break-all select-all">
              {process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://<your-rtdb>.firebasedatabase.app"}/keys/&lt;KEY&gt;.json
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Automatic HWID binding on 1st login</span>
              <span className="text-emerald-400 font-medium">Zero-lag sync</span>
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

                      {/* Details row: expiry, countdown, note */}
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
                              HWID:{" "}
                              {item.boundDeviceId ? (
                                <span className="font-mono text-[11px] text-indigo-300">
                                  {item.boundDeviceId.substring(0, 10)}...
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">Unbound</span>
                              )}
                            </span>
                          </div>
                          {item.note && (
                            <div className="mt-1 text-[11px] text-slate-400 truncate">
                              Note: {item.note}
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

                          {/* Reset HWID button */}
                          {item.boundDeviceId && (
                            <button
                              onClick={() => resetDeviceBinding(item.key)}
                              className="px-2 py-1 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-300 text-[11px] transition-colors flex items-center gap-1"
                              title="Reset bound device"
                            >
                              <Unlock className="w-3 h-3" /> Reset HWID
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Suspend / Resume toggle */}
                          <button
                            onClick={() => toggleKeyStatus(item.key, item.status)}
                            className={`p-1.5 rounded transition-colors ${
                              item.status === "active"
                                ? "bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/70"
                                : "bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/70"
                            }`}
                            title={item.status === "active" ? "Revoke / Suspend" : "Re-activate"}
                          >
                            {item.status === "active" ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteKey(item.key)}
                            className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/70 transition-colors"
                            title="Delete Key"
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
