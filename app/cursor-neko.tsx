'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

type Motion = 'running' | 'awake' | 'stop' | 'jare' | 'kaki' | 'akubi' | 'sleep' | 'togi';
type Direction = 'right' | 'dwright' | 'down' | 'dwleft' | 'left' | 'upleft' | 'up' | 'upright';
type TogiDirection = 'u' | 'd' | 'l' | 'r';

// Browser port of winebarrel/Neco's CC0 state machine and public-domain oneko sprites.
const SPEED = 360;
const STOP_DISTANCE = 24;
const WAKE_DISTANCE = 40;
const EDGE_MARGIN = 24;
const ANIM_TICKS = 7;
const SLEEP_ANIM_TICKS = 30;

const stateDurations: Partial<Record<Motion, number>> = {
  awake: 375,
  stop: 500,
  jare: 1250,
  togi: 1250,
  kaki: 500,
  akubi: 750,
};

// Browser Y grows downward, so the vertical direction names are inverted from AppKit.
const directions: Direction[] = ['right', 'dwright', 'down', 'dwleft', 'left', 'upleft', 'up', 'upright'];
const spriteNames = [
  'awake', 'down1', 'down2', 'dtogi1', 'dtogi2', 'dwleft1', 'dwleft2', 'dwright1', 'dwright2',
  'jare2', 'kaki1', 'kaki2', 'left1', 'left2', 'ltogi1', 'ltogi2', 'mati2', 'mati3',
  'right1', 'right2', 'rtogi1', 'rtogi2', 'sleep1', 'sleep2', 'up1', 'up2', 'upleft1',
  'upleft2', 'upright1', 'upright2', 'utogi1', 'utogi2',
];

function directionFor(dx: number, dy: number): Direction {
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return directions[((sector % 8) + 8) % 8];
}

export default function CursorNeko({ enabled }: { enabled: boolean }) {
  const nekoRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const neko = nekoRef.current;
    const sprite = spriteRef.current;
    if (!enabled || !neko || !sprite) return;

    const desktopQuery = window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    spriteNames.forEach((name) => {
      const image = new window.Image();
      image.src = `/neko-sprites/${name}.png`;
    });

    let active = desktopQuery.matches && !reducedMotionQuery.matches;
    let animationFrame = 0;
    let previousTime = performance.now();
    let stateStarted = previousTime;
    let tick = 0;
    let motion: Motion = 'sleep';
    let direction: Direction = 'right';
    let togiDirection: TogiDirection = 'd';
    let headingDx = 0;
    let headingDy = 0;
    let currentSprite = '';
    let hasPointer = false;
    const position = { x: Math.max(42, window.innerWidth * 0.18), y: Math.max(42, window.innerHeight - 94) };
    const target = { ...position };

    const setMotion = (next: Motion, time: number) => {
      if (motion === next) return;
      motion = next;
      stateStarted = time;
      neko.dataset.motion = next;
    };

    const frameName = () => {
      const phase = Math.floor(tick / ANIM_TICKS) % 2;
      switch (motion) {
        case 'running': return `${direction}${phase === 0 ? '1' : '2'}`;
        case 'awake': return 'awake';
        case 'stop': return 'mati2';
        case 'jare': return phase === 0 ? 'jare2' : 'mati2';
        case 'kaki': return phase === 0 ? 'kaki1' : 'kaki2';
        case 'akubi': return 'mati3';
        case 'sleep': return Math.floor(tick / SLEEP_ANIM_TICKS) % 2 === 0 ? 'sleep1' : 'sleep2';
        case 'togi': return `${togiDirection}togi${phase === 0 ? '1' : '2'}`;
      }
    };

    const render = () => {
      position.x = Math.max(32, Math.min(window.innerWidth - 32, position.x));
      position.y = Math.max(32, Math.min(window.innerHeight - 32, position.y));
      neko.style.transform = `translate3d(${Math.round(position.x - 32)}px, ${Math.round(position.y - 32)}px, 0)`;
      const nextSprite = frameName();
      if (nextSprite !== currentSprite) {
        currentSprite = nextSprite;
        sprite.src = `/neko-sprites/${nextSprite}.png`;
      }
    };

    const chooseAfterStop = (time: number) => {
      if (headingDx < 0 && position.x <= 32 + EDGE_MARGIN) togiDirection = 'l';
      else if (headingDx > 0 && position.x >= window.innerWidth - 32 - EDGE_MARGIN) togiDirection = 'r';
      else if (headingDy < 0 && position.y <= 32 + EDGE_MARGIN) togiDirection = 'u';
      else if (headingDy > 0 && position.y >= window.innerHeight - 32 - EDGE_MARGIN) togiDirection = 'd';
      else if (Math.random() < 0.5) {
        const choices: TogiDirection[] = ['u', 'd', 'l', 'r'];
        togiDirection = choices[Math.floor(Math.random() * choices.length)];
      } else {
        setMotion('jare', time);
        return;
      }
      setMotion('togi', time);
    };

    const updateAvailability = () => {
      active = desktopQuery.matches && !reducedMotionQuery.matches;
      neko.hidden = !active;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      target.x = Math.max(0, Math.min(window.innerWidth, event.clientX));
      target.y = Math.max(0, Math.min(window.innerHeight, event.clientY));
      hasPointer = true;
    };

    const update = (time: number) => {
      const deltaMs = Math.min(34, time - previousTime);
      const delta = deltaMs / 1000;
      previousTime = time;
      tick += deltaMs / (1000 / 60);

      if (active) {
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const distance = Math.hypot(dx, dy);
        const stateAge = time - stateStarted;

        switch (motion) {
          case 'running':
            if (!hasPointer || distance <= STOP_DISTANCE) {
              setMotion('stop', time);
            } else {
              direction = directionFor(dx, dy);
              headingDx = dx;
              headingDy = dy;
              const step = Math.min(SPEED * delta, distance);
              position.x += (dx / distance) * step;
              position.y += (dy / distance) * step;
            }
            break;
          case 'awake':
            if (stateAge >= stateDurations.awake!) {
              direction = directionFor(dx, dy);
              setMotion('running', time);
            }
            break;
          case 'stop':
            if (distance > STOP_DISTANCE) setMotion('awake', time);
            else if (stateAge >= stateDurations.stop!) chooseAfterStop(time);
            break;
          case 'jare':
          case 'togi':
            if (distance > STOP_DISTANCE) setMotion('awake', time);
            else if (stateAge >= stateDurations[motion]!) setMotion('kaki', time);
            break;
          case 'kaki':
            if (distance > STOP_DISTANCE) setMotion('awake', time);
            else if (stateAge >= stateDurations.kaki!) setMotion('akubi', time);
            break;
          case 'akubi':
            if (distance > STOP_DISTANCE) setMotion('awake', time);
            else if (stateAge >= stateDurations.akubi!) setMotion('sleep', time);
            break;
          case 'sleep':
            if (hasPointer && distance > WAKE_DISTANCE) setMotion('awake', time);
            break;
        }

        render();
      }
      animationFrame = window.requestAnimationFrame(update);
    };

    neko.dataset.motion = motion;
    updateAvailability();
    render();
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    desktopQuery.addEventListener('change', updateAvailability);
    reducedMotionQuery.addEventListener('change', updateAvailability);
    animationFrame = window.requestAnimationFrame(update);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('pointermove', onPointerMove);
      desktopQuery.removeEventListener('change', updateAvailability);
      reducedMotionQuery.removeEventListener('change', updateAvailability);
    };
  }, [enabled]);

  return (
    <div ref={nekoRef} className="cursor-neko" hidden aria-hidden="true">
      <Image ref={spriteRef} src="/neko-sprites/sleep1.png" alt="" width={32} height={32} draggable={false} unoptimized priority />
    </div>
  );
}
