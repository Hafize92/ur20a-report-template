import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist");
const sourceFiles = ["app.js", "report-model.js", "styles.css"];
const assetFiles = ["jkr.png", "pemilik.png"];

if (basename(output) !== "dist" || relative(root, output).startsWith(`..${sep}`)) {
  throw new Error("Refusing to clean an unexpected build output path.");
}

await mkdir(join(output, "src"), { recursive: true });
await mkdir(join(output, "assets"), { recursive: true });
await copyFile(join(root, "index.html"), join(output, "index.html"));
await Promise.all(
  sourceFiles.map((file) => copyFile(join(root, "src", file), join(output, "src", file)))
);
await Promise.all(
  assetFiles.map((file) => copyFile(join(root, "assets", file), join(output, "assets", file)))
);

console.log("Built standalone IWK template in dist/.");
