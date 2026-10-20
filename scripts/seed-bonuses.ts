#!/usr/bin/env npx tsx
/**
 * seed-bonuses.ts
 * 
 * Script otomatisasi untuk membuat bonus bundle dari folder bahanbonusapp/.
 * 
 * Usage:
 *   npx tsx scripts/seed-bonuses.ts --dry-run
 *   npx tsx scripts/seed-bonuses.ts --base-url https://api.growwithai.id --cookie "session=..."
 *   npx tsx scripts/seed-bonuses.ts --base-url https://api.growwithai.id --cookie "session=..." --bundle agency-growth-blueprint
 *   npx tsx scripts/seed-bonuses.ts --resume --base-url https://api.growwithai.id --cookie "session=..."
 */

import fs from "node:fs";
import path from "node:path";

// ─── Configuration ────────────────────────────────────────────────────────────

const BAHAN_DIR = path.resolve(import.meta.dirname ?? __dirname, "../../bahanbonusapp");
const PROGRESS_FILE = path.resolve(import.meta.dirname ?? __dirname, ".seed-progress.json");
const UPLOAD_FOLDER = "Bonusses"; // R2 folder
const DELAY_MS = 500; // delay between uploads to avoid rate limiting

// Sort order mapping for product types within a bundle
const TYPE_SORT_ORDER: Record<string, number> = {
  "Book": 0,
  "Guide": 1,
  "Checklist": 2,
  "Listicle": 3,
  "Mini-Course": 4,
  "Prompt Pack": 5,
  "Toolstack": 6,
  "Audio": 7,
};

// File extensions to skip
const SKIP_EXTENSIONS = new Set([".docx", ".ds_store"]);

