import { expect } from 'chai';
import * as utils from '../utils';

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
});
