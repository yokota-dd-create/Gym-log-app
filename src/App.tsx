import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import './App.css';

interface WorkoutSet {
  id: string;
  part: string;
  exercise: string;
  weight: number;
  reps: number;
  created_at: string;
}

const BODY_PARTS = ['胸', '背中', '脚', '肩', '腕'];
const EXERCISES: Record<string, string[]> = {
  胸: ['ベンチプレス', 'インクラインDBプレス', 'ダンベルフライ'],
  背中: ['デッドリフト', 'ラットプルダウン', 'ベントオーバーロウ'],
  脚: ['スクワット', 'レッグプレス', 'レッグエクステンション'],
  肩: ['ショルダープレス', 'サイドレイズ', 'リアレイズ'],
  腕: ['アームカール', 'スカルクラッシャー', 'トライセプスPush']
};

export default function App() {
  const [selectedPart, setSelectedPart] = useState<string>('胸');
  const [selectedExercise, setSelectedExercise] = useState<string>('ベンチプレス');
  const [weight, setWeight] = useState<number>(60);
  const [reps, setReps] = useState<number>(10);
  const [logs, setLogs] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // タイマー状態
  const [seconds, setSeconds] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  // 初期ロード：Supabaseから記録一覧を取得
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching logs:', error);
    } else if (data) {
      setLogs(data);
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (isActive && seconds > 0) {
      interval = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0) {
      setIsActive(false);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const startTimer = (sec: number) => {
    setSeconds(sec);
    setIsActive(true);
  };

  // Supabaseへデータを保存
  const handleAddSet = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('workouts')
      .insert([
        {
          part: selectedPart,
          exercise: selectedExercise,
          weight,
          reps
        }
      ])
      .select();

    setLoading(false);

    if (error) {
      alert('保存に失敗しました: ' + error.message);
    } else if (data && data[0]) {
      setLogs([data[0], ...logs]);
      startTimer(90);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <h2 style={{ margin: 0 }}>Gym Tracker</h2>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date().toLocaleDateString()}</span>
      </div>

      {/* インターバルタイマー */}
      <div className="timer-box">
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>REST TIMER</div>
          <div className="timer-display">
            {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
          </div>
        </div>
        <div className="btn-group">
          <button className="btn-chip" onClick={() => startTimer(60)}>+60s</button>
          <button className="btn-chip" onClick={() => startTimer(90)}>+90s</button>
          <button className="btn-chip" onClick={() => setIsActive(false)}>Stop</button>
        </div>
      </div>

      {/* 部位選択 */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>部位</label>
        <div className="btn-group" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {BODY_PARTS.map(part => (
            <button
              key={part}
              className={`btn-chip ${selectedPart === part ? 'active' : ''}`}
              onClick={() => {
                setSelectedPart(part);
                setSelectedExercise(EXERCISES[part][0]);
              }}
            >
              {part}
            </button>
          ))}
        </div>
      </div>

      {/* 種目選択 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>種目</label>
        <div className="btn-group" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {EXERCISES[selectedPart].map(ex => (
            <button
              key={ex}
              className={`btn-chip ${selectedExercise === ex ? 'active' : ''}`}
              onClick={() => setSelectedExercise(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* 重量・レップ数入力フォーム */}
      <div className="input-card">
        <div className="input-row">
          <div className="input-group">
            <label>重量 (kg)</label>
            <input
              type="number"
              step="2.5"
              value={weight}
              onChange={e => setWeight(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="input-group">
            <label>回数 (Reps)</label>
            <input
              type="number"
              value={reps}
              onChange={e => setReps(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={handleAddSet}
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '保存中...' : 'セット記録 & タイマースタート'}
        </button>
      </div>

      {/* ログ一覧 */}
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>記録一覧 ({logs.length} セット)</h3>
      <div className="history-list">
        {logs.map(log => (
          <div key={log.id} className="history-item">
            <div>
              <span style={{ fontWeight: 'bold' }}>{log.exercise}</span>
              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ fontWeight: 'bold', color: '#38bdf8' }}>
              {log.weight} kg × {log.reps} reps
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}