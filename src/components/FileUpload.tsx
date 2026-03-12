import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  bucket: string;
  path: string;
  onUpload: (url: string) => void;
  accept?: string;
  label?: string;
  className?: string;
}

export function FileUpload({ bucket, path, onUpload, accept = "image/*", label, className }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${path}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
    if (error) {
      toast.error("Erro no upload: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    onUpload(urlData.publicUrl);
    setUploading(false);
    toast.success("Upload concluído!");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={accept} onChange={handleUpload} className="hidden" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
        {label || "Upload"}
      </Button>
    </div>
  );
}
