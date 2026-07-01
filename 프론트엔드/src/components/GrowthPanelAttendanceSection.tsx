import { memo } from 'react';
import type { AttendanceUiStats } from '../game/attendance';

type GrowthPanelAttendanceSectionProps = {
  attendance: AttendanceUiStats;
  onClaimAttendanceDaily?: () => void;
  onClaimAttendanceStreak?: () => void;
  claimingAttendanceDaily?: boolean;
  claimingAttendanceStreak?: boolean;
};

function GrowthPanelAttendanceSectionComponent({
  attendance,
  onClaimAttendanceDaily,
  onClaimAttendanceStreak,
  claimingAttendanceDaily = false,
  claimingAttendanceStreak = false,
}: GrowthPanelAttendanceSectionProps) {
  return (
    <div
      className={`growth-panel__attendance${attendance.goalMetToday ? ' growth-panel__attendance--complete' : ''}`}
      aria-label={`출석 체크 오늘 ${Math.min(attendance.harvestsToday, attendance.dailyGoal)}/${attendance.dailyGoal}회, 연속 ${attendance.streak}/${attendance.streakTarget}일`}
    >
      <div className="growth-panel__attendance-head">
        <span className="growth-panel__attendance-icon" aria-hidden="true">
          📅
        </span>
        <span className="growth-panel__attendance-label">출석 체크</span>
        <strong className="growth-panel__attendance-today">
          오늘 {Math.min(attendance.harvestsToday, attendance.dailyGoal)}/{attendance.dailyGoal}회
        </strong>
      </div>
      <div className="growth-panel__attendance-track-row">
        <div className="growth-panel__attendance-track" aria-hidden="true">
          <div
            className={`growth-panel__attendance-fill${attendance.goalMetToday ? ' growth-panel__attendance-fill--complete' : ''}`}
            style={{ width: `${attendance.progressPercent}%` }}
          />
        </div>
        <span className="growth-panel__attendance-streak">
          연속 {attendance.streak}/{attendance.streakTarget}일
        </span>
      </div>
      <p className="growth-panel__attendance-note">
        {attendance.dailyClaimedToday
          ? '오늘 출석 보상을 받았어요. 내일도 이어가면 연속일이 쌓여요.'
          : attendance.goalMetToday
            ? '목표 달성! 아래 버튼으로 출석 보상을 받아 주세요.'
            : `커피나무 100% ${attendance.dailyGoal}번 · 일일 ${attendance.dailyRewardCups}잔 · ${attendance.streakTarget}일 연속 +${attendance.bonusCups}잔`}
      </p>
      {(attendance.canClaimDaily || attendance.canClaimStreakBonus) && (
        <div className="growth-panel__attendance-rewards">
          {attendance.canClaimDaily && (
            <button
              type="button"
              className="growth-panel__attendance-reward-btn"
              disabled={claimingAttendanceDaily}
              onClick={onClaimAttendanceDaily}
            >
              {claimingAttendanceDaily
                ? '광고 확인 중…'
                : `광고 보고 내린 커피 ${attendance.dailyRewardCups}잔 받기`}
            </button>
          )}
          {attendance.canClaimStreakBonus && (
            <button
              type="button"
              className="growth-panel__attendance-reward-btn growth-panel__attendance-reward-btn--streak"
              disabled={claimingAttendanceStreak}
              onClick={onClaimAttendanceStreak}
            >
              {claimingAttendanceStreak
                ? '받는 중…'
                : `연속 7일 혜택 +${attendance.bonusCups}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const GrowthPanelAttendanceSection = memo(GrowthPanelAttendanceSectionComponent);
