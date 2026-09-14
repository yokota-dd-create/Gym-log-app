import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Workout, MuscleCategory } from '../types/database';
import { CATEGORY_MAP } from '../types/database';
import { 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  Calendar as CalendarIcon, 
  Sparkles,
  Clock,
  X
} from 'lucide-react';

export const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateWorkouts, setSelectedDateWorkouts] = useState<any[]>([]);

  // ★ おすすめメニュー用のステートと設定
  const [cycle, setCycle] = useState<'3' | '5'>('5');
  const todayDayOfWeek = new Date().getDay(); // 0:日, 1:月, 2:火, 3:水, 4:木, 5:金, 6:土

  const RECOMMENDED_ROUTINES: Record<string, Record<number, MuscleCategory[]>> = {
    '3': {
      1: ['chest', 'shoulders'], // 月
      3: ['back', 'arms'],       // 水
      5: ['legs', 'core'],       // 金
    },
    '5': {
      1: ['chest'],              // 月
      2: ['back', 'core'],       // 火
      3: ['legs'],               // 水
      5: ['shoulders', 'core'],  // 金
      6: ['arms'],               // 土
    }
  };
  const recommendedCategories = RECOMMENDED_ROUTINES[cycle][todayDayOfWeek] || [];

  useEffect(() => {
    fetchWorkouts();
  }, [currentDate]);

  const fetchWorkouts = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    // 月の最初と最後の日を計算
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .gte('workout_date', startDate)
      .lte('workout_date', endDate);

    if (error) {
      console.error('Failed to load workouts:', error);
      return;
    }
    setWorkouts(data || []);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = async (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const year = clickedDate.getFullYear();
    const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(clickedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;

    const dateWorkouts = workouts.filter(w => {
      if (!w.workout_date) return false;
      return w.workout_date.startsWith(dateStr);
    });

    setSelectedDate(clickedDate);
    
    if (dateWorkouts.length > 0) {
      const workoutIds = dateWorkouts.map(w => w.id);
      const { data: setsData, error } = await supabase
        .from('workout_sets')
        .select(`
          *,
          exercises (
            name,
            category
          )
        `)
        .in('workout_id', workoutIds);

      if (!error && setsData) {
        const detailedWorkouts = dateWorkouts.map(w => ({
          ...w,
          sets: setsData.filter(s => s.workout_id === w.id)
        }));
        setSelectedDateWorkouts(detailedWorkouts);
      } else {
        setSelectedDateWorkouts(dateWorkouts.map(w => ({ ...w, sets: [] })));
      }
    } else {
      setSelectedDateWorkouts([]);
    }
  };

  const renderCalendar = () => {
    const days = [];
    const today = new Date();
    
    // 空白セル
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 bg-slate-900/20 rounded-lg"></div>);
    }

    // 日付セル
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dayStr}`;

      const dayWorkouts = workouts.filter(w => w.workout_date && w.workout_date.startsWith(dateStr));
      const hasWorkout = dayWorkouts.length > 0;
      
      const isToday = 
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
        
      const isSelected = selectedDate &&
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear();

      days.push(
        <div
          key={`day-${day}`}
          onClick={() => handleDateClick(day)}
          className={`h-14 relative p-1 rounded-lg border transition cursor-pointer flex flex-col items-center justify-start ${
            isSelected 
              ? 'bg-cyan-950/40 border-cyan-500/50' 
              : hasWorkout 
                ? 'bg-slate-800/80 border-slate-700 hover:border-slate-500' 
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className={`text-xs font-bold ${
            isToday ? 'text-amber-400' : hasWorkout ? 'text-slate-200' : 'text-slate-500'
          }`}>
            {day}
          </span>
          {hasWorkout && (
            <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
              {Array.from(new Set(dayWorkouts.flatMap(w => w.target_categories))).slice(0, 3).map((cat, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full ${
                    cat === 'chest' ? 'bg-blue-400' :
                    cat === 'back' ? 'bg-emerald-400' :
                    cat === 'legs' ? 'bg-purple-400' :
                    cat === 'shoulders' ? 'bg-amber-400' :
                    cat === 'arms' ? 'bg-rose-400' : 'bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  const renderWorkoutDetails = () => {
    if (!selectedDate) return null;
    
    return (
      <div className="mt-4 bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center">
            <CalendarIcon className="w-4 h-4 mr-2 text-cyan-400" />
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日の記録
          </h3>
          <button 
            onClick={() => setSelectedDate(null)}
            className="p-1 text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {selectedDateWorkouts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">この日の記録はありません</p>
        ) : (
          <div className="space-y-4">
            {selectedDateWorkouts.map((workout, wIdx) => (
              <div key={wIdx} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                <div className="flex items-center space-x-4 text-xs font-medium mb-3">
                  <div className="flex items-center space-x-1 text-orange-400">
                    <Flame className="w-3.5 h-3.5" />
                    <span>約 {workout.estimated_calories} kcal</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{workout.duration_minutes} 分</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const exerciseGroups = new Map();
                    workout.sets?.forEach((s: any) => {
                      if (!s.exercises) return;
                      const exName = s.exercises.name;
                      const exCat = s.exercises.category;
                      if (!exerciseGroups.has(exName)) {
                        exerciseGroups.set(exName, { category: exCat, sets: [] });
                      }
                      exerciseGroups.get(exName).sets.push(s);
                    });

                    return Array.from(exerciseGroups.entries()).map(([exName, group], exIdx) => (
                      <div key={exIdx} className="border-t border-slate-700/50 pt-2">
                        <div className="flex items-center space-x-2 mb-1.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${CATEGORY_MAP[group.category as MuscleCategory]?.badgeClass}`}>
                            {CATEGORY_MAP[group.category as MuscleCategory]?.label || group.category}
                          </span>
                          <span className="text-xs font-bold text-slate-200">{exName}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.sets.map((s: any, sIdx: number) => (
                            <div key={sIdx} className="bg-slate-900 rounded px-1.5 py-0.5 text-[10px] text-slate-400 border border-slate-800">
                              <span className="text-slate-300 font-bold">{s.weight_kg}</span>kg × <span className="text-slate-300 font-bold">{s.reps}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* ★ おすすめメニュー表示エリア */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center">
            <Sparkles className="w-4 h-4 text-amber-400 mr-1.5" />
            今日のおすすめ部位
          </h3>
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value as '3' | '5')}
            className="bg-slate-800 text-xs font-bold text-slate-300 rounded-lg border border-slate-700 px-3 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="3">週3回コース</option>
            <option value="5">週5回コース</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {recommendedCategories.length > 0 ? (
            recommendedCategories.map((cat) => (
              <span
                key={cat}
                className={`text-xs px-2.5 py-1 rounded-full border font-bold ${CATEGORY_MAP[cat].badgeClass}`}
              >
                {CATEGORY_MAP[cat].label}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 font-medium bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              今日はオフレスト（お休み）推奨日 🍵
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-slate-100">
            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
          </h2>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['日', '月', '火', '水', '木', '金', '土'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-slate-500 py-1">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {renderCalendar()}
        </div>
      </div>

      {renderWorkoutDetails()}
    </div>
  );
};

export default CalendarView;