"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasTailwindCdnSource = hasTailwindCdnSource;
exports.replaceSourceUrlVars = replaceSourceUrlVars;
// Utility functions exported for testing
function hasTailwindCdnSource(jsFiles) {
    const tailwindCdnRegex = /https:\/\/(cdn\.tailwindcss\.com(\?[^"'\s]*)?|cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4(\.\d+){0,2})/;
    return jsFiles.some((url) => tailwindCdnRegex.test(url));
}
function replaceSourceUrlVars(str, source) {
    if (!source)
        return str;
    const escapedSource = String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`var.url+'${escapedSource}([^']*)'`, 'g');
    return str.replace(pattern, (match, path) => `\${vars.url}${path}`);
}
const package_json_1 = __importDefault(require("./package.json"));
const { version } = package_json_1.default;
const block = async (htmlContent, options = {
    name: 'My block',
    prefix: 'wp',
    category: 'common',
    basePath: process.cwd(),
    shouldSaveFiles: true,
    generateIconPreview: false,
    jsFiles: [],
    cssFiles: [],
    source: null,
}) => {
    // ...existing block implementation from index.js...
};
exports.default = block;
//# sourceMappingURL=index.js.map