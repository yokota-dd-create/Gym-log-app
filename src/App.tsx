import React, { useState } from 'react';
import WorkoutLogger from './components/WorkoutLogger';
import CalendarView from './components/CalendarView';
import ExerciseDictionary from './components/ExerciseDictionary';
import { Dumbbell, Calendar, BookOpen } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'workout' | 'calendar' | 'exercises'>('workout');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
      {/* ヘッダー */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-1.5 rounded-lg text-white">
              <Dumbbell className="w-5 h-5" />
            </div>
            <h1 className="font-black text-lg tracking-wide bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
              GymLog
            </h1>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-mono">
            大宮東口
          </span>
        </div>
      </header>

      {/* メインコンテンツエリア */}
      <main className="max-w-md mx-auto px-4 pt-4">
        {activeTab === 'workout' && <WorkoutLogger onWorkoutSaved={() => setActiveTab('calendar')} />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'exercises' && <ExerciseDictionary />}
      </main>

      {/* フッター ナビゲーションバー */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur border-t border-slate-800">
        <div className="max-w-md mx-auto grid grid-cols-3 h-16">
          <button
            type="button"
            onClick={() => setActiveTab('workout')}
            className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
              activeTab === 'workout' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-[10px]">記録</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
              activeTab === 'calendar' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">カレンダー</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exercises')}
            className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
              activeTab === 'exercises' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px]">種目図鑑</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;