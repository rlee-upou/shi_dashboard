import React, { useState, useEffect } from 'react';

// IMPORTANT FOR VS CODE: 
// Uncomment the line below when you move to your local VS Code environment!
import { createClient } from '@supabase/supabase-js';


import { 
  Activity, Users, TrendingUp, FileText, CheckCircle, AlertCircle, Map, Clock, LayoutDashboard, RefreshCw
} from 'lucide-react';

// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
// For local VS Code, use your .env file by replacing the two lines below with:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';


const supabase = createClient(supabaseUrl, supabaseKey);

// --- COMPONENTS ---
const MetricCard = ({ title, value, unit, icon: Icon, description, colorClass, status }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      {status && (
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${status === 'Critical' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {status}
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <div className="flex items-baseline gap-1 mt-1">
      <span className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</span>
      {unit && <span className="text-slate-500 text-sm font-semibold">{unit}</span>}
    </div>
    <p className="text-xs text-slate-400 mt-2 italic">{description}</p>
  </div>
);

export default function LiveDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  
  // Dashboard State
  const [stats, setStats] = useState({
    avgSteps: 0,
    avgExercise: 0,
    totalPolled: 0,
    sedentaryRate: 0
  });
  const [rankings, setRankings] = useState([]);

  // Fetch Live Data from Supabase
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch pre-calculated data directly from our new SQL View
      const { data: metrics, error } = await supabase
        .from('live_dashboard_metrics')
        .select('*');
        
      if (error) throw error;

      // 2. Aggregate City-Wide Global Stats from the View
      let totalResidents = 0;
      let sumStepsWeighted = 0;
      let sumMinsWeighted = 0;
      let totalSedentary = 0;

      const calculatedRankings = [];

      metrics.forEach((bgy, index) => {
        const count = bgy.total_unique_residents || 0;
        if (count > 0) {
          totalResidents += count;
          sumStepsWeighted += (bgy.barangay_avg_steps * count);
          sumMinsWeighted += (bgy.barangay_avg_mins * count);
          totalSedentary += (bgy.sedentary_residents || 0);

          // Setup Rankings Array
          const colors = ['bg-indigo-600', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500', 'bg-slate-400'];
          calculatedRankings.push({
            name: bgy.barangay_name,
            steps: bgy.barangay_avg_steps,
            color: colors[index % colors.length]
          });
        }
      });

      // 3. Update Global State
      setStats({
        avgSteps: totalResidents > 0 ? Math.round(sumStepsWeighted / totalResidents) : 0,
        avgExercise: totalResidents > 0 ? Math.round(sumMinsWeighted / totalResidents) : 0,
        totalPolled: totalResidents,
        sedentaryRate: totalResidents > 0 ? Math.round((totalSedentary / totalResidents) * 100) : 0
      });

      // 4. Update Rankings State (Highest steps first)
      setRankings(calculatedRankings.sort((a, b) => b.steps - a.steps));
      setLastUpdated(new Date().toLocaleTimeString());

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-[#1E40AF] rounded-lg flex items-center justify-center shadow-md">
                <LayoutDashboard className="text-white w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Live Census Hub</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Quezon City Activity Baseline • <span className="text-emerald-600 font-semibold flex items-center inline-flex gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Database Connected</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-100 transition-colors shadow-sm text-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} /> 
              {isLoading ? 'Syncing...' : 'Refresh Data'}
            </button>
            <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs border-2 border-white shadow-sm">
              CH
            </div>
          </div>
        </header>

        {/* Simplified Tabs */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Real-Time Insights', icon: Activity },
            { id: 'rankings', label: 'Barangay Rankings', icon: Map },
            { id: 'ai-brief', label: 'AI Policy Brief', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Avg Daily Steps" 
                value={stats.avgSteps} 
                unit="steps"
                icon={Activity} 
                description="Community daily average"
                colorClass="bg-indigo-600"
              />
              <MetricCard 
                title="Weekly Exercise" 
                value={stats.avgExercise} 
                unit="mins"
                icon={Clock} 
                description="Intentional workout duration"
                colorClass="bg-teal-600"
              />
              <MetricCard 
                title="Total Participation" 
                value={stats.totalPolled} 
                unit="residents"
                icon={Users} 
                description={`Last updated: ${lastUpdated}`}
                colorClass="bg-blue-600"
              />
              <MetricCard 
                title="Sedentary Rate" 
                value={stats.sedentaryRate} 
                unit="%"
                icon={AlertCircle} 
                status={stats.sedentaryRate > 40 ? "Critical" : "Stable"}
                description="Residents < 5k steps daily"
                colorClass="bg-rose-600"
              />
            </div>

            {/* Main Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold mb-6 text-slate-900">Live Barangay Leaderboard</h2>
                <div className="space-y-6">
                  {rankings.map((item) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <span className="font-black text-slate-900">{item.steps.toLocaleString()} steps</span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div 
                          className={`${item.color} h-full rounded-full transition-all duration-1000`} 
                          style={{ width: `${Math.min((item.steps / 10000) * 100, 100)}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                  {rankings.length === 0 && !isLoading && (
                    <div className="text-center text-slate-400 py-4 font-medium">No activity data found. Deploy Field Agents to gather data.</div>
                  )}
                </div>
              </div>

              {/* AI Quick Insight Placeholder */}
              <div className="bg-[#1E40AF] rounded-3xl p-8 text-white shadow-xl shadow-blue-900/20 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <TrendingUp className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="text-2xl">✨</span> AI Policy Insight</h3>
                  <p className="text-blue-100 leading-relaxed text-sm">
                    "Based on the live baseline, the city's average of <span className="font-bold text-white">{stats.avgSteps} steps</span> is being dragged down by a <span className="font-bold text-rose-300">{stats.sedentaryRate}% sedentary rate</span>. 
                    <br/><br/>
                    <strong>Recommendation:</strong> Allocate resources to the lowest-ranking Barangay ({rankings[rankings.length - 1]?.name || 'N/A'}) for immediate weekend wellness interventions."
                  </p>
                </div>
                <button className="mt-6 w-full py-3 bg-white text-[#1E40AF] font-bold rounded-xl hover:bg-blue-50 transition-colors relative z-10">
                  Export Full AI Brief
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Placeholders */}
        {activeTab !== 'overview' && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-400 capitalize">{activeTab.replace('-', ' ')} coming soon</h2>
            <p className="text-slate-400 text-sm mt-2">Extended modules are under development for Phase 2 of the Capstone.</p>
          </div>
        )}
      </div>
    </div>
  );
}