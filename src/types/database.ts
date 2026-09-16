export type MuscleCategory = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';
export type EquipmentType = 'machine' | 'cable' | 'free_weight' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  category: MuscleCategory;
  equipment_type: EquipmentType;
  icon_name: string;
  image_url?: string | null; // 機器画像のURL
  default_tips: string | null;
  created_at?: string;
  user_note?: string;
}

export interface Workout {
  id: string;
  workout_date: string;
  target_categories: MuscleCategory[];
  duration_minutes: number;
  estimated_calories: number;
  memo: string | null;
  created_at?: string;
}

export interface RestOverride {
  id: string;
  rest_date: string;
  created_at?: string;
}

export interface WorkoutSet {
  id?: string;
  workout_id?: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  is_completed: boolean;
  created_at?: string;
}

export interface CategoryMeta {
  label: string;
  color: string;
  badgeClass: string;
}

export const CATEGORY_MAP: Record<MuscleCategory, CategoryMeta> = {
  chest: { label: '胸', color: 'bg-red-500', badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30' },
  back: { label: '背中', color: 'bg-blue-500', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  legs: { label: '脚', color: 'bg-green-500', badgeClass: 'bg-green-500/10 text-green-400 border-green-500/30' },
  shoulders: { label: '肩', color: 'bg-amber-500', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  arms: { label: '腕', color: 'bg-purple-500', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  core: { label: '腹・体幹', color: 'bg-cyan-500', badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
};