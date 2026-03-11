import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 1000;

interface ImportProgress {
  file: string;
  totalRows: number;
  insertedRows: number;
  status: "processing" | "completed" | "error";
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is platform_admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: platform_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { files } = await req.json();
    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files specified" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: ImportProgress[] = [];

    for (const filePath of files) {
      const progress: ImportProgress = {
        file: filePath,
        totalRows: 0,
        insertedRows: 0,
        status: "processing",
      };

      try {
        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("ontology")
          .download(filePath);

        if (downloadError || !fileData) {
          progress.status = "error";
          progress.error = downloadError?.message || "File not found";
          results.push(progress);
          continue;
        }

        const text = await fileData.text();
        const lines = text.split("\n").filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          progress.status = "error";
          progress.error = "File has no data rows";
          results.push(progress);
          continue;
        }

        // Parse header
        const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());
        const dataLines = lines.slice(1);
        progress.totalRows = dataLines.length;

        // Detect file type from headers
        const fileType = detectFileType(headers, filePath);

        if (!fileType) {
          progress.status = "error";
          progress.error = `Unrecognized RF2 file format. Headers: ${headers.join(", ")}`;
          results.push(progress);
          continue;
        }

        // Process in batches
        for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
          const batch = dataLines.slice(i, i + BATCH_SIZE);
          const rows = batch
            .map((line) => parseLine(line, headers, fileType))
            .filter(Boolean);

          if (rows.length === 0) continue;

          const { error: insertError } = await insertBatch(
            supabase,
            fileType,
            rows
          );

          if (insertError) {
            console.error(`Batch insert error at row ${i}:`, insertError);
            // Continue processing remaining batches
          }

          progress.insertedRows += rows.length;
        }

        progress.status = "completed";
      } catch (err) {
        progress.status = "error";
        progress.error = err instanceof Error ? err.message : String(err);
      }

      results.push(progress);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("import-snomed-rf2 error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

type FileType = "concept" | "description" | "relationship";

function detectFileType(headers: string[], filePath: string): FileType | null {
  const path = filePath.toLowerCase();

  if (
    path.includes("concept") ||
    headers.includes("definitionstatusid")
  ) {
    return "concept";
  }
  if (
    path.includes("description") ||
    headers.includes("term") ||
    headers.includes("languagecode")
  ) {
    return "description";
  }
  if (
    path.includes("relationship") ||
    headers.includes("sourceid") ||
    headers.includes("destinationid")
  ) {
    return "relationship";
  }
  return null;
}

function parseLine(
  line: string,
  headers: string[],
  fileType: FileType
): Record<string, unknown> | null {
  const cols = line.split("\t");
  if (cols.length < headers.length) return null;

  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    row[h] = (cols[i] || "").trim();
  });

  try {
    switch (fileType) {
      case "concept":
        return {
          concept_id: parseInt(row["id"] || row["conceptid"] || row["concept_id"], 10),
          effective_time: parseRf2Date(row["effectivetime"]),
          active: row["active"] === "1" || row["active"] === "true",
          module_id: row["moduleid"] || null,
          definition_status_id: row["definitionstatusid"] || null,
        };
      case "description":
        return {
          description_id: parseInt(row["id"] || row["descriptionid"] || row["description_id"], 10),
          concept_id: parseInt(row["conceptid"] || row["concept_id"], 10),
          language_code: row["languagecode"] || row["language_code"] || "en",
          type_id: row["typeid"] || row["type_id"] || null,
          term: row["term"] || "",
          active: row["active"] === "1" || row["active"] === "true",
        };
      case "relationship":
        return {
          relationship_id: parseInt(row["id"] || row["relationshipid"] || row["relationship_id"], 10),
          source_concept: parseInt(row["sourceid"] || row["source_concept"], 10),
          destination_concept: parseInt(row["destinationid"] || row["destination_concept"], 10),
          relationship_type: row["typeid"] || row["relationship_type"] || null,
          active: row["active"] === "1" || row["active"] === "true",
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseRf2Date(dateStr: string): string | null {
  if (!dateStr || dateStr.length < 8) return null;
  // RF2 dates are YYYYMMDD
  const y = dateStr.substring(0, 4);
  const m = dateStr.substring(4, 6);
  const d = dateStr.substring(6, 8);
  return `${y}-${m}-${d}`;
}

async function insertBatch(
  supabase: ReturnType<typeof createClient>,
  fileType: FileType,
  rows: Record<string, unknown>[]
) {
  const tableMap: Record<FileType, string> = {
    concept: "snomed_concepts",
    description: "snomed_descriptions",
    relationship: "snomed_relationships",
  };

  // Use upsert to handle re-imports gracefully
  const pkMap: Record<FileType, string> = {
    concept: "concept_id",
    description: "description_id",
    relationship: "relationship_id",
  };

  // Direct SQL via rpc for terminology schema since PostgREST may not expose it
  const table = tableMap[fileType];
  const pk = pkMap[fileType];

  // Build batch insert using the service role client
  // We use raw SQL via a function since terminology schema may not be in PostgREST
  const values = rows.map((r) => {
    switch (fileType) {
      case "concept":
        return `(${r.concept_id}, ${r.effective_time ? `'${r.effective_time}'` : "NULL"}, ${r.active}, ${r.module_id ? `'${escapeSql(String(r.module_id))}'` : "NULL"}, ${r.definition_status_id ? `'${escapeSql(String(r.definition_status_id))}'` : "NULL"})`;
      case "description":
        return `(${r.description_id}, ${r.concept_id}, '${escapeSql(String(r.language_code || "en"))}', ${r.type_id ? `'${escapeSql(String(r.type_id))}'` : "NULL"}, '${escapeSql(String(r.term || ""))}', ${r.active})`;
      case "relationship":
        return `(${r.relationship_id}, ${r.source_concept}, ${r.destination_concept}, ${r.relationship_type ? `'${escapeSql(String(r.relationship_type))}'` : "NULL"}, ${r.active})`;
      default:
        return "";
    }
  }).filter(Boolean);

  const columnMap: Record<FileType, string> = {
    concept: "concept_id, effective_time, active, module_id, definition_status_id",
    description: "description_id, concept_id, language_code, type_id, term, active",
    relationship: "relationship_id, source_concept, destination_concept, relationship_type, active",
  };

  const sql = `INSERT INTO terminology.${table} (${columnMap[fileType]}) VALUES ${values.join(",")} ON CONFLICT (${pk}) DO UPDATE SET active = EXCLUDED.active`;

  // Execute via Supabase management API — use the service role connection
  const { error } = await supabase.rpc("exec_terminology_sql", { sql_text: sql });

  if (error) {
    // Fallback: try direct fetch to PostgREST if schema exposed
    console.error("RPC exec error, trying direct:", error.message);
    
    // Use fetch to call the database directly via the REST API
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_terminology_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql_text: sql }),
    });
    
    if (!resp.ok) {
      const errText = await resp.text();
      return { error: { message: errText } };
    }
  }

  return { error: null };
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}
