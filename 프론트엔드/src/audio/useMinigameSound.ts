import { useCallback } from 'react';
import { useSound } from './SoundProvider';
import type { SfxId } from './types';

export function useMinigameSound() {
  const { unlock, play } = useSound();

  return useCallback(
    async (id: SfxId) => {
      await unlock();
      play(id);
    },
    [unlock, play],
  );
}