// Cover file name priorities per type
const COVER_NAMES: Record<string, string[]> = {
  "Book": ["Book Cover.jpg", "Artwork.jpg", "Artwork.png"],
  "Guide": ["Guide Cover.jpg", "Artwork.jpg", "Artwork.png"],
  "Checklist": ["Checklist Cover.jpg", "Artwork.jpg", "Artwork.png"],
  "Listicle": ["Listicle Cover.jpg", "Artwork.jpg", "Artwork.png"],
  "Mini-Course": ["Mini-Course Cover.jpg", "Artwork.jpg", "Artwork.png"],
  "Prompt Pack": ["Prompt Pack Cover.jpg", "Artwork.jpg", "Artwork.png"],
  "Toolstack": ["Toolstack Cover.jpg", "Artwork.jpg", "Artwork.png"],
  "Audio": ["Artwork.png", "Artwork.jpg"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedProduct {
  type: string;
  title: string;
  folderPath: string;
  coverFile: string | null;
  contentFiles: string[]; // PDF or M4A files
}

interface ParsedBundle {
  slug: string;
  title: string;
  folderPath: string;
  coverFile: string | null;
  products: ParsedProduct[];
}

interface Progress {
  completedBundles: string[]; // slugs of fully completed bundles
  uploadedFiles: Record<string, string>; // local path -> R2 URL
  createdBonuses: Record<string, string>; // slug -> bonus ID
}

// ─── CLI Args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--resume") {
      opts.resume = true;
    } else if (arg === "--force") {
      opts.force = true;
    } else if (arg === "--base-url" && args[i + 1]) {
      opts.baseUrl = args[++i];
    } else if (arg === "--cookie" && args[i + 1]) {
      opts.cookie = args[++i];
    } else if (arg === "--bundle" && args[i + 1]) {
      opts.bundle = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npx tsx scripts/seed-bonuses.ts [options]

Options:
  --dry-run              Preview what will be done without uploading
  --base-url <url>       API base URL (e.g., https://api.growwithai.id)
  --cookie <cookie>      Admin session cookie string
  --bundle <slug>        Only process a specific bundle by folder name
  --resume               Resume from last progress
  --force                Overwrite existing bundles
  -h, --help             Show this help
`);
      process.exit(0);
    }
  }
  return opts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bThe\b/g, (m, offset) => (offset === 0 ? m : "the"))
    .replace(/\bFor\b/g, (m, offset) => (offset === 0 ? m : "for"))
    .replace(/\bWith\b/g, (m, offset) => (offset === 0 ? m : "with"))
    .replace(/\bWithout\b/g, (m, offset) => (offset === 0 ? m : "without"))
    .replace(/\bIn\b/g, (m, offset) => (offset === 0 ? m : "in"))
    .replace(/\bTo\b/g, (m, offset) => (offset === 0 ? m : "to"))
    .replace(/\bA\b/g, (m, offset) => (offset === 0 ? m : "a"))
    .replace(/\bAn\b/g, (m, offset) => (offset === 0 ? m : "an"));
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    } catch {
      // ignore
    }
  }
  return { completedBundles: [], uploadedFiles: {}, createdBonuses: {} };
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ─── Folder Scanner ───────────────────────────────────────────────────────────

function parseFolderName(name: string): { type: string; title: string } | null {
  // Check known multi-word types first (order matters: longest prefix first)
  const KNOWN_TYPES = [
    "Mini-Course",
    "Prompt Pack",
    "Audio",
    "Book",
    "Guide",
    "Checklist",
    "Listicle",
    "Toolstack",
  ];

  for (const knownType of KNOWN_TYPES) {
    const prefix = `${knownType} - `;
    if (name.startsWith(prefix)) {
      return { type: knownType, title: name.slice(prefix.length).trim() };
    }
  }

  // Fallback: split on first " - "
  const sepIdx = name.indexOf(" - ");
  if (sepIdx === -1) return null;
  return { type: name.slice(0, sepIdx).trim(), title: name.slice(sepIdx + 3).trim() };
}

function findCoverFile(folderPath: string, productType: string): string | null {
  const files = fs.readdirSync(folderPath);
  const priorities = COVER_NAMES[productType] || ["Artwork.jpg", "Artwork.png"];

  for (const coverName of priorities) {
    const found = files.find((f) => f.toLowerCase() === coverName.toLowerCase());
    if (found) return path.join(folderPath, found);
  }

  // Fallback: any jpg/png file that looks like a cover
  const imgFile = files.find(
    (f) =>
      (f.toLowerCase().endsWith(".jpg") || f.toLowerCase().endsWith(".png")) &&
      (f.toLowerCase().includes("cover") || f.toLowerCase().includes("artwork"))
  );
  if (imgFile) return path.join(folderPath, imgFile);

  return null;
}

function findContentFiles(folderPath: string): string[] {
  const files = fs.readdirSync(folderPath);
  return files
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) return false;
      if (f.startsWith(".")) return false;
      // Content files: PDF, M4A
      return [".pdf", ".m4a"].includes(ext);
    })
    .map((f) => path.join(folderPath, f))
    .sort();
}

function scanBundles(filterSlug?: string): ParsedBundle[] {
  if (!fs.existsSync(BAHAN_DIR)) {
    console.error(`❌ Folder not found: ${BAHAN_DIR}`);
    process.exit(1);
  }

  const bundleDirs = fs
    .readdirSync(BAHAN_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  const bundles: ParsedBundle[] = [];

  for (const bundleDir of bundleDirs) {
    if (filterSlug && bundleDir !== filterSlug) continue;

    const bundlePath = path.join(BAHAN_DIR, bundleDir);
    const bundleTitle = toTitleCase(bundleDir);
    const bundleSlug = slugify(bundleDir);

    // Find products (subdirectories)
    const productDirs = fs
      .readdirSync(bundlePath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name)
      .sort();

    const products: ParsedProduct[] = [];

    for (const productDir of productDirs) {
      const parsed = parseFolderName(productDir);
      if (!parsed) {
        console.warn(`⚠️  Skipping unknown folder format: ${productDir}`);
        continue;
      }

      const productPath = path.join(bundlePath, productDir);
      const coverFile = findCoverFile(productPath, parsed.type);
      const contentFiles = findContentFiles(productPath);

      products.push({
        type: parsed.type,
        title: parsed.title,
        folderPath: productPath,
        coverFile,
        contentFiles,
      });
    }

    // Sort products by type order
    products.sort((a, b) => {
      const orderA = TYPE_SORT_ORDER[a.type] ?? 99;
      const orderB = TYPE_SORT_ORDER[b.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });

    // Bundle cover = Book Cover from "Book - ..." subfolder
    const bookProduct = products.find((p) => p.type === "Book");
    const bundleCover = bookProduct?.coverFile || products.find((p) => p.coverFile)?.coverFile || null;

    bundles.push({
      slug: bundleSlug,
      title: bundleTitle,
      folderPath: bundlePath,
      coverFile: bundleCover,
      products,
    });
  }

  return bundles;
}

// ─── API Client ───────────────────────────────────────────────────────────────

class ApiClient {
  constructor(
    private baseUrl: string,
    private cookie: string
  ) {}

  async uploadFile(filePath: string): Promise<{ key: string; url: string }> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();

    // Determine content type
    const contentTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf",
      ".m4a": "audio/mp4",
    };

    const contentType = contentTypeMap[ext] || "application/octet-stream";

    // Create form data manually using Blob
    const blob = new Blob([fileBuffer], { type: contentType });
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("folder", UPLOAD_FOLDER);

    const res = await fetch(`${this.baseUrl}/api/admin/storage/upload`, {
      method: "POST",
      headers: { Cookie: this.cookie },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { success: boolean; data: { key: string }; error?: string };
    if (!data.success) {
      throw new Error(`Upload failed: ${data.error}`);
    }

    return {
      key: data.data.key,
      url: `https://file.growwithai.id/${data.data.key}`,
    };
  }

  async createBonus(bonus: {
    title: string;
    slug: string;
    bonus_type: string;
    thumbnail_url?: string;
    status: string;
  }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/admin/bonuses`, {
      method: "POST",
      headers: {
        Cookie: this.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bonus),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Create bonus failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { success: boolean; data: { id: string }; error?: string };
    if (!data.success) {
      throw new Error(`Create bonus failed: ${data.error}`);
    }

    return data.data.id;
  }

  async addBonusFile(
    bonusId: string,
    file: {
      title: string;
      file_type: string;
      file_url: string;
      r2_key: string;
      thumbnail_url?: string | null;
      r2_thumbnail_key?: string | null;
      sort_order: number;
    }
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/admin/bonuses/${bonusId}/files`, {
      method: "POST",
      headers: {
        Cookie: this.cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(file),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Add bonus file failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { success: boolean; data: { id: string }; error?: string };
    if (!data.success) {
      throw new Error(`Add bonus file failed: ${data.error}`);
    }

    return data.data.id;
  }
}

// ─── Dry Run ──────────────────────────────────────────────────────────────────

function printDryRun(bundles: ParsedBundle[]) {
  console.log("\n" + "═".repeat(70));
  console.log("🔍 DRY RUN — Preview of what will be done");
  console.log("═".repeat(70));

  let totalUploads = 0;
  let totalSkipped = 0;
  let totalProducts = 0;

  for (const bundle of bundles) {
    console.log(`\n📦 Bundle: ${bundle.title}`);
    console.log(`   Slug: ${bundle.slug}`);
    console.log(`   Cover: ${bundle.coverFile ? path.basename(bundle.coverFile) : "❌ None"}`);
    console.log(`   Products: ${bundle.products.length}`);

    if (bundle.coverFile) totalUploads++;

    for (const product of bundle.products) {
      const typeEmoji: Record<string, string> = {
        Book: "📖",
        Guide: "📝",
        Checklist: "✅",
        Listicle: "📃",
        "Mini-Course": "🎓",
        "Prompt Pack": "💡",
        Toolstack: "🛠️",
        Audio: "🎧",
      };
      const emoji = typeEmoji[product.type] || "📄";

      console.log(`   ${emoji} ${product.type} — ${product.title}`);
      if (product.coverFile) {
        console.log(`      Cover: ${path.basename(product.coverFile)}`);
        totalUploads++;
      } else {
        console.log(`      Cover: ❌ None`);
      }

      for (const contentFile of product.contentFiles) {
        const ext = path.extname(contentFile).toLowerCase();
        const sizeMb = (fs.statSync(contentFile).size / 1024 / 1024).toFixed(1);
        console.log(`      Content: ${path.basename(contentFile)} (${sizeMb}MB)`);
        totalUploads++;
      }

      totalProducts++;

      // Count skipped files
      const allFiles = fs.readdirSync(product.folderPath);
      const skipped = allFiles.filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return SKIP_EXTENSIONS.has(ext) || f.startsWith(".");
      });
      totalSkipped += skipped.length;
    }
  }

  console.log("\n" + "─".repeat(70));
  console.log(`📊 Summary:`);
  console.log(`   Bundles:         ${bundles.length}`);
  console.log(`   Products:        ${totalProducts}`);
  console.log(`   Files to upload: ${totalUploads}`);
  console.log(`   Files to skip:   ${totalSkipped}`);
  console.log(`   Est. time:       ~${Math.ceil(totalUploads * DELAY_MS / 1000 / 60)} minutes`);
  console.log("═".repeat(70) + "\n");
}

