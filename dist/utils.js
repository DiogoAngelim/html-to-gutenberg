"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasTailwindCdnSource = hasTailwindCdnSource;
exports.replaceSourceUrlVars = replaceSourceUrlVars;
exports.sanitizeAndReplaceLeadingNumbers = sanitizeAndReplaceLeadingNumbers;
exports.replaceUnderscoresSpacesAndUppercaseLetters = replaceUnderscoresSpacesAndUppercaseLetters;
exports.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase = convertDashesSpacesAndUppercaseToUnderscoresAndLowercase;
exports.hasAbsoluteKeyword = hasAbsoluteKeyword;
exports.generateRandomVariableName = generateRandomVariableName;
// Utility functions for html-to-gutenberg
function hasTailwindCdnSource(jsFiles) {
    const tailwindCdnRegex = /https:\/\/(cdn\.tailwindcss\.com(\?[^"'\s]*)?|cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4(\.\d+){0,2})/;
    return jsFiles.some((url) => tailwindCdnRegex.test(url));
}
function replaceSourceUrlVars(str, source) {
    if (!source)
        return str;
    const escapedSource = String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`var\\.url\\+'${escapedSource}([^']*)'`, 'g');
    if (!pattern.test(str))
        return str;
    return str.replace(pattern, (_match, path) => `\${vars.url}${path}`);
}
function sanitizeAndReplaceLeadingNumbers(str) {
    const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    let firstNumberReplaced = false;
    return str
        .toLowerCase()
        .replace(/[\s\-_]/g, '')
        .replace(/\d/g, (digit) => {
        if (!firstNumberReplaced) {
            firstNumberReplaced = true;
            return numberWords[parseInt(digit)] + digit;
        }
        return digit;
    })
        .replace(/^[^a-z]+/, '');
}
function replaceUnderscoresSpacesAndUppercaseLetters(name = '') {
    return name.replace(new RegExp(/\W|_/, 'g'), '-').toLowerCase();
}
function convertDashesSpacesAndUppercaseToUnderscoresAndLowercase(string) {
    if (string) {
        return `${string.replaceAll('-', '_').replaceAll(' ', '_').toLowerCase()}`;
    }
    return '';
}
function hasAbsoluteKeyword(str) {
    if (typeof str !== 'string')
        return false;
    return str.toLowerCase().includes('absolute');
}
function generateRandomVariableName(prefix = 'content', length = 3) {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let suffix = '';
    for (let i = 0; i < length; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}${suffix}`;
}
//# sourceMappingURL=utils.js.map