/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CinematicPlayer } from './components/CinematicPlayer';
import { GameHud } from './components/GameHud';
import { GameModal } from './components/GameModal';
import { OptionsModal } from './components/OptionsModal';
import { TitleScreen } from './components/TitleScreen';
import { DoomEngine } from './game/engine';
import { Difficulty, HudSnapshot, WeaponId } from './game/types';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<DoomEngine | null>(null);
  const introPlayedRef = useRef(false);
  const endingShownForVictoryRef = useRef(false);
  const pendingStartDifficultyRef = useRef<Difficulty | null>(null);

  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [startSectorIndex, setStartSectorIndex] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [cinematicMode, setCinematicMode] = useState<'intro' | 'ending' | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const engine = new DoomEngine(mount, (snapshot) => {
      setHud(snapshot);
      if (snapshot.phase === 'playing') {
        setOptionsOpen(false);
        endingShownForVictoryRef.current = false;
      } else if (snapshot.phase === 'victory' && !endingShownForVictoryRef.current) {
        endingShownForVictoryRef.current = true;
        setCinematicMode('ending');
      }
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setCinematicActive(Boolean(cinematicMode));
  }, [cinematicMode]);

  const handleSelectDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d);
    engineRef.current?.setDifficulty(d);
  }, []);

  const handleSelectStartSector = useCallback((idx: number) => {
    setStartSectorIndex(idx);
    engineRef.current?.setStartSector(idx);
  }, []);

  const handleChangeSensitivity = useCallback((val: number) => {
    engineRef.current?.setSensitivity(val);
  }, []);

  const handleToggleInvertY = useCallback(() => {
    const next = !(hud?.invertY ?? false);
    engineRef.current?.setInvertY(next);
  }, [hud?.invertY]);

  const handleStart = useCallback(
    (d: Difficulty) => {
      setOptionsOpen(false);
      if (startSectorIndex === 0 && !introPlayedRef.current) {
        introPlayedRef.current = true;
        pendingStartDifficultyRef.current = d;
        setCinematicMode('intro');
        return;
      }
      engineRef.current?.startGame(d, startSectorIndex);
    },
    [startSectorIndex],
  );

  const handleOpenIntro = useCallback(() => {
    setOptionsOpen(false);
    pendingStartDifficultyRef.current = null;
    setCinematicMode('intro');
  }, []);

  const handleWatchEnding = useCallback(() => {
    setOptionsOpen(false);
    setCinematicMode('ending');
  }, []);

  const handleCompleteCinematic = useCallback(() => {
    const currentMode = cinematicMode;
    setCinematicMode(null);
    if (currentMode === 'intro' && pendingStartDifficultyRef.current) {
      const diff = pendingStartDifficultyRef.current;
      pendingStartDifficultyRef.current = null;
      engineRef.current?.startGame(diff, startSectorIndex);
    }
  }, [cinematicMode, startSectorIndex]);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleSelectWeapon = useCallback((id: WeaponId) => {
    engineRef.current?.selectWeapon(id);
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    setOptionsOpen(false);
    engineRef.current?.resumeGame();
  }, []);

  const handleRestart = useCallback(() => {
    setOptionsOpen(false);
    engineRef.current?.restartSector();
  }, []);

  const handleRestartCampaign = useCallback(() => {
    setOptionsOpen(false);
    setStartSectorIndex(0);
    engineRef.current?.restartCampaign();
  }, []);

  const handleNextSector = useCallback(() => {
    engineRef.current?.nextSector();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setOptionsOpen(false);
    engineRef.current?.returnToTitle();
  }, []);

  const handleOpenOptions = useCallback(() => {
    setOptionsOpen(true);
  }, []);

  const handleCloseOptions = useCallback(() => {
    setOptionsOpen(false);
  }, []);

  const activeDifficulty = hud?.difficulty ?? difficulty;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#09080a]">
      {/* Isolated WebGL canvas mount */}
      <div ref={mountRef} className="w-full h-full" />

      {hud && hud.phase === 'title' && (
        <TitleScreen
          difficulty={activeDifficulty}
          startSectorIndex={startSectorIndex}
          muted={hud.muted}
          gamepadConnected={hud.gamepadConnected}
          optionsOpen={optionsOpen}
          cinematicOpen={Boolean(cinematicMode)}
          onStart={handleStart}
          onOpenIntro={handleOpenIntro}
          onOpenOptions={handleOpenOptions}
          onToggleMute={handleToggleMute}
        />
      )}

      {hud && hud.phase === 'playing' && (
        <GameHud
          hud={hud}
          onSelectWeapon={handleSelectWeapon}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
        />
      )}

      {hud &&
        (hud.phase === 'paused' ||
          hud.phase === 'sector_clear' ||
          hud.phase === 'victory' ||
          hud.phase === 'gameover') && (
          <GameModal
            hud={hud}
            optionsOpen={optionsOpen}
            cinematicOpen={Boolean(cinematicMode)}
            onResume={handleResume}
            onRestart={handleRestart}
            onRestartCampaign={handleRestartCampaign}
            onNextSector={handleNextSector}
            onOpenOptions={handleOpenOptions}
            onWatchEnding={handleWatchEnding}
            onTitle={handleReturnTitle}
          />
        )}

      {hud && optionsOpen && (
        <OptionsModal
          difficulty={activeDifficulty}
          startSectorIndex={startSectorIndex}
          sensitivity={hud.sensitivity}
          invertY={hud.invertY}
          muted={hud.muted}
          gamepadConnected={hud.gamepadConnected}
          gamepadName={hud.gamepadName}
          gamepadBlocked={hud.gamepadBlocked}
          inGame={hud.phase === 'paused'}
          onSelectDifficulty={handleSelectDifficulty}
          onSelectStartSector={handleSelectStartSector}
          onChangeSensitivity={handleChangeSensitivity}
          onToggleInvertY={handleToggleInvertY}
          onToggleMute={handleToggleMute}
          onClose={handleCloseOptions}
        />
      )}

      {hud && cinematicMode && (
        <CinematicPlayer
          mode={cinematicMode}
          muted={hud.muted}
          onToggleMute={handleToggleMute}
          onComplete={handleCompleteCinematic}
        />
      )}
    </main>
  );
}
