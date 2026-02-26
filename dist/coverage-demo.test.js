"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const coverage_demo_1 = require("./src/coverage-demo");
describe('add', () => {
    it('adds two numbers', () => {
        (0, chai_1.expect)((0, coverage_demo_1.add)(2, 3)).to.equal(5);
    });
});
//# sourceMappingURL=coverage-demo.test.js.map