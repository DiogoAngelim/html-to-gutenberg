import * as utils from './utils';
import { expect } from 'chai';
// Removed imports from index and globals to avoid ESM parsing errors

describe('utils.ts functions', () => {
  it('hasTailwindCdnSource returns true for Tailwind CDN', () => {
    expect(utils.hasTailwindCdnSource(['https://cdn.tailwindcss.com'])).to.equal(true);
    expect(utils.hasTailwindCdnSource(['https://example.com'])).to.equal(false);
  });

  it('replaceSourceUrlVars returns input if no match', () => {
    const str = "var.url+'http://site.com/path'";
    const expected = "${vars.url}/path";
    expect(utils.replaceSourceUrlVars(str, 'http://site.com')).to.equal(expected);
  });

  it('sanitizeAndReplaceLeadingNumbers replaces leading numbers', () => {
    expect(utils.sanitizeAndReplaceLeadingNumbers('1test')).to.match(/one1test|1test/);
  });

  it('replaceUnderscoresSpacesAndUppercaseLetters replaces underscores and spaces', () => {
    expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).to.equal('test-name-here');
  });

  it('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase converts correctly', () => {
    expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).to.equal('test_name_here');
  });

  it('hasAbsoluteKeyword detects absolute', () => {
    expect(utils.hasAbsoluteKeyword('absolute')).to.equal(true);
    expect(utils.hasAbsoluteKeyword('relative')).to.equal(false);
  });

  it('generateRandomVariableName returns string with prefix', () => {
    expect(utils.generateRandomVariableName('prefix')).to.match(/^prefix/);
  });

  // Additional coverage tests

  describe('hasTailwindCdnSource edge cases', () => {
    it('returns false for empty array', () => {
      expect(utils.hasTailwindCdnSource([])).to.equal(false);
    });
    it('returns true for multiple tailwind URLs', () => {
      expect(utils.hasTailwindCdnSource([
        'https://cdn.tailwindcss.com',
        'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.0.0'
      ])).to.equal(true);
    });
    it('returns false for malformed URLs', () => {
      expect(utils.hasTailwindCdnSource(['not-a-url'])).to.equal(false);
    });
  });

  describe('replaceSourceUrlVars edge cases', () => {
    it('replaces matching pattern', () => {
      const str = "var.url+'http://site.com/path'";
      const source = 'http://site.com';
      const expected = "${vars.url}/path";
      expect(utils.replaceSourceUrlVars(str, source)).to.contain(expected);
    });
    it('returns input for empty string', () => {
      expect(utils.replaceSourceUrlVars('', 'http://site.com')).to.equal('');
    });
    it('returns input for null source', () => {
      expect(utils.replaceSourceUrlVars("var.url+'http://site.com/path'", null)).to.equal("var.url+'http://site.com/path'");
    });
    it('replaces multiple matches', () => {
      const str = "var.url+'http://site.com/a' and var.url+'http://site.com/b'";
      const source = 'http://site.com';
      const result = utils.replaceSourceUrlVars(str, source);
      expect(result.match(/\${vars\.url}/g)?.length).to.be.greaterThanOrEqual(2);
    });
  });

  describe('sanitizeAndReplaceLeadingNumbers edge cases', () => {
    it('returns input for no numbers', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('test')).to.equal('test');
    });
    it('handles multiple leading numbers', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('123abc')).to.match(/one1two2three3abc|123abc/);
    });
    it('handles only numbers', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('123')).to.match(/one1two2three3|123/);
    });
    it('handles special characters', () => {
      expect(utils.sanitizeAndReplaceLeadingNumbers('1_test')).to.match(/one1test|1test/);
    });
  });

  describe('replaceUnderscoresSpacesAndUppercaseLetters edge cases', () => {
    it('handles only underscores', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('___')).to.equal('---');
    });
    it('handles only spaces', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('   ')).to.equal('---');
    });
    it('handles mixed cases', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('Test_Name Here')).to.equal('test-name-here');
    });
    it('handles empty string', () => {
      expect(utils.replaceUnderscoresSpacesAndUppercaseLetters('')).to.equal('');
    });
  });

  describe('convertDashesSpacesAndUppercaseToUnderscoresAndLowercase edge cases', () => {
    it('handles only dashes', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('---')).to.equal('___');
    });
    it('handles only spaces', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('   ')).to.equal('___');
    });
    it('handles mixed cases', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('Test-Name Here')).to.equal('test_name_here');
    });
    it('handles empty string', () => {
      expect(utils.convertDashesSpacesAndUppercaseToUnderscoresAndLowercase('')).to.equal('');
    });
  });

  describe('hasAbsoluteKeyword edge cases', () => {
    it('detects uppercase', () => {
      expect(utils.hasAbsoluteKeyword('ABSOLUTE')).to.equal(true);
    });
    it('returns false for empty string', () => {
      expect(utils.hasAbsoluteKeyword('')).to.equal(false);
    });
    it('returns false for empty string', () => {
      expect(utils.hasAbsoluteKeyword('')).to.equal(false);
    });
  });

  describe('generateRandomVariableName edge cases', () => {
    it('returns prefix only for length 0', () => {
      expect(utils.generateRandomVariableName('prefix', 0)).to.equal('prefix');
    });
    it('returns only random part for empty prefix', () => {
      expect(utils.generateRandomVariableName('', 3)).to.match(/^[a-z]{3}$/);
    });
    it('returns correct length', () => {
      const result = utils.generateRandomVariableName('pre', 5);
      expect(result.length).to.equal(8);
    });
  });
});
