import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

const BANNER_MS = 3000;

/** Fun message for a rejected defense; hides itself after a moment. */
export function BoutBanner() {
  const banner = useGameStore((s) => s.banner);
  const nickname = useGameStore((s) =>
    s.banner ? s.game?.players.find((p) => p.id === s.banner?.playerId)?.nickname : undefined,
  );

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => useGameStore.getState().clearBanner(), BANNER_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  if (!banner) return null;
  return (
    <div className="banner" role="alert" key={banner.id}>
      {nickname ?? 'Someone'} tried to beat it with that… Nice try, but no 🙅
    </div>
  );
}
