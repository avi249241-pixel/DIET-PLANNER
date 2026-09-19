import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { FoodItem, DailyStats, WeeklyAuditReport } from '../types';
import { X, Sparkles, Activity, Award, ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

interface WeeklyAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: FoodItem[];
  dailyStats: DailyStats | null;
}

export const WeeklyAuditModal: React.FC<WeeklyAuditModalProps> = ({
  isOpen,
  onClose,
  logs,
  dailyStats
}) => {
  const { profile } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<WeeklyAuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const generateAudit = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const resData = await apiFetch<any>('/api/ai/weekly-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs,
          profile,
          dailyStats
        })
      });

      if (!resData.success) throw new Error(resData.error || 'Failed to generate weekly audit');

      setReport(resData.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error generating weekly audit report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Weekly AI Nutritionist Audit</h2>
              <p className="text-[11px] text-slate-400">Comprehensive health, macro compliance & junk frequency review</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!report && !isGenerating && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-black text-white">Generate Your Performance Audit</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Our sports dietitian AI will review your logged meals, calorie thresholds, junk food limit adherence, and hydration trends over the past week to formulate a tailored critique.
                </p>
              </div>
              <button
                onClick={generateAudit}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition shadow-[0_4px_14px_rgba(16,185,129,0.3)] inline-flex items-center gap-2"
              >
                <span>Run Full AI Audit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-12 space-y-4">
              <Activity className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
              <h3 className="text-base font-bold text-white">Compiling Clinical Audit...</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Evaluating macro balance, caloric deviations, micronutrient density, and recovery factors...
              </p>
            </div>
          )}

          {report && !isGenerating && (
            <div className="space-y-5 animate-in fade-in">
              {/* Scorecard Hero */}
              <div className="bg-gradient-to-br from-emerald-950/60 via-slate-950 to-teal-950/60 border border-emerald-500/30 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                    Overall Performance
                  </span>
                  <h3 className="text-2xl font-black text-white tracking-tight">Grade {report.grade}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Health Score: <strong className="text-emerald-400">{report.overallScore}/100</strong></p>
                </div>

                <button
                  onClick={generateAudit}
                  className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition flex items-center gap-1.5 text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-audit</span>
                </button>
              </div>

              {/* Summary */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Executive Assessment</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">{report.summary}</p>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-emerald-500/20 p-3.5 rounded-xl">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Key Strengths</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {report.strengths?.map((s, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-950 border border-amber-500/20 p-3.5 rounded-xl">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Areas to Improve</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {report.weaknesses?.map((w, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Plan */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Actionable Directives for Next Week</span>
                </h4>
                <div className="space-y-2 pt-1">
                  {report.actionPlan?.map((plan, idx) => (
                    <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{plan}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smart Swaps */}
              {report.smartSwaps && report.smartSwaps.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                    <span>Personalized Smart Swaps</span>
                  </h4>
                  <div className="space-y-2">
                    {report.smartSwaps.map((swap, idx) => (
                      <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs">
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <span className="text-red-400 line-through">{swap.currentFood}</span>
                          <span className="text-slate-500">➔</span>
                          <span className="text-emerald-400">{swap.recommendedSwap}</span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{swap.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Grocery List */}
              {report.suggestedWeeklyGrocery && report.suggestedWeeklyGrocery.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    Recommended Shopping Items For Next Week
                  </h4>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {report.suggestedWeeklyGrocery.map((item, idx) => (
                      <span key={idx} className="bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {report.closingEncouragement && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs font-medium text-emerald-300 italic">"{report.closingEncouragement}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
