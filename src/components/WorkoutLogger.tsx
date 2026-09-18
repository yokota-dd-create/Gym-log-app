import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { Exercise, MuscleCategory, Workout } from '../types/database';
import { CATEGORY_MAP } from '../types/database';
import {
  Dumbbell,
  Lightbulb,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Save,
  Calendar,
  X,
  Sparkles
} from 'lucide-react';

interface LocalWorkoutSet {
  exercise_id: string;
  set_number: number;
  weight_kg: number | string;
  reps: number | string;
  is_completed: boolean;
}

interface ActiveExerciseItem {
  exercise: Exercise;
  sets: LocalWorkoutSet[];
  userNote: string;
  isNoteOpen: boolean;
}

export const WorkoutLogger: React.FC<{ onWorkoutSaved?: () => void }> = ({ onWorkoutSaved }) => {
  const [exercisesMaster, setExercisesMaster] = useState<Exercise[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MuscleCategory | 'all'>('all');
  const [activeExercises, setActiveExercises] = useState<ActiveExerciseItem[]>([]);
  const [workoutDate, setWorkoutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [startTime] = useState<Date>(new Date());
  const [saving, setSaving] = useState<boolean>(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // ★ おすすめ機能のための履歴と設定
  const [workoutsHistory, setWorkoutsHistory] = useState<Workout[]>([]);
  const [frequency, setFrequency] = useState<'2' | '3' | '4' | '5' | '5b' | '6' | '6b'>(() => {
    return (localStorage.getItem('gymlog_frequency') as any) || '5';
  });

  useEffect(() => {
    fetchExercises();
    fetchWorkoutsHistory();
    
    // カレンダー側で頻度が変更された時の同期
    const handleStorage = () => {
      const f = localStorage.getItem('gymlog_frequency');
      if (f) setFrequency(f as any);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const fetchExercises = async () => {
    const { data: exData, error: exErr } = await supabase
      .from('exercises')
      .select('*')
      .order('category', { ascending: true });

    const { data: notesData } = await supabase
      .from('exercise_user_notes')
      .select('*');

    if (exErr) {
      console.error('Failed to load exercises:', exErr);
      return;
    }

    const noteMap = new Map<string, string>();
    notesData?.forEach((n: { exercise_id: string; note: string }) => {
      noteMap.set(n.exercise_id, n.note);
    });

    const combined: Exercise[] = (exData || []).map((ex) => ({
      ...ex,
      user_note: noteMap.get(ex.id) || '',
    }));

    setExercisesMaster(combined);
  };

  const fetchWorkoutsHistory = async () => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const { data } = await supabase
      .from('workouts')
      .select('*')
      .gte('workout_date', startDate.toISOString().split('T')[0])
      .lte('workout_date', endDate.toISOString().split('T')[0]);

    if (data) setWorkoutsHistory(data);
  };

  // ★ 日付と連動したスマートサジェスト
  const recommendedCategories = useMemo(() => {
    const lastTrained: Record<string, number> = {
      chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0
    };

    const targetDateObj = new Date(workoutDate);
    targetDateObj.setHours(0,0,0,0);
    const targetTime = targetDateObj.getTime();

    workoutsHistory.forEach(w => {
      if (!w.workout_date) return;
      const wDate = new Date(w.workout_date).setHours(0,0,0,0);
      
      // 選択した日付「より前」の記録だけを使う
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
  }, [workoutsHistory, frequency, workoutDate]);

  const handleAddExercise = (exercise: Exercise) => {
    if (activeExercises.some((ae) => ae.exercise.id === exercise.id)) return;
    setActiveExercises((prev) => [
      ...prev,
      {
        exercise,
        userNote: exercise.user_note || '',
        isNoteOpen: false,
        sets: [
          { exercise_id: exercise.id, set_number: 1, weight_kg: '', reps: '', is_completed: false }
        ]
      }
    ]);
  };

  const handleToggleTips = (exerciseIndex: number) => {
    setActiveExercises((prev) =>
      prev.map((item, idx) =>
        idx === exerciseIndex ? { ...item, isNoteOpen: !item.isNoteOpen } : item
      )
    );
  };

  const handleAddSet = (exerciseIndex: number) => {
    setActiveExercises((prev) =>
      prev.map((item, idx) => {
        if (idx !== exerciseIndex) return item;
        const lastSet = item.sets[item.sets.length - 1];
        const nextSet: LocalWorkoutSet = {
          exercise_id: item.exercise.id,
          set_number: item.sets.length + 1,
          weight_kg: lastSet ? lastSet.weight_kg : '',
          reps: lastSet ? lastSet.reps : '',
          is_completed: false
        };
        return { ...item, sets: [...item.sets, nextSet] };
      })
    );
  };

  const handleUpdateSet = (exerciseIndex: number, setIndex: number, field: 'weight_kg' | 'reps', value: string) => {
    setActiveExercises((prev) =>
      prev.map((item, idx) => {
        if (idx !== exerciseIndex) return item;
        const updatedSets = item.sets.map((s, sIdx) => {
          if (sIdx !== setIndex) return s;
          return { ...s, [field]: value };
        });
        return { ...item, sets: updatedSets };
      })
    );
  };

  const handleToggleComplete = (exerciseIndex: number, setIndex: number) => {
    setActiveExercises((prev) =>
      prev.map((item, idx) => {
        if (idx !== exerciseIndex) return item;
        const updatedSets = item.sets.map((s, sIdx) => {
          if (sIdx !== setIndex) return s;
          return { ...s, is_completed: !s.is_completed };
        });
        return { ...item, sets: updatedSets };
      })
    );
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    setActiveExercises((prev) => prev.filter((_, idx) => idx !== exerciseIndex));
  };

  const handleNoteChange = (exerciseIndex: number, text: string) => {
    setActiveExercises((prev) =>
      prev.map((item, idx) =>
        idx === exerciseIndex ? { ...item, userNote: text } : item
      )
    );
  };

  const handleSaveNote = async (exerciseId: string, noteText: string) => {
    await supabase
      .from('exercise_user_notes')
      .upsert({ exercise_id: exerciseId, note: noteText, updated_at: new Date().toISOString() });
  };

  const totalWeightVolume = activeExercises.reduce((total, item) => {
    return total + item.sets.filter((s) => s.is_completed).reduce((sTotal, s) => sTotal + (Number(s.weight_kg) * Number(s.reps)), 0);
  }, 0);

  const completedSetsCount = activeExercises.reduce((total, item) => {
    return total + item.sets.filter((s) => s.is_completed).length;
  }, 0);

  const estimatedCalories = Math.round((completedSetsCount * 12) + (totalWeightVolume * 0.015));

  const handleFinishWorkout = async () => {
    if (completedSetsCount === 0) {
      alert('完了したセットがありません。セット右側の「○」ボタンを押して完了にしてください。');
      return;
    }

    setSaving(true);
    const durationMinutes = Math.max(1, Math.round((new Date().getTime() - startTime.getTime()) / 60000));
    
    // ★ 3セット以上実施した部位だけをメインとして判定
    const categorySetCounts = new Map<string, number>();
    activeExercises.forEach(item => {
      const compSets = item.sets.filter(s => s.is_completed).length;
      const cat = item.exercise.category;
      categorySetCounts.set(cat, (categorySetCounts.get(cat) || 0) + compSets);
    });

    const targetCategories = Array.from(categorySetCounts.entries())
      .filter(([_, count]) => count >= 3)
      .map(([cat]) => cat);

    // 全てが3セット未満だった場合は、一番多くやった部位を救済として採用
    if (targetCategories.length === 0 && activeExercises.length > 0) {
      const maxCat = Array.from(categorySetCounts.entries()).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      targetCategories.push(maxCat);
    }

    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({
        target_categories: targetCategories,
        duration_minutes: durationMinutes,
        estimated_calories: estimatedCalories,
        workout_date: workoutDate 
      })
      .select()
      .single();

    if (wErr || !workout) {
      alert('保存に失敗しました: ' + wErr?.message);
      setSaving(false);
      return;
    }

    const allSets: any[] = [];
    activeExercises.forEach((item) => {
      item.sets.filter((s) => s.is_completed).forEach((s) => {
        allSets.push({
          workout_id: workout.id,
          exercise_id: s.exercise_id,
          set_number: s.set_number,
          weight_kg: Number(s.weight_kg) || 0,
          reps: Number(s.reps) || 0,
          is_completed: true
        });
      });
    });

    if (allSets.length > 0) {
      await supabase.from('workout_sets').insert(allSets);
    }

    // 保存後に履歴も更新しておく
    setWorkoutsHistory(prev => [...prev, workout]);

    setSaving(false);
    alert('🎉 ワークアウトを記録しました！');
    setActiveExercises([]);
    setWorkoutDate(new Date().toISOString().split('T')[0]);
    if (onWorkoutSaved) onWorkoutSaved();
  };

  const filteredMaster = selectedCategory === 'all'
    ? exercisesMaster
    : exercisesMaster.filter((ex) => ex.category === selectedCategory);

  return (
    <>
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 backdrop-blur-sm p-4 transition-opacity cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img 
              src={enlargedImage} 
              alt="Enlarged" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button 
              className="absolute -top-12 right-0 p-2 text-stone-300 hover:text-white bg-stone-700 rounded-full transition"
              onClick={() => setEnlargedImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 pb-24">
        {/* ★ 日付選択とおすすめ部位の表示 */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center space-x-2 bg-stone-900 border border-stone-600 px-3 py-1.5 rounded-xl shadow-sm">
            <Calendar className="w-4 h-4 text-stone-300" />
            <input
              type="date"
              value={workoutDate}
              onChange={(e) => setWorkoutDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-stone-100 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-stone-300 flex items-center">
              <Sparkles className="w-3 h-3 text-amber-400 mr-1" />
              おすすめ:
            </span>
            <div className="flex gap-1">
              {recommendedCategories.length > 0 ? (
                recommendedCategories.map(cat => (
                  <span key={cat} className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${CATEGORY_MAP[cat as MuscleCategory]?.badgeClass}`}>
                    {CATEGORY_MAP[cat as MuscleCategory]?.label}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-stone-300 font-medium bg-stone-600 px-2 py-0.5 rounded-full border border-stone-600">
                  オフ 🍵
                </span>
              )}
            </div>
          </div>
        </div>

        {activeExercises.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-stone-300 tracking-wider">実施メニュー</h2>
            {activeExercises.map((item, exIdx) => {
              const cat = CATEGORY_MAP[item.exercise.category];
              return (
                <div key={item.exercise.id} className="bg-stone-700 rounded-2xl border border-stone-600 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      <div 
                        className={`w-10 h-10 bg-stone-600 rounded-lg overflow-hidden flex items-center justify-center border border-stone-600 flex-shrink-0 ${item.exercise.image_url ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => {
                          if (item.exercise.image_url) setEnlargedImage(item.exercise.image_url);
                        }}
                      >
                        {item.exercise.image_url ? (
                          <img src={item.exercise.image_url} alt={item.exercise.name} className="w-full h-full object-cover" />
                        ) : (
                          <Dumbbell className="w-5 h-5 text-stone-300" />
                        )}
                      </div>
                      <div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cat.badgeClass}`}>
                          {cat.label}
                        </span>
                        <h3 className="font-bold text-sm text-stone-100 mt-0.5">{item.exercise.name}</h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleTips(exIdx)}
                      className="p-2 bg-stone-600 hover:bg-stone-500 rounded-lg text-amber-300 transition cursor-pointer"
                    >
                      <Lightbulb className="w-4 h-4" />
                    </button>
                  </div>

                  {item.isNoteOpen && (
                    <div className="bg-stone-950/90 rounded-xl p-3 border border-stone-600 text-xs space-y-2.5">
                      {item.exercise.default_tips && (
                        <div className="space-y-1">
                          <span className="font-semibold text-stone-200">💡 公式フォーム解説:</span>
                          <p className="text-stone-300 whitespace-pre-line">
                            {item.exercise.default_tips.replace(/\\n/g, '\n')}
                          </p>
                        </div>
                      )}
                      <div className="space-y-1 pt-2 border-t border-stone-600">
                        <span className="font-semibold text-amber-400">📝 マイ設定・注意点メモ:</span>
                        <textarea
                          rows={2}
                          value={item.userNote}
                          placeholder="例: シート高さ4番、サムレスで持つ..."
                          onChange={(e) => handleNoteChange(exIdx, e.target.value)}
                          onBlur={() => handleSaveNote(item.exercise.id, item.userNote)}
                          className="w-full bg-stone-900 border border-stone-600 rounded-lg p-2 text-stone-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-stone-300 px-2">
                      <span className="col-span-2">SET</span>
                      <span className="col-span-4 text-center">重量 (kg)</span>
                      <span className="col-span-4 text-center">回数 (Reps)</span>
                      <span className="col-span-2 text-right">完了</span>
                    </div>

                    {item.sets.map((set, setIdx) => (
                      <div
                        key={setIdx}
                        className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl transition ${
                          set.is_completed ? 'bg-emerald-950/40 border border-emerald-800/50' : 'bg-stone-900'
                        }`}
                      >
                        <span className="col-span-2 font-mono font-bold text-stone-300 text-xs pl-1">
                          #{set.set_number}
                        </span>
                        <div className="col-span-4 flex justify-center">
                          <input
                            type="number"
                            step="0.5"
                            value={set.weight_kg}
                            placeholder="-"
                            onChange={(e) => handleUpdateSet(exIdx, setIdx, 'weight_kg', e.target.value)}
                            className="w-16 bg-stone-900 border border-stone-600 text-center rounded-lg py-1 text-sm font-bold text-stone-100 focus:outline-none focus:border-orange-400"
                          />
                        </div>
                        <div className="col-span-4 flex justify-center">
                          <input
                            type="number"
                            value={set.reps}
                            placeholder="-"
                            onChange={(e) => handleUpdateSet(exIdx, setIdx, 'reps', e.target.value)}
                            className="w-16 bg-stone-900 border border-stone-600 text-center rounded-lg py-1 text-sm font-bold text-stone-100 focus:outline-none focus:border-orange-400"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(exIdx, setIdx)}
                            className={`p-1.5 rounded-full transition cursor-pointer ${
                              set.is_completed ? 'text-emerald-400' : 'text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            {set.is_completed ? (
                              <CheckCircle2 className="w-6 h-6 fill-emerald-500/20 text-emerald-400" />
                            ) : (
                              <Circle className="w-6 h-6" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddSet(exIdx)}
                      className="flex items-center space-x-1 text-xs text-orange-400 hover:text-orange-300 font-medium py-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>セットを追加</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(exIdx)}
                      className="text-stone-400 hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleFinishWorkout}
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 font-bold rounded-2xl shadow-lg shadow-orange-900/50 flex items-center justify-center space-x-2 transition cursor-pointer text-white"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? '保存中...' : '指定した日付でワークアウトを記録'}</span>
            </button>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-stone-300 tracking-wider">種目を追加する</h2>

          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-stone-200 text-stone-900 font-bold'
                  : 'bg-stone-600 text-stone-300 hover:bg-stone-500'
              }`}
            >
              すべて
            </button>
            {(Object.keys(CATEGORY_MAP) as MuscleCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-stone-200 text-stone-900 font-bold'
                    : 'bg-stone-600 text-stone-300 hover:bg-stone-500'
                }`}
              >
                {CATEGORY_MAP[cat].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredMaster.map((ex) => {
              const isAdded = activeExercises.some((ae) => ae.exercise.id === ex.id);
              const cat = CATEGORY_MAP[ex.category];
              return (
                <div
                  key={ex.id}
                  onClick={() => !isAdded && handleAddExercise(ex)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    isAdded
                      ? 'bg-stone-900 border-stone-600 opacity-50 cursor-not-allowed'
                      : 'bg-stone-700 border-stone-600 hover:border-stone-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className={`w-11 h-11 bg-stone-600 rounded-lg overflow-hidden flex items-center justify-center border border-stone-600 flex-shrink-0 ${ex.image_url ? 'cursor-pointer hover:opacity-80' : ''}`}
                      onClick={(e) => {
                        if (ex.image_url) {
                          e.stopPropagation();
                          setEnlargedImage(ex.image_url);
                        }
                      }}
                    >
                      {ex.image_url ? (
                        <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" />
                      ) : (
                        <Dumbbell className="w-5 h-5 text-stone-300" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${cat.badgeClass}`}>
                          {cat.label}
                        </span>
                        <span className="text-xs text-stone-300">
                          {ex.equipment_type === 'machine' ? 'マシン' : ex.equipment_type === 'free_weight' ? 'フリー' : 'ケーブル'}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-stone-100 mt-0.5">{ex.name}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isAdded}
                    className={`p-2 rounded-lg text-xs font-bold transition ${
                      isAdded
                        ? 'bg-stone-600 text-stone-400'
                        : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 cursor-pointer'
                    }`}
                  >
                    {isAdded ? '追加済' : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default WorkoutLogger;