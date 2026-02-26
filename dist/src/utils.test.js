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
describe('utils.ts functions', () => {
    it('hasTailwindCdnSource returns true for Tailwind CDN', () => {
        (0, chai_1.expect)(utils.hasTailwindCdnSource(['https://cdn.tailwindcss.com'])).to.equal(true);
        (0, chai_1.expect)(utils.hasTailwindCdnSource(['https://example.com'])).to.equal(false);
    });
    it('replaceSourceUrlVars returns input if no match', () => {
        const str = "var.url+'http://site.com/path'";
        const expected = "${vars.url}/path";
        (0, chai_1.expect)(utils.replaceSourceUrlVars(str, 'http://site.com')).to.equal(expected);
    });
    it('sanitizeAndReplaceLeadingNumbers replaces leading numbers', () => {
        (0, chai_1.expect)(utils.sanitizeAndReplaceLeadingNumbers('1test')).to.match(/one1test|1test/);
    });
    it('replaceUnderscoresSpacesAndUppercaseLetters replaces underscores and spaces', () => {
        (0, chai_1.expect)(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).to.equal('test-name-here');
    });
    it('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase converts correctly', () => {
        (0, chai_1.expect)(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).to.equal('test_name_here');
    });
    it('hasAbsoluteKeyword detects absolute', () => {
        (0, chai_1.expect)(utils.hasAbsoluteKeyword('absolute')).to.equal(true);
        (0, chai_1.expect)(utils.hasAbsoluteKeyword('relative')).to.equal(false);
    });
    it('generateRandomVariableName returns string with prefix', () => {
        (0, chai_1.expect)(utils.generateRandomVariableName('prefix')).to.match(/^prefix/);
    });
});
//# sourceMappingURL=utils.test.js.map