import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import beautify from "beautify";
import { decode } from "html-entities";
import mime from "mime";
import { createFileRecord, inferContentType, uploadBufferToR2 } from "../../r2.js";
export const h = (t, i = true) => { if (i)
    console.error(`[Error] ${t}`); };
export const p = (t, i = true) => { if (i)
    console.log(`[Success] ${t}`); };
export const d = (t) => t.startsWith("//");
export const m = (t, r = "https") => (d(t) ? `${r}:${t}` : t);
export const u = (t) => t.endsWith("/");
export const w = (t) => !t.startsWith("http") && !d(t);
export const $ = (e) => e.trim().replace(/^['"]|['"]$/g, "");
export const E = (relativePath, a = "", r = "https") => {
    try {
        if (w(relativePath)) {
            const cleanPath = $(relativePath);
            const resolved = new URL(cleanPath, a);
            return resolved.href;
        }
        return m(relativePath, r);
    }
    catch (err) {
        h(`Error resolving path: ${relativePath} — ${err.message}`);
        return relativePath;
    }
};
export const g = (t) => path.join(...t);
export const U = (t, i = true) => {
    fs.mkdirSync(t, { recursive: !0 });
    p(`Directory ensured: ${t}`, i);
};
export const v = (t, l, s, c, i = true) => {
    if (c) {
        const { parsedUrl: e, destinationFilePath: a } = t;
        const { origin: r } = new URL(e);
        const urlStr = typeof e === "string" ? e : e.toString();
        let relativeLocalPath = path.relative(s, a).split(path.sep).join("/");
        l = l.replaceAll(urlStr, relativeLocalPath);
        l = l.replaceAll(`${r}${urlStr}`, relativeLocalPath);
        fs.writeFileSync(path.join(s, "index.html"), beautify(l, { format: "html" }), "utf8");
        p(`Updated HTML with local asset path for ${urlStr} -> ${relativeLocalPath}`, i);
    }
};
export const A = (t) => t.split("?")[0].split("#")[0];
export const F = (t, e) => A(path.join(t, e));
export const x = (t) => t.split(".");
export const P = (t, e) => t[e] || t[e.toLowerCase()];
export const R = (headers, fallback) => {
    let filename = P(headers, "Content-Disposition")?.match(/filename="(.+?)"/)?.[1] || fallback;
    filename = filename?.split("?")[0].split("#")[0];
    filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const contentType = P(headers, "Content-Type");
    const hasExt = filename.includes(".");
    if (!hasExt && contentType) {
        const ext = mime.getExtension(contentType);
        if (ext) {
            filename = `${filename}.${ext}`;
        }
    }
    return filename;
};
export const D = (t) => {
    const { loaded: e, total: s } = t;
    const a = e && s ? Math.round((e / s) * 100) : 0;
    if (!isNaN(a))
        console.log(`Download progress: ${a}%`);
};
const extractAssets = async (t, e = {}) => {
    let { basePath: s = process.cwd(), source: a = "", protocol: r = "https", maxRetryAttempts: o = 3, retryDelay: n = 1000, verbose: i = true, saveFile: c = true, concurrency: y = 8, uploadToR2: k = false, returnDetails: q = false, jobId: z = "conv_local", r2Prefix: G, _assetTaskCache: H, _ensuredDirs: B } = e;
    a = a || "";
    r = r || "https";
    n = n || 1000;
    s = s || process.cwd();
    o = Math.max(1, o || 3);
    y = Math.max(1, Number.isFinite(y) ? Math.floor(y) : 8);
    let l = "";
    const uploadedAssets = [];
    const assetTaskCache = H instanceof Map ? H : new Map();
    const ensuredDirs = B instanceof Set ? B : new Set();
    const h = (message) => {
        if (i) {
            console.error(`[Error] ${message}`);
        }
    };
    const p = (message) => {
        if (i) {
            console.log(`[Success] ${message}`);
        }
    };
    const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
    const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isProtocolRelative = (value) => value.startsWith("//");
    const applyProtocol = (value) => (isProtocolRelative(value) ? `${r}:${value}` : value);
    const isRelativePath = (value) => !value.startsWith("http") && !isProtocolRelative(value);
    const stripQuotes = (value) => value.trim().replace(/^['"]|['"]$/g, "");
    const ensureDir = (dirPath) => {
        if (!dirPath || ensuredDirs.has(dirPath)) {
            return;
        }
        fs.mkdirSync(dirPath, { recursive: true });
        ensuredDirs.add(dirPath);
        p(`Directory ensured: ${dirPath}`);
    };
    const resolveAssetUrl = (relativePath) => {
        try {
            if (isRelativePath(relativePath)) {
                const cleanPath = stripQuotes(relativePath);
                if (!a) {
                    throw new Error("A source URL is required to resolve relative asset paths.");
                }
                return new URL(cleanPath, a).href;
            }
            return applyProtocol(relativePath);
        }
        catch (err) {
            h(`Error resolving path: ${relativePath} — ${err.message}`);
            return relativePath;
        }
    };
    const pickHeader = (headers, headerName) => headers[headerName] || headers[headerName.toLowerCase()];
    const getFileNameFromHeaders = (headers, fallback) => {
        let filename = pickHeader(headers, "Content-Disposition")?.match(/filename="(.+?)"/)?.[1] || fallback;
        filename = filename?.split("?")[0].split("#")[0];
        filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const contentType = pickHeader(headers, "Content-Type");
        if (!filename.includes(".") && contentType) {
            const ext = mime.getExtension(contentType);
            if (ext) {
                filename = `${filename}.${ext}`;
            }
        }
        return filename;
    };
    const fetchBuffer = async (url, fallbackName) => {
        const decodedUrl = decode(url);
        if (decodedUrl.startsWith("file://")) {
            const localPath = decodedUrl.replace("file://", "");
            p(`Reading local file: ${localPath}`);
            const data = fs.readFileSync(localPath);
            return { data, fileName: path.basename(localPath) };
        }
        p(`Starting download for: ${decodedUrl}`);
        return new Promise((resolve, reject) => {
            const client = decodedUrl.startsWith("https") ? https : http;
            client.get(decodedUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "*/*"
                }
            }, (res) => {
                const statusCode = res.statusCode || 0;
                const location = res.headers.location;
                if (statusCode >= 300 && statusCode < 400 && location) {
                    res.resume();
                    resolve(fetchBuffer(new URL(location, decodedUrl).href, fallbackName));
                    return;
                }
                if (statusCode >= 400) {
                    res.resume();
                    reject(new Error(`HTTP error! Status: ${statusCode}`));
                    return;
                }
                const chunks = [];
                res.on("data", (chunk) => {
                    chunks.push(chunk);
                });
                res.on("end", () => {
                    resolve({
                        data: Buffer.concat(chunks),
                        fileName: getFileNameFromHeaders(res.headers, fallbackName)
                    });
                });
                res.on("error", reject);
            }).on("error", reject);
        });
    };
    const fetchText = async (url) => {
        const decodedUrl = decode(url);
        p(`Fetching content: ${decodedUrl}`);
        return new Promise((resolve, reject) => {
            const client = decodedUrl.startsWith("https") ? https : http;
            client.get(decodedUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "*/*"
                }
            }, (res) => {
                const statusCode = res.statusCode || 0;
                const location = res.headers.location;
                if (statusCode >= 300 && statusCode < 400 && location) {
                    res.resume();
                    resolve(fetchText(new URL(location, decodedUrl).href));
                    return;
                }
                if (statusCode >= 400) {
                    res.resume();
                    reject(new Error(`HTTP error! Status: ${statusCode}`));
                    return;
                }
                const chunks = [];
                res.on("data", (chunk) => {
                    chunks.push(chunk);
                });
                res.on("end", () => {
                    resolve(Buffer.concat(chunks).toString("utf-8"));
                });
                res.on("error", reject);
            }).on("error", reject);
        });
    };
    const isValidUrl = (value) => {
        try {
            return !!new URL(applyProtocol(value));
        }
        catch {
            return false;
        }
    };
    const hasValidHttpProtocol = (value) => {
        const { protocol, hostname, href } = new URL(A(value));
        if (!protocol || !["http:", "https:"].includes(protocol)) {
            throw new Error("Invalid baseUrl. Only http and https are supported.");
        }
        if (!hostname) {
            throw new Error("Invalid baseUrl. Provide a valid URL with a hostname.");
        }
        return !!href;
    };
    const loadInputHtml = async () => {
        if (typeof t !== "string" || typeof s !== "string") {
            h("Invalid user input: source and basePath must be strings.");
            return;
        }
        if (isValidUrl(t)) {
            try {
                hasValidHttpProtocol(t);
                l = await fetchText(t);
                if (!a) {
                    a = t;
                }
            }
            catch (err) {
                h(err.message || err);
            }
            return;
        }
        l = t;
    };
    const saveResolvedAsset = async (asset) => {
        const absoluteAssetUrl = resolveAssetUrl(asset);
        if (assetTaskCache.has(absoluteAssetUrl)) {
            return assetTaskCache.get(absoluteAssetUrl);
        }
        const task = (async () => {
            try {
                const urlObj = new URL(absoluteAssetUrl);
                const urlPath = urlObj.pathname.replace(/^\//, "");
                const destinationPath = path.join(s, path.dirname(urlPath));
                const fileNameGuess = path.basename(urlPath).split("?")[0].split("#")[0] || "asset";
                ensureDir(destinationPath);
                for (let attempt = 0; attempt < o; attempt++) {
                    try {
                        const { data, fileName } = await fetchBuffer(absoluteAssetUrl, fileNameGuess);
                        const fullPath = path.join(destinationPath, fileName);
                        let uploadedFile = null;
                        if (k) {
                            const storageKey = path.posix.join(G || `generated/${z}/assets`, path.dirname(urlPath).split(path.sep).join("/"), fileName);
                            const uploadResult = await uploadBufferToR2({
                                storageKey,
                                body: data,
                                contentType: inferContentType(fileName)
                            });
                            uploadedFile = createFileRecord({
                                id: `asset_${uploadedAssets.length + 1}`,
                                name: fileName,
                                kind: "asset",
                                storageKey: uploadResult.storageKey,
                                size: uploadResult.size,
                                type: uploadResult.type,
                                url: uploadResult.url
                            });
                            uploadedAssets.push({ ...uploadedFile, buffer: data });
                            p(`Asset uploaded successfully to ${uploadResult.url}`);
                        }
                        else if (c) {
                            fs.writeFileSync(fullPath, data);
                            p(`Asset saved successfully to ${fullPath}`);
                        }
                        return {
                            parsedUrl: asset,
                            absoluteAssetUrl,
                            destinationPath,
                            destinationFilePath: fullPath,
                            fileName,
                            uploadedFile
                        };
                    }
                    catch (err) {
                        const isLastAttempt = attempt === o - 1;
                        if (isLastAttempt) {
                            const { message, code } = err || {};
                            if (["ECONNRESET", "ETIMEDOUT"].includes(code)) {
                                h(`Network error occurred while downloading asset from ${absoluteAssetUrl}: ${message}.`);
                            }
                            else if (["EACCES", "EISDIR"].includes(code)) {
                                h("Error saving asset. Permission denied or target path is a directory.");
                            }
                            else {
                                h(`Error downloading asset from ${absoluteAssetUrl}: ${message || err}.`);
                            }
                            return null;
                        }
                        await sleep(n);
                    }
                }
            }
            catch (err) {
                h(`Error downloading asset from ${absoluteAssetUrl}: ${err.message || err}.`);
            }
            return null;
        })();
        assetTaskCache.set(absoluteAssetUrl, task);
        return task;
    };
    await loadInputHtml();
    if (!l) {
        return l;
    }
    l = l.replace(/srcset="(.*?)"/gi, "").replace(/sizes="(.*?)"/gi, "");
    if (a) {
        l = l.replace(new RegExp(escapeRegExp(a), "g"), "");
    }
    const regex = /(<link[^>]+rel=["']stylesheet["'][^>]+href=["'])([^"']+\.[^"']+)["']|<(img|script|source)[^>]+src=["']([^"']+\.(?!json)[^"']+)["']/gi;
    const matches = [
        ...[...l.matchAll(regex)].map((match) => match[2] || match[4] || ""),
        ...[...l.matchAll(/url\(["']?(.*?)["']?\)/gi)]
            .map((match) => match[1])
            .filter((url) => !/^#/.test(url))
    ].filter((match) => !!match && !match.startsWith("data:"));
    const uniqueMatches = [...new Set(matches)];
    const queue = [...uniqueMatches];
    const workers = Array.from({ length: Math.min(y, queue.length || 1) }, async () => {
        while (queue.length > 0) {
            const asset = queue.shift();
            if (!asset) {
                return;
            }
            await saveResolvedAsset(asset);
        }
    });
    await Promise.all(workers);
    if (q) {
        return { html: l, assets: uploadedAssets };
    }
    return l;
};
export default extractAssets;
