export { scanCode } from "./code/scanCode";
export { routeUrlFor } from "./code/extractRoutes";
export type { CodeScanContext } from "./code/context";
export { scanPython } from "./python/scanPython";
export type { PyScanContext } from "./python/context";
export { scanSql } from "./sql/scanSql";
export { scanPackageJson } from "./config/scanPackageJson";
export { scanDocs } from "./docs/scanDocs";
export type { DocScan, DocSection } from "./docs/scanDocs";
export { linkDocsToCode } from "./docs/linkDocsToCode";
export { parseMarkdown, slugify } from "./docs/parseMarkdown";
export type { ParsedMarkdown, MdHeading, MdLink, MdToken, MdCodeBlock } from "./docs/parseMarkdown";

// Built-in scanners as versioned plugins (no auto-loading; hosts register these).
export {
  builtinScannerPlugins,
  packagePlugin,
  codePlugin,
  sqlPlugin,
  docsPlugin,
} from "./plugins";
