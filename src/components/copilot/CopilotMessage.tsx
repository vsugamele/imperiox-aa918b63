import ReactMarkdown from "react-markdown";
import { Crown, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export function CopilotMessage({ role, content }: Props) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "h-7 w-7 shrink-0 rounded-full flex items-center justify-center",
        isUser ? "bg-muted text-foreground" : "bg-primary/15 text-primary"
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
      </div>
      <div className={cn(
        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
        isUser ? "bg-primary/10 text-foreground" : "bg-muted/40 text-foreground"
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:mt-2 prose-headings:mb-1">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
