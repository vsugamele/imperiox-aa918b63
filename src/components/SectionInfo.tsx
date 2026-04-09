import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SectionInfoProps {
  title: string;
  description: string;
  usage?: string;
}

export function SectionInfo({ title, description, usage }: SectionInfoProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="right" align="start">
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground">{title}</h4>
          <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
          {usage && (
            <p className="text-xs text-primary/80 leading-relaxed">
              💡 {usage}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
