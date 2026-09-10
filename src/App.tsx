import { useState, useEffect } from 'react';
import './App.css';

interface WorkoutSet {
  id: string;
  part: string;
  exercise: string;
  weight: number;
  reps: number;
  timestamp: string;
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

  // タイマー状態
  const [seconds, setSeconds] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

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

  const handleAddSet = () => {
    const newLog: WorkoutSet = {
      id: crypto.randomUUID(),
      part: selectedPart,
      exercise: selectedExercise,
      weight,
      reps,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setLogs([newLog, ...logs]);
    // 記録完了時に自動で90秒タイマー始動
    startTimer(90);
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
        <button className="btn-primary" onClick={handleAddSet}>
          セット記録 & タイマースタート
        </button>
      </div>

      {/* 今日のログ一覧 */}
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>今日の記録 ({logs.length} セット)</h3>
      <div className="history-list">
        {logs.map((log, index) => (
          <div key={log.id} className="history-item">
            <div>
              <span style={{ fontWeight: 'bold' }}>{log.exercise}</span>
              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{log.timestamp}</span>
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