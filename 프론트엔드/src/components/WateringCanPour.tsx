import { memo, type CSSProperties } from 'react';
import { WATERING_CAN_SRC } from '../game/constants';
import './WateringCanPour.css';

type WateringCanPourProps = {
  progress: number;
  active: boolean;
};

/** 물주기 홀드 중 화분 위 물뿌리개 붓기 모션 */
function WateringCanPourComponent({ progress, active }: WateringCanPourProps) {
  if (!active) return null;

  const pour = Math.min(100, Math.max(0, progress));

  return (
    <div
      className="watering-can-pour"
      style={{ '--pour-progress': String(pour) } as CSSProperties}
      aria-hidden="true"
    >
      <img className="watering-can-pour__can" src={WATERING_CAN_SRC} alt="" draggable={false} />
      {pour >= 18 && (
        <span className="watering-can-pour__stream">
          <span className="watering-can-pour__drop" />
          <span className="watering-can-pour__drop watering-can-pour__drop--2" />
          <span className="watering-can-pour__drop watering-can-pour__drop--3" />
        </span>
      )}
    </div>
  );
}

export const WateringCanPour = memo(WateringCanPourComponent);
