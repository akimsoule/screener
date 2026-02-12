import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { StockCandle } from "@/types/stock";
import { format } from "date-fns";

interface StockChartProps {
  readonly data: StockCandle[];
  readonly showMA20?: boolean;
  readonly showMA50?: boolean;
  readonly showVolume?: boolean;
  readonly yDomain?: { min?: number; max?: number };
  readonly yPadding?: number; // fraction of span to pad top/bottom (default 0.1)
  readonly priceFlex?: number; // flex value for the price chart area (default 1 -> grows normally)
  readonly yTickCount?: number; // number of Y ticks (default 4) to increase spacing between grid lines
}

// Calculate Simple Moving Average
function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / period;
      result.push(avg);
    }
  }
  return result;
}

// Compute 'nice' ticks for a numeric range (similar to d3.ticks)
function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (span <= 0 || count <= 1) return [min, max];

  const rawStep = span / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceMultiplier = 1;
  if (residual >= 7) niceMultiplier = 10;
  else if (residual >= 3) niceMultiplier = 5;
  else if (residual >= 1.5) niceMultiplier = 2;

  const niceStep = magnitude * niceMultiplier;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + 0.5 * niceStep; t += niceStep) {
    ticks.push(Math.round(t));
  }
  return ticks;
}

export function StockChart({
  data,
  showMA20 = true,
  showMA50 = true,
  showVolume = true,
  yDomain,
  yPadding = 0.1,
  priceFlex = 1,
  yTickCount = 4,
}: StockChartProps) {
  // Tooltip formatter helper (use permissive types then cast to satisfy Recharts types)
  const tooltipFormatter = (
    value: number | string | undefined,
    name: string,
  ): [string, string] | string => {
    const labels: Record<string, string> = {
      close: "Close",
      open: "Open",
      high: "High",
      low: "Low",
      ma20: "MA 20",
      ma50: "MA 50",
    };

    if (value == null || value === "") {
      return ["-", labels[name] || name];
    }

    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return ["-", labels[name] || name];
    return [`$${num.toFixed(2)}`, labels[name] || name];
  };
  const chartData = useMemo(() => {
    const closes = data.map((d) => d.close);
    const ma20 = calculateSMA(closes, 20);
    const ma50 = calculateSMA(closes, 50);

    return data.map((candle, i) => ({
      ...candle,
      dateFormatted: format(new Date(candle.date), "MMM dd"),
      ma20: ma20[i],
      ma50: ma50[i],
      candleColor:
        candle.close >= candle.open ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)",
      candleBody: Math.abs(candle.close - candle.open),
      candleLow: Math.min(candle.open, candle.close),
    }));
  }, [data]);

  const priceRange = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 100 };
    const prices = data.flatMap((d) => [d.high, d.low]);
    let min = Math.min(...prices);
    let max = Math.max(...prices);

    // If all prices are the same (flat line) expand range by a small delta
    if (min === max) {
      const delta = Math.max(Math.abs(min) * Math.max(yPadding, 0.05), 1); // at least some delta
      return { min: min - delta, max: max + delta };
    }

    const padding = (max - min) * yPadding;
    return { min: min - padding, max: max + padding };
  }, [data]);

  // Compute effective domain (allow override via `yDomain`) and produce ticks
  const { domain, ticks } = useMemo(() => {
    const baseMin = priceRange.min;
    const baseMax = priceRange.max;
    const min = typeof yDomain?.min === "number" ? yDomain.min : baseMin;
    const max = typeof yDomain?.max === "number" ? yDomain.max : baseMax;

    const tickCount = Math.max(2, Math.floor(yTickCount));
    const ticks = niceTicks(min, max, tickCount);
    return { domain: [min, max] as [number, number], ticks };
  }, [priceRange, yDomain]);

  const volumeMax = useMemo(() => {
    return Math.max(...data.map((d) => d.volume)) * 1.1;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No data available. Select a stock to view chart.
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col gap-2">
      {/* Price Chart */}
      <div className="min-h-0" style={{ flex: priceFlex }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 14%, 15%)"
              vertical={false}
            />
            <XAxis
              dataKey="dateFormatted"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={domain}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              ticks={ticks}
              orientation="right"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 12%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                padding: "12px",
              }}
              labelStyle={{ color: "hsl(210, 20%, 95%)" }}
              formatter={tooltipFormatter as any}
            />

            {/* Candlestick as bars - simplified visualization */}
            <Bar
              dataKey="candleBody"
              stackId="candle"
              barSize={6}
              fill="transparent"
            />

            {/* Close line for cleaner visualization */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(217, 91%, 60%)" }}
            />

            {showMA20 && (
              <Line
                type="monotone"
                dataKey="ma20"
                stroke="hsl(280, 100%, 70%)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 5"
              />
            )}

            {showMA50 && (
              <Line
                type="monotone"
                dataKey="ma50"
                stroke="hsl(38, 92%, 50%)"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 5"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart (separate) */}
      {showVolume && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(220, 14%, 15%)"
                vertical={false}
              />
              <XAxis dataKey="dateFormatted" hide />
              <YAxis
                domain={[0, volumeMax]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }}
                tickFormatter={(v) => {
                  if (v >= 1_000_000_000)
                    return `${(v / 1_000_000_000).toFixed(1)}B`;
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
                  return `${v}`;
                }}
                width={80}
              />
              <Bar
                dataKey="volume"
                fill="hsl(217, 91%, 60%)"
                opacity={0.4}
                barSize={6}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
