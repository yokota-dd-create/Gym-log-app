import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Exercise, MuscleCategory } from '../types/database';
import { CATEGORY_MAP } from '../types/database';
import { 
  Dumbbell, 
  Lightbulb, 
  Timer, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Flame, 
  Save,
  Calendar,
  X // ★ Xアイコンを追加
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
  
  const [restSeconds, setRestSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [startTime] = useState<Date>(new Date());
  const [saving, setSaving] = useState<boolean>(false);

  // ★ 画像拡大用のステートを追加
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && restSeconds > 0) {
      interval = setInterval(() => {
        setRestSeconds((prev) => prev - 1);
      }, 1000);
    } else if (restSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, restSeconds]);

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
          const nextCompleted = !s.is_completed;
          if (nextCompleted) {
            setRestSeconds(90);
            setIsTimerRunning(true);
          }
          return { ...s, is_completed: nextCompleted };
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
    const targetCategories = Array.from(new Set(activeExercises.map((ae) => ae.exercise.category)));

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
      {/* ★ 画像拡大モーダル */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 transition-opacity cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img 
              src={enlargedImage} 
              alt="Enlarged" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button 
              className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white bg-slate-800/80 rounded-full transition"
              onClick={() => setEnlargedImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 pb-24">
        {/* 上部ステータスバー */}
        <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800 p-3 flex justify-between items-center rounded-xl shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-amber-400 font-mono text-lg font-bold">
              <Timer className={`w-5 h-5 ${isTimerRunning ? 'animate-pulse text-red-400' : ''}`} />
              <span>{Math.floor(restSeconds / 60)}:{(restSeconds % 60).toString().padStart(2, '0')}</span>
            </div>
            {isTimerRunning && (
              <button
                type="button"
                onClick={() => setIsTimerRunning(false)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded cursor-pointer"
              >
                スキップ
              </button>
            )}
          </div>

          <div className="flex items-center space-x-4 text-xs font-medium">
            <div className="flex items-center space-x-1 text-orange-400">
              <Flame className="w-4 h-4" />
              <span>約 {estimatedCalories} kcal</span>
            </div>
            <div className="text-slate-400">
              総負荷: <span className="font-bold text-slate-200">{totalWeightVolume.toLocaleString()}</span> kg
            </div>
          </div>
        </div>

        <div className="flex justify-end -mt-3 pr-1">
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={workoutDate}
              onChange={(e) => setWorkoutDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-200 focus:outline-none"
            />
          </div>
        </div>

        {activeExercises.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-400 tracking-wider">実施メニュー</h2>
            {activeExercises.map((item, exIdx) => {
              const cat = CATEGORY_MAP[item.exercise.category];
              return (
                <div key={item.exercise.id} className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                      {/* ★ 画像タップで拡大 */}
                      <div 
                        className={`w-10 h-10 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border border-slate-700 flex-shrink-0 ${item.exercise.image_url ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => {
                          if (item.exercise.image_url) setEnlargedImage(item.exercise.image_url);
                        }}
                      >
                        {item.exercise.image_url ? (
                          <img src={item.exercise.image_url} alt={item.exercise.name} className="w-full h-full object-cover" />
                        ) : (
                          <Dumbbell className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cat.badgeClass}`}>
                          {cat.label}
                        </span>
                        <h3 className="font-bold text-sm text-slate-100 mt-0.5">{item.exercise.name}</h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleTips(exIdx)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-amber-300 transition cursor-pointer"
                    >
                      <Lightbulb className="w-4 h-4" />
                    </button>
                  </div>

                  {item.isNoteOpen && (
                    <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 text-xs space-y-2.5">
                      {item.exercise.default_tips && (
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-300">💡 公式フォーム解説:</span>
                          <p className="text-slate-400 whitespace-pre-line">
                            {item.exercise.default_tips.replace(/\\n/g, '\n')}
                          </p>
                        </div>
                      )}
                      <div className="space-y-1 pt-2 border-t border-slate-800">
                        <span className="font-semibold text-amber-400">📝 マイ設定・注意点メモ:</span>
                        <textarea
                          rows={2}
                          value={item.userNote}
                          placeholder="例: シート高さ4番、サムレスで持つ..."
                          onChange={(e) => handleNoteChange(exIdx, e.target.value)}
                          onBlur={() => handleSaveNote(item.exercise.id, item.userNote)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-400 px-2">
                      <span className="col-span-2">SET</span>
                      <span className="col-span-4 text-center">重量 (kg)</span>
                      <span className="col-span-4 text-center">回数 (Reps)</span>
                      <span className="col-span-2 text-right">完了</span>
                    </div>

                    {item.sets.map((set, setIdx) => (
                      <div
                        key={setIdx}
                        className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl transition ${
                          set.is_completed ? 'bg-emerald-950/40 border border-emerald-800/50' : 'bg-slate-800/50'
                        }`}
                      >
                        <span className="col-span-2 font-mono font-bold text-slate-400 text-xs pl-1">
                          #{set.set_number}
                        </span>
                        <div className="col-span-4 flex justify-center">
                          <input
                            type="number"
                            step="0.5"
                            value={set.weight_kg}
                            placeholder="-"
                            onChange={(e) => handleUpdateSet(exIdx, setIdx, 'weight_kg', e.target.value)}
                            className="w-16 bg-slate-900 border border-slate-700 text-center rounded-lg py-1 text-sm font-bold text-slate-100 focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div className="col-span-4 flex justify-center">
                          <input
                            type="number"
                            value={set.reps}
                            placeholder="-"
                            onChange={(e) => handleUpdateSet(exIdx, setIdx, 'reps', e.target.value)}
                            className="w-16 bg-slate-900 border border-slate-700 text-center rounded-lg py-1 text-sm font-bold text-slate-100 focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(exIdx, setIdx)}
                            className={`p-1.5 rounded-full transition cursor-pointer ${
                              set.is_completed ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
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
                      className="flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium py-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>セットを追加</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(exIdx)}
                      className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
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
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 font-bold rounded-2xl shadow-lg shadow-emerald-950/50 flex items-center justify-center space-x-2 transition cursor-pointer text-white"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? '保存中...' : '指定した日付でワークアウトを記録'}</span>
            </button>
          </div>
        )}

        {/* 種目追加エリア */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-slate-400 tracking-wider">種目を追加する</h2>

          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
                    ? 'bg-slate-200 text-slate-900 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* ★ 画像タップで拡大（親要素のonClickを発火させないように stopPropagation を追加） */}
                    <div 
                      className={`w-11 h-11 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border border-slate-700 flex-shrink-0 ${ex.image_url ? 'cursor-pointer hover:opacity-80' : ''}`}
                      onClick={(e) => {
                        if (ex.image_url) {
                          e.stopPropagation(); // 誤って追加されないようにブロック
                          setEnlargedImage(ex.image_url);
                        }
                      }}
                    >
                      {ex.image_url ? (
                        <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" />
                      ) : (
                        <Dumbbell className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${cat.badgeClass}`}>
                          {cat.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {ex.equipment_type === 'machine' ? 'マシン' : ex.equipment_type === 'free_weight' ? 'フリー' : 'ケーブル'}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-slate-200 mt-0.5">{ex.name}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isAdded}
                    className={`p-2 rounded-lg text-xs font-bold transition ${
                      isAdded
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 cursor-pointer'
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