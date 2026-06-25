import type { ReactNode } from 'react';
import type { DailyGameId } from '../../services/dailyGamePick';
import { MinigameCoverImage } from './MinigameCoverImage';

type MinigameCoverPanelProps = {
  gameId: DailyGameId;
  compact?: boolean;
  victory?: boolean;
  withControls?: boolean;
  /** 표지 이미지 상단 여백 오버레이 */
  header?: ReactNode;
  /** 게임 진행 중(표지 접힘)일 때만 아래에 표시 */
  body?: ReactNode;
  overlay?: ReactNode;
  controls?: ReactNode;
  className?: string;
};

export function MinigameCoverPanel({
  gameId,
  compact = false,
  victory = false,
  withControls = false,
  header,
  body,
  overlay,
  controls,
  className = '',
}: MinigameCoverPanelProps) {
  const panelClass = [
    'minigame-cover-hero',
    className,
    victory ? 'minigame-cover-hero--victory' : '',
    compact ? 'minigame-cover-hero--compact' : '',
    withControls ? 'minigame-cover-hero--with-controls' : '',
    header ? 'minigame-cover-hero--with-header' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showHeaderOnCover = Boolean(header) && (!compact || victory);
  const showBodyBelow = Boolean(body) && compact && !victory;

  return (
    <section className={panelClass}>
      <div className="minigame-cover-hero__media">
        <MinigameCoverImage gameId={gameId} />
        {showHeaderOnCover ? <div className="minigame-cover-hero__header">{header}</div> : null}
        {controls ? <div className="minigame-cover-hero__controls">{controls}</div> : null}
        {overlay ? <div className="minigame-cover-hero__overlay">{overlay}</div> : null}
      </div>
      {showBodyBelow ? <div className="minigame-cover-hero__body">{body}</div> : null}
    </section>
  );
}

/** 난이도 선택 버튼 — 표지 이미지 하단 오버레이용 */
export function MinigameCoverMissionSelect({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="ai-mission-select-title ai-mission-select-title--on-cover">
        <strong>{title}</strong>
        <small>{hint}</small>
      </div>
      <div className="ai-mission-select ai-mission-select--on-cover">{children}</div>
    </>
  );
}
