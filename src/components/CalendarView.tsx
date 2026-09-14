import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Workout, MuscleCategory } from '../types/database';
import { CATEGORY_MAP } from '../types/database';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Sparkles,
  X,
  Trash2,
  Pencil,
  Save,
  Plus
} from 'lucide-react';

interface EditSet {
  id: string;
  exercise_id: string;
  set_number: number;
  weight: string;
  reps: string;
  is_deleted: boolean;
  is_new: boolean;
}

export const CalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateWorkouts, setSelectedDateWorkouts] = useState<any[]>([]);

  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingSets, setEditingSets] = useState<EditSet[]>([]);

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
    const initialSets = workout.sets.map((s: any) => ({
      id: s.id,
      exercise_id: s.exercise_id,
      set_number: s.set_number,
      weight: s.weight_kg.toString(),
      reps: s.reps.toString(),
      is_deleted: false,
      is_new: false,
    }));
    setEditingSets(initialSets);
    setEditingWorkoutId(workout.id);
  };

  const handleCancelEdit = () => {
    setEditingWorkoutId(null);
    setEditingSets([]);
  };

  const handleAddEditSet = (exerciseId: string) => {
    setEditingSets(prev => {
      const exSets = prev.filter(s => s.exercise_id === exerciseId && !s.is_deleted);
      const lastSet = exSets.length > 0 ? exSets[exSets.length - 1] : null;

      return [...prev, {
        id: `temp_${Date.now()}`,
        exercise_id: exerciseId,
        set_number: 999,
        weight: lastSet ? lastSet.weight : '',
        reps: lastSet ? lastSet.reps : '',
        is_deleted: false,
        is_new: true,
      }];
    });
  };

  const handleRemoveEditSet = (setId: string) => {
    setEditingSets(prev => prev.map(s => s.id === setId ? { ...s, is_deleted: true } : s));
  };

  const handleSetChange = (setId: string, field: 'weight' | 'reps', value: string) => {
    setEditingSets(prev => prev.map(s => s.id === setId ? { ...s, [field]: value } : s));
  };

  const handleSaveEdit = async () => {
    const exGroups: Record<string, EditSet[]> = {};
    editingSets.filter(s => !s.is_deleted).forEach(s => {
      if (!exGroups[s.exercise_id]) exGroups[s.exercise_id] = [];
      exGroups[s.exercise_id].push(s);
    });
    
    Object.values(exGroups).forEach(sets => {
      sets.forEach((s, i) => {
        s.set_number = i + 1;
      });
    });

    const promises = editingSets.map(async (s) => {
      if (s.is_deleted && !s.is_new) {
        return supabase.from('workout_sets').delete().eq('id', s.id);
      } else if (s.is_new && !s.is_deleted) {
        return supabase.from('workout_sets').insert({
          workout_id: editingWorkoutId,
          exercise_id: s.exercise_id,
          set_number: s.set_number,
          weight_kg: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          is_completed: true
        });
      } else if (!s.is_deleted && !s.is_new) {
        return supabase.from('workout_sets').update({
          weight_kg: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          set_number: s.set_number
        }).eq('id', s.id);
      }
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
                          exerciseGroups.set(exName, { category: exCat, exercise_id: s.exercise_id, sets: [] });
                        }
                        exerciseGroups.get(exName).sets.push(s);
                      });

                      return Array.from(exerciseGroups.entries()).map(([exName, group], exIdx) => {
                        const setsToRender = isEditing 
                          ? editingSets.filter(s => s.exercise_id === group.exercise_id && !s.is_deleted)
                          : group.sets;

                        return (
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

                            <div className="space-y-1.5 mt-2">
                              {setsToRender.map((s: any, sIdx: number) => {
                                if (isEditing) {
                                  return (
                                    <div key={s.id} className="flex items-center justify-between bg-slate-950 rounded-lg px-3 py-2 border border-cyan-700/50 shadow-inner">
                                      <span className="text-xs font-mono font-bold text-cyan-600 w-6">#{sIdx + 1}</span>
                                      
                                      <div className="flex flex-1 items-center space-x-3 ml-2">
                                        <div className="flex items-center space-x-1">
                                          <input 
                                            type="number" 
                                            step="0.5"
                                            value={s.weight}
                                            onChange={(e) => handleSetChange(s.id, 'weight', e.target.value)}
                                            className="w-14 bg-slate-900 border border-slate-700 text-center rounded-md py-1 text-sm font-bold text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                                            placeholder="0"
                                          />
                                          <span className="text-[10px] text-slate-500">kg</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <input 
                                            type="number" 
                                            value={s.reps}
                                            onChange={(e) => handleSetChange(s.id, 'reps', e.target.value)}
                                            className="w-12 bg-slate-900 border border-slate-700 text-center rounded-md py-1 text-sm font-bold text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                                            placeholder="0"
                                          />
                                          <span className="text-[10px] text-slate-500">回</span>
                                        </div>
                                      </div>

                                      <button 
                                        onClick={() => handleRemoveEditSet(s.id)}
                                        className="p-1.5 bg-red-950/30 border border-red-900/50 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded-md transition"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
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
                            
                            {isEditing && (
                              <button
                                onClick={() => handleAddEditSet(group.exercise_id)}
                                className="w-full mt-2 py-1.5 border border-dashed border-cyan-700/50 rounded-lg text-cyan-500 flex items-center justify-center hover:bg-cyan-900/30 transition"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}

                          </div>
                        );
                      });
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