import { useEffect, useRef } from 'react';
import { STAGES } from '../game/constants';
import type { GameState } from '../game/types';
import { useSound } from './SoundProvider';

type UseGameAudioArgs = {
  state: GameState;
  growth: number;
  isHolding: boolean;
  lastEarned: number | null;
  showOnboarding: boolean;
};

export function useGameAudio({
  state,
  growth,
  isHolding,
  lastEarned,
  showOnboarding,
}: UseGameAudioArgs) {
  const { play, startWaterLoop, stopWaterLoop, startAmbient, unlock } = useSound();
  const prevGrowth = useRef(growth);
  const prevHolding = useRef(isHolding);
  const prevRedeemed = useRef(state.redeemed);
  const prevLastEarned = useRef(lastEarned);

  useEffect(() => {
    if (showOnboarding) return;
    void unlock().then(() => startAmbient());
  }, [showOnboarding, unlock, startAmbient]);

  useEffect(() => {
    if (isHolding && !prevHolding.current) {
      play('waterStart');
      startWaterLoop();
    }
    if (!isHolding && prevHolding.current) {
      stopWaterLoop();
    }
    prevHolding.current = isHolding;
  }, [isHolding, play, startWaterLoop, stopWaterLoop]);

  useEffect(() => {
    const prev = prevGrowth.current;
    if (growth > prev) {
      if (growth >= 100 && prev < 100) {
        play('waterComplete');
      } else {
        const crossed = STAGES.filter((s) => s.min < 100).find(
          (stage) => prev < stage.min && growth >= stage.min,
        );
        if (crossed) play(crossed.min >= 75 ? 'waterComplete' : 'growth');
      }
    }
    prevGrowth.current = growth;
  }, [growth, play]);

  useEffect(() => {
    if (lastEarned !== null && lastEarned !== prevLastEarned.current) {
      play('coin');
    }
    prevLastEarned.current = lastEarned;
  }, [lastEarned, play]);

  useEffect(() => {
    if (state.redeemed && !prevRedeemed.current) {
      play('win');
    }
    prevRedeemed.current = state.redeemed;
  }, [state.redeemed, play]);
}
