import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Exercise, MuscleCategory, EquipmentType } from '../types/database';
import { CATEGORY_MAP } from '../types/database';
import { MuscleDiagram } from './MuscleDiagram';
import {
  Search,
  Dumbbell,
  Lightbulb,
  Check,
  Save,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const EQUIPMENT_MAP: Record<EquipmentType | 'all', { label: string; badge: string }> = {
  all: { label: 'すべて', badge: 'bg-slate-800 text-slate-300' },
  machine: { label: 'マシン', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  free_weight: { label: 'フリー重量', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  cable: { label: 'ケーブル', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  bodyweight: { label: '自重', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
};

export const ExerciseDictionary: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MuscleCategory | 'all'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchExercisesAndNotes();
  }, []);

  const fetchExercisesAndNotes = async () => {
    const { data: exData, error: exErr } = await supabase
      .from('exercises')
      .select('*')
      .order('category', { ascending: true });

    const { data: notesData } = await supabase
      .from('exercise_user_notes')
      .select('*');

    if (exErr) {
      console.error('Failed to fetch exercises:', exErr);
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

    setExercises(combined);

    const initialNotes: Record<string, string> = {};
    combined.forEach((ex) => {
      initialNotes[ex.id] = ex.user_note || '';
    });
    setEditingNotes(initialNotes);
  };

  const handleSaveNote = async (exerciseId: string) => {
    const noteText = editingNotes[exerciseId] || '';
    const { error } = await supabase
      .from('exercise_user_notes')
      .upsert({
        exercise_id: exerciseId,
        note: noteText,
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      setSavedStatus((prev) => ({ ...prev, [exerciseId]: true }));
      setTimeout(() => {
        setSavedStatus((prev) => ({ ...prev, [exerciseId]: false }));
      }, 2000);
    }
  };

  const filteredExercises = exercises.filter((ex) => {
    const matchCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    const matchEquipment = selectedEquipment === 'all' || ex.equipment_type === selectedEquipment;
    const matchSearch =
      searchQuery.trim() === '' ||
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.default_tips && ex.default_tips.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCategory && matchEquipment && matchSearch;
  });

  return (
    <div className="space-y-5 pb-24">
      {/* 検索バー */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="種目名・フォームのキーワードで検索..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition shadow-inner"
        />
      </div>

      {/* 絞り込みフィルター（部位） */}
      <div className="space-y-2">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-400">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>対象部位で絞り込み</span>
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-950/40'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            すべての部位
          </button>
          {(Object.keys(CATEGORY_MAP) as MuscleCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-950/40'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {CATEGORY_MAP[cat].label}
            </button>
          ))}
        </div>
      </div>

      {/* 絞り込みフィルター（器具タイプ） */}
      <div className="space-y-2">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-400">
          <Dumbbell className="w-3.5 h-3.5 text-amber-400" />
          <span>器具タイプで絞り込み</span>
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {(Object.keys(EQUIPMENT_MAP) as (EquipmentType | 'all')[]).map((eq) => (
            <button
              key={eq}
              type="button"
              onClick={() => setSelectedEquipment(eq)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition border cursor-pointer ${
                selectedEquipment === eq
                  ? 'bg-slate-200 text-slate-950 font-bold border-slate-200 shadow-md shadow-white/10'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {EQUIPMENT_MAP[eq].label}
            </button>
          ))}
        </div>
      </div>

      {/* 件数表示 */}
      <div className="text-right text-xs text-slate-500 pr-1">
        該当件数: <strong className="text-slate-300">{filteredExercises.length}</strong> 件
      </div>

      {/* 種目一覧カード群 */}
      <div className="space-y-3">
        {filteredExercises.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 text-center text-xs text-slate-500">
            該当する種目が見つかりませんでした
          </div>
        ) : (
          filteredExercises.map((ex) => {
            const isExpanded = expandedId === ex.id;
            const catMeta = CATEGORY_MAP[ex.category];
            const eqMeta = EQUIPMENT_MAP[ex.equipment_type] || EQUIPMENT_MAP.machine;
            const isSaved = savedStatus[ex.id];

            return (
              <div
                key={ex.id}
                className={`bg-slate-900/90 border transition-all rounded-2xl overflow-hidden shadow-lg ${
                  isExpanded ? 'border-cyan-500/50 shadow-cyan-950/20' : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* ヘッダー部（画像 or アイコン + 種目情報） */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    {/* 機器画像 / アイコン */}
                    <div className="w-14 h-14 bg-slate-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-700/60 relative">
                      {ex.image_url ? (
                        <img
                          src={ex.image_url}
                          alt={ex.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Dumbbell className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${catMeta.badgeClass}`}>
                          {catMeta.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${eqMeta.badge}`}>
                          {eqMeta.label}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-100 truncate">{ex.name}</h3>
                    </div>
                  </div>

                  <div className="p-1 text-slate-400 flex-shrink-0">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* 展開エリア */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/70 p-4 space-y-4">
                    {/* ターゲット部位ハイライト図 */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center space-x-4">
                      <MuscleDiagram category={ex.category} className="w-16 h-auto flex-shrink-0" />
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          <span>ターゲット部位</span>
                        </div>
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-bold ${catMeta.badgeClass}`}>
                          {catMeta.label}
                        </span>
                        <p className="text-[11px] text-slate-500">ハイライトした部分が重点的に働く部位です</p>
                      </div>
                    </div>

                    {/* 公式フォーム解説 */}
                    {ex.default_tips && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                          <Lightbulb className="w-4 h-4" />
                          <span>基本フォーム & 注意ポイント</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                          {ex.default_tips.replace(/\\n/g, '\n')}
                        </p>
                      </div>
                    )}

                    {/* マイ設定・フォームメモ */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-300 flex items-center space-x-1">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>マイ設定・調整メモ（自動保存対応）</span>
                        </span>
                        {isSaved && (
                          <span className="text-[10px] text-emerald-400 flex items-center space-x-1 animate-pulse">
                            <Check className="w-3.5 h-3.5" />
                            <span>保存完了</span>
                          </span>
                        )}
                      </div>

                      <textarea
                        rows={3}
                        value={editingNotes[ex.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingNotes((prev) => ({ ...prev, [ex.id]: val }));
                        }}
                        placeholder="例: シートの高さ4番、グリップは広めに持つ、足の位置は前寄りで..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition leading-relaxed"
                      />

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSaveNote(ex.id)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl text-xs font-bold text-white flex items-center space-x-1.5 transition cursor-pointer shadow-md shadow-cyan-950/40"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>メモを保存</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ExerciseDictionary;