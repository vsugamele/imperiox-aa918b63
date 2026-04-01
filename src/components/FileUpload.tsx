import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  bucket: string;
  path: string;
  onUpload?: (url: string) => void;
  onUploadMultiple?: (urls: string[]) => void;
  accept?: string;
  label?: string;
  className?: string;
  multiple?: boolean;
}

export function FileUpload({ bucket, path, onUpload, onUploadMultiple, accept = "image/*", label, className, multiple = false }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const total = files.length;
    let uploaded = 0;
    const collectedUrls: string[] = [];

    for (let i = 0; i < total; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop();
      const filePath = `${path}/${Date.now()}_${i}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
      if (error) {
        toast.error(`Erro no upload (${file.name}): ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      collectedUrls.push(urlData.publicUrl);
      uploaded++;
      setUploadCount(uploaded);
    }

    // Batch callback for multiple uploads to avoid stale closure issues
    if (collectedUrls.length > 0) {
      if (multiple && onUploadMultiple) {
        onUploadMultiple(collectedUrls);
      } else {
        collectedUrls.forEach((url) => onUpload?.(url));
      }
    }

    setUploading(false);
    setUploadCount(0);
    if (uploaded > 0) toast.success(`${uploaded} arquivo(s) enviado(s)!`);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleUpload} className="hidden" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            {uploadCount > 0 ? `${uploadCount}...` : ""}
          </>
        ) : (
          <Upload className="h-3 w-3 mr-1" />
        )}
        {label || "Upload"}
      </Button>
    </div>
  );
}
