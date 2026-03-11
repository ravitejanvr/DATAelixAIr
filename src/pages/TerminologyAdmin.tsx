import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  Upload, Database, Play, Loader2, CheckCircle, XCircle,
  FileText, Trash2, RefreshCw
} from "lucide-react";

interface UploadedFile {
  name: string;
  path: string;
  size: number;
  created_at: string;
}

interface ImportResult {
  file: string;
  totalRows: number;
  insertedRows: number;
  status: "processing" | "completed" | "error";
  error?: string;
}

interface ConceptCounts {
  concepts: number;
  descriptions: number;
  relationships: number;
  mappings: number;
}

export default function TerminologyAdmin() {
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [counts, setCounts] = useState<ConceptCounts>({ concepts: 0, descriptions: 0, relationships: 0, mappings: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);

  const loadFiles = useCallback(async () => {
    const { data, error } = await supabase.storage
      .from("ontology")
      .list("snomed", { sortBy: { column: "created_at", order: "desc" } });

    if (!error && data) {
      setFiles(
        data
          .filter((f) => f.name && !f.name.startsWith("."))
          .map((f) => ({
            name: f.name,
            path: `snomed/${f.name}`,
            size: f.metadata?.size || 0,
            created_at: f.created_at || "",
          }))
      );
    }
  }, []);

  const loadCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/rest/v1/rpc/get_terminology_counts`;
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${token}`,
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        setCounts(data || { concepts: 0, descriptions: 0, relationships: 0, mappings: 0 });
      }
    } catch (err) {
      console.error("Failed to load counts:", err);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    loadCounts();
  }, [loadFiles, loadCounts]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        const filePath = `snomed/${file.name}`;
        const { error } = await supabase.storage
          .from("ontology")
          .upload(filePath, file, { upsert: true });

        if (error) {
          toast({
            title: "Upload failed",
            description: `${file.name}: ${error.message}`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Uploaded", description: file.name });
        }
      }
      await loadFiles();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (path: string) => {
    const { error } = await supabase.storage.from("ontology").remove([path]);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "File deleted" });
      await loadFiles();
    }
  };

  const handleImport = async () => {
    if (files.length === 0) {
      toast({ title: "No files to import", variant: "destructive" });
      return;
    }

    setImporting(true);
    setImportResults([]);

    try {
      const filePaths = files.map((f) => f.path);
      const { data, error } = await supabase.functions.invoke("import-snomed-rf2", {
        body: { files: filePaths },
      });

      if (error) {
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
        return;
      }

      setImportResults(data?.results || []);

      const successCount = (data?.results || []).filter(
        (r: ImportResult) => r.status === "completed"
      ).length;
      const errorCount = (data?.results || []).filter(
        (r: ImportResult) => r.status === "error"
      ).length;

      toast({
        title: "Import complete",
        description: `${successCount} files imported successfully${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
        variant: errorCount > 0 ? "destructive" : "default",
      });

      await loadCounts();
    } catch (err) {
      toast({
        title: "Import error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <>
      <SEO title="Terminology Management — DATAelixAIr" description="SNOMED CT ontology management." />
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Terminology Management</h2>
          <p className="text-sm text-muted-foreground">Upload and ingest SNOMED CT RF2 snapshot files.</p>
        </div>

        {/* Concept Counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Database className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Concepts</p>
              <p className="text-2xl font-bold">{loadingCounts ? "…" : counts.concepts.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <FileText className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Descriptions</p>
              <p className="text-2xl font-bold">{loadingCounts ? "…" : counts.descriptions.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Database className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Relationships</p>
              <p className="text-2xl font-bold">{loadingCounts ? "…" : counts.relationships.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Database className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Local Mappings</p>
              <p className="text-2xl font-bold">{loadingCounts ? "…" : counts.mappings.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload SNOMED RF2 Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".txt,.csv,.tsv"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1" />
                    )}
                    Select Files
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground">
                Upload Concept, Description, and Relationship snapshot files (RF2 tab-separated format).
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Uploaded Files</p>
                {files.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between p-2 rounded-lg border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(f.path)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {files.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No SNOMED files uploaded yet. Upload RF2 snapshot files to begin.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="h-4 w-4" /> Import SNOMED Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleImport}
                disabled={importing || files.length === 0}
                size="sm"
              >
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1" />
                )}
                {importing ? "Importing…" : "Import SNOMED"}
              </Button>
              <Button variant="outline" size="sm" onClick={loadCounts}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh Counts
              </Button>
            </div>

            {importing && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Processing files…</p>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            {/* Import Results */}
            {importResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Import Results</p>
                {importResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg border text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {r.status === "completed" ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className="text-xs">{r.file}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === "completed" ? (
                        <Badge variant="outline" className="text-[9px]">
                          {r.insertedRows.toLocaleString()} / {r.totalRows.toLocaleString()} rows
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-destructive">{r.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
