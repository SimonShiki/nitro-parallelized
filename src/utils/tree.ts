import { promises as fsp } from "node:fs";
import { resolve, dirname, relative } from "pathe";
import { globby } from "globby";
import prettyBytes from "pretty-bytes";
import { gzipSize } from "gzip-size";
import chalk from "chalk";
import { isTest } from "std-env";

export async function generateFSTree(
  dir: string,
  options: { compressedSizes?: boolean } = {}
) {
  if (isTest) {
    return;
  }

  const files = await globby("**/*.*", { cwd: dir, ignore: ["*.map"] });

  // from https://github.com/unjs/nitro/issues/1833#issuecomment-1772762009
  // read file parallelly to avoid OOM
  const items = []
  for (const file of files) {
    const path = resolve(dir, file);
    const src = await promises.readFile(path);
    const size = src.byteLength;
    const gzip = options.compressedSizes ? await gzipSize(src) : 0;

    const fileMapped = { file, path, size, gzip };
    items.push(fileMapped);
  }
  items.sort((a, b) => a.path.localeCompare(b.path));

  let totalSize = 0;
  let totalGzip = 0;

  let totalNodeModulesSize = 0;
  let totalNodeModulesGzip = 0;

  let treeText = "";

  for (const [index, item] of items.entries()) {
    let dir = dirname(item.file);
    if (dir === ".") {
      dir = "";
    }
    const rpath = relative(process.cwd(), item.path);
    const treeChar = index === items.length - 1 ? "└─" : "├─";

    const isNodeModules = item.file.includes("node_modules");

    if (isNodeModules) {
      totalNodeModulesSize += item.size;
      totalNodeModulesGzip += item.gzip;
      continue;
    }

    treeText += chalk.gray(
      `  ${treeChar} ${rpath} (${prettyBytes(item.size)})`
    );
    if (options.compressedSizes) {
      treeText += chalk.gray(` (${prettyBytes(item.gzip)} gzip)`);
    }
    treeText += "\n";
    totalSize += item.size;
    totalGzip += item.gzip;
  }

  treeText += `${chalk.cyan("Σ Total size:")} ${prettyBytes(
    totalSize + totalNodeModulesSize
  )}`;
  if (options.compressedSizes) {
    treeText += ` (${prettyBytes(totalGzip + totalNodeModulesGzip)} gzip)`;
  }
  treeText += "\n";

  return treeText;
}
