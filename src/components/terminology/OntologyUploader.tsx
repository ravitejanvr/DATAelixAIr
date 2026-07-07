import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Upload, X, Loader2, CheckCircle2, XCircle, FileArchive } from "lucide-react";

type FileStatus = "pending" | "uploading" | "done" | "failed";

type Item = {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
};

// Release folder must be a safe relative path like "snomed/SnomedCT_INT_20250701"
const FOLDER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

function isAllowedFilename(name: string) {
  if (name === "manifest.json") return true;
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*\.ndjson\.gz$/.test(name)) return true;
  return false;
}

export default function OntologyUploader() {
  const [folder, setFolder] = useState("snomed/");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const folderValid = useMemo(() => {
    const trimmed = folder.replace(/\/+$/, "");
    return FOLDER_RE.test(trimmed);
  }, [folder]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming: Item[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      if (!isAllowedFilename(f.name)) {
        rejected.push(f.name);
        continue;
      }
      incoming.push({ id: `${f.name}-${f.size}-${f.lastModified}`, file: f, status: "pending" });
    }
    if (rejected.length) {
      toast({
        title: "Skipped invalid files",
        description: `Only manifest.json and *.ndjson.gz are allowed. Rejected: ${rejected.slice(0, 5).join(", ")}${rejected.length > 5 ? "…" : ""}`,
        variant: "destructive",
      });
    }
    if (!incoming.length) return;
    setItems((prev) => {
      const byId = new Map(prev.map((x) => [x.id, x]));
      for (const it of incoming) byId.set(it.id, it);
      return Array.from(byId.values());
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((x) => x.id !== id || x.status === "uploading"));

  const clearDone = () => setItems((prev) => prev.filter((x) => x.status !== "done"));

  const startUpload = async () => {
    const trimmedFolder = folder.replace(/\/+$/, "");
    if (!FOLDER_RE.test(trimmedFolder)) {
      return toast({ title: "Invalid release folder", description: "Use a path like snomed/SnomedCT_INT_20250701", variant: "destructive" });
    }
    const queue = items.filter((x) => x.status === "pending" || x.status === "failed");
    if (!queue.length) return;
    setBusy(true);
    // Sequential to keep UI honest about progress and avoid rate spikes.
    for (const item of queue) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "uploading", error: undefined } : x)));
      const path = `${trimmedFolder}/${item.file.name}`;
      const contentType = item.file.name.endsWith(".json") ? "application/json" : "application/gzip";
      const { error } = await supabase.storage.from("ontology").upload(path, item.file, {
        upsert: true,
        contentType,
      });
      if (error) {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "failed", error: error.message } : x)));
      } else {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "done" } : x)));
      }
    }
    setBusy(false);
    const failed = items.filter((x) => x.status === "failed").length;
    toast({
      title: failed ? "Upload finished with errors" : "Upload complete",
      description: failed ? `${failed} file(s) failed. See list.` : "All files uploaded to the ontology bucket.",
      variant: failed ? "destructive" : "default",
    });
  };

  const counts = useMemo(() => {
    const c = { pending: 0, uploading: 0, done: 0, failed: 0 };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Upload chunks to ontology bucket</span>
          <span className="text-xs font-normal text-muted-foreground">platform_admin only</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Release folder (inside <code>ontology/</code>)</label>
          <Input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="snomed/SnomedCT_INT_20250701"
            className="font-mono text-xs"
          />
          {!folderValid && (
            <div className="text-xs text-destructive">
              Path must look like <code>snomed/&lt;release-id&gt;</code> — letters, digits, dot, dash, underscore, forward slash.
            </div>
          )}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
        >
          <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
          <div className="text-sm mt-2">Drag &amp; drop <code>manifest.json</code> and <code>*.ndjson.gz</code> here</div>
          <div className="text-xs text-muted-foreground">or click to select files</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".json,.gz,application/json,application/gzip"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {items.length > 0 && (
          <div className="border rounded divide-y max-h-72 overflow-auto">
            {items.map((it) => (
              <div key={it.id} className="p-2 flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs">{it.file.name}</div>
                    <div className="text-xs text-muted-foreground">{(it.file.size / 1024).toFixed(1)} KB</div>
                    {it.error && <div className="text-xs text-destructive truncate">{it.error}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {it.status === "pending" && <Badge variant="outline">pending</Badge>}
                  {it.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {it.status === "done" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  {it.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                  {it.status !== "uploading" && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(it.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            {items.length} file(s) · {counts.done} done · {counts.failed} failed · {counts.pending} pending
          </div>
          <div className="flex items-center gap-2">
            {counts.done > 0 && (
              <Button variant="ghost" size="sm" onClick={clearDone} disabled={busy}>Clear done</Button>
            )}
            <Button
              size="sm"
              onClick={startUpload}
              disabled={busy || !folderValid || items.every((x) => x.status === "done" || x.status === "uploading")}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload {counts.pending + counts.failed > 0 ? `(${counts.pending + counts.failed})` : ""}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Uploads go directly to the private <code>ontology</code> bucket. After all files land, paste the same <code>manifest.json</code> below in <em>Register new release</em> to trigger Load → Verify → Promote. Existing files at the same path are overwritten.
        </p>
      </CardContent>
    </Card>
  );
}
