import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { article_id } = await req.json();
    if (!article_id) {
      return new Response(JSON.stringify({ success: false, error: "article_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch article
    const { data: article, error: fetchErr } = await supabase
      .from("blog_articles")
      .select("*")
      .eq("id", article_id)
      .single();

    if (fetchErr || !article) {
      return new Response(JSON.stringify({ success: false, error: "Article not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build full text for RAG indexing
    const fullText = [
      article.title,
      article.summary,
      article.content,
      ...(article.key_findings || []),
      article.clinical_implications || "",
      (article.keywords || []).join(", "),
    ].filter(Boolean).join("\n\n");

    // Upsert index entry
    const { error: upsertErr } = await supabase
      .from("blog_article_index")
      .upsert({
        article_id: article.id,
        title: article.title,
        summary: article.summary,
        keywords: article.keywords || [],
        category: article.category,
        full_text: fullText,
        indexed_at: new Date().toISOString(),
      }, { onConflict: "article_id" });

    if (upsertErr) {
      console.error("Index upsert error:", upsertErr);
      return new Response(JSON.stringify({ success: false, error: upsertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("index-article error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
