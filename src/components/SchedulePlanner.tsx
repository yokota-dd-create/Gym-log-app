import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import type { Workout, RestOverride, MuscleCategory } from '../types/database';
import { CATEGORY_MAP } from '../types/database';
import { Ban, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react';

const PLAN_DAYS = 7;
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const SPLITS: Record<string, MuscleCategory[][]> = {
  '2': [['chest', 'shoulders', 'arms'], ['back', 'legs', 'core']],
  '3': [['chest', 'shoulders'], ['back', 'arms'], ['legs', 'core']],
  '4': [['chest', 'arms'], ['back', 'core'], ['legs'], ['shoulders']],
  '5': [['chest'], ['back'], ['legs'], ['shoulders'], ['arms']],
  '6': [['chest', 'shoulders'], ['back', 'arms'], ['legs']]
};

type DayPlan = {
  date: Date;
  dateStr: string;
  isToday: boolean;
  isOverride: boolean;
  type: 'done' | 'rest_forced' | 'rest_natural' | 'planned';
  categories: MuscleCategory[];
};

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const SchedulePlanner = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [overrides, setOverrides] = useState<RestOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState<'2' | '3' | '4' | '5' | '6'>(() => {
    return (localStorage.getItem('gymlog_frequency') as any) || '5';
  });

  useEffect(() => {
    fetchData();

    const handleStorage = () => {
      const f = localStorage.getItem('gymlog_frequency');
      if (f) setFrequency(f as any);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const today = new Date();
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - 60);
    const planEnd = new Date();
    planEnd.setDate(planEnd.getDate() + PLAN_DAYS - 1);

    const [{ data: workoutsData }, { data: overridesData }] = await Promise.all([
      supabase
        .from('workouts')
        .select('*')
        .gte('workout_date', toDateStr(historyStart))
        .lte('workout_date', toDateStr(today)),
      supabase
        .from('rest_overrides')
        .select('*')
        .gte('rest_date', toDateStr(today))
        .lte('rest_date', toDateStr(planEnd)),
    ]);

    setWorkouts(workoutsData || []);
    setOverrides(overridesData || []);
    setLoading(false);
  };

  const handleToggleOverride = async (dateStr: string, isCurrentlyOverridden: boolean) => {
    if (isCurrentlyOverridden) {
      const { error } = await supabase.from('rest_overrides').delete().eq('rest_date', dateStr);
      if (!error) setOverrides((prev) => prev.filter((o) => o.rest_date !== dateStr));
    } else {
      const { data, error } = await supabase
        .from('rest_overrides')
        .insert({ rest_date: dateStr })
        .select()
        .single();
      if (!error && data) setOverrides((prev) => [...prev, data]);
    }
  };

  const schedule = useMemo<DayPlan[]>(() => {
    const lastTrained: Record<string, number> = {
      chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0
    };

    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const todayStr = toDateStr(todayObj);

    const realTrainedToday = new Set<MuscleCategory>();

    workouts.forEach((w) => {
      if (!w.workout_date) return;
      const wDateStr = w.workout_date.slice(0, 10);
      const wTime = new Date(wDateStr).setHours(0, 0, 0, 0);

      if (wDateStr === todayStr) {
        w.target_categories?.forEach((cat) => realTrainedToday.add(cat));
        return;
      }
      if (wTime < todayObj.getTime()) {
        w.target_categories?.forEach((cat) => {
          if (wTime > lastTrained[cat]) lastTrained[cat] = wTime;
        });
      }
    });

    const overrideDates = new Set(overrides.map((o) => o.rest_date));
    const groups = SPLITS[frequency] || SPLITS['5'];
    const result: DayPlan[] = [];

    for (let offset = 0; offset < PLAN_DAYS; offset++) {
      const date = new Date(todayObj);
      date.setDate(date.getDate() + offset);
      const dateStr = toDateStr(date);
      const targetTime = date.getTime();

      if (offset === 0 && realTrainedToday.size > 0) {
        const cats = Array.from(realTrainedToday);
        cats.forEach((cat) => { lastTrained[cat] = targetTime; });
        result.push({ date, dateStr, isToday: true, isOverride: false, type: 'done', categories: cats });
        continue;
      }

      if (overrideDates.has(dateStr)) {
        result.push({ date, dateStr, isToday: offset === 0, isOverride: true, type: 'rest_forced', categories: [] });
        continue;
      }

      let bestGroup: MuscleCategory[] = [];
      let maxDaysSince = -1;
      groups.forEach((group) => {
        const groupLastTrained = Math.max(...group.map((m) => lastTrained[m] || 0));
        const daysSince = groupLastTrained === 0 ? 999 : (targetTime - groupLastTrained) / (1000 * 60 * 60 * 24);
        if (daysSince > maxDaysSince) {
          maxDaysSince = daysSince;
          bestGroup = group;
        }
      });

      if (maxDaysSince <= 0) {
        result.push({ date, dateStr, isToday: offset === 0, isOverride: false, type: 'rest_natural', categories: [] });
        continue;
      }

      bestGroup.forEach((cat) => { lastTrained[cat] = targetTime; });
      result.push({ date, dateStr, isToday: offset === 0, isOverride: false, type: 'planned', categories: bestGroup });
    }

    return result;
  }, [workouts, overrides, frequency]);

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center">
            <Sparkles className="w-4 h-4 text-amber-400 mr-1.5" />
            今後{PLAN_DAYS}日の予定モデル
          </h3>
          <select
            value={frequency}
            onChange={(e) => {
              setFrequency(e.target.value as any);
              localStorage.setItem('gymlog_frequency', e.target.value);
              window.dispatchEvent(new Event('storage'));
            }}
            className="bg-slate-800 text-xs font-bold text-slate-300 rounded-lg border border-slate-700 px-3 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="2">週2回 (二分割)</option>
            <option value="3">週3回 (PPL)</option>
            <option value="4">週4回 (四分割)</option>
            <option value="5">週5回 (ブロスプリット)</option>
            <option value="6">週6回 (高頻度PPL)</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          行けない日は「行けない」を押すと予定が組み直されます。
        </p>
      </div>

      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 shadow-lg space-y-2">
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-4">読み込み中...</p>
        ) : (
          schedule.map((day) => {
            const weekday = WEEKDAY_LABELS[day.date.getDay()];
            return (
              <div
                key={day.dateStr}
                className={`flex items-center justify-between rounded-xl p-3 border ${
                  day.isToday ? 'bg-cyan-950/30 border-cyan-700/50' : 'bg-slate-800/50 border-slate-700/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-14 flex-shrink-0">
                    <div className="text-xs font-bold text-slate-300">
                      {day.date.getMonth() + 1}/{day.date.getDate()}
                    </div>
                    <div className="text-[10px] text-slate-500">({weekday}){day.isToday ? ' 今日' : ''}</div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {day.type === 'planned' || day.type === 'done' ? (
                      day.categories.map((cat) => (
                        <span
                          key={cat}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${CATEGORY_MAP[cat].badgeClass}`}
                        >
                          {CATEGORY_MAP[cat].label}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium bg-slate-900 px-2 py-0.5 rounded-full border border-slate-700">
                        {day.type === 'rest_forced' ? '休み(確定)' : 'オフ 🍵'}
                      </span>
                    )}
                  </div>
                </div>

                {day.type === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleOverride(day.dateStr, day.isOverride)}
                    className={`flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition cursor-pointer flex-shrink-0 ${
                      day.isOverride
                        ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50'
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-800'
                    }`}
                  >
                    {day.isOverride ? (
                      <>
                        <RotateCcw className="w-3 h-3" />
                        <span>予定に戻す</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3 h-3" />
                        <span>行けない</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SchedulePlanner;
