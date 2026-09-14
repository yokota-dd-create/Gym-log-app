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
  X,
  Trash2,
  Pencil,
  Save
} from 'lucide-react';

export const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateWorkouts, setSelectedDateWorkouts] = useState<any[]>([]);

  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, {weight: string, reps: string}>>({});

  const [cycle, setCycle] = useState<'3' | '5'>('5');
  const todayDayOfWeek = new Date().getDay();

  const RECOMMENDED_ROUTINES: Record<string, Record<number, MuscleCategory[]>> = {
    '3': {
      1: ['chest', 'shoulders'],
      3: ['back', 'arms'],      
      5: ['legs', 'core'],      
    },
    '5': {
      1: ['chest'],             
      2: ['back', 'core'],      
      3: ['legs'],              
      5: ['shoulders', 'core'], 
      6: ['arms'],              
    }
  };
  const recommendedCategories = RECOMMENDED_ROUTINES[cycle][todayDayOfWeek] || [];

  useEffect(() => {
    fetchWorkouts();
  }, [currentDate]);

  const fetchWorkouts = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
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

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!window.confirm('この記録を完全に削除しますか？')) return;
    
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId);
      
    if (!error) {
      setWorkouts(prev => prev.filter(w => w.id !== workoutId));
      setSelectedDateWorkouts(prev => prev.filter(w => w.id !== workoutId));
    } else {
      alert('削除に失敗しました: ' + error.message);
    }
  };

  const handleStartEdit = (workout: any) => {
    const initialState: Record<string, {weight: string, reps: string}> = {};
    workout.sets.forEach((s: any) => {
      initialState[s.id] = { 
        weight: s.weight_kg.toString(), 
        reps: s.reps.toString() 
      };
    });
    setEditState(initialState);
    setEditingWorkoutId(workout.id);
  };

  const handleCancelEdit = () => {
    setEditingWorkoutId(null);
    setEditState({});
  };

  const handleSetChange = (setId: string, field: 'weight' | 'reps', value: string) => {
    setEditState(prev => ({
      ...prev,
      [setId]: { ...prev[setId], [field]: value }
    }));
  };

  const handleSaveEdit = async () => {
    const promises = Object.entries(editState).map(([setId, vals]) => {
      return supabase
        .from('workout_sets')
        .update({
          weight_kg: Number(vals.weight) || 0,
          reps: Number(vals.reps) || 0
        })
        .eq('id', setId);
    });

    await Promise.all(promises);

    if (selectedDate) {
      handleDateClick(selectedDate.getDate());
    }
    setEditingWorkoutId(null);
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
    setEditingWorkoutId(null);
    
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
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-14 bg-slate-900/20 rounded-lg"></div>);
    }

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
                    cat === 'chest' ? 'bg-rose-400' :
                    cat === 'back' ? 'bg-blue-400' :
                    cat === 'legs' ? 'bg-emerald-400' :
                    cat === 'shoulders' ? 'bg-amber-400' :
                    cat === 'arms' ? 'bg-purple-400' : 
                    cat === 'core' ? 'bg-cyan-400' : 'bg-slate-400'
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
            onClick={() => {
              setSelectedDate(null);
              setEditingWorkoutId(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {selectedDateWorkouts.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">この日の記録はありません</p>
        ) : (
          <div className="space-y-4">
            {selectedDateWorkouts.map((workout, wIdx) => {
              const isEditing = editingWorkoutId === workout.id;
              
              return (
                <div key={wIdx} className={`bg-slate-800/50 rounded-xl p-3 border transition ${isEditing ? 'border-cyan-500/50 shadow-lg shadow-cyan-900/20' : 'border-slate-700/50'}`}>
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
                        <div key={exIdx} className={`${exIdx > 0 ? 'border-t border-slate-700/50 pt-3 mt-3' : ''}`}>
                          
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2 flex-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${CATEGORY_MAP[group.category as MuscleCategory]?.badgeClass}`}>
                                {CATEGORY_MAP[group.category as MuscleCategory]?.label || group.category}
                              </span>
                              <span className="text-xs font-bold text-slate-200 leading-tight">{exName}</span>
                            </div>

                            {exIdx === 0 && (
                              <div className="flex items-center space-x-2 text-[10px] font-medium ml-2 shrink-0">
                                {!isEditing && (
                                  <>
                                    <div className="flex items-center space-x-1 text-orange-400">
                                      <Flame className="w-3.5 h-3.5" />
                                      <span>約 {workout.estimated_calories} kcal</span>
                                    </div>
                                    <div className="flex items-center space-x-1 text-slate-400">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>{workout.duration_minutes} 分</span>
                                    </div>
                                  </>
                                )}
                                
                                {isEditing ? (
                                  <>
                                    <button 
                                      onClick={handleSaveEdit}
                                      className="p-1.5 ml-1 text-emerald-400 hover:text-emerald-300 transition bg-emerald-900/30 rounded-md border border-emerald-700/50"
                                      title="保存"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={handleCancelEdit}
                                      className="p-1.5 ml-1 text-slate-400 hover:text-slate-300 transition bg-slate-900/50 rounded-md border border-slate-700/50"
                                      title="キャンセル"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => handleStartEdit(workout)}
                                      className="p-1.5 ml-1 text-cyan-400 hover:text-cyan-300 transition bg-cyan-900/30 rounded-md border border-cyan-700/50"
                                      title="編集"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteWorkout(workout.id)}
                                      className="p-1.5 ml-1 text-slate-500 hover:text-red-400 transition bg-slate-900/50 rounded-md border border-slate-700/50"
                                      title="削除"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ★ 横並びから、1行ずつの縦並びリストに変更 */}
                          <div className="space-y-1.5 mt-2">
                            {group.sets.map((s: any, sIdx: number) => {
                              if (isEditing) {
                                const eState = editState[s.id] || { weight: '', reps: '' };
                                return (
                                  <div key={sIdx} className="flex items-center justify-between bg-slate-950 rounded-lg px-3 py-2 border border-cyan-700/50 shadow-inner">
                                    <span className="text-xs font-mono font-bold text-cyan-600 w-8">#{sIdx + 1}</span>
                                    <div className="flex items-center space-x-1">
                                      <input 
                                        type="number" 
                                        step="0.5"
                                        value={eState.weight}
                                        onChange={(e) => handleSetChange(s.id, 'weight', e.target.value)}
                                        className="w-16 bg-slate-900 border border-slate-700 text-center rounded-md py-1 text-sm font-bold text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                                        placeholder="0"
                                      />
                                      <span className="text-[10px] text-slate-500 w-4">kg</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <input 
                                        type="number" 
                                        value={eState.reps}
                                        onChange={(e) => handleSetChange(s.id, 'reps', e.target.value)}
                                        className="w-16 bg-slate-900 border border-slate-700 text-center rounded-md py-1 text-sm font-bold text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                                        placeholder="0"
                                      />
                                      <span className="text-[10px] text-slate-500 w-4">回</span>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <div key={sIdx} className="flex items-center justify-between bg-slate-900/60 rounded-lg px-4 py-2 border border-slate-800/80">
                                  <span className="text-xs font-mono font-bold text-slate-500 w-8">#{sIdx + 1}</span>
                                  <div className="flex items-baseline space-x-1 w-20 justify-end">
                                    <span className="text-sm font-bold text-slate-200">{s.weight_kg}</span>
                                    <span className="text-[10px] text-slate-500">kg</span>
                                  </div>
                                  <div className="flex items-baseline space-x-1 w-20 justify-end">
                                    <span className="text-sm font-bold text-slate-200">{s.reps}</span>
                                    <span className="text-[10px] text-slate-500">回</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-24">
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