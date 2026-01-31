import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ChartControlsProps {
  showMA20: boolean;
  showMA50: boolean;
  showVolume: boolean;
  onToggleMA20: (value: boolean) => void;
  onToggleMA50: (value: boolean) => void;
  onToggleVolume: (value: boolean) => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
}

const intervals = [
  { label: "1D", value: "daily" },
  { label: "1W", value: "weekly" },
  { label: "1M", value: "monthly" },
];

export function ChartControls({
  showMA20,
  showMA50,
  showVolume,
  onToggleMA20,
  onToggleMA50,
  onToggleVolume,
  interval,
  onIntervalChange,
}: ChartControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-secondary/30 rounded-lg">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch id="ma20" checked={showMA20} onCheckedChange={onToggleMA20} />
          <Label htmlFor="ma20" className="text-sm cursor-pointer">
            <span className="inline-block w-3 h-0.5 bg-chart-ma-fast mr-2 align-middle" />
            MA 20
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="ma50" checked={showMA50} onCheckedChange={onToggleMA50} />
          <Label htmlFor="ma50" className="text-sm cursor-pointer">
            <span className="inline-block w-3 h-0.5 bg-chart-ma-slow mr-2 align-middle" />
            MA 50
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="volume"
            checked={showVolume}
            onCheckedChange={onToggleVolume}
          />
          <Label htmlFor="volume" className="text-sm cursor-pointer">
            Volume
          </Label>
        </div>
      </div>

      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {intervals.map((int) => (
          <Button
            key={int.value}
            variant={interval === int.value ? "default" : "ghost"}
            size="sm"
            onClick={() => onIntervalChange(int.value)}
            className="px-3"
          >
            {int.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
