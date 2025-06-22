export const imports = `
  const { registerBlockType } = wp.blocks;
  const { RichText, MediaUpload, InspectorControls } = wp.blockEditor;
  const { 
    Panel, 
    PanelBody, 
    PanelRow, 
    TextareaControl, 
    ToggleControl, 
    Button,
    TextControl, 
    Notice
   } = wp.components;

  const { createRoot, useEffect, useRef } = wp.element;

`;
export const panels = [];
export const images = [];
export const browserOptions = [
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
];
export const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36';
export const pageOptions = {
    waitUntil: 'networkidle2',
};
export const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';