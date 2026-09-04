import { validateCsvFile } from "@/lib/import/csv";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ success: false, data: null, error: { code: "FILE_REQUIRED", message: "Please choose a CSV file." } }, { status: 400 });
    }
    const parse = validateCsvFile(file);
    const result = parse(await file.text());
    return Response.json({
      success: true,
      data: {
        summary: { total: result.total, valid: result.rows.length, invalid: result.errors.length, duplicates: result.duplicates },
        rows: result.rows,
        errors: result.errors.slice(0, 50),
      },
      error: null,
    });
  } catch (error) {
    return Response.json({
      success: false,
      data: null,
      error: { code: "CSV_PREVIEW_FAILED", message: error instanceof Error ? error.message : "Unable to preview this CSV file." },
    }, { status: 400 });
  }
}
