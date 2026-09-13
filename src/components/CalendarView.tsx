import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Workout, MuscleCategory, Exercise } from '../types/database';
import { CATEGORY_MAP } from '../types/database';
import { 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  Calendar as CalendarIcon, 
  Sparkles,
  Clock,
  Trash2,
  Edit2,
  X,
  Save,
} from 'lucide-react';

interface SetItem {
  id?: string;
  workout_id?: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
}

interface WorkoutDetail extends Workout {
  sets: (SetItem & { exercise_name: string; category: MuscleCategory })[];
}

interface Recommendation {
  category: MuscleCategory;
  daysAgo: number | null;
  reason: string;
}

export const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [workouts, setWorkouts] = useState<WorkoutDetail[]>([]);
  const [selectedDateWorkouts, setSelectedDateWorkouts] = useState<WorkoutDetail[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // 編集モーダル用ステート
  const [editingWorkout, setEditingWorkout] = useState<WorkoutDetail | null>(null);
  const [editSets, setEditSets] = useState<(SetItem & { exercise_name: string; category: MuscleCategory })[]>([]);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    loadAllData();
  }, [currentDate]);

  const loadAllData = async () => {
    // 1. 種目マスターのロード
    const { data: exData } = await supabase.from('exercises').select('*');
    const exMap: Record<string, Exercise> = {};
    (exData || []).forEach((ex: Exercise) => {
      exMap[ex.id] = ex;
    });

    // 2. ワークアウト記録 & セットのロード
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 2, 0).toISOString().split('T')[0];

    const { data: wData } = await supabase
      .from('workouts')
      .select('*')
      .gte('workout_date', startDate)
      .lte('workout_date', endDate)
      .order('created_at', { ascending: false });

    if (!wData || wData.length === 0) {
      setWorkouts([]);
      setSelectedDateWorkouts([]);
      calculateRecommendations([]);
      return;
    }

    const workoutIds = wData.map((w) => w.id);
    const { data: setsData } = await supabase
      .from('workout_sets')
      .select('*')
      .in('workout_id', workoutIds)
      .order('set_number', { ascending: true });

    const combined: WorkoutDetail[] = wData.map((w) => {
      const matchingSets = (setsData || [])
        .filter((s) => s.workout_id === w.id)
        .map((s) => ({
          ...s,
          exercise_name: exMap[s.exercise_id]?.name || '種目名未設定',
          category: exMap[s.exercise_id]?.category || 'chest',
        }));
      return {
        ...w,
        sets: matchingSets,
      };
    });

    setWorkouts(combined);
    setSelectedDateWorkouts(combined.filter((w) => w.workout_date === selectedDateStr));
    calculateRecommendations(combined);
  };

  // レコメンド計算
  const calculateRecommendations = (allWorkouts: WorkoutDetail[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const categories: MuscleCategory[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    const lastTrainedMap: Record<MuscleCategory, number | null> = {
      chest: null,
      back: null,
      legs: null,
      shoulders: null,
      arms: null,
      core: null,
    };

    allWorkouts.forEach((w) => {
      const wDate = new Date(w.workout_date);
      wDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - wDate.getTime()) / (1000 * 60 * 60 * 24));

      w.target_categories?.forEach((cat) => {
        if (categories.includes(cat)) {
          if (lastTrainedMap[cat] === null || diffDays < lastTrainedMap[cat]!) {
            lastTrainedMap[cat] = diffDays;
          }
        }
      });
    });

    const recList: Recommendation[] = categories.map((cat) => {
      const days = lastTrainedMap[cat];
      let reason = '';
      if (days === null) {
        reason = '未記録（おすすめ！）';
      } else if (days === 0) {
        reason = '今日実施（休息・回復中）';
      } else if (days === 1) {
        reason = '昨日実施（超回復中）';
      } else if (days >= 3) {
        reason = `${days}日前（おすすめ！）`;
      } else {
        reason = `${days}日前に実施`;
      }

      return {
        category: cat,
        daysAgo: days,
        reason,
      };
    });

    recList.sort((a, b) => {
      const scoreA = a.daysAgo === null ? 999 : a.daysAgo;
      const scoreB = b.daysAgo === null ? 999 : b.daysAgo;
      return scoreB - scoreA;
    });

    setRecommendations(recList);
  };

  // ワークアウト削除
  const handleDeleteWorkout = async (workoutId: string) => {
    if (!window.confirm('この日のトレーニング記録を削除しますか？')) return;

    await supabase.from('workout_sets').delete().eq('workout_id', workoutId);
    await supabase.from('workouts').delete().eq('id', workoutId);

    loadAllData();
  };

  // 編集モーダルを開く
  const handleOpenEdit = (workout: WorkoutDetail) => {
    setEditingWorkout(workout);
    setEditSets(JSON.parse(JSON.stringify(workout.sets)));
  };

  // 編集中のセット更新
  const handleUpdateEditSet = (idx: number, field: 'weight_kg' | 'reps', val: number) => {
    setEditSets((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s))
    );
  };

  // 編集中のセット削除
  const handleRemoveEditSet = (idx: number) => {
    setEditSets((prev) => prev.filter((_, i) => i !== idx));
  };

  // 編集内容の保存
  const handleSaveEdit = async () => {
    if (!editingWorkout) return;
    setSavingEdit(true);

    // 総重量・消費カロリー再計算
    const totalVol = editSets.reduce((sum, s) => sum + (Number(s.weight_kg) * Number(s.reps)), 0);
    const estCal = Math.round((editSets.length * 12) + (totalVol * 0.015));
    const targetCats = Array.from(new Set(editSets.map((s) => s.category)));

    
    // 1. workoutsテーブル更新
    await supabase
      .from('workouts')
      .update({
        target_categories: targetCats,
        estimated_calories: estCal,
      })
      .eq('id', editingWorkout.id);

    // 2. workout_setsテーブル再生成
    await supabase.from('workout_sets').delete().eq('workout_id', editingWorkout.id);
    
    if (editSets.length > 0) {
      const newSetsToInsert = editSets.map((s, index) => ({
        workout_id: editingWorkout.id,
        exercise_id: s.exercise_id,
        set_number: index + 1,
        weight_kg: Number(s.weight_kg),
        reps: Number(s.reps),
        is_completed: true,
      }));
      await supabase.from('workout_sets').insert(newSetsToInsert);
    }

    setSavingEdit(false);
    setEditingWorkout(null);
    loadAllData();
  };

  // カレンダー操作
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handleDateClick = (day: number) => {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDateStr(dStr);
    setSelectedDateWorkouts(workouts.filter((w) => w.workout_date === dStr));
  };

  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  return (
    <div className="space-y-6 pb-24">
      {/* 1. おすすめ部位バナー */}
      <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>今日のおすすめ部位</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {recommendations.slice(0, 2).map((rec) => {
            const catMeta = CATEGORY_MAP[rec.category];
            return (
              <div
                key={rec.category}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${catMeta.badgeClass}`}>
                    {catMeta.label}
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold font-mono">
                    {rec.daysAgo === null ? '未記録' : `${rec.daysAgo}日前`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-2 font-medium">
                  {rec.reason}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 月別カレンダー */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-base text-slate-100 flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-cyan-400" />
            <span>{year}年 {month + 1}月</span>
          </h2>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
          <span className="text-red-400">日</span>
          <span>月</span>
          <span>火</span>
          <span>水</span>
          <span>木</span>
          <span>金</span>
          <span className="text-blue-400">土</span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="h-14 rounded-xl" />;

            const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayWorkouts = workouts.filter((w) => w.workout_date === dStr);
            const isSelected = selectedDateStr === dStr;
            const isToday = new Date().toISOString().split('T')[0] === dStr;
            const dayCategories = Array.from(new Set(dayWorkouts.flatMap((w) => w.target_categories || [])));

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDateClick(day)}
                className={`h-14 p-1 rounded-xl flex flex-col justify-between items-center transition border cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-400 shadow-md shadow-cyan-950/40'
                    : isToday
                    ? 'bg-slate-900 border-slate-600'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <span className={`text-xs font-bold ${isToday ? 'text-cyan-400' : 'text-slate-300'}`}>
                  {day}
                </span>
                <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
                  {dayCategories.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className={`w-1.5 h-1.5 rounded-full ${CATEGORY_MAP[cat]?.color || 'bg-slate-500'}`}
                    />
                  ))}
                  {dayCategories.length > 3 && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 選択日付のワークアウト詳細 */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-400 tracking-wider">
          {selectedDateStr} の記録
        </h3>

        {selectedDateWorkouts.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 text-center text-xs text-slate-500">
            この日のトレーニング記録はありません
          </div>
        ) : (
          selectedDateWorkouts.map((w) => {
            const totalVol = w.sets.reduce((tot, s) => tot + Number(s.weight_kg) * Number(s.reps), 0);

            return (
              <div
                key={w.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg"
              >
                {/* ヘッダー & 編集・削除ボタン */}
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap gap-1.5">
                    {w.target_categories?.map((cat) => (
                      <span
                        key={cat}
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${CATEGORY_MAP[cat]?.badgeClass}`}
                      >
                        {CATEGORY_MAP[cat]?.label}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(w)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                      title="記録を編集"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteWorkout(w.id)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition cursor-pointer"
                      title="記録を削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* サマリー */}
                <div className="flex items-center justify-between text-xs text-slate-400 border-y border-slate-800/80 py-2">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{w.duration_minutes || 30} 分</span>
                    </span>
                    <span className="flex items-center space-x-1 text-orange-400 font-semibold">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{w.estimated_calories || 0} kcal</span>
                    </span>
                  </div>
                  <div className="font-mono text-slate-200">
                    総負荷: <strong>{totalVol.toLocaleString()}</strong> kg
                  </div>
                </div>

                {/* 種目ごとのセット内訳 */}
                <div className="space-y-2 pt-1">
                  {Array.from(new Set(w.sets.map((s) => s.exercise_name))).map((exName) => {
                    const exSets = w.sets.filter((s) => s.exercise_name === exName);
                    const cat = exSets[0]?.category;
                    return (
                      <div key={exName} className="bg-slate-950/80 p-3 rounded-xl space-y-1.5 border border-slate-800/60">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${CATEGORY_MAP[cat]?.badgeClass}`}>
                            {CATEGORY_MAP[cat]?.label}
                          </span>
                          <span className="font-bold text-xs text-slate-100">{exName}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {exSets.map((s, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-mono bg-slate-900 border border-slate-700/80 text-slate-300 px-2 py-0.5 rounded-md"
                            >
                              #{idx + 1}: <strong className="text-cyan-400">{s.weight_kg}kg</strong> × {s.reps}回
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. 編集モーダル */}
      {editingWorkout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* モーダルヘッダー */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-slate-100">記録の編集</h3>
                <p className="text-xs text-slate-400">{editingWorkout.workout_date}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingWorkout(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* モーダル本体（セット一覧の編集） */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {editSets.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">セットがありません</div>
              ) : (
                editSets.map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between space-x-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-slate-200 truncate">{s.exercise_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Set #{idx + 1}</div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.5"
                          value={s.weight_kg}
                          onChange={(e) => handleUpdateEditSet(idx, 'weight_kg', Number(e.target.value))}
                          className="w-14 bg-slate-800 border border-slate-700 text-center rounded py-1 text-xs font-bold text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                        <span className="text-[10px] text-slate-400">kg</span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          value={s.reps}
                          onChange={(e) => handleUpdateEditSet(idx, 'reps', Number(e.target.value))}
                          className="w-14 bg-slate-800 border border-slate-700 text-center rounded py-1 text-xs font-bold text-slate-100 focus:outline-none focus:border-cyan-400"
                        />
                        <span className="text-[10px] text-slate-400">回</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveEditSet(idx)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* モーダルフッター */}
            <div className="p-4 border-t border-slate-800 flex space-x-3">
              <button
                type="button"
                onClick={() => setEditingWorkout(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl text-xs font-bold text-white flex items-center justify-center space-x-1 transition shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>{savingEdit ? '更新中...' : '変更を保存'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;