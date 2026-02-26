"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const index_js_1 = __importDefault(require("./index.js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
describe('block screenshot integration', () => {
    const testHtml = '<html><body><h1>SnapAPI Test</h1></body></html>';
    const testOptions = {
        name: 'SnapAPITestBlock',
        prefix: 'wp',
        category: 'common',
        basePath: process.cwd(),
        shouldSaveFiles: true,
        generateIconPreview: true,
        jsFiles: [],
        cssFiles: [],
        source: 'https://example.com',
    };
    const previewPath = path_1.default.join(testOptions.basePath, 'snapapitestblock', 'preview.jpeg');
    after(function () {
        if (fs_1.default.existsSync(previewPath)) {
            fs_1.default.unlinkSync(previewPath);
            // Use fs.rmSync for recursive directory removal in Node >=14
            const dir = path_1.default.dirname(previewPath);
            if (fs_1.default.existsSync(dir)) {
                fs_1.default.rmSync(dir, { recursive: true, force: true });
            }
        }
    });
    it('should generate a preview.jpeg using SnapAPI', async function () {
        this.timeout(15000); // Allow time for API call
        await (0, index_js_1.default)(testHtml, testOptions);
        (0, chai_1.expect)(fs_1.default.existsSync(previewPath)).to.equal(true);
        const stats = fs_1.default.statSync(previewPath);
        (0, chai_1.expect)(stats.size).to.be.greaterThan(1000); // Should not be empty
    });
});
//# sourceMappingURL=snapapi-screenshot.test.js.map