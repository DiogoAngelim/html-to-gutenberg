"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.characters = exports.pageOptions = exports.userAgent = exports.browserOptions = exports.images = exports.imports = void 0;
exports.imports = `
  const { registerBlockType } = wp.blocks;
  const { RichText, MediaUpload, InspectorControls } = wp.blockEditor;
  const { Panel, PanelBody, PanelRow, TextareaControl, ToggleControl, Button } = wp.components;
  const { Fragment } = wp.element;
`;
exports.images = [];
exports.browserOptions = [
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
];
exports.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36';
exports.pageOptions = {
    waitUntil: 'networkidle2',
};
exports.characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
//# sourceMappingURL=globals.js.map