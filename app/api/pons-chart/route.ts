const TOKEN_ADDRESS = '0x80baa4b3bfac6f4978700df824b1b3d98e889136';

const rangeSettings = {
  '5m': { timeframe: 'minute', aggregate: 1, limit: 5 },
  '1h': { timeframe: 'minute', aggregate: 1, limit: 60 },
  '6h': { timeframe: 'minute', aggregate: 5, limit: 72 },
  '24h': { timeframe: 'minute', aggregate: 15, limit: 96 },
} as const;

type RangeKey = keyof typeof rangeSettings;
type DexPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels?: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative?: string;
  priceUsd?: string;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
};

function selectCanonicalPair(pairs: DexPair[]) {
  return pairs
    .filter((pair) => pair.chainId === 'robinhood' && pair.baseToken.address.toLowerCase() === TOKEN_ADDRESS)
    .sort((a, b) => {
      const aCanonical = a.labels?.includes('v4') && a.quoteToken.address === '0x0000000000000000000000000000000000000000' ? 1 : 0;
      const bCanonical = b.labels?.includes('v4') && b.quoteToken.address === '0x0000000000000000000000000000000000000000' ? 1 : 0;
      return bCanonical - aCanonical || (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
    })[0];
}

export async function GET(request: Request) {
  const requestedRange = new URL(request.url).searchParams.get('range') ?? '1h';
  const range = (requestedRange in rangeSettings ? requestedRange : '1h') as RangeKey;
  const setting = rangeSettings[range];

  try {
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`, {
      headers: { accept: 'application/json' },
    });
    if (!dexResponse.ok) throw new Error(`Market feed returned ${dexResponse.status}`);

    const dexPayload = await dexResponse.json() as { pairs?: DexPair[] };
    const pair = selectCanonicalPair(dexPayload.pairs ?? []);
    if (!pair) throw new Error('No Robinhood Chain market was found for this token.');

    const candleUrl = new URL(`https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${pair.pairAddress}/ohlcv/${setting.timeframe}`);
    candleUrl.searchParams.set('aggregate', String(setting.aggregate));
    candleUrl.searchParams.set('limit', String(setting.limit));
    candleUrl.searchParams.set('currency', 'usd');
    candleUrl.searchParams.set('token', 'base');

    const candleResponse = await fetch(candleUrl, { headers: { accept: 'application/json' } });
    if (!candleResponse.ok) throw new Error(`Chart feed returned ${candleResponse.status}`);
    const candlePayload = await candleResponse.json() as {
      data?: { attributes?: { ohlcv_list?: number[][] } };
    };

    const seen = new Set<number>();
    const points = (candlePayload.data?.attributes?.ohlcv_list ?? [])
      .filter((row) => row.length >= 6 && Number.isFinite(row[4]))
      .map(([timestamp, open, high, low, close, volume]) => ({ timestamp, open, high, low, close, volume }))
      .filter((point) => seen.has(point.timestamp) ? false : (seen.add(point.timestamp), true))
      .sort((a, b) => a.timestamp - b.timestamp);

    const rangeKey = range === '5m' ? 'm5' : range === '1h' ? 'h1' : range === '6h' ? 'h6' : 'h24';
    return Response.json({
      token: {
        address: TOKEN_ADDRESS,
        name: 'Neko',
        symbol: 'NEKO',
        quoteSymbol: pair.quoteToken.symbol,
      },
      market: {
        pairAddress: pair.pairAddress,
        dexUrl: pair.url,
        priceUsd: Number(pair.priceUsd ?? points.at(-1)?.close ?? 0),
        priceNative: Number(pair.priceNative ?? 0),
        marketCap: pair.marketCap ?? pair.fdv ?? 0,
        liquidity: pair.liquidity?.usd ?? 0,
        volume: pair.volume?.[rangeKey] ?? 0,
        change: pair.priceChange?.[rangeKey] ?? 0,
        buys: pair.txns?.[rangeKey]?.buys ?? 0,
        sells: pair.txns?.[rangeKey]?.sells ?? 0,
        pairCreatedAt: pair.pairCreatedAt ?? null,
      },
      range,
      points,
      updatedAt: Date.now(),
    }, { headers: { 'Cache-Control': 'public, max-age=20, s-maxage=20' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'The chart feed is unavailable.' }, { status: 502 });
  }
}
