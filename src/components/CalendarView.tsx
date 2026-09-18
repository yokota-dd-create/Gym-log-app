import { useState, useEffect, useMemo } from 'react';
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

  const [frequency, setFrequency] = useState<'2' | '3' | '4' | '5' | '5b' | '6' | '6b'>(() => {
    return (localStorage.getItem('gymlog_frequency') as any) || '5';
  });

  useEffect(() => {
    fetchWorkouts();
  }, [currentDate]);

  const fetchWorkouts = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    const startDate = new Date(year, month - 1, 1);
    startDate.setDate(startDate.getDate() - 14);
    
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .gte('workout_date', startDate.toISOString())
      .lte('workout_date', endDate.toISOString());

    if (error) {
      console.error('Failed to load workouts:', error);
      return;
    }
    setWorkouts(data || []);
  };

  const recommendedCategories = useMemo(() => {
    const lastTrained: Record<string, number> = {
      chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0
    };

    const targetDateObj = new Date();
    targetDateObj.setHours(0,0,0,0);
    const targetTime = targetDateObj.getTime();

    workouts.forEach(w => {
      if (!w.workout_date) return;
      const wDate = new Date(w.workout_date).setHours(0,0,0,0);
      
      // ★ 当日の記録はおすすめ計算から除外し、記録直後に表示が切り替わるのを防ぐ
      if (wDate < targetTime) {
        w.target_categories?.forEach(cat => {
          if (wDate > lastTrained[cat]) {
            lastTrained[cat] = wDate;
          }
        });
      }
    });

    const SPLITS: Record<string, MuscleCategory[][]> = {
      '2': [['chest', 'shoulders', 'arms'], ['back', 'legs', 'core']],
      '3': [['chest', 'shoulders'], ['back', 'arms'], ['legs', 'core']],
      '4': [['chest', 'arms'], ['back', 'core'], ['legs'], ['shoulders']],
      '5': [['chest'], ['back'], ['legs'], ['shoulders'], ['arms']],
      '5b': [['chest', 'shoulders', 'arms'], ['back', 'arms'], ['legs'], ['chest', 'back', 'shoulders', 'arms'], ['legs', 'core']],
      '6': [['chest', 'shoulders'], ['back', 'arms'], ['legs']],
      '6b': [['chest'], ['back'], ['legs'], ['shoulders'], ['arms'], ['core']]
    };

    const groups = SPLITS[frequency] || SPLITS['5'];
    let bestGroup: MuscleCategory[] = [];
    let maxDaysSince = -1;

    groups.forEach(group => {
      const groupLastTrained = Math.max(...group.map(m => lastTrained[m] || 0));
      const daysSince = groupLastTrained === 0 ? 999 : (targetTime - groupLastTrained) / (1000 * 60 * 60 * 24);
      
      if (daysSince > maxDaysSince) {
        maxDaysSince = daysSince;
        bestGroup = group;
      }
    });

    return maxDaysSince <= 0 ? [] : bestGroup;
  }, [workouts, frequency]);

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

    const activeSets = editingSets.filter(s => !s.is_deleted);
    const totalWeightVolume = activeSets.reduce((sum, s) => sum + (Number(s.weight) * Number(s.reps)), 0);
    const completedSetsCount = activeSets.length;
    const newCalories = Math.round((completedSetsCount * 12) + (totalWeightVolume * 0.015));

    await supabase
      .from('workouts')
      .update({ estimated_calories: newCalories })
      .eq('id', editingWorkoutId);

    await fetchWorkouts();

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
      days.push(<div key={`empty-${i}`} className="h-14 bg-zinc-100 rounded-lg"></div>);
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
              ? 'bg-orange-50 border-orange-300' 
              : hasWorkout 
                ? 'bg-white border-zinc-200 hover:border-zinc-200' 
                : 'bg-zinc-100 border-zinc-200 hover:border-zinc-200'
          }`}
        >
          <span className={`text-xs font-bold ${
            isToday ? 'text-amber-600' : hasWorkout ? 'text-zinc-900' : 'text-zinc-500'
          }`}>
            {day}
          </span>
          {hasWorkout && (
            <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
              {Array.from(new Set(dayWorkouts.flatMap(w => w.target_categories))).slice(0, 3).map((cat, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full ${
                    cat === 'chest' ? 'bg-rose-500' :
                    cat === 'back' ? 'bg-blue-500' :
                    cat === 'legs' ? 'bg-emerald-500' :
                    cat === 'shoulders' ? 'bg-amber-500' :
                    cat === 'arms' ? 'bg-purple-500' : 
                    cat === 'core' ? 'bg-cyan-500' : 'bg-zinc-400'
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
      <div className="mt-4 bg-white rounded-2xl border border-zinc-200 p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4 border-b border-zinc-200 pb-3">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center">
            <CalendarIcon className="w-4 h-4 mr-2 text-orange-600" />
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日の記録
          </h3>
          <button 
            onClick={() => {
              setSelectedDate(null);
              setEditingWorkoutId(null);
            }}
            className="p-1 text-zinc-600 hover:text-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {selectedDateWorkouts.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">この日の記録はありません</p>
        ) : (
          <div className="space-y-4">
            {selectedDateWorkouts.map((workout, wIdx) => {
              const isEditing = editingWorkoutId === workout.id;
              
              return (
                <div key={wIdx} className={`bg-zinc-100 rounded-xl p-3 border transition ${isEditing ? 'border-orange-300 shadow-lg shadow-orange-500/25' : 'border-zinc-200'}`}>
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
                          <div key={exIdx} className={`${exIdx > 0 ? 'border-t border-zinc-200 pt-3 mt-3' : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center space-x-2 flex-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${CATEGORY_MAP[group.category as MuscleCategory]?.badgeClass}`}>
                                  {CATEGORY_MAP[group.category as MuscleCategory]?.label || group.category}
                                </span>
                                <span className="text-xs font-bold text-zinc-900 leading-tight">{exName}</span>
                              </div>

                              {exIdx === 0 && (
                                <div className="flex items-center space-x-2 text-[10px] font-medium ml-2 shrink-0">
                                  {isEditing ? (
                                    <>
                                      <button 
                                        onClick={handleSaveEdit}
                                        className="p-1.5 ml-1 text-emerald-600 hover:text-emerald-600 transition bg-emerald-50 rounded-md border border-emerald-300"
                                        title="保存"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={handleCancelEdit}
                                        className="p-1.5 ml-1 text-zinc-600 hover:text-zinc-800 transition bg-zinc-100 rounded-md border border-zinc-200"
                                        title="キャンセル"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => handleStartEdit(workout)}
                                        className="p-1.5 ml-1 text-orange-600 hover:text-orange-600 transition bg-orange-50 rounded-md border border-orange-300"
                                        title="編集"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteWorkout(workout.id)}
                                        className="p-1.5 ml-1 text-zinc-500 hover:text-red-600 transition bg-zinc-100 rounded-md border border-zinc-200"
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
                                const rowKey = isEditing ? s.id : sIdx;
                                const baseRowClasses = "flex items-center justify-between rounded-lg px-3 py-1.5 border transition-colors";
                                const modeClasses = isEditing 
                                  ? "bg-zinc-100 border-orange-300 shadow-inner" 
                                  : "bg-zinc-100 border-zinc-200";

                                return (
                                  <div key={rowKey} className={`${baseRowClasses} ${modeClasses}`}>
                                    <div className="w-8 flex-shrink-0">
                                      <span className={`text-xs font-mono font-bold ${isEditing ? 'text-orange-600' : 'text-zinc-500'}`}>
                                        #{sIdx + 1}
                                      </span>
                                    </div>
                                    
                                    <div className="flex flex-1 items-center justify-center space-x-6">
                                      <div className="flex items-center justify-end w-20">
                                        {isEditing ? (
                                          <input 
                                            type="number" step="0.5" value={s.weight}
                                            onChange={(e) => handleSetChange(s.id, 'weight', e.target.value)}
                                            className="w-14 bg-zinc-100 border border-zinc-200 text-right rounded-md py-1 px-2 text-sm font-bold text-zinc-900 focus:outline-none focus:border-orange-500 placeholder-zinc-400"
                                            placeholder="0"
                                          />
                                        ) : (
                                          <span className="w-14 text-right py-1 px-2 text-sm font-bold text-zinc-900">
                                            {s.weight_kg}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-zinc-500 font-medium ml-1.5 w-4">kg</span>
                                      </div>

                                      <div className="flex items-center justify-end w-16">
                                        {isEditing ? (
                                          <input 
                                            type="number" value={s.reps}
                                            onChange={(e) => handleSetChange(s.id, 'reps', e.target.value)}
                                            className="w-12 bg-zinc-100 border border-zinc-200 text-right rounded-md py-1 px-2 text-sm font-bold text-zinc-900 focus:outline-none focus:border-orange-500 placeholder-zinc-400"
                                            placeholder="0"
                                          />
                                        ) : (
                                          <span className="w-12 text-right py-1 px-2 text-sm font-bold text-zinc-900">
                                            {s.reps}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-zinc-500 font-medium ml-1.5 w-4">回</span>
                                      </div>
                                    </div>

                                    <div className="w-8 flex-shrink-0 flex justify-end">
                                      {isEditing && (
                                        <button 
                                          onClick={() => handleRemoveEditSet(s.id)}
                                          className="p-1.5 bg-red-50 border border-red-300 text-red-600 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {isEditing && (
                              <button
                                onClick={() => handleAddEditSet(group.exercise_id)}
                                className="w-full mt-2 py-1.5 border border-dashed border-orange-300 rounded-lg text-orange-500 flex items-center justify-center hover:bg-orange-50 transition cursor-pointer"
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
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-zinc-900 flex items-center">
            <Sparkles className="w-4 h-4 text-amber-600 mr-1.5" />
            今日のおすすめ部位
          </h3>
          <select
            value={frequency}
            onChange={(e) => {
              setFrequency(e.target.value as any);
              localStorage.setItem('gymlog_frequency', e.target.value);
              // logger側にも即座に反映させるためのイベント
              window.dispatchEvent(new Event('storage'));
            }}
            className="bg-zinc-100 text-xs font-bold text-zinc-800 rounded-lg border border-zinc-200 px-3 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="2">週2回 (二分割)</option>
            <option value="3">週3回 (PPL)</option>
            <option value="4">週4回 (四分割)</option>
            <option value="5">週5回 (ブロスプリット)</option>
            <option value="5b">週5回 (PPL+上下・全部位週2頻度)</option>
            <option value="6">週6回 (高頻度PPL・上級者向け)</option>
            <option value="6b">週6回 (6分割・中級者向け)</option>
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
            <span className="text-xs text-zinc-600 font-medium bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
              今日はオフレスト（お休み）推奨日 🍵
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-zinc-900">
            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
          </h2>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-800 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['日', '月', '火', '水', '木', '金', '土'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-zinc-500 py-1">
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