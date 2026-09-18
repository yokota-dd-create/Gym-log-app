import type { MuscleCategory } from '../types/database';

const HIGHLIGHT_COLOR: Record<MuscleCategory, string> = {
  chest: '#f43f5e',
  back: '#3b82f6',
  legs: '#10b981',
  shoulders: '#f59e0b',
  arms: '#a855f7',
  core: '#06b6d4',
};

const BODY_FILL = '#d4d4d8';
const BODY_STROKE = '#a1a1aa';

const TORSO_PATH = 'M30 35 Q30 33 33 33 L67 33 Q70 33 70 35 L72 90 Q72 94 68 94 L32 94 Q28 94 28 90 Z';
const LEFT_ARM_PATH = 'M28 37 Q18 38 15 48 L11 95 Q10 99 14 99 L20 99 Q23 99 23 95 L26 50 Z';
const RIGHT_ARM_PATH = 'M72 37 Q82 38 85 48 L89 95 Q90 99 86 99 L80 99 Q77 99 77 95 L74 50 Z';
const LEFT_LEG_PATH = 'M32 94 L30 190 Q30 195 35 195 L42 195 Q45 195 45 190 L47 94 Z';
const RIGHT_LEG_PATH = 'M68 94 L70 190 Q70 195 65 195 L58 195 Q55 195 55 190 L53 94 Z';

export const MuscleDiagram: React.FC<{ category: MuscleCategory; className?: string }> = ({ category, className }) => {
  const color = HIGHLIGHT_COLOR[category];

  return (
    <svg viewBox="0 0 100 210" className={className}>
      <g stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round">
        <circle cx="50" cy="16" r="13" fill={BODY_FILL} />
        <rect x="44" y="27" width="12" height="8" fill={BODY_FILL} />
        <path d={TORSO_PATH} fill={BODY_FILL} />
        <path d={LEFT_ARM_PATH} fill={BODY_FILL} />
        <path d={RIGHT_ARM_PATH} fill={BODY_FILL} />
        <path d={LEFT_LEG_PATH} fill={BODY_FILL} />
        <path d={RIGHT_LEG_PATH} fill={BODY_FILL} />
      </g>

      {category === 'chest' && (
        <path d="M33 38 Q50 34 67 38 L66 58 Q50 63 34 58 Z" fill={color} opacity="0.9" />
      )}
      {category === 'shoulders' && (
        <>
          <circle cx="27" cy="40" r="9" fill={color} opacity="0.9" />
          <circle cx="73" cy="40" r="9" fill={color} opacity="0.9" />
        </>
      )}
      {category === 'arms' && (
        <>
          <path d={LEFT_ARM_PATH} fill={color} opacity="0.9" />
          <path d={RIGHT_ARM_PATH} fill={color} opacity="0.9" />
        </>
      )}
      {category === 'core' && (
        <rect x="34" y="60" width="32" height="32" rx="4" fill={color} opacity="0.9" />
      )}
      {category === 'legs' && (
        <>
          <path d={LEFT_LEG_PATH} fill={color} opacity="0.9" />
          <path d={RIGHT_LEG_PATH} fill={color} opacity="0.9" />
        </>
      )}
      {category === 'back' && (
        <path d={TORSO_PATH} fill={color} opacity="0.9" />
      )}
    </svg>
  );
};

export default MuscleDiagram;
