"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const utils = __importStar(require("./utils"));
describe('utils.ts functions', () => {
    test('hasTailwindCdnSource returns true for Tailwind CDN', () => {
        expect(utils.hasTailwindCdnSource(['https://cdn.tailwindcss.com'])).toBe(true);
        expect(utils.hasTailwindCdnSource(['https://example.com'])).toBe(false);
    });
    test('replaceSourceUrlVars returns input if no match', () => {
        const str = "var.url+'http://site.com/path'";
        const expected = "${vars.url}/path";
        expect(utils.replaceSourceUrlVars(str, 'http://site.com')).toBe(expected);
    });
    test('sanitizeAndReplaceLeadingNumbers replaces leading numbers', () => {
        expect(utils.sanitizeAndReplaceLeadingNumbers('1test')).toMatch(/one1test|1test/);
    });
    test('replaceUnderscoresSpacesAndUppercaseLetters replaces underscores and spaces', () => {
        expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).toBe('test-name-here');
    });
    test('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase converts correctly', () => {
        expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).toBe('test_name_here');
    });
    test('hasAbsoluteKeyword detects absolute', () => {
        expect(utils.hasAbsoluteKeyword('absolute')).toBe(true);
        expect(utils.hasAbsoluteKeyword('relative')).toBe(false);
    });
    test('generateRandomVariableName returns string with prefix', () => {
        expect(utils.generateRandomVariableName('prefix')).toMatch(/^prefix/);
    });
    // Additional coverage tests
    describe('hasTailwindCdnSource edge cases', () => {
        test('returns false for empty array', () => {
            expect(utils.hasTailwindCdnSource([])).toBe(false);
        });
        test('returns true for multiple tailwind URLs', () => {
            expect(utils.hasTailwindCdnSource([
                'https://cdn.tailwindcss.com',
                'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.0.0'
            ])).toBe(true);
        });
        test('returns false for malformed URLs', () => {
            expect(utils.hasTailwindCdnSource(['not-a-url'])).toBe(false);
        });
    });
    describe('replaceSourceUrlVars edge cases', () => {
        test('replaces matching pattern', () => {
            const str = "var.url+'http://site.com/path'";
            const source = 'http://site.com';
            const expected = "${vars.url}/path";
            expect(utils.replaceSourceUrlVars(str, source)).toContain(expected);
        });
        test('returns input for empty string', () => {
            expect(utils.replaceSourceUrlVars('', 'http://site.com')).toBe('');
        });
        test('returns input for null source', () => {
            expect(utils.replaceSourceUrlVars("var.url+'http://site.com/path'", null)).toBe("var.url+'http://site.com/path'");
        });
        test('replaces multiple matches', () => {
            const str = "var.url+'http://site.com/a' and var.url+'http://site.com/b'";
            const source = 'http://site.com';
            const result = utils.replaceSourceUrlVars(str, source);
            expect(result.match(/\$\{vars\.url\}/g)?.length).toBeGreaterThanOrEqual(2);
        });
    });
    describe('sanitizeAndReplaceLeadingNumbers edge cases', () => {
        test('returns input for no numbers', () => {
            expect(utils.sanitizeAndReplaceLeadingNumbers('test')).toBe('test');
        });
        test('handles multiple leading numbers', () => {
            expect(utils.sanitizeAndReplaceLeadingNumbers('123abc')).toMatch(/one1two2three3abc|123abc/);
        });
        test('handles only numbers', () => {
            expect(utils.sanitizeAndReplaceLeadingNumbers('123')).toMatch(/one1two2three3|123/);
        });
        test('handles special characters', () => {
            expect(utils.sanitizeAndReplaceLeadingNumbers('1_test')).toMatch(/one1test|1test/);
        });
    });
    describe('replaceUnderscoresSpacesAndUppercaseLetters edge cases', () => {
        test('handles only underscores', () => {
            expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('___')).toBe('---');
        });
        test('handles only spaces', () => {
            expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('   ')).toBe('---');
        });
        test('handles mixed cases', () => {
            expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).toBe('test-name-here');
        });
        test('handles empty string', () => {
            expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('')).toBe('');
        });
    });
    describe('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase edge cases', () => {
        test('handles only dashes', () => {
            expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('---')).toBe('___');
        });
        test('handles only spaces', () => {
            expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('   ')).toBe('___');
        });
        test('handles mixed cases', () => {
            expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).toBe('test_name_here');
        });
        test('handles empty string', () => {
            expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('')).toBe('');
        });
    });
    describe('hasAbsoluteKeyword edge cases', () => {
        test('detects uppercase', () => {
            expect(utils.hasAbsoluteKeyword('ABSOLUTE')).toBe(true);
        });
        test('returns false for empty string', () => {
            expect(utils.hasAbsoluteKeyword('')).toBe(false);
        });
        test('returns false for empty string', () => {
            expect(utils.hasAbsoluteKeyword('')).toBe(false);
        });
    });
    describe('generateRandomVariableName edge cases', () => {
        test('returns prefix only for length 0', () => {
            expect(utils.generateRandomVariableName('prefix', 0)).toBe('prefix');
        });
        test('returns only random part for empty prefix', () => {
            expect(utils.generateRandomVariableName('', 3)).toMatch(/^[a-z]{3}$/);
        });
        test('returns correct length', () => {
            const result = utils.generateRandomVariableName('pre', 5);
            expect(result.length).toBe(8);
        });
    });
});
//# sourceMappingURL=index.test.js.map