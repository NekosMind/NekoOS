'use client';

import Image from 'next/image';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExternalLink, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type ChartRange = '5m' | '1h' | '6h' | '24h';
type ChartPoint = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };
type ChartPayload = {
  token: { address: string; name: string; symbol: string; quoteSymbol: string };
  market: {
    pairAddress: string; dexUrl: string; priceUsd: number; priceNative: number; marketCap: number;
    liquidity: number; volume: number; change: number; buys: number; sells: number; pairCreatedAt: number | null;
  };
  range: ChartRange;
  points: ChartPoint[];
  updatedAt: number;
};

const ranges: { id: ChartRange; label: string }[] = [
  { id: '5m', label: '5M' }, { id: '1h', label: '1H' }, { id: '6h', label: '6H' }, { id: '24h', label: '1D' },
];

function compactUsd(value: number) {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(6)}`;
}

function tickTime(timestamp: number, range: ChartRange) {
  return new Intl.DateTimeFormat('en-NZ', range === '24h'
    ? { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }
    : { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp * 1000));
}

export default function PonsChart() {
  const [range, setRange] = useState<ChartRange>('1h');
  const [payload, setPayload] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextRange: ChartRange, quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/pons-chart?range=${nextRange}`, { cache: 'no-store' });
      const result = await response.json() as ChartPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not reach the chart feed.');
      setPayload(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reach the chart feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
    const refresh = window.setInterval(() => void load(range, true), 30_000);
    return () => window.clearInterval(refresh);
  }, [load, range]);

  const change = payload?.market.change ?? 0;
  const positive = change >= 0;
  const chartColor = positive ? '#176c6d' : '#76517e';

  return (
    <div className="pons-terminal">
      <div className="pons-toolbar">
        <div><span className="pons-led" /> LIVE · ROBINHOOD CHAIN</div>
        <button type="button" onClick={() => void load(range)} disabled={loading} aria-label="Refresh market data"><RefreshCw size={14} /> REFRESH</button>
      </div>

      {loading && !payload ? (
        <div className="pons-loading"><span>READING NEKO.EXE</span><div><i /></div><small>connecting to pool data...</small></div>
      ) : error && !payload ? (
        <div className="pons-error"><b>MARKET DATA ERROR</b><p>{error}</p><button className="os-button" type="button" onClick={() => void load(range)}>TRY AGAIN</button></div>
      ) : payload ? (
        <>
          <header className="pons-market-head">
            <div className="pons-token-id"><Image className="pons-coin" src="/neko-chart-icon.jpg" alt="Neko" width={1280} height={1280} /><div><p>{payload.token.symbol} / USD</p><h2>{payload.token.name}</h2></div></div>
            <div className="pons-price"><strong>{compactUsd(payload.market.priceUsd)}</strong><span className={positive ? 'up' : 'down'}>{positive ? <TrendingUp /> : <TrendingDown />}{positive ? '+' : ''}{change.toFixed(2)}% · {ranges.find((item) => item.id === range)?.label}</span></div>
            <div className="pons-ranges" aria-label="Chart timeframe">{ranges.map((item) => <button className={range === item.id ? 'active' : ''} type="button" key={item.id} onClick={() => setRange(item.id)}>{item.label}</button>)}</div>
          </header>

          <div className="pons-chart-wrap" aria-label={`${payload.token.symbol} price chart`}>
            {payload.points.length > 1 ? <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={payload.points} margin={{ top: 14, right: 8, bottom: 2, left: 0 }}>
                <defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity={0.34} /><stop offset="100%" stopColor={chartColor} stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid stroke="#8a8a8a" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="timestamp" tickFormatter={(value) => tickTime(Number(value), range)} minTickGap={34} axisLine={false} tickLine={false} tick={{ fill: '#333333', fontSize: 11 }} />
                <YAxis orientation="right" domain={['dataMin', 'dataMax']} tickFormatter={(value) => compactUsd(Number(value))} axisLine={false} tickLine={false} width={68} tick={{ fill: '#333333', fontSize: 11 }} />
                <Tooltip labelFormatter={(value) => tickTime(Number(value), range)} formatter={(value) => [compactUsd(Number(value)), 'PRICE']} contentStyle={{ color: '#111', background: '#ffffff', border: `2px solid ${chartColor}`, borderRadius: 0, fontFamily: 'Courier New', fontSize: 12, boxShadow: '2px 2px 0 #111' }} labelStyle={{ color: '#333333' }} />
                <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={3} fill="url(#priceFill)" dot={false} activeDot={{ r: 4, fill: chartColor, stroke: '#111' }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer> : <div className="pons-no-data">WAITING FOR MORE TRADES...</div>}
          </div>

          <div className="pons-metrics">
            <span><small>MARKET CAP</small><b>{compactUsd(payload.market.marketCap)}</b></span>
            <span><small>LIQUIDITY</small><b>{compactUsd(payload.market.liquidity)}</b></span>
            <span><small>VOLUME</small><b>{compactUsd(payload.market.volume)}</b></span>
            <span><small>TRADES</small><b><i className="buy">{payload.market.buys}B</i> / <i className="sell">{payload.market.sells}S</i></b></span>
          </div>

          <div className="pons-contract-row"><span><b>CONTRACT:</b> {payload.token.address}</span><a href={payload.market.dexUrl} target="_blank" rel="noreferrer">OPEN MARKET <ExternalLink size={12} /></a></div>
          <p className="pons-disclaimer">Read-only estimate from public market data. Verify the contract. Not affiliated with or endorsed by pons.</p>
        </>
      ) : null}
    </div>
  );
}
