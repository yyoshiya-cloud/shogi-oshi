import React from 'react';
import { OshiBadge } from '../types/shogi';
import { Heart, Sparkles, Flame, Lightbulb } from 'lucide-react';

export interface OshiBadgeConfig {
  badge: OshiBadge;
  label: string;
  desc: string;
  emoji: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  bg: string;
  text: string;
  border: string;
  ring: string;
}

export const OSHI_BADGE_CONFIGS: Record<OshiBadge, OshiBadgeConfig> = {
  本命: {
    badge: '本命',
    label: '本命',
    desc: '最推し・一筋に応援する棋士',
    emoji: '❤️',
    Icon: Heart,
    bg: 'bg-rose-500/20 hover:bg-rose-500/30',
    text: 'text-rose-300',
    border: 'border-rose-500/50',
    ring: 'ring-rose-500',
  },
  神推し: {
    badge: '神推し',
    label: '神推し',
    desc: '尊敬し崇拝する最高の推し',
    emoji: '✨',
    Icon: Sparkles,
    bg: 'bg-amber-500/20 hover:bg-amber-500/30',
    text: 'text-amber-300',
    border: 'border-amber-500/50',
    ring: 'ring-amber-500',
  },
  激推し: {
    badge: '激推し',
    label: '激推し',
    desc: '熱烈に応援・対局を見逃せない',
    emoji: '🔥',
    Icon: Flame,
    bg: 'bg-purple-500/20 hover:bg-purple-500/30',
    text: 'text-purple-300',
    border: 'border-purple-500/50',
    ring: 'ring-purple-500',
  },
  注目: {
    badge: '注目',
    label: '注目',
    desc: '今後の活躍や対局をチェック',
    emoji: '💡',
    Icon: Lightbulb,
    bg: 'bg-sky-500/20 hover:bg-sky-500/30',
    text: 'text-sky-300',
    border: 'border-sky-500/50',
    ring: 'ring-sky-500',
  },
};

export const OSHI_BADGE_OPTIONS: OshiBadgeConfig[] = [
  OSHI_BADGE_CONFIGS['本命'],
  OSHI_BADGE_CONFIGS['神推し'],
  OSHI_BADGE_CONFIGS['激推し'],
  OSHI_BADGE_CONFIGS['注目'],
];

export function getOshiBadgeConfig(badge: OshiBadge): OshiBadgeConfig {
  return OSHI_BADGE_CONFIGS[badge] || OSHI_BADGE_CONFIGS['注目'];
}

export function renderOshiBadgeIcon(
  badge: OshiBadge,
  size: number = 12,
  className?: string
): React.ReactNode {
  const config = getOshiBadgeConfig(badge);
  const IconComponent = config.Icon;
  const defaultClass =
    badge === '注目'
      ? 'fill-current stroke-[2.2]'
      : 'fill-current';
  return <IconComponent size={size} className={className || defaultClass} />;
}

interface OshiBadgeTagProps {
  badge: OshiBadge;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showEmojiPrefix?: boolean;
}

export const OshiBadgeTag: React.FC<OshiBadgeTagProps> = ({
  badge,
  size = 'xs',
  className = '',
  showEmojiPrefix = false,
}) => {
  const config = getOshiBadgeConfig(badge);
  const IconComponent = config.Icon;

  const sizeClasses = {
    xs: 'text-[10px] font-black px-2 py-0.5 gap-1',
    sm: 'text-[11px] font-black px-2.5 py-0.5 gap-1.5',
    md: 'text-xs font-black px-3 py-1 gap-1.5',
  }[size];

  const iconSizes = {
    xs: 10,
    sm: 12,
    md: 14,
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showEmojiPrefix ? (
        <span className="text-[11px] leading-none">{config.emoji}</span>
      ) : (
        <IconComponent
          size={iconSizes}
          className={badge === '注目' ? 'fill-current stroke-[2.2]' : 'fill-current'}
        />
      )}
      <span>{config.label}</span>
    </span>
  );
};