// ─── Execute Upload ───────────────────────────────────────────────────────────

async function executeUpload(
  bundles: ParsedBundle[],
  api: ApiClient,
  progress: Progress,
  opts: Record<string, string | boolean>
) {
  console.log("\n" + "═".repeat(70));
  console.log("🚀 STARTING UPLOAD");
  console.log("═".repeat(70));

  let uploadCount = 0;
  let errorCount = 0;

  for (const bundle of bundles) {
    // Check if already completed
    if (!opts.force && progress.completedBundles.includes(bundle.slug)) {
      console.log(`\n⏭️  Skipping bundle "${bundle.title}" (already completed)`);
      continue;
    }

    console.log(`\n${"─".repeat(50)}`);
    console.log(`📦 Processing: ${bundle.title}`);
    console.log(`${"─".repeat(50)}`);

    try {
      // Step 1: Upload bundle cover
      let bundleThumbnailUrl: string | undefined;
      if (bundle.coverFile) {
        if (progress.uploadedFiles[bundle.coverFile]) {
          bundleThumbnailUrl = progress.uploadedFiles[bundle.coverFile];
          console.log(`   ♻️  Cover already uploaded: ${path.basename(bundle.coverFile)}`);
        } else {
          console.log(`   📤 Uploading bundle cover: ${path.basename(bundle.coverFile)}`);
          const result = await api.uploadFile(bundle.coverFile);
          bundleThumbnailUrl = result.url;
          progress.uploadedFiles[bundle.coverFile] = result.url;
          saveProgress(progress);
          uploadCount++;
          await delay(DELAY_MS);
        }
      }

      // Step 2: Create bonus entry
      let bonusId: string;
      if (progress.createdBonuses[bundle.slug]) {
        bonusId = progress.createdBonuses[bundle.slug];
        console.log(`   ♻️  Bonus already created: ${bonusId}`);
      } else {
        console.log(`   📝 Creating bonus: ${bundle.title}`);
        bonusId = await api.createBonus({
          title: bundle.title,
          slug: bundle.slug,
          bonus_type: "bundle",
          thumbnail_url: bundleThumbnailUrl,
          status: "active",
        });
        progress.createdBonuses[bundle.slug] = bonusId;
        saveProgress(progress);
        console.log(`   ✅ Created bonus: ${bonusId}`);
        await delay(DELAY_MS);
      }

      // Step 3: Process each product
      let sortOrder = 0;
      for (const product of bundle.products) {
        const productKey = `${bundle.slug}/${product.type}/${product.title}`;

        console.log(`\n   📄 Product: [${product.type}] ${product.title}`);

        // Upload product cover
        let productThumbnailUrl: string | null = null;
        let productThumbnailKey: string | null = null;

        if (product.coverFile) {
          if (progress.uploadedFiles[product.coverFile]) {
            productThumbnailUrl = progress.uploadedFiles[product.coverFile];
            // Extract key from URL
            productThumbnailKey = productThumbnailUrl.replace("https://file.growwithai.id/", "");
            console.log(`      ♻️  Cover already uploaded`);
          } else {
            console.log(`      📤 Uploading cover: ${path.basename(product.coverFile)}`);
            const result = await api.uploadFile(product.coverFile);
            productThumbnailUrl = result.url;
            productThumbnailKey = result.key;
            progress.uploadedFiles[product.coverFile] = result.url;
            saveProgress(progress);
            uploadCount++;
            await delay(DELAY_MS);
          }
        }

        // Upload content files
        if (product.type === "Audio") {
          // Audio: each episode becomes a separate bonus_file
          const episodes = product.contentFiles.filter((f) => f.endsWith(".m4a"));
          episodes.sort(); // Ep.1, Ep.2, Ep.3...

          for (const episode of episodes) {
            const episodeName = path.basename(episode, ".m4a");

            if (progress.uploadedFiles[episode]) {
              console.log(`      ♻️  Audio already uploaded: ${episodeName}`);
              // Still need to create the bonus_file entry if not done
            } else {
              const sizeMb = (fs.statSync(episode).size / 1024 / 1024).toFixed(1);
              console.log(`      📤 Uploading audio (${sizeMb}MB): ${episodeName}`);
              const result = await api.uploadFile(episode);
              progress.uploadedFiles[episode] = result.url;
              saveProgress(progress);
              uploadCount++;
              await delay(DELAY_MS);
            }

            // Create bonus_file entry
            const fileUrl = progress.uploadedFiles[episode];
            const fileKey = fileUrl.replace("https://file.growwithai.id/", "");

            try {
              await api.addBonusFile(bonusId, {
                title: episodeName,
                file_type: "audio",
                file_url: fileUrl,
                r2_key: fileKey,
                thumbnail_url: productThumbnailUrl,
                r2_thumbnail_key: productThumbnailKey,
                sort_order: sortOrder++,
              });
              console.log(`      ✅ Added audio file: ${episodeName}`);
            } catch (err: any) {
              console.error(`      ❌ Failed to add audio file: ${err.message}`);
              errorCount++;
            }

            await delay(DELAY_MS);
          }
        } else {
          // Non-audio: upload PDF(s), each becomes a bonus_file
          for (const contentFile of product.contentFiles) {
            const contentName = path.basename(contentFile);

            if (progress.uploadedFiles[contentFile]) {
              console.log(`      ♻️  File already uploaded: ${contentName}`);
            } else {
              const sizeMb = (fs.statSync(contentFile).size / 1024 / 1024).toFixed(1);
              console.log(`      📤 Uploading file (${sizeMb}MB): ${contentName}`);
              const result = await api.uploadFile(contentFile);
              progress.uploadedFiles[contentFile] = result.url;
              saveProgress(progress);
              uploadCount++;
              await delay(DELAY_MS);
            }

            // Determine file_type from extension
            const ext = path.extname(contentFile).toLowerCase();
            let fileType = "file";
            if (ext === ".pdf") fileType = "pdf";
            else if (ext === ".m4a") fileType = "audio";

            // Use product title for the main file, or filename for extras
            const isMainFile =
              product.contentFiles.length === 1 ||
              contentName.toLowerCase().includes(product.title.toLowerCase().split(" ")[0].toLowerCase());

            const fileUrl = progress.uploadedFiles[contentFile];
            const fileKey = fileUrl.replace("https://file.growwithai.id/", "");

            try {
              await api.addBonusFile(bonusId, {
                title: isMainFile ? product.title : path.basename(contentFile, ext),
                file_type: fileType,
                file_url: fileUrl,
                r2_key: fileKey,
                thumbnail_url: productThumbnailUrl,
                r2_thumbnail_key: productThumbnailKey,
                sort_order: sortOrder++,
              });
              console.log(`      ✅ Added file: ${isMainFile ? product.title : contentName}`);
            } catch (err: any) {
              console.error(`      ❌ Failed to add file: ${err.message}`);
              errorCount++;
            }

            await delay(DELAY_MS);
          }
        }
      }

      // Mark bundle as completed
      progress.completedBundles.push(bundle.slug);
      saveProgress(progress);
      console.log(`\n   🎉 Bundle "${bundle.title}" completed!`);
    } catch (err: any) {
      console.error(`\n   ❌ Error processing bundle "${bundle.title}": ${err.message}`);
      errorCount++;
      saveProgress(progress);
      // Continue to next bundle
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log(`🏁 UPLOAD COMPLETE`);
  console.log(`   Total uploads: ${uploadCount}`);
  console.log(`   Errors: ${errorCount}`);
  if (errorCount > 0) {
    console.log(`   ⚠️  Run with --resume to retry failed items`);
  }
  console.log("═".repeat(70) + "\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log("\n🔧 Seed Bonuses Script");
  console.log(`   Source: ${BAHAN_DIR}`);

  // Scan bundles
  const bundles = scanBundles(opts.bundle as string | undefined);

  if (bundles.length === 0) {
    console.log("❌ No bundles found.");
    process.exit(1);
  }

  console.log(`   Found: ${bundles.length} bundle(s)\n`);

  // Dry run mode
  if (opts.dryRun) {
    printDryRun(bundles);
    return;
  }

  // Validate required args for upload mode
  if (!opts.baseUrl) {
    console.error("❌ --base-url is required for upload mode");
    console.error("   Use --dry-run to preview, or provide --base-url and --cookie");
    process.exit(1);
  }
  if (!opts.cookie) {
    console.error("❌ --cookie is required for upload mode");
    process.exit(1);
  }

  const api = new ApiClient(opts.baseUrl as string, opts.cookie as string);

  // Load or reset progress
  let progress: Progress;
  if (opts.resume) {
    progress = loadProgress();
    console.log(`   ♻️  Resuming from progress file (${progress.completedBundles.length} bundles done)`);
  } else if (!opts.force) {
    // Fresh start — check for existing progress
    if (fs.existsSync(PROGRESS_FILE)) {
      const existing = loadProgress();
      if (existing.completedBundles.length > 0) {
        console.log(`\n⚠️  Found existing progress (${existing.completedBundles.length} bundles done).`);
        console.log(`   Use --resume to continue, or --force to start fresh.\n`);
        process.exit(1);
      }
    }
    progress = { completedBundles: [], uploadedFiles: {}, createdBonuses: {} };
  } else {
    progress = { completedBundles: [], uploadedFiles: {}, createdBonuses: {} };
    if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  }

  await executeUpload(bundles, api, progress, opts);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
