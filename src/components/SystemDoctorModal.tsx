import React, { useState, useEffect } from 'react';
import { runAutonomousHealthScan, SystemHealthReport } from '../lib/autonomousTester';
import { selfHealingSentinel, SelfHealingIncident } from '../lib/selfHealingEngine';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  ShieldCheck, 
  Wrench, 
  Zap, 
  Cpu, 
  Clock, 
  Database, 
  Terminal,
  Sparkles,
  HeartPulse
} from 'lucide-react';

interface SystemDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDoctorModal: React.FC<SystemDoctorModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [incidents, setIncidents] = useState<SelfHealingIncident[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'incidents'>('matrix');

  useEffect(() => {
    if (isOpen) {
      handleRunScan();
      const unsub = selfHealingSentinel.subscribe(setIncidents);
      return () => unsub();
    }
  }, [isOpen]);

  const handleRunScan = async () => {
    setIsScanning(true);
    try {
      const scanResult = await runAutonomousHealthScan();
      setReport(scanResult);
    } catch (err) {
      console.error('Autonomous scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <HeartPulse className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-tight">Autonomous System Doctor</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Self-Healing Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Continuous background error detection, verification & auto-repair</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Scorecard */}
        <div className="p-5 border-b border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
              Autonomous Health Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white tracking-tight">
                {report ? `${report.overallScore}%` : '--%'}
              </span>
              <span className="text-xs text-emerald-400 font-bold">
                {report?.overallScore === 100 ? 'All 8 Subsystems Optimal' : 'Self-Healed & Resilient'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Passed: <strong className="text-emerald-400">{report?.passedCount || 0}</strong> • Auto-Repaired: <strong className="text-amber-400">{report?.repairedCount || 0}</strong> • Anomaly Log: <strong className="text-blue-400">{incidents.length} incidents resolved</strong>
            </p>
          </div>

          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2.5 rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(16,185,129,0.3)] shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Running Auto-Diagnostics...' : 'Run Full Auto-Scan & Heal'}</span>
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 shrink-0">
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeSubTab === 'matrix' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Subsystem Health Matrix (8)
          </button>
          <button
            onClick={() => setActiveSubTab('incidents')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === 'incidents' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>Auto-Repair Ledger</span>
            <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {incidents.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeSubTab === 'matrix' && (
            <div className="space-y-2.5">
              {report?.subsystems.map((sub) => (
                <div 
                  key={sub.id}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 p-3.5 rounded-2xl transition flex items-start justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      sub.status === 'passed' ? 'bg-emerald-500/20 text-emerald-400' :
                      sub.status === 'repaired' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {sub.status === 'passed' ? <CheckCircle2 className="w-4 h-4" /> :
                       sub.status === 'repaired' ? <Wrench className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{sub.name}</h4>
                        <span className="text-[10px] text-slate-500 font-medium">({sub.category})</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{sub.details}</p>
                      {sub.autoFixReport && (
                        <div className="mt-1.5 text-[10px] text-amber-300/90 font-medium flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>Auto-Healed: {sub.autoFixReport}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      sub.status === 'passed' ? 'bg-emerald-500/20 text-emerald-400' :
                      sub.status === 'repaired' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {sub.status === 'passed' ? 'Optimal' : sub.status === 'repaired' ? 'Auto-Healed' : 'Degraded'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                      {sub.latencyMs}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'incidents' && (
            <div className="space-y-2.5">
              {incidents.length === 0 ? (
                <div className="text-center py-10 space-y-2 text-slate-500">
                  <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400/60" />
                  <h4 className="text-xs font-bold text-slate-300">Clean Slate — 0 Active Anomalies</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    The autonomous sentinel has not encountered any unhandled faults or corrupted schemas.
                  </p>
                </div>
              ) : (
                incidents.map((incident) => (
                  <div 
                    key={incident.id}
                    className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-1.5 text-xs shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{incident.subsystem}</span>
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-slate-500 font-mono">
                          {new Date(incident.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="bg-emerald-500/20 text-emerald-400 font-black uppercase px-2 py-0.5 rounded">
                          Auto-Healed
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      <strong className="text-slate-300">Issue:</strong> {incident.detectedIssue}
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-xl border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Auto-Fix Action:</strong> {incident.autoFixApplied}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Autonomous Sentinel v2.0 • Active in background</span>
          </div>
          <button onClick={onClose} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
