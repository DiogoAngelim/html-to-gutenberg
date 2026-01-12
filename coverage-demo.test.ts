import { expect } from 'chai';
import { add } from './src/coverage-demo';

describe('add', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).to.equal(5);
  });
});
