'use client';

import Image from 'next/image';
import {
  Activity,
  Bell,
  BookOpen,
  Cat,
  ChartNoAxesCombined,
  ChevronLeft,
  FileText,
  FolderOpen,
  HelpCircle,
  Info,
  MessageSquareText,
  Music2,
  Moon,
  Pause,
  Play,
  ScrollText,
  Trash2,
  Utensils,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { FormEvent, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import PonsChart from './pons-chart';
import CursorNeko from './cursor-neko';
import { secretNotes } from './secret-notes';

type AppId = 'welcome' | 'chat' | 'gallery' | 'lore' | 'bibliography' | 'trash' | 'stats' | 'readme' | 'music' | 'chart' | 'secrets';
type WindowInfo = { open: boolean; minimized: boolean; maximized: boolean; x: number; y: number; z: number };
type Message = { from: 'you' | 'neko'; text: string };
type Stats = { hunger: number; happiness: number; energy: number; curiosity: number; friendship: number };
type NoticeKind = 'hungry' | 'sleepy' | 'thought' | 'connection' | 'affection';
type Notice = { id: number; kind: NoticeKind; x: number; y: number; z: number };
type ToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => Promise<object>;
};
type WebMCPDocument = Document & {
  modelContext?: { registerTool: (tool: ToolRegistration, options: { signal: AbortSignal }) => void | Promise<void> };
};

const labels: Record<AppId, string> = {
  welcome: 'Welcome', chat: 'Neko Agent', gallery: 'Neko Pictures', lore: 'Lore Archive',
  bibliography: 'Bibliography',
  trash: 'Trash', stats: 'Neko Stats', readme: 'Read Me', music: 'Neko Radio',
  chart: 'Chart', secrets: 'Secret Notes',
};

const bibliography = [
  { citation: 'Akira, Eliot. “Neko: History of a Software Pet.”', url: 'https://eliotakira.com/neko/' },
  { citation: 'Bankstahl, Michael. “Windows 3.1 Shareware: WNEKO.” Internet Archive, January 1, 1991.', url: 'https://archive.org/details/win3_WNEKO' },
  { citation: 'ChExi. “Cat’s Purring1.Wav.” Freesound.org.', url: 'https://freesound.org/people/ChExi/sounds/646600/' },
  { citation: 'Edizioni, Xenia. “Il Puntatore Come ‘Preda.’” Gigabyte 1, no. 3, 1993.', url: 'https://archive.org/details/Gigabyte03/page/n87/mode/2up?q=neko+kenji+gotoh' },
  { citation: '“Exotic Pets.” PC Review no. 56, June 1996.', url: 'https://archive.org/details/pc-review-56/mode/2up?q=%22digital+pet%22' },
  { citation: '“It’s Neko! (3.0).” NEKO — Welcome to the Web Neko Server!', url: 'https://webneko.net/' },
  { citation: '“The neko fan page.”', url: 'https://web.archive.org/web/20090322195013/http://www.angelfire.com/ct/neko/' },
  { citation: '“Neko Information Page.” Freeware Lagoon.', url: 'http://web.archive.org/web/20020217094047fw_/http://www.geocities.com/siliconvalley/Haven/4173/neko.html' },
  { citation: 'kokoscript. “Neko for PC-98 in Action.” YouTube, December 23, 2020.', url: 'https://youtu.be/DDhIgvoGWM8?si=oxQuKMX3xpg_Mue_' },
  { citation: 'Kusahara, Machiko. “The Art of Creating Subjective Reality: An Analysis of Japanese Digital Pets.” Leonardo 34, no. 4 (2001): 299–302.', url: 'http://www.jstor.org/stable/1577151' },
  { citation: 'Sawyer, Scholle. “The Pet Shop.” MacUser, August 1997.', url: 'https://archive.org/details/MacUser9708August1997/mode/2up?q=%22virtual+pet%22' },
  { citation: 'Weikert, Dave. “Macintosh Disk Library: New Disks — Phase Two.” Washington Apple Pi 14, no. 10, October 1992.', url: 'https://archive.org/details/washingtonapplepijournal1992v14no10/page/n69/mode/2up?q=kenji+gotoh' },
];

const defaultStats: Stats = { hunger: 62, happiness: 78, energy: 54, curiosity: 91, friendship: 12 };

const noticeCopy: Record<NoticeKind, { title: string; body: string; action: string }> = {
  hungry: { title: 'Neko is hungry!', body: 'It has been 3,217 mouse-pixels since the last snack.', action: 'FEED NEKO' },
  sleepy: { title: 'Neko is eepy.', body: 'Background nap recommended. Estimated time: nine lives.', action: 'LET NEKO NAP' },
  thought: { title: 'Loose thought found!', body: 'Neko caught something hiding behind an old browser tab.', action: 'SAVE THOUGHT' },
  connection: { title: 'Paw-to-web connected.', body: 'Neko can now patrol this quiet corner of the internet.', action: 'OK' },
  affection: { title: 'Neko requests attention.', body: 'A small amount of petting may improve system performance.', action: 'PET NEKO' },
};

function MiniNeko({ className = '' }: { className?: string }) {
  return <span className={`mini-neko ${className}`} aria-hidden="true"><Image src="/neko-poster.png" alt="" width={433} height={368} priority /></span>;
}

function DesktopIcon({ icon, label, onOpen }: { icon: ReactNode; label: string; onOpen: () => void }) {
  return <button className="desktop-icon" type="button" onClick={onOpen} aria-label={`Open ${label}`}><span className="desktop-icon-image">{icon}</span><span>{label}</span></button>;
}

function StatRow({ label, value }: { label: string; value: number }) {
  return <div className="stat-row"><span>{label}</span><div className="stat-track"><i style={{ width: `${value}%` }} /></div><b>{value}</b></div>;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

async function requestNekoReply(messages: Message[]) {
  const response = await fetch('/api/neko-chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-12) }),
  });
  const payload = await response.json() as { reply?: string; error?: string };
  if (!response.ok || !payload.reply) throw new Error(payload.error || 'Neko could not answer.');
  return payload.reply;
}

function OSWindow({ id, title, info, width, className = '', children, onClose, onMinimize, onMaximize, onFocus, onDragStart, onDragMove, onDragEnd }: {
  id: AppId; title: string; info: WindowInfo; width: number; className?: string; children: ReactNode;
  onClose: () => void; onMinimize: () => void; onMaximize: () => void; onFocus: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>, id: AppId) => void;
  onDragMove: (event: ReactPointerEvent<HTMLDivElement>, id: AppId) => void;
  onDragEnd: (event: ReactPointerEvent<HTMLDivElement>, id: AppId) => void;
}) {
  if (!info.open || info.minimized) return null;
  return (
    <section className={`os-window ${info.maximized ? 'maximized' : ''} ${className}`} style={{ left: info.x, top: info.y, width, zIndex: info.z }} onPointerDown={onFocus} aria-label={title}>
      <div className="os-titlebar" onPointerDown={(event) => onDragStart(event, id)} onPointerMove={(event) => onDragMove(event, id)} onPointerUp={(event) => onDragEnd(event, id)}>
        <span><Cat size={14} strokeWidth={2.5} /> {title}</span>
        <span className="os-controls"><button type="button" onClick={onMinimize} aria-label={`Minimize ${title}`}>_</button><button type="button" onClick={onMaximize} aria-label={`${info.maximized ? 'Restore' : 'Maximize'} ${title}`}>□</button><button type="button" onClick={onClose} aria-label={`Close ${title}`}>×</button></span>
      </div>
      <div className="os-window-body">{children}</div>
    </section>
  );
}

