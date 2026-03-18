import React, { useState, useEffect } from 'react';


import { createClient } from '@supabase/supabase-js';

import { 
  Activity, Users, TrendingUp, CheckCircle, AlertCircle, Map, Clock, LayoutDashboard, RefreshCw, Filter, PieChart, BarChart3, Smartphone, UserCheck, ShieldCheck, Loader2
} from 'lucide-react';

// ==========================================
// SUPABASE INITIALIZATION & MOCK DATA
// ==========================================

// --- CANVAS PREVIEW MOCK ---
const createClientMock = () => {
  return {
    from: (tableName) => ({
      select: () => Promise.resolve({
        data: tableName === 'barangays' 
          ? [
              { id: 1, name: 'Bgy. UP Campus', target_population: 45000 },
              { id: 2, name: 'Bgy. Fairview', target_population: 60000 },
              { id: 3, name: 'Bgy. Payatas', target_population: 120000 },
              { id: 4, name: 'Bgy. Socorro', target_population: 25000 }
            ]
          : [
              // Mocking joined raw logs to allow for dynamic drill-downs by age and source
              { resident_id: 'r1', daily_steps: 8500, weekly_exercise_mins: 60, residents: { barangay_id: 1, age_group: '18-24', primary_source: 'STRAVA_API' } },
              { resident_id: 'r2', daily_steps: 4200, weekly_exercise_mins: 20, residents: { barangay_id: 1, age_group: '65+', primary_source: 'FIELD_AGENT' } },
              { resident_id: 'r3', daily_steps: 10500, weekly_exercise_mins: 90, residents: { barangay_id: 1, age_group: '25-34', primary_source: 'WEB_PORTAL' } },
              { resident_id: 'r4', daily_steps: 3000, weekly_exercise_mins: 0, residents: { barangay_id: 3, age_group: '45-54', primary_source: 'FIELD_AGENT' } },
              { resident_id: 'r5', daily_steps: 2500, weekly_exercise_mins: 15, residents: { barangay_id: 3, age_group: '55-64', primary_source: 'FIELD_AGENT' } },
              { resident_id: 'r6', daily_steps: 7000, weekly_exercise_mins: 45, residents: { barangay_id: 2, age_group: '35-44', primary_source: 'WEB_PORTAL' } },
              { resident_id: 'r7', daily_steps: 6500, weekly_exercise_mins: 30, residents: { barangay_id: 4, age_group: '25-34', primary_source: 'STRAVA_API' } },
              { resident_id: 'r8', daily_steps: 5000, weekly_exercise_mins: 25, residents: { barangay_id: 2, age_group: '18-24', primary_source: 'STRAVA_API' } },
            ],
        error: null
      })
    })
  };
};
// ---------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey); // Swap to true createClient for production

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

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [barangays, setBarangays] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [selectedBgy, setSelectedBgy] = useState('ALL'); // 'ALL' or barangay_id
  
  // Dashboard Computed States
  const [stats, setStats] = useState({ avgSteps: 0, avgExercise: 0, totalPolled: 0, sedentaryRate: 0, targetPop: 0 });
  const [ageData, setAgeData] = useState([]);
  const [sourceData, setSourceData] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [leaderboardMetric, setLeaderboardMetric] = useState('steps'); // 'steps' or 'exercise'
  const [aiSummary, setAiSummary] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Fetch Live Data
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: bgys } = await supabase.from('barangays').select('*');
      setBarangays(bgys || []);

      const { data: logs } = await supabase
        .from('activity_logs')
        .select(`resident_id, daily_steps, weekly_exercise_mins, residents ( barangay_id, age_group, primary_source )`)
        .limit(10000);
      
      setRawData(logs || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute stats whenever rawData or selectedBgy changes
  useEffect(() => {
    if (rawData.length === 0 || barangays.length === 0) return;

    // 1. FILTER DATA based on selected Barangay
    const filteredLogs = selectedBgy === 'ALL' 
      ? rawData 
      : rawData.filter(log => log.residents?.barangay_id.toString() === selectedBgy);

    // 2. MULTI-DAY DEDUPLICATION (Personal Averages)
    const residentAggregates = {};
    filteredLogs.forEach(log => {
      const rId = log.resident_id;
      if (!residentAggregates[rId]) {
        residentAggregates[rId] = { 
          steps: 0, mins: 0, count: 0, 
          age: log.residents?.age_group || 'Unknown', 
          source: log.residents?.primary_source || 'Unknown' 
        };
      }
      residentAggregates[rId].steps += (log.daily_steps || 0);
      residentAggregates[rId].mins += (log.weekly_exercise_mins || 0);
      residentAggregates[rId].count += 1;
    });

    const personalAverages = Object.values(residentAggregates).map(r => ({
      avg_steps: r.steps / r.count,
      avg_mins: r.mins / r.count,
      age: r.age,
      source: r.source
    }));

    const totalUnique = personalAverages.length;

    // 3. COMPUTE KPIs
    let sumSteps = 0, sumMins = 0, sedentaryCount = 0;
    const ageGroups = { 
      '18-24': { count: 0, steps: 0, mins: 0 }, 
      '25-34': { count: 0, steps: 0, mins: 0 }, 
      '35-44': { count: 0, steps: 0, mins: 0 }, 
      '45-54': { count: 0, steps: 0, mins: 0 }, 
      '55-64': { count: 0, steps: 0, mins: 0 }, 
      '65+': { count: 0, steps: 0, mins: 0 } 
    };
    const sources = { 'STRAVA_API': 0, 'WEB_PORTAL': 0, 'FIELD_AGENT': 0 };

    personalAverages.forEach(p => {
      sumSteps += p.avg_steps;
      sumMins += p.avg_mins;
      if (p.avg_steps < 5000) sedentaryCount++;
      if (ageGroups[p.age] !== undefined) {
        ageGroups[p.age].count++;
        ageGroups[p.age].steps += p.avg_steps;
        ageGroups[p.age].mins += p.avg_mins;
      }
      if (sources[p.source] !== undefined) sources[p.source]++;
    });

    // Compute Target Population for Penetration Metric
    const currentTargetPop = selectedBgy === 'ALL' 
      ? barangays.reduce((sum, b) => sum + (b.target_population || 0), 0)
      : barangays.find(b => b.id.toString() === selectedBgy)?.target_population || 0;

    setStats({
      avgSteps: totalUnique > 0 ? Math.round(sumSteps / totalUnique) : 0,
      avgExercise: totalUnique > 0 ? Math.round(sumMins / totalUnique) : 0,
      totalPolled: totalUnique,
      sedentaryRate: totalUnique > 0 ? Math.round((sedentaryCount / totalUnique) * 100) : 0,
      targetPop: currentTargetPop
    });

    setAgeData(Object.entries(ageGroups).map(([age, data]) => ({ 
      age, 
      count: data.count,
      avgSteps: data.count > 0 ? Math.round(data.steps / data.count) : 0,
      avgMins: data.count > 0 ? Math.round(data.mins / data.count) : 0
    })));
    setSourceData(Object.entries(sources).map(([source, count]) => ({ source, count })));

    // 4. COMPUTE CITY RANKINGS (Only if viewing 'ALL')
    if (selectedBgy === 'ALL') {
      const bgyTotals = {};
      rawData.forEach(log => {
        const bId = log.residents?.barangay_id;
        if (!bgyTotals[bId]) bgyTotals[bId] = { steps: 0, mins: 0, count: 0 };
        bgyTotals[bId].steps += log.daily_steps || 0;
        bgyTotals[bId].mins += log.weekly_exercise_mins || 0;
        bgyTotals[bId].count += 1;
      });

      const ranks = barangays.map((b, index) => {
        const bCount = bgyTotals[b.id] ? bgyTotals[b.id].count : 0;
        const bAvgSteps = bCount > 0 ? Math.round(bgyTotals[b.id].steps / bCount) : 0;
        const bAvgMins = bCount > 0 ? Math.round(bgyTotals[b.id].mins / bCount) : 0;
        const bPenetration = b.target_population > 0 ? ((bCount / b.target_population) * 100).toFixed(2) : 0;
        const colors = ['bg-indigo-600', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500'];
        return { name: b.name, steps: bAvgSteps, mins: bAvgMins, penetration: bPenetration, color: colors[index % colors.length] };
      });
      // Ranking sorting is now handled dynamically in the render function based on leaderboardMetric
      setRankings(ranks);
    }

    // Clear AI summary when changing context
    setAiSummary('');

  }, [rawData, barangays, selectedBgy]);

  const penetrationRate = stats.targetPop > 0 ? ((stats.totalPolled / stats.targetPop) * 100).toFixed(2) : 0;

  const generateAISummary = async () => {
    setIsGeneratingAI(true);
    setAiSummary('');

    const apiKey = ""; // The execution environment provides the key at runtime
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const locationName = selectedBgy === 'ALL' ? 'Quezon City (City-Wide)' : barangays.find(b => b.id.toString() === selectedBgy)?.name || 'the selected area';

    const systemInstruction = `You are an Expert Public Health Policy Consultant for Quezon City LGUs. Write a professional executive summary in paragraph form. Analyze the provided physical activity data and provide actionable recommendations. Your primary objective is to help officials quickly understand the community's current baseline and propose strategies to motivate residents to achieve the target of 10,000 average daily steps and 150 minutes of weekly exercise. Provide your response entirely in cohesive paragraphs, without using bullet points, lists, or markdown formatting.`;

    const userQuery = `
      Location: ${locationName}
      Total Residents Polled: ${stats.totalPolled} (${penetrationRate}% of target population)
      Average Daily Steps: ${stats.avgSteps}
      Average Weekly Exercise: ${stats.avgExercise} minutes
      Sedentary Rate (< 5k steps/day): ${stats.sedentaryRate}%
    `;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    };

    const fetchWithBackoff = async (url, options, maxRetries = 5) => {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          const response = await fetch(url, options);
          if (!response.ok) throw new Error('HTTP error');
          return await response.json();
        } catch (error) {
          retries++;
          if (retries >= maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries - 1) * 1000));
        }
      }
    };

    try {
      const result = await fetchWithBackoff(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (result.candidates && result.candidates.length > 0) {
        setAiSummary(result.candidates[0].content.parts[0].text);
      } else {
        setAiSummary("Unable to generate summary at this time. Please try again.");
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      setAiSummary("Error connecting to the AI Policy Engine. Please verify connectivity and try again.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header & Controls */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#1E40AF] rounded-2xl flex items-center justify-center shadow-inner">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Researcher Hub</h1>
              <p className="text-slate-500 text-sm font-medium">SmartHealthIndex Analytics</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={selectedBgy}
                onChange={(e) => setSelectedBgy(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">City-Wide Overview</option>
                {barangays.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="bg-[#1E40AF] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-800 transition-colors shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> 
              {isLoading ? 'Syncing...' : 'Refresh'}
            </button>
          </div>
        </header>

        {/* Dynamic Context Banner */}
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <h2 className="text-lg font-bold text-slate-700">
            {selectedBgy === 'ALL' ? 'Showing Data for Entire Quezon City Pilot' : `Viewing Drill-Down: ${barangays.find(b=>b.id.toString()===selectedBgy)?.name}`}
          </h2>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard title="Avg Daily Steps" value={stats.avgSteps} unit="steps" icon={Activity} description="Community daily average" colorClass="bg-indigo-600" />
          <MetricCard title="Weekly Exercise" value={stats.avgExercise} unit="mins" icon={Clock} description="Intentional physical activity" colorClass="bg-teal-600" />
          <MetricCard title="Sedentary Rate" value={stats.sedentaryRate} unit="%" icon={AlertCircle} status={stats.sedentaryRate > 40 ? "Critical" : "Stable"} description="Residents < 5k steps daily" colorClass="bg-rose-600" />
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="p-3 rounded-xl bg-blue-100"><Users className="w-6 h-6 text-blue-600" /></div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">Census Penetration</h3>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-slate-900">{stats.totalPolled.toLocaleString()}</span>
                <span className="text-slate-500 text-sm font-semibold">polled</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                <span>{penetrationRate}% of Target Pop.</span>
                <span>{stats.targetPop.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(penetrationRate, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Drill-Down Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Demographics: Age Group */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold mb-6 text-slate-900 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-600"/> Demographic Distribution</h2>
            <div className="space-y-4">
              {ageData.map((item) => {
                const maxCount = Math.max(...ageData.map(d => d.count), 1);
                const percent = ((item.count / maxCount) * 100).toFixed(0);
                return (
                  <div key={item.age} className="space-y-1">
                    <div className="flex items-center gap-4">
                      <span className="w-16 text-sm font-bold text-slate-600 text-right">{item.age}</span>
                      <div className="flex-grow bg-slate-100 h-6 rounded-lg overflow-hidden flex items-center">
                        <div className="bg-indigo-500 h-full transition-all duration-1000 flex items-center justify-end px-2" style={{ width: `${percent}%` }}>
                          {item.count > 0 && <span className="text-[10px] font-bold text-white">{item.count}</span>}
                        </div>
                      </div>
                    </div>
                    {item.count > 0 && (
                      <div className="flex gap-4 pl-20 text-[10px] font-medium text-slate-500">
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-indigo-400"/> {item.avgSteps.toLocaleString()} steps</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-teal-400"/> {item.avgMins} mins</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 italic mt-6 text-center">Data helps identify if specific age cohorts lack wellness programming.</p>
          </div>

          {/* Equity: Source Inclusion */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold mb-6 text-slate-900 flex items-center gap-2"><PieChart className="w-5 h-5 text-teal-600"/> Data Source Inclusion</h2>
            <div className="grid grid-cols-1 gap-4">
              {sourceData.map((item) => {
                const total = sourceData.reduce((sum, d) => sum + d.count, 0) || 1;
                const percent = Math.round((item.count / total) * 100);
                
                let label = '';
                let icon = null;
                let color = '';
                
                if(item.source === 'STRAVA_API') { label = 'Gadget Integration'; icon = <Smartphone className="w-4 h-4"/>; color = 'bg-orange-500'; }
                if(item.source === 'WEB_PORTAL') { label = 'Resident Portal (Self)'; icon = <UserCheck className="w-4 h-4"/>; color = 'bg-teal-500'; }
                if(item.source === 'FIELD_AGENT') { label = 'Field Agent (Manual)'; icon = <ShieldCheck className="w-4 h-4"/>; color = 'bg-blue-600'; }

                return (
                  <div key={item.source} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg text-white ${color}`}>{icon}</div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{label}</p>
                        <p className="text-xs text-slate-500">{percent}% of baseline</p>
                      </div>
                    </div>
                    <div className="text-xl font-black text-slate-900">{item.count}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 italic mt-6 text-center">Ensures the "Digitally Disconnected" are represented in the census.</p>
          </div>

          {/* Barangay Rankings (Only visible on City-Wide Overview) */}
          {selectedBgy === 'ALL' && (
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm mt-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Map className="w-5 h-5 text-amber-500"/> City-Wide Leaderboard</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
                  <button 
                    onClick={() => setLeaderboardMetric('steps')} 
                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md transition-all ${leaderboardMetric === 'steps' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Steps
                  </button>
                  <button 
                    onClick={() => setLeaderboardMetric('exercise')} 
                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md transition-all ${leaderboardMetric === 'exercise' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Exercise
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                {[...rankings].sort((a, b) => leaderboardMetric === 'steps' ? b.steps - a.steps : b.mins - a.mins).map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between items-end text-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">{item.penetration}% of Pop. Polled</span>
                      </div>
                      <div className="text-right leading-tight flex flex-col">
                        <div className={`font-black text-indigo-600 transition-all duration-300 ${leaderboardMetric === 'steps' ? 'text-base order-1' : 'text-[10px] opacity-80 order-2'}`}>
                          {item.steps.toLocaleString()} steps
                        </div>
                        <div className={`font-black text-teal-600 transition-all duration-300 ${leaderboardMetric === 'exercise' ? 'text-base order-1' : 'text-[10px] opacity-80 order-2'}`}>
                          {item.mins} mins exercise
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`w-full bg-slate-100 rounded-full overflow-hidden transition-all duration-300 ${leaderboardMetric === 'steps' ? 'h-2 order-1 opacity-100' : 'h-1.5 order-2 opacity-80'}`}>
                        <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min((item.steps / 10000) * 100, 100)}%` }} />
                      </div>
                      <div className={`w-full bg-slate-100 rounded-full overflow-hidden transition-all duration-300 ${leaderboardMetric === 'exercise' ? 'h-2 order-1 opacity-100' : 'h-1.5 order-2 opacity-80'}`}>
                        <div className="bg-teal-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min((item.mins / 150) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Executive Summary (Visible on Drill-Down and City-Wide) */}
          <div className="lg:col-span-2 bg-[#1E40AF] rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between relative overflow-hidden mt-4">
            <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp className="w-48 h-48" /></div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="text-2xl">✨</span> AI Executive Summary & Recommendations</h3>
              
              <div className="bg-blue-900/50 p-6 rounded-2xl border border-blue-800/50 min-h-[160px]">
                {isGeneratingAI ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-3 py-6 text-blue-200">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-bold animate-pulse">Analyzing health data and synthesizing policy recommendations...</p>
                  </div>
                ) : aiSummary ? (
                  <p className="text-blue-50 leading-relaxed text-sm whitespace-pre-wrap">
                    {aiSummary}
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full space-y-2 py-6 text-blue-200">
                    <p className="text-sm text-center max-w-lg">
                      Ready to synthesize data for <strong>{selectedBgy === 'ALL' ? 'Quezon City (City-Wide)' : barangays.find(b=>b.id.toString()===selectedBgy)?.name}</strong>. 
                      Click below to generate a narrative analysis and tailored recommendations to help hit the 10,000 steps and 150 mins/week targets.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={generateAISummary}
              disabled={isGeneratingAI || stats.totalPolled === 0}
              className="mt-6 w-fit px-8 py-3 bg-white text-[#1E40AF] font-bold rounded-xl hover:bg-blue-50 transition-colors relative z-10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              {isGeneratingAI ? 'Generating...' : 'Generate AI Executive Summary'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}