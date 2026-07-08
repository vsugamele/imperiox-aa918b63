import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  urls: string[];
  kinds: string[];
  onChange: (urls: string[], kinds: string[]) => void;
}

export function ReferenceUploader({ urls, kinds, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { toast.error("Faça login"); return; }
      const newUrls = [...urls];
      const newKinds = [...kinds];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("studio-references").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (error) { toast.error(error.message); continue; }
        const { data: signed } = await supabase.storage.from("studio-references").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) {
          newUrls.push(signed.signedUrl);
          newKinds.push(file.type.startsWith("video") ? "video" : "image");
        }
      }
      onChange(newUrls, newKinds);
    } finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const removeAt = (i: number) => {
    const nu = urls.filter((_, idx) => idx !== i);
    const nk = kinds.filter((_, idx) => idx !== i);
    onChange(nu, nk);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {urls.length > 0 ? `${urls.length} referência${urls.length > 1 ? "s" : ""}` : "Fotos/vídeos de referência"}
        </span>
        {urls.length > 0 && (
          <button
            onClick={() => onChange([], [])}
            className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> Remover todas
          </button>
        )}
      </div>

      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {urls.map((u, i) => (
            <div key={u} className="relative group aspect-square rounded overflow-hidden border border-border/60 bg-background/40">
              {kinds[i] === "video" ? (
                <video src={u} className="w-full h-full object-cover" muted />
              ) : (
                <img src={u} className="w-full h-full object-cover" alt="" />
              )}
              <button
                onClick={() => removeAt(i)}
                className="absolute top-0.5 right-0.5 bg-rose-500/90 hover:bg-rose-500 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition"
                title="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "w-full border-2 border-dashed rounded p-3 flex items-center justify-center gap-2 text-xs transition",
          "border-border/60 hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-primary",
          uploading && "opacity-60 cursor-wait"
        )}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? "Enviando…" : "Enviar foto ou vídeo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
    </div>
  );
}
