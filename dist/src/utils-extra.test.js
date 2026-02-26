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
const chai_1 = require("chai");
const utils = __importStar(require("../utils"));
describe('hasTailwindCdnSource edge cases', () => {
    it('returns false for empty array', () => {
        (0, chai_1.expect)(utils.hasTailwindCdnSource([])).to.equal(false);
    });
    it('returns true for multiple tailwind URLs', () => {
        (0, chai_1.expect)(utils.hasTailwindCdnSource([
            'https://cdn.tailwindcss.com',
            'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.0.0'
        ])).to.equal(true);
    });
    it('returns false for malformed URLs', () => {
        (0, chai_1.expect)(utils.hasTailwindCdnSource(['not-a-url'])).to.equal(false);
    });
});
describe('replaceSourceUrlVars edge cases', () => {
    it('replaces matching pattern', () => {
        const str = "var.url+'http://site.com/path'";
        const source = 'http://site.com';
        const expected = "${vars.url}/path";
        (0, chai_1.expect)(utils.replaceSourceUrlVars(str, source)).to.contain(expected);
    });
    it('returns input for empty string', () => {
        (0, chai_1.expect)(utils.replaceSourceUrlVars('', 'http://site.com')).to.equal('');
    });
    it('returns input for null source', () => {
        (0, chai_1.expect)(utils.replaceSourceUrlVars("var.url+'http://site.com/path'", null)).to.equal("var.url+'http://site.com/path'");
    });
    it('replaces multiple matches', () => {
        const str = "var.url+'http://site.com/a' and var.url+'http://site.com/b'";
        const source = 'http://site.com';
        const result = utils.replaceSourceUrlVars(str, source);
        (0, chai_1.expect)(result.match(/\${vars\.url}/g)?.length).to.be.greaterThanOrEqual(2);
    });
});
describe('sanitizeAndReplaceLeadingNumbers edge cases', () => {
    it('returns input for no numbers', () => {
        (0, chai_1.expect)(utils.sanitizeAndReplaceLeadingNumbers('test')).to.equal('test');
    });
    it('handles multiple leading numbers', () => {
        (0, chai_1.expect)(utils.sanitizeAndReplaceLeadingNumbers('123abc')).to.match(/one1two2three3abc|123abc/);
    });
    it('handles only numbers', () => {
        (0, chai_1.expect)(utils.sanitizeAndReplaceLeadingNumbers('123')).to.match(/one1two2three3|123/);
    });
    it('handles special characters', () => {
        (0, chai_1.expect)(utils.sanitizeAndReplaceLeadingNumbers('1_test')).to.match(/one1test|1test/);
    });
});
describe('replaceUnderscoresSpacesAndUppercaseLetters edge cases', () => {
    it('handles only underscores', () => {
        (0, chai_1.expect)(utils.replaceUnderscoresSpacesAndUppercaseLetters('___')).to.equal('---');
    });
    it('handles only spaces', () => {
        (0, chai_1.expect)(utils.replaceUnderscoresSpacesAndUppercaseLetters('   ')).to.equal('---');
    });
    it('handles mixed cases', () => {
        (0, chai_1.expect)(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).to.equal('test-name-here');
    });
    it('handles empty string', () => {
        (0, chai_1.expect)(utils.replaceUnderscoresSpacesAndUppercaseLetters('')).to.equal('');
    });
});
describe('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase edge cases', () => {
    it('handles only dashes', () => {
        (0, chai_1.expect)(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('---')).to.equal('___');
    });
    it('handles only spaces', () => {
        (0, chai_1.expect)(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('   ')).to.equal('___');
    });
    it('handles mixed cases', () => {
        (0, chai_1.expect)(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).to.equal('test_name_here');
    });
    it('handles empty string', () => {
        (0, chai_1.expect)(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('')).to.equal('');
    });
});
describe('hasAbsoluteKeyword edge cases', () => {
    it('detects uppercase', () => {
        (0, chai_1.expect)(utils.hasAbsoluteKeyword('ABSOLUTE')).to.equal(true);
    });
    it('returns false for empty string', () => {
        (0, chai_1.expect)(utils.hasAbsoluteKeyword('')).to.equal(false);
    });
    it('returns false for empty string', () => {
        (0, chai_1.expect)(utils.hasAbsoluteKeyword('')).to.equal(false);
    });
});
describe('generateRandomVariableName edge cases', () => {
    it('returns prefix only for length 0', () => {
        (0, chai_1.expect)(utils.generateRandomVariableName('prefix', 0)).to.equal('prefix');
    });
    it('returns only random part for empty prefix', () => {
        (0, chai_1.expect)(utils.generateRandomVariableName('', 3)).to.match(/^[a-z]{3}$/);
    });
    it('returns correct length', () => {
        const result = utils.generateRandomVariableName('pre', 5);
        (0, chai_1.expect)(result.length).to.equal(8);
    });
});
//# sourceMappingURL=utils-extra.test.js.map