import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw, Link2Off, FileWarning } from "lucide-react";

interface HealthIssue {
  articleId: string;
  title: string;
  slug: string;
  status: string;
  issues: string[];
}

const REQUIRED_FIELDS = ["title", "slug", "category", "summary", "content", "publish_date"] as const;

export default function BlogHealthChecker() {
  const [issues, setIssues] = useState<HealthIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("blog_articles")
        .select("*")
        .order("created_at", { ascending: false }) as any;

      if (!data) { setIssues([]); return; }

      const found: HealthIssue[] = [];

      for (const article of data) {
        const articleIssues: string[] = [];

        // Check required fields
        for (const field of REQUIRED_FIELDS) {
          const val = article[field];
          if (val === null || val === undefined || val === "") {
            articleIssues.push(`Missing required field: ${field}`);
          }
        }

        // Check empty arrays that should have content
        if (!article.keywords?.length) articleIssues.push("No keywords defined");
        if (!article.key_findings?.length && article.source_type === "Research") {
          articleIssues.push("Research article missing key findings");
        }

        // Check for missing author
        if (!article.author?.trim()) articleIssues.push("Missing author");

        // Check reading time
        if (!article.reading_time_min || article.reading_time_min <= 0) {
          articleIssues.push("Invalid reading time");
        }

        // Check source URL validity
        if (article.source_url) {
          try {
            new URL(article.source_url);
          } catch {
            articleIssues.push("Invalid source URL format");
          }
        } else if (article.source_type === "Research") {
          articleIssues.push("Research article missing source URL");
        }

        // Published without publish_date
        if (article.status === "published" && !article.publish_date) {
          articleIssues.push("Published without publish_date");
        }

        // Missing SEO metadata
        if (!article.meta_title) articleIssues.push("Missing meta title");
        if (!article.meta_description) articleIssues.push("Missing meta description");

        // Slug format check
        if (article.slug && /[A-Z\s]/.test(article.slug)) {
          articleIssues.push("Slug contains uppercase or spaces");
        }

        if (articleIssues.length > 0) {
          found.push({
            articleId: article.id,
            title: article.title || "(untitled)",
            slug: article.slug || "(no slug)",
            status: article.status,
            issues: articleIssues,
          });
        }
      }

      setIssues(found);
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runCheck(); }, []);

  const severityColor = (count: number) => {
    if (count >= 4) return "text-destructive";
    if (count >= 2) return "text-amber-600 dark:text-amber-400";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileWarning className="h-4 w-4" />
            Blog Health Checker
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastChecked && (
              <span className="text-[10px] text-muted-foreground">Last: {lastChecked}</span>
            )}
            <Button size="sm" variant="outline" onClick={runCheck} disabled={loading} className="h-7">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!loading && issues.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 py-4 justify-center">
            <CheckCircle2 className="h-4 w-4" />
            All articles pass health checks
          </div>
        )}

        {!loading && issues.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {issues.length} article{issues.length > 1 ? "s" : ""} with issues detected
            </p>
            {issues.map((item) => (
              <div key={item.articleId} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium truncate flex-1">{item.title}</p>
                  <Badge variant="outline" className="text-[9px] ml-2 shrink-0">{item.status}</Badge>
                </div>
                <ul className="space-y-1">
                  {item.issues.map((issue, i) => (
                    <li key={i} className={`text-[11px] flex items-start gap-1.5 ${severityColor(item.issues.length)}`}>
                      {issue.includes("URL") ? (
                        <Link2Off className="h-3 w-3 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      )}
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