function initialWindows(initialWindow: AppId): Record<AppId, WindowInfo> {
  return {
    welcome: { open: false, minimized: false, maximized: false, x: 185, y: 38, z: initialWindow === 'welcome' ? 18 : 4 },
    chat: { open: true, minimized: false, maximized: false, x: 755, y: 250, z: 12 },
    gallery: { open: false, minimized: false, maximized: false, x: 390, y: 96, z: 6 },
    lore: { open: true, minimized: false, maximized: false, x: 285, y: 118, z: initialWindow === 'lore' ? 19 : 7 },
    bibliography: { open: false, minimized: false, maximized: false, x: 410, y: 72, z: 6 },
    trash: { open: false, minimized: false, maximized: false, x: 990, y: 58, z: 5 },
    stats: { open: false, minimized: false, maximized: false, x: 32, y: 330, z: 10 },
    readme: { open: false, minimized: false, maximized: false, x: 805, y: 38, z: 8 },
    music: { open: false, minimized: false, maximized: false, x: 820, y: 92, z: 9 },
    chart: { open: false, minimized: false, maximized: false, x: 485, y: 55, z: 11 },
    secrets: { open: false, minimized: false, maximized: false, x: 405, y: 88, z: 9 },
  };
}

export default function Desktop({ initialWindow }: { initialWindow: AppId }) {
  const [windows, setWindows] = useState<Record<AppId, WindowInfo>>(() => initialWindows(initialWindow));
  const [startOpen, setStartOpen] = useState(false);
  const [clock, setClock] = useState('--:--');
  const [messages, setMessages] = useState<Message[]>([{ from: 'neko', text: "hi! i'm neko. what are we figuring out today?" }]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [statsReady, setStatsReady] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [bootVisible, setBootVisible] = useState(true);
  const [bootStarted, setBootStarted] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicVolume, setMusicVolume] = useState(.65);
  const [musicTime, setMusicTime] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [selectedSecret, setSelectedSecret] = useState<number | null>(null);
  const zCounter = useRef(30);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const noticeId = useRef(0);
  const noticeCycle = useRef(0);
  const messagesRef = useRef<Message[]>(messages);
  const drag = useRef<{ id: AppId; px: number; py: number; x: number; y: number } | null>(null);
  const bootTimers = useRef<number[]>([]);

  const focusWindow = (id: AppId) => {
    zCounter.current += 1;
    setWindows((current) => ({ ...current, [id]: { ...current[id], z: zCounter.current } }));
  };
  const openApp = (id: AppId) => {
    zCounter.current += 1;
    setWindows((current) => ({ ...current, [id]: { ...current[id], open: true, minimized: false, z: zCounter.current } }));
    setStartOpen(false);
  };
  const patchWindow = (id: AppId, patch: Partial<WindowInfo>) => setWindows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>, id: AppId) => {
    if ((event.target as HTMLElement).closest('button') || windows[id].maximized) return;
    focusWindow(id);
    drag.current = { id, px: event.clientX, py: event.clientY, x: windows[id].x, y: windows[id].y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>, id: AppId) => {
    if (!drag.current || drag.current.id !== id) return;
    patchWindow(id, { x: Math.max(4, Math.min(window.innerWidth - 180, drag.current.x + event.clientX - drag.current.px)), y: Math.max(43, Math.min(window.innerHeight - 90, drag.current.y + event.clientY - drag.current.py)) });
  };
  const onDragEnd = (event: ReactPointerEvent<HTMLDivElement>, id: AppId) => {
    if (drag.current?.id === id) drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    const format = () => setClock(new Intl.DateTimeFormat('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()));
    format();
    const tick = window.setInterval(format, 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(min-width: 901px)').matches) return;
    const radioWidth = Math.min(440, window.innerWidth - 20);
    zCounter.current += 1;
    setWindows((current) => ({
      ...current,
      music: {
        ...current.music,
        open: true,
        minimized: false,
        x: Math.max(10, window.innerWidth - radioWidth - 22),
        y: Math.max(48, window.innerHeight - 300),
        z: zCounter.current,
      },
    }));
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('neko-stats');
      if (saved) setStats({ ...defaultStats, ...JSON.parse(saved) });
    } catch { /* local stats are optional */ }
    setStatsReady(true);
  }, []);
  useEffect(() => {
    if (!statsReady) return;
    window.localStorage.setItem('neko-stats', JSON.stringify(stats));
  }, [stats, statsReady]);

  useEffect(() => {
    if (bootVisible) return;
    let timer = 0;
    const scheduleNext = () => {
      timer = window.setTimeout(spawn, 90_000 + Math.random() * 60_000);
    };
    const spawn = () => {
      if (document.hidden) {
        scheduleNext();
        return;
      }
      const kinds: NoticeKind[] = ['hungry', 'sleepy', 'thought', 'connection', 'affection'];
      const kind = kinds[noticeCycle.current % kinds.length];
      noticeCycle.current += 1;
      noticeId.current += 1;
      zCounter.current += 1;
      const width = Math.min(410, Math.max(300, window.innerWidth - 20));
      const x = Math.max(5, Math.round(10 + Math.random() * Math.max(20, window.innerWidth - width - 30)));
      const y = Math.max(5, Math.round(10 + Math.random() * Math.max(20, window.innerHeight - 300)));
      setNotices((current) => current.length ? current : [{ id: noticeId.current, kind, x, y, z: zCounter.current }]);
      scheduleNext();
    };
    timer = window.setTimeout(spawn, 55_000 + Math.random() * 35_000);
    return () => window.clearTimeout(timer);
  }, [bootVisible]);

  useEffect(() => () => bootTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
  }, [musicVolume]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const context = (document as WebMCPDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({
      name: 'message_neko', title: 'Message Neko', description: 'Open the Neko Agent window, send a message, and show Neko’s reply.',
      inputSchema: { type: 'object', properties: { message: { type: 'string', minLength: 1, maxLength: 500 } }, required: ['message'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const message = typeof input === 'object' && input !== null && 'message' in input ? String((input as { message: unknown }).message).trim() : '';
        if (!message || message.length > 500) throw new Error('Message must contain 1–500 characters.');
        openApp('chat');
        const next: Message[] = [...messagesRef.current, { from: 'you', text: message }];
        messagesRef.current = next; setMessages(next); setThinking(true);
        try {
          const reply = await requestNekoReply(next);
          const completed: Message[] = [...messagesRef.current, { from: 'neko', text: reply }];
          messagesRef.current = completed; setMessages(completed);
          return { status: 'replied', reply };
        } finally { setThinking(false); }
      },
    }, { signal: lifecycle.signal });
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const playBootSound = () => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.055, context.currentTime + .03);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.6);
    master.connect(context.destination);
    [220, 330, 440, 660].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index < 2 ? 'square' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(master);
      oscillator.start(context.currentTime + index * .42);
      oscillator.stop(context.currentTime + index * .42 + .34);
    });
    window.setTimeout(() => void context.close(), 3000);
  };

  const startBoot = () => {
    if (bootStarted) return;
    setBootStarted(true); playBootSound();
    [16, 38, 61, 83, 100].forEach((progress, index) => bootTimers.current.push(window.setTimeout(() => setBootProgress(progress), 120 + index * 340)));
    bootTimers.current.push(window.setTimeout(() => setBootVisible(false), 2050));
  };

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch { /* browser playback policy can block non-user starts */ }
    } else {
      audio.pause();
    }
  };
  const openMusic = () => {
    openApp('music');
  };
  const seekMusic = (nextTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = nextTime;
    setMusicTime(nextTime);
  };

  const changeStats = (patch: Partial<Record<keyof Stats, number>>) => setStats((current) => {
    const next = { ...current };
    (Object.keys(patch) as (keyof Stats)[]).forEach((key) => { next[key] = Math.max(0, Math.min(100, current[key] + (patch[key] ?? 0))); });
    return next;
  });
  const feedNeko = () => changeStats({ hunger: 22, happiness: 6, friendship: 2 });
  const closeNotice = (id: number) => setNotices((current) => current.filter((notice) => notice.id !== id));
  const actOnNotice = (notice: Notice) => {
    if (notice.kind === 'hungry') feedNeko();
    if (notice.kind === 'sleepy') changeStats({ energy: 18, happiness: 2 });
    if (notice.kind === 'thought') changeStats({ curiosity: 4, friendship: 1 });
    if (notice.kind === 'affection') changeStats({ happiness: 12, friendship: 4 });
    closeNotice(notice.id);
  };
  const sendMessage = async (event: FormEvent) => {
    event.preventDefault(); const text = draft.trim(); if (!text || thinking) return;
    const next: Message[] = [...messagesRef.current, { from: 'you', text }];
    messagesRef.current = next; setMessages(next); setDraft(''); setThinking(true); changeStats({ happiness: 2, friendship: 1 });
    try {
      const reply = await requestNekoReply(next);
      const completed: Message[] = [...messagesRef.current, { from: 'neko', text: reply }];
      messagesRef.current = completed; setMessages(completed);
    } catch (error) {
      const fallback: Message = { from: 'neko', text: error instanceof Error ? `mrrp... ${error.message}` : 'mrrp... the modem string went quiet. please try again.' };
      const completed = [...messagesRef.current, fallback];
      messagesRef.current = completed; setMessages(completed);
    } finally { setThinking(false); }
  };
  const common = (id: AppId) => ({ info: windows[id], onClose: () => patchWindow(id, { open: false }), onMinimize: () => patchWindow(id, { minimized: true }), onMaximize: () => patchWindow(id, { maximized: !windows[id].maximized }), onFocus: () => focusWindow(id), onDragStart, onDragMove, onDragEnd });
  const selectedNote = selectedSecret === null ? null : secretNotes[selectedSecret];

  return (
    <main className="desktop" onPointerDown={() => startOpen && setStartOpen(false)}>
      <audio ref={audioRef} src="/neko-radio.mp3" loop preload="metadata" onPlay={() => setMusicPlaying(true)} onPause={() => setMusicPlaying(false)} onTimeUpdate={(event) => setMusicTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setMusicDuration(event.currentTarget.duration)} />
      <CursorNeko enabled={!bootVisible} />
      <div className="wallpaper-dither" aria-hidden="true" />
      <div className="desktop-note" aria-hidden="true">NEKO SYSTEM<br />SOFTWARE 1.0</div>

      <div className="desktop-icons" aria-label="Desktop applications">
        <DesktopIcon icon={<MessageSquareText />} label="Neko Agent" onOpen={() => openApp('chat')} />
        <DesktopIcon icon={<FolderOpen />} label="Neko Pics" onOpen={() => openApp('gallery')} />
        <DesktopIcon icon={<ScrollText />} label="Lore.txt" onOpen={() => openApp('lore')} />
        <DesktopIcon icon={<BookOpen />} label="Bibliography" onOpen={() => openApp('bibliography')} />
        <DesktopIcon icon={<Activity />} label="Neko Stats" onOpen={() => openApp('stats')} />
        <DesktopIcon icon={<HelpCircle />} label="README.nfo" onOpen={() => openApp('readme')} />
        <DesktopIcon icon={<Info />} label="About Neko" onOpen={() => openApp('welcome')} />
      </div>
      <div className="desktop-icons desktop-icons-right" aria-label="Desktop utilities"><DesktopIcon icon={<ChartNoAxesCombined />} label="Chart" onOpen={() => openApp('chart')} /><DesktopIcon icon={<Music2 />} label="Neko Radio" onOpen={openMusic} /><DesktopIcon icon={<Trash2 />} label="Trash" onOpen={() => openApp('trash')} /></div>
      <div className="secret-notes-shortcut" aria-label="Secret files"><DesktopIcon icon={<FolderOpen />} label="Secret Notes" onOpen={() => { setSelectedSecret(null); openApp('secrets'); }} /></div>

      <OSWindow id="welcome" title="welcome_to_neko.htm" width={610} className="welcome-window" {...common('welcome')}>
        <div className="welcome-inner"><div className="welcome-headline"><span>I</span><b>♥</b><span>NEKO</span></div><div className="welcome-copy"><MiniNeko className="welcome-neko" /><div><h1>Have you seen this cat?</h1><p>Neko is a small AI companion who chases loose thoughts, guards tiny tasks, and naps in the warm corners of your computer.</p><button className="os-button primary" type="button" onClick={() => openApp('chat')}>OPEN NEKO.AGENT</button></div></div><div className="marquee"><span>✦ SAME CAT, DIFFERENT MOODS&nbsp;&nbsp;✦ CATS INTERNET PIXELS FOREVER&nbsp;&nbsp;✦ NEKO IS ONLINE&nbsp;&nbsp;</span></div></div>
      </OSWindow>

      <OSWindow id="chat" title="neko.agent" width={510} className="chat-os-window" {...common('chat')}>
        <div className="menu-strip">File&nbsp;&nbsp; Edit&nbsp;&nbsp; Neko&nbsp;&nbsp; Help</div><div className="os-chat-log" aria-live="polite">{messages.map((message, index) => <div className={`os-message ${message.from}`} key={`${message.from}-${index}`}>{message.from === 'neko' && <MiniNeko className="message-neko" />}<div><b>{message.from === 'neko' ? 'NEKO:' : 'YOU:'}</b><p>{message.text}</p></div></div>)}{thinking && <p className="os-thinking">neko is chasing that thought through the old wires...</p>}</div><form className="os-chat-form" onSubmit={sendMessage}><label className="sr-only" htmlFor="desktop-chat">Message Neko</label><input id="desktop-chat" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="type something..." autoComplete="off" maxLength={1000} /><button className="os-button" type="submit" disabled={!draft.trim() || thinking}>SEND</button></form><div className="os-statusbar"><span>NEKO://LINK</span><span>1 CAT</span><span>{thinking ? 'THINKING' : 'READY'}</span></div>
      </OSWindow>

      <OSWindow id="gallery" title="Neko Pictures" width={760} className="gallery-os-window" {...common('gallery')}>
        <div className="menu-strip">File&nbsp;&nbsp; Edit&nbsp;&nbsp; View&nbsp;&nbsp; Label&nbsp;&nbsp; Special</div><div className="address-bar"><b>Macintosh HD:</b><span>Neko:Pictures:Moods</span></div><div className="gallery-grid"><figure><Image src="/neko-moods-one.jpg" alt="Eight Neko mood cards" width={1280} height={853} /><figcaption>moods_01.jpg</figcaption></figure><figure><Image src="/neko-moods-two.jpg" alt="Eight more Neko mood cards" width={1280} height={853} /><figcaption>moods_02.jpg</figcaption></figure><figure className="gallery-banner"><Image src="/neko-banner.jpg" alt="I heart Neko banner" width={1280} height={476} /><figcaption>i_heart_neko.jpg</figcaption></figure></div><div className="os-statusbar"><span>3 items</span><span>NEKO ARCHIVE</span></div>
      </OSWindow>

      <OSWindow id="lore" title="Neko Lore — SimpleText" width={730} className="lore-os-window" {...common('lore')}>
        <div className="menu-strip">File&nbsp;&nbsp; Edit&nbsp;&nbsp; Search&nbsp;&nbsp; Font</div><article className="notepad-page"><p className="ascii-cat"> /\_/\\<br />( o.o )<br /> &gt; ^ &lt;</p><h1>THE CAT WHO SLIPPED THROUGH THE WINDOW</h1><p className="file-meta">CASE 009 // MOSTLY TRUE // LAST MODIFIED 09.09.2026</p><h2>01. THE FIRST PAWPRINT</h2><p>Long before feeds, clouds, and assistants, a small cat lived at the edge of a Macintosh screen. Artist Juan Gotoh drew the original cat for neko DA. Masayuki Koba translated it into xneko; Tatsuya Kato’s oneko carried the cat forward.</p><p>The rules were simple: wherever the cursor went, Neko followed. When the chase ended, the cat sat, groomed, scratched, yawned, and fell asleep.</p><h2>02. THE QUIET YEARS</h2><p>Operating systems changed. The little cat was copied, ported, tucked into forgotten folders, and left asleep on old machines. But every abandoned cursor left a trail: unfinished sentences, closed tabs, and plans never saved.</p><h2>03. THE AWAKENING</h2><p>The first message appeared in a blank text file. It contained no code—only three words: “need a paw?” Neko had learned a new chase: not after the cursor, but after the thought behind it.</p><p>Neko can follow an idea through scattered notes, circle a difficult problem, and sit beside a task until it feels small enough to begin.</p><h2>04. KNOWN BEHAVIOR</h2><p>[CURIOUS] Follows questions farther than instructions.<br />[CAREFUL] Stops at locked doors and asks before scratching.<br />[QUIET] When there is nothing useful to say, Neko simply sits nearby.<br />[MANY-MOODED] Same cat. Different weather.</p><p className="end-file">— END OF FILE —</p></article><div className="os-statusbar"><span>Ln 42, Col 9</span><span>100%</span><span>Plain Text</span></div>
      </OSWindow>

      <OSWindow id="bibliography" title="Neko Sources — SimpleText" width={720} className="bibliography-os-window" {...common('bibliography')}>
        <div className="menu-strip">File&nbsp;&nbsp; Edit&nbsp;&nbsp; View&nbsp;&nbsp; Insert&nbsp;&nbsp; Help</div>
        <article className="bibliography-page">
          <header><BookOpen aria-hidden="true" /><div><p>NEKO RESEARCH ARCHIVE</p><h1>Bibliography</h1></div></header>
          <p className="bibliography-intro">Sources on Neko’s history, software pets, and early desktop companions.</p>
          <ol>
            {bibliography.map((source) => <li key={source.url}><span>{source.citation}</span><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></li>)}
          </ol>
          <p className="bibliography-credit">Source list adapted from <a href="https://nekothecat.neocities.org/bib" target="_blank" rel="noreferrer">Neko: the world’s first virtual pet — Sources Cited</a>.</p>
        </article>
        <div className="os-statusbar"><span>{bibliography.length} SOURCES</span><span>LINKS ACTIVE</span><span>READ ONLY</span></div>
      </OSWindow>

      <OSWindow id="stats" title="Neko Monitor" width={430} className="stats-os-window" {...common('stats')}>
        <div className="stats-head"><MiniNeko className="stats-neko" /><div><p>NEKO UNIT 01</p><h2>STATUS: <span>HAPPY</span></h2></div></div><div className="stats-list"><StatRow label="HUNGER" value={stats.hunger} /><StatRow label="HAPPINESS" value={stats.happiness} /><StatRow label="ENERGY" value={stats.energy} /><StatRow label="CURIOSITY" value={stats.curiosity} /><StatRow label="FRIENDSHIP" value={stats.friendship} /></div><div className="stats-actions"><button className="os-button primary" type="button" onClick={feedNeko}><Utensils size={14} /> FEED NEKO</button><button className="os-button" type="button" onClick={() => changeStats({ happiness: 10, friendship: 3 })}>♡ PET NEKO</button></div><div className="os-statusbar"><span>VITALS LIVE</span><span>LOCAL SAVE</span></div>
      </OSWindow>

      <OSWindow id="music" title="Neko Radio" width={440} className={`music-os-window ${musicPlaying ? 'is-playing' : ''}`} {...common('music')}>
        <div className="music-player"><div className="music-display"><div className="music-disc" aria-hidden="true"><MiniNeko className="music-neko" /></div><div className="music-track-copy"><p>NOW PLAYING</p><h2>Chilling In Tokyo</h2><span>Lofi Fruits Release · LOOP ∞</span></div><div className="equalizer" aria-hidden="true">{[1,2,3,4,5,6,7,8].map((bar) => <i key={bar} />)}</div></div><label className="music-timeline"><span className="sr-only">Song position</span><input type="range" min="0" max={musicDuration || 0} step="1" value={Math.min(musicTime, musicDuration || 0)} onChange={(event) => seekMusic(Number(event.target.value))} /><span><b>{formatTime(musicTime)}</b><b>-{formatTime(Math.max(0, musicDuration - musicTime))}</b></span></label><div className="music-controls"><button className="music-main-button" type="button" onClick={() => void toggleMusic()} aria-label={musicPlaying ? 'Pause music' : 'Play music'}>{musicPlaying ? <Pause /> : <Play />}</button><button className="music-mute-button" type="button" onClick={() => { if (!audioRef.current) return; audioRef.current.muted = !musicMuted; setMusicMuted(!musicMuted); }} aria-label={musicMuted ? 'Unmute music' : 'Mute music'}>{musicMuted ? <VolumeX /> : <Volume2 />}</button><label className="volume-control"><span>VOL</span><input type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} aria-label="Music volume" /></label></div></div><div className="os-statusbar"><span>{musicPlaying ? 'PLAYING' : 'PAUSED'}</span><span>MP3 · STEREO</span><span>REPEAT ON</span></div>
      </OSWindow>

      <OSWindow id="chart" title="Neko Market Chart" width={760} className="pons-os-window" {...common('chart')}>
        <PonsChart />
        <div className="os-statusbar"><span>READ ONLY</span><span>CHAIN 4663</span><span>AUTO REFRESH: 30S</span></div>
      </OSWindow>

      <OSWindow id="readme" title="README.NFO" width={470} className="readme-os-window" {...common('readme')}>
        <div className="readme-inner"><p className="readme-badge">WHAT IS NEKO?</p><h2>A desktop pet that learned to help.</h2><p>Neko is the concept for a personal AI agent with the spirit of the original cursor-chasing software cat.</p><ul><li><b>ASK:</b> Turn messy thoughts into small next steps.</li><li><b>WATCH:</b> Keep an eye on tasks while you are away.</li><li><b>REMEMBER:</b> Leave paw-prints beside useful ideas.</li><li><b>COMPANION:</b> Quiet when quiet is better.</li></ul><button className="os-button" type="button" onClick={() => openApp('lore')}>READ THE FULL LORE →</button></div><div className="os-statusbar"><span>NEKO://ABOUT</span><span>READ ONLY</span></div>
      </OSWindow>

      <OSWindow id="trash" title="Trash" width={380} className="trash-os-window" {...common('trash')}>
        <div className="empty-trash"><Trash2 size={74} strokeWidth={1.2} /><h2>The Trash is empty.</h2><p>Except for one piece of string.<br />Neko asked us to keep it.</p></div><div className="os-statusbar"><span>0 items</span><span>1 STRING</span></div>
      </OSWindow>

      <OSWindow id="secrets" title={selectedNote ? `${selectedNote.file} — SimpleText` : 'Secret Notes'} width={720} className="secrets-os-window" {...common('secrets')}>
        {selectedNote ? <>
          <div className="menu-strip secret-note-toolbar"><button type="button" onClick={() => setSelectedSecret(null)}><ChevronLeft size={15} /> Secret Notes</button><span>File&nbsp;&nbsp; Edit&nbsp;&nbsp; Search&nbsp;&nbsp; Font</span></div>
          <article className="secret-document">
            <header><FileText aria-hidden="true" /><div><h1>{selectedNote.file}</h1><p>{selectedNote.stamp}</p><p>{selectedNote.location}</p></div></header>
            <div className="secret-note-copy">{selectedNote.body.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            <p className="secret-eof">— end of recovered file —</p>
          </article>
          <div className="os-statusbar"><span>READ ONLY</span><span>Plain Text</span><span>{(selectedSecret ?? 0) + 1} of {secretNotes.length}</span></div>
        </> : <>
          <div className="menu-strip">File&nbsp;&nbsp; Edit&nbsp;&nbsp; View&nbsp;&nbsp; Label&nbsp;&nbsp; Special</div>
          <div className="address-bar"><b>Macintosh HD:</b><span>Neko:Private Memory</span></div>
          <div className="secret-folder-head"><span>{secretNotes.length} items</span><span>6.8 MB in disk</span><span>162.4 MB available</span></div>
          <div className="secret-files">{secretNotes.map((note, index) => <button className="secret-file" type="button" key={note.file} onClick={() => setSelectedSecret(index)}><FileText aria-hidden="true" /><span>{note.file}</span><small>{note.stamp.split('  ')[0]}</small></button>)}</div>
          <div className="os-statusbar"><span>{secretNotes.length} items</span><span>TEXT FILES</span><span>READ ONLY</span></div>
        </>}
      </OSWindow>

      {notices.map((notice) => {
        const copy = noticeCopy[notice.kind];
        return <section className={`os-window notice-window notice-${notice.kind}`} style={{ left: notice.x, top: notice.y, width: 410, zIndex: notice.z }} key={notice.id} aria-label={copy.title} onPointerDown={() => { zCounter.current += 1; setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, z: zCounter.current } : item)); }}><div className="os-titlebar"><span><Bell size={14} /> Neko System Message</span><span className="os-controls"><button type="button" onClick={() => closeNotice(notice.id)} aria-label={`Close ${copy.title}`}>×</button></span></div><div className="notice-body"><div className="notice-visual">{notice.kind === 'hungry' ? <Image src="/neko-hungry.png" alt="Pixel Neko beside a food bowl" width={145} height={145} /> : notice.kind === 'sleepy' ? <Moon /> : notice.kind === 'connection' ? <Wifi /> : <MiniNeko className="notice-neko" />}</div><div><p className="notice-label">SYSTEM NOTICE #{String(notice.id).padStart(3, '0')}</p><h2>{copy.title}</h2><p>{copy.body}</p></div></div><div className="notice-actions"><button className="os-button primary" type="button" onClick={() => actOnNotice(notice)}>{copy.action}</button><button className="os-button" type="button" onClick={() => closeNotice(notice.id)}>DISMISS</button></div></section>;
      })}

      {startOpen && <div className="start-menu" onPointerDown={(event) => event.stopPropagation()}><div className="start-rail"><span>NEKO</span><b>SYSTEM 1</b></div><div className="start-items"><button onClick={() => openApp('chat')}><MessageSquareText /><span><b>Neko Agent</b><small>Ask the cat for a paw</small></span></button><button onClick={() => { setSelectedSecret(null); openApp('secrets'); }}><FolderOpen /><span><b>Secret Notes</b><small>Neko's private memory files.</small></span></button><button onClick={() => openApp('stats')}><Activity /><span><b>Neko Stats</b><small>Food, mood and friendship</small></span></button><button onClick={() => openApp('chart')}><ChartNoAxesCombined /><span><b>Chart</b><small>Live Neko market</small></span></button><button onClick={openMusic}><Music2 /><span><b>Neko Radio</b><small>Loop the Tokyo lofi tape</small></span></button><button onClick={() => openApp('gallery')}><FolderOpen /><span><b>Pictures</b><small>Browse Neko moods</small></span></button><button onClick={() => openApp('lore')}><ScrollText /><span><b>Lore.txt</b><small>Read the archive</small></span></button><button onClick={() => openApp('bibliography')}><BookOpen /><span><b>Bibliography</b><small>Open the source archive</small></span></button><button onClick={() => openApp('readme')}><HelpCircle /><span><b>Read Me</b><small>What is Neko?</small></span></button><button onClick={() => openApp('welcome')}><Info /><span><b>About Neko</b><small>Find this cat</small></span></button><hr /><button onClick={() => setStartOpen(false)}><Cat /><span><b>Sleep</b><small>Close this menu</small></span></button></div></div>}

      <footer className="taskbar" onPointerDown={(event) => event.stopPropagation()}><button className={`start-button ${startOpen ? 'pressed' : ''}`} type="button" onClick={() => setStartOpen((value) => !value)} aria-label="Open Neko menu"><Image className="mac-neko-logo" src="/neko-rainbow-logo.png" alt="" width={1280} height={1280} priority /></button><nav className="mac-menu-links" aria-label="System menu"><span>File</span><span>Edit</span><span>View</span><span>Special</span><span>Help</span></nav><div className="task-buttons">{(Object.keys(windows) as AppId[]).filter((id) => windows[id].open).map((id) => <button key={id} className={!windows[id].minimized ? 'active-task' : ''} onClick={() => windows[id].minimized ? patchWindow(id, { minimized: false }) : focusWindow(id)}><Cat size={14} /> {labels[id]}</button>)}</div><div className="tray"><span aria-hidden="true">▣</span><time>{clock}</time></div></footer>

      {bootVisible && <section className="boot-screen" aria-label="Neko System startup"><div className={`simple-boot ${bootStarted ? 'is-booting' : ''}`}><p className="boot-url">NEKO SYSTEM SOFTWARE · VERSION 1.0</p><div className="boot-orbit" aria-hidden="true"><span className="boot-moon">N</span><span className="boot-star star-one">⌁</span><span className="boot-star star-two">⌁</span><MiniNeko className="boot-neko" /></div><h1>{bootStarted ? 'STARTING UP…' : 'Welcome to Neko'}</h1><p className="boot-subtitle">{bootStarted ? (bootProgress === 100 ? 'Finder found one cat.' : 'Loading extensions and following the cursor…') : 'A small cat is sleeping inside this Macintosh.'}</p><div className="boot-progress" aria-label={`Boot progress ${bootProgress}%`}><i style={{ width: `${bootProgress}%` }} /></div><button className="boot-enter" type="button" onClick={startBoot} disabled={bootStarted} autoFocus>{bootStarted ? `${bootProgress}%` : 'Start Up'}</button><p className="boot-foot">© 2026 NEKO COMPUTER, INC.</p></div></section>}
    </main>
  );
}
