import { useState } from 'react';
import WorkoutLogger from './components/WorkoutLogger';
import CalendarView from './components/CalendarView';
import SchedulePlanner from './components/SchedulePlanner';
import ExerciseDictionary from './components/ExerciseDictionary';
import { Dumbbell, Calendar, CalendarClock, BookOpen } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'workout' | 'calendar' | 'plan' | 'exercises'>('workout');

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 antialiased selection:bg-orange-500 selection:text-white">
      {/* ヘッダー */}
      <header className="border-b border-zinc-200 bg-white/85 backdrop-blur sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-tr from-orange-500 to-amber-500 p-1.5 rounded-lg text-white shadow-lg shadow-orange-500/25">
              <Dumbbell className="w-5 h-5" />
            </div>
            <h1 className="font-black text-lg tracking-wide bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent">
              GymLog
            </h1>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-mono">
            大宮東口
          </span>
        </div>
      </header>

      {/* メインコンテンツエリア */}
      <main className="max-w-md mx-auto px-4 pt-4">
        {activeTab === 'workout' && <WorkoutLogger onWorkoutSaved={() => setActiveTab('calendar')} />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'plan' && <SchedulePlanner />}
        {activeTab === 'exercises' && <ExerciseDictionary />}
      </main>

      {/* フッター ナビゲーションバー */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/85 backdrop-blur border-t border-zinc-200">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16">
          <button
            type="button"
            onClick={() => setActiveTab('workout')}
            className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
              activeTab === 'workout' ? 'text-orange-600 font-bold' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-[10px]">記録</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
              activeTab === 'calendar' ? 'text-orange-600 font-bold' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">カレンダー</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
              activeTab === 'plan' ? 'text-orange-600 font-bold' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <CalendarClock className="w-5 h-5" />
            <span className="text-[10px]">予定</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('exercises')}
            className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer ${
              activeTab === 'exercises' ? 'text-orange-600 font-bold' : 'text-zinc-600 hover:text-zinc-900'
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