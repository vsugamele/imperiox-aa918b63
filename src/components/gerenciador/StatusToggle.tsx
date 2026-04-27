import { Switch } from "@/components/ui/switch";

export function StatusToggle({
  status,
  loading,
  onChange,
}: {
  status: string | null | undefined;
  loading?: boolean;
  onChange: (next: "ACTIVE" | "PAUSED") => void;
}) {
  const isActive = status === "ACTIVE";
  return (
    <Switch
      checked={isActive}
      disabled={loading}
      onCheckedChange={(v) => onChange(v ? "ACTIVE" : "PAUSED")}
      className="data-[state=checked]:bg-emerald-500/80 data-[state=unchecked]:bg-muted/40"
    />
  );
}
