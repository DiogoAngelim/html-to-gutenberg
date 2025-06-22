import axios from 'axios';
import * as cheerio from 'cheerio';
import convert from 'node-html-to-jsx';
import fs from 'fs';
import path from 'path';
import * as babel from '@babel/core';
import presetReact from '@babel/preset-react';
import { transform } from '@svgr/core';
import extractAssets from 'fetch-page-assets/index.js';
import icon from 'html-screenshots';
import imageToBase64 from 'image-to-base64';

import {
  imports,
  panels,
  images,
  characters
} from './globals.js';

interface Attributes {
  [key: string]: {
    attribute?: string,
    selector?: string,
    default?: string,
    type?: string
  }
}

interface Panel {
  type?: string,
  title?: string,
  attributes?: any,
};

interface Image {
  randomUrlVariable: string,
  randomAltVariable: string,
  imgClass: string,
}

interface ImageProperties {
  imgTag: any,
  imgSrc: string,
  imgAlt: string,
  imgClass: string,
  isBackground: boolean,
  type?: string,
  attribute?: string,
  prefix?: string,
}
interface BlockOptions {
  name: string,
  prefix: string,
  category: string,
  basePath: string,
  htmlContent?: string,
  cssFiles?: string[],
  jsFiles?: string[],
  generateIconPreview?: boolean,
  shouldSaveFiles?: boolean,
}

let js = '';
let css = '';
const block = async (
  htmlContent,
  options = {
    name: 'My block',
    prefix: 'wp',
    category: 'common',
    basePath: process.cwd(),
    shouldSaveFiles: true,
  }
) => {
  const styles = [];
  const scripts = [];
  const attributes = {};

  function parseStyleString(style) {
    const entries = style.split(';').filter(Boolean).map(rule => {
      const [key, value] = rule.split(':');
      if (!key || !value) return null;

      const camelKey = key.trim().replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      return [camelKey, value.trim()];
    }).filter(Boolean);

    const styleObject = Object.fromEntries(entries);

    return JSON.stringify(styleObject).replace(/"([^"]+)":/g, '$1:'); // Strip object keys' quotes
  }

  function sanitizeAndReplaceNumbers(str) {
    const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    let firstNumberReplaced = false;

    return str
      .toLowerCase()
      .replace(/[\s\-_]/g, '')
      .replace(/\d/g, (digit) => {
        if (!firstNumberReplaced) {
          firstNumberReplaced = true;
          return numberWords[parseInt(digit)] + digit;
        }
        return digit; // keep the rest as-is or you can modify as needed
      })
      .replace(/^[^a-z]+/, '');
  }

  const convertName = (name) => {
    return (name || '').replace(new RegExp(/\W|_/, 'g'), '-').toLowerCase();
  };
  const saveFile = (fileName, contents, options) => {
    try {
      const filePath = path.join(options.basePath, fileName);
      fs.writeFileSync(filePath, contents);
      return contents;
    } catch (error) {
      logError(error);
    }
  };
  const parseRequirements = async (files) => {
    let output = '';
    for (const file of files) {
      try {
        const { data } = await axios.get(file, { responseType: 'text' });
        output += data;
      } catch (error) {
        logError(error);
      }
    }
    return output;
  };
  const convertToUnderscores = (string) => {
    if (string) {
      return `${string.replaceAll('-', '_').replaceAll(' ', '_').toLowerCase()}${generateRandomVariableName(
        'func',
        3
      )}`;
    }

    return '';
  };

  const getPhp = (options) => {
    const { name, prefix, jsFiles, cssFiles } = options;
    const newName = convertName(name);
    const phpName = convertToUnderscores(name);
    const phpPrefix = convertToUnderscores(prefix);

    const inlineRemoteLoader = `
      var remoteUrls = ${JSON.stringify(jsFiles)};

      (function loadScripts() {
        window._loadedRemoteScripts = window._loadedRemoteScripts || new Set();

        remoteUrls.forEach((url) => {
          if (window._loadedRemoteScripts.has(url)) return;

          const script = document.createElement('script');
          script.src = url;
          script.async = true;
          document.head.appendChild(script);

          window._loadedRemoteScripts.add(url);
        });
      })();
    `;


    const enqueueRemoteStyles = cssFiles
      .map((remoteUrl) => {
        return `
      wp_enqueue_style(
        '${prefix}-${newName}-${remoteUrl
            .split('/')
            .pop()
            .replace(/\.\w+$/, '')}',
        '${remoteUrl}',
        array(),
        null // Set to null if you don't have a version
      );
    `;
      })
      .join('\n');

    return `<?php
  /*
    * Plugin Name:       ${name}
    * Version:           1.0
    * Author:            Html to Gutenberg
    * Author URI:        https://www.html-to-gutenberg.io/
    * Description:       A custom editable block built with Html to Gutenberg

  */

  if ( ! defined( 'ABSPATH' ) ) {
    exit;
  }

  function ${phpPrefix}_${phpName}_add_custom_editor_styles() {
    echo '<style>
      .block-editor-block-types-list__list-item {
          width: 100% !important;
      }

      .block-editor-block-list__layout.is-root-container > :where(:not(.alignleft):not(.alignright):not(.alignfull)) {
          max-width: 100%;
          margin: 0;
      }

      [aria-label="Empty block; start writing or type forward slash to choose a block"] {
          max-width: 1200px !important;
      }

      span.block-editor-block-types-list__item-icon img {
          max-width: 100%;
          width: 100%;
          margin: 0;
          display: block;
      }

      span.block-editor-block-icon.has-colors {
          width: 100%;
          all: inherit;
      }

      span.block-editor-block-icon.has-colors svg {
          margin-left: auto;
          margin-right: auto;
      }

      span.block-editor-block-icon.has-colors {
          order: 2;
          flex: 0 0 100%;
          width: 100%;
      }

       .block-editor-block-card {
          display: flex !important;
          flex-wrap: wrap;
      }

      .block-editor-inserter__preview-content-missing {
          display: none !important;
      }

      span.block-editor-block-icon.block-editor-block-switcher__toggle.has-colors img {
          display: none;
      }
          

    </style>';
  }

  add_action('admin_footer', function () {
    $screen = get_current_screen();
    
    if ($screen && method_exists($screen, 'is_block_editor') && $screen->is_block_editor()) {
        $href = esc_url(plugins_url('editor.css', __FILE__));
        echo "<link rel='stylesheet' id='${prefix}-${newName}-style' href='$href' type='text/css' media='all' />";
    }
});

  add_action( 'enqueue_block_editor_assets', '${phpPrefix}_${phpName}_editor_assets' );

  add_action('wp_enqueue_scripts', function() {
      wp_dequeue_style('wp-fonts-local');
      wp_deregister_style('wp-fonts-local');
      wp_dequeue_style('global-styles');
      wp_deregister_style('global-styles');
      remove_action('wp_footer', 'wp_global_styles_render_svg_filters');
  }, 100);


  function ${phpPrefix}_${phpName}_editor_assets() {
    $filepath = plugin_dir_path(__FILE__) . 'block.js';
    $version = file_exists($filepath) ? filemtime($filepath) : time();

    wp_enqueue_script(
      '${prefix}-${newName}',
      plugins_url( 'block.js', __FILE__ ),
      array( 'wp-blocks', 'wp-components', 'wp-element' ,'wp-editor'),
      $version
    );

    wp_localize_script( '${prefix}-${newName}', 'vars', array( 'url' => plugin_dir_url( __FILE__ ) ) );

    wp_enqueue_script(
        '${prefix}-${newName}-remote-loader',
        plugins_url('remote-loader.js', __FILE__),
        array(),
        null,
        true
    );

    wp_add_inline_script(
      '${prefix}-${newName}-remote-loader',
      ${JSON.stringify(inlineRemoteLoader)}
    );

    ${enqueueRemoteStyles}

    ${phpPrefix}_${phpName}_add_custom_editor_styles();

      wp_dequeue_style('${prefix}-${newName}-frontend');
      wp_deregister_style('${prefix}-${newName}-frontend');
  }

  add_action('enqueue_block_editor_assets', function () {
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('wp-block-library-theme');
    wp_dequeue_style('wc-block-style');
    wp_dequeue_style('wp-format-library');
}, 100);

  add_action( 'enqueue_block_assets', '${phpPrefix}_${phpName}_block_assets' );

  if (!is_admin()) {
    wp_register_style(
        '${prefix}-${newName}-frontend',
        plugins_url('style.css', __FILE__)
    );
  }

  function ${phpPrefix}_${phpName}_block_assets() {
    
    if ( ! is_admin() ) {
      wp_enqueue_style('${prefix}-${newName}-frontend');
    }

    wp_enqueue_script(
        '${prefix}-${newName}-remote-loader',
        plugins_url('remote-loader.js', __FILE__),
        array(),
        null,
        true
    );

    
    wp_add_inline_script(
      '${prefix}-${newName}-remote-loader',
      ${JSON.stringify(inlineRemoteLoader)}
    );
  }
  `;
  };

  function scopeCss(css, blockClass) {
    const GLOBAL_SELECTORS = ['html', 'body', ':root', ':host', '::backdrop'];
    const lines = css.split('\n');

    let result = '';
    const nestingStack = [];
    let selectorBuffer = [];
    let insidePropertyBlock = false;
    let insideRule = false;
    let currentIsScoped = false;

    function scopeSelector(sel) {
      sel = sel.trim();

      const whereMatch = sel.match(/^([^ :]+)(:where\(.*\))$/);
      if (whereMatch) {
        const base = whereMatch[1];
        const pseudo = whereMatch[2];
        const scopedBase = scopeSelector(base);
        return `${scopedBase}${pseudo}`;
      }

      if (sel.startsWith(':where(') && sel.endsWith(')')) {
        const inner = sel.slice(7, -1);
        const scopedInner = inner
          .split(',')
          .map(scopeSelector)
          .join(', ');
        return `:where(${scopedInner})`;
      }

      const isGlobal = GLOBAL_SELECTORS.some(g => sel.startsWith(g));
      const isAlreadyScoped = sel.startsWith(blockClass) || sel.includes(` ${blockClass}`);

      if (!isGlobal && !isAlreadyScoped && sel.length > 0) {
        return `${blockClass} ${sel}`;
      }
      return sel;
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.startsWith('@property')) {
        insidePropertyBlock = true;
        nestingStack.push('@property');
        result += `${rawLine}\n`;
        continue;
      }

      if (insidePropertyBlock) {
        result += `${rawLine}\n`;
        if (line === '}') {
          nestingStack.pop();
          insidePropertyBlock = false;
        }
        continue;
      }

      if (line.startsWith('@') && line.endsWith('{')) {
        nestingStack.push('@block');
        result += `${rawLine}\n`;
        continue;
      }

      if (line === '}') {
        if (nestingStack.length) nestingStack.pop();
        result += `${rawLine}\n`;
        insideRule = false;
        currentIsScoped = false;
        continue;
      }

      if (!insideRule && !line.startsWith('@')) {
        selectorBuffer.push(rawLine);

        if (line.endsWith('{')) {
          insideRule = true;

          const fullSelectorLine = selectorBuffer.join('\n');
          const selectorPart = fullSelectorLine.split('{')[0];
          const selectors = selectorPart.split(',').map(s => s.trim());

          const scopedSelectors = selectors.map(scopeSelector);
          currentIsScoped = selectors.some(sel => scopeSelector(sel) !== sel);

          result += `${scopedSelectors.join(',\n')} {\n`;
          selectorBuffer = [];
        }

        continue;
      }

      if (insideRule && line.includes(':')) {
        const declarationMatch = line.match(/^([a-zA-Z0-9\-\_]+)\s*:\s*(.+?)(;?)$/);
        if (declarationMatch) {
          let [_, prop, value, semi] = declarationMatch;
          result += `  ${prop}: ${value}${semi}\n`;
          continue;
        }
      }

      result += `${rawLine}\n`;
    }

    return result;
  }

  const saveFiles = async (options) => {
    const { cssFiles = [], shouldSaveFiles, name, prefix } = options;
    css = await parseRequirements(cssFiles);

    for (const style of styles) {
      css = style.type === 'inline' ? `
      *:not(.components-button) { 
        all: revert-layer; 
      }
        
      ${style.content}` : `${style.content}`;
    }

    const scopedCssFrontend = scopeCss(css, `.wp-block-${sanitizeAndReplaceNumbers(convertName(prefix))}-${sanitizeAndReplaceNumbers(convertName(name))}`);
    const editorStyleFile = scopeCss(css, `[data-type="${sanitizeAndReplaceNumbers(convertName(prefix))}/${sanitizeAndReplaceNumbers(convertName(name))}"]`);
    const scriptFile = js;
    const indexFile = getPhp(options);
    const blockCode = await getBlock(htmlContent, options);

    const blockFile = babel.transformSync(blockCode, {
      presets: [[presetReact, { pragma: 'wp.element.createElement' }]],
      filename: 'block.js',
    });

    if (shouldSaveFiles) {
      saveFile('style.css', scopedCssFrontend, options);
      saveFile('editor.css', editorStyleFile, options);
      saveFile('scripts.js', scriptFile, options);
      saveFile('index.php', indexFile, options);
      saveFile('block.js', blockFile.code, options);
      saveFile('remote-loader.js', '// This file intentionally left blank.', options);
    }

    return {
      'style.css': scopedCssFrontend,
      'editor.css': editorStyleFile,
      'scripts.js': scriptFile,
      'index.php': indexFile,
      'block.js': blockFile.code,
    }

  };

  const logError = (error) => {
    console.error(`[Error] ${error.message}`);
  };

  const generateRandomVariableName = (prefix = 'content', length = 3) => {
    let suffix = '';
    for (let i = 0; i < length; i++) {
      suffix += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return `${prefix}${suffix}`;
  };
  const setAttributeContent = (randomVariableName, content) => {
    attributes[randomVariableName] = {
      type: 'string', default: content.replace(/(?:<[^>]*>|[^<"]*")|"/g, (match) => {
        if (match === '"') {
          return '&quot;';
        }
        return match;
      })
    };
  };

  const hasAbsoluteKeyword = (str) => {
    return !!(str && str.toLowerCase().includes('absolute'));
  };

  const getImageTemplate = (image) => {
    const { randomUrlVariable, randomAltVariable, imgClass } = image;
    return `
    <MediaUpload
      onSelect={(media) => {
        setAttributes({
          ${randomUrlVariable}: media.url,
          ${randomAltVariable}: media.alt
        });
      }}
      type="image"
      render={({ open }) => (
        <div style={{ position: 'relative' }}>
          <img
            src={attributes.${randomUrlVariable}}
            alt={attributes.${randomAltVariable}}
            className="${imgClass}"
          />
          <div
            onClick={open}
            style={{
              position: 'absolute',
              bottom: '0',
              width: '100%',
              height: '100%',
              zIndex: 10,
            }}
          ></div>
        </div>
      )}
    />
  `;
  };


  const replaceHtmlImage = (html, image) => {
    const { randomUrlVariable } = image;
    const regex = new RegExp(`<img\\s+[^>]*src=\\{[^}]*${randomUrlVariable}[^}]*\\}[^>]*>`, 'gi');
    return html.replace(regex, getImageTemplate(image));
  };
  const replaceImageComponents = (html) => {
    images.forEach((image) => {
      html = replaceHtmlImage(html, image);
    });

    return html;
  };
  const loadHtml = async (options) => {
    const { basePath, htmlContent } = options;
    if (htmlContent) {
      const newHtml = await extractAssets(htmlContent, {
        basePath,
        verbose: false,
        saveFile: false,
      });
      return cheerio.load(newHtml, {
        xmlMode: true,
        decodeEntities: false,
      });
    }
  };
  const getImageSource = (imgTag) => {
    return imgTag.attr('src') || '';
  };
  const getImageAlt = (imgTag) => {
    return imgTag.attr('alt') || '';
  };
  const getParentElement = (imgTag) => {
    return imgTag.parent();
  };
  const getImageStyle = (imgTag) => {
    return imgTag.attr('style') || '';
  };
  const getImageClass = (imgTag) => {
    return imgTag.attr('class') || imgTag.attr('className') || '';
  };
  const getPreviousStyle = (parentElement) => {
    return parentElement.attr('style') || '';
  };
  const getParentClass = (parentElement) => {
    return parentElement.attr('class') || parentElement.attr('className') || '';
  };
  const isBackgroundImage = (
    imgStyle,
    imgClass,
    previousStyle,
    previousClass
  ) => {
    return (
      hasAbsoluteKeyword(imgStyle) ||
      hasAbsoluteKeyword(imgClass) ||
      hasAbsoluteKeyword(previousStyle) ||
      hasAbsoluteKeyword(previousClass)
    );
  };
  const getImageProperties = (imgTag) => {
    const parentElement = getParentElement(imgTag);
    const imgStyle = getImageStyle(imgTag);
    const imgClass = getImageClass(imgTag);
    const previousStyle = getPreviousStyle(parentElement);
    const previousClass = getParentClass(parentElement);
    const isBackground = isBackgroundImage(
      imgStyle,
      imgClass,
      previousStyle,
      previousClass
    );
    return {
      imgTag,
      imgClass,
      isBackground,
      imgSrc: getImageSource(imgTag),
      imgAlt: getImageAlt(imgTag),
    };
  };
  const setImageAttribute = (properties) => {
    const { imgTag, imgSrc, imgAlt, attribute, type, prefix } = properties;
    const newPrefix = prefix ? convertName(prefix) : 'wp';
    const randomVariable = generateRandomVariableName(`${type}${newPrefix}`);
    attributes[randomVariable] = {
      attribute,
      type: 'string',
      selector: 'img',
      default: attribute === 'alt' ? imgAlt : `var.url+'${imgSrc}'`,
    };
    imgTag.attr(attribute, `{attributes.${randomVariable}}`);
    return randomVariable;
  };
  const processImage = (properties) => {
    const { imgClass, type } = properties;
    const randomUrlVariable = setImageAttribute({
      ...properties,
      attribute: 'src',
      prefix: 'Url',
    });
    const randomAltVariable = setImageAttribute({
      ...properties,
      attribute: 'alt',
      prefix: 'Alt',
    });
    if (type !== 'background') {
      images.push({ randomUrlVariable, randomAltVariable, imgClass });
      return;
    }
    createPanel({
      type: 'media',
      title: 'Background Image',
      attributes: [randomUrlVariable, randomAltVariable],
    });
  };
  const getFixedHtml = (html) => {
    return html
      .replace(/ onChange="{" \(newtext\)=""\>/gi, ' onChange={ (newtext) => ')
      .replace(/\<\/RichText\>/gi, '')
      .replace(/value="{(.*?)}"/gi, 'value={$1}')
      .replace(/"{attributes.(.*?)}"/gi, '{attributes.$1}');
  };
  const processImages = (imgTag) => {
    const properties = getImageProperties(imgTag);
    const { isBackground } = properties;
    if (!isBackground) {
      processImage({ ...properties, type: 'image' });
      return;
    }
    processImage({ ...properties, type: 'background' });
  };
  const loopImages = ($) => {
    $('img').each((_index, img) => {
      processImages($(img));
    });
  };
  const getHtml = ($) => {
    return $.html({ xml: false, decodeEntities: false });
  };
  const processEditImages = async (options) => {
    const $ = await loadHtml(options);
    loopImages($);
    return replaceImageComponents(getFixedHtml(getHtml($)));
  };
  const getRichTextTemplate = (randomVariable, variableContent) => {
    return `
    ><RichText 
      tagName="span"
      value={attributes.${randomVariable}} 
      default="${variableContent.trim().replace(/"/g, '&quot;')}"
      onChange={ (newtext) => {
        setAttributes({ ${randomVariable}: newtext });
      }}
    /><`;
  };
  const convertToRichText = (variableContent) => {
    const randomVariable = generateRandomVariableName('content');
    setAttributeContent(randomVariable, variableContent);
    return getRichTextTemplate(randomVariable, variableContent);
  };
  const parseContent = (content) => {
    return content.replace(/>([^<]+)</g, (match, variableContent) => {
      if (match.replace(/\s\S/g, '').replace(/(<|>)/g, '').trim() === '') {
        return match;
      }
      return convertToRichText(variableContent);
    });
  };
  const editJsxContent = async (options) => {
    let content;
    if (options.htmlContent) {
      content = options.htmlContent.replaceAll(/<!--(.*?)-->/gs, '');
    }
    content = `<div className="custom-block">${content}</div>`;
    return await processEditImages({
      ...options,
      htmlContent: convert(parseContent(content)),
    });
  };
  const createPanel = (values) => {
    if (values.attributes && values.attributes.length > 0) {
      panels.push(values);
    }
  };
  const getSvgTemplate = (_match, group1, group3, randomSVGVariable) => {
    return `
      <svg
        ${group1}
        dangerouslySetInnerHTML={ { __html: attributes.${randomSVGVariable} }}
        >
      ${group3}
      `;
  };
  const replaceSVGImages = async (html) => {
    const regex = /<\s*svg\b((?:[^>'"]|"[^"]*"|'[^']*')*)>(\s*(?:[^<]|<(?!\/svg\s*>))*)(<\/\s*svg\s*>)/gim;

    let result = '';
    let lastIndex = 0;
    const matches = [...html.matchAll(regex)];

    for (const match of matches) {
      const [fullMatch, group1, group2, group3] = match;
      const start = match.index;
      const end = start + fullMatch.length;

      result += html.slice(lastIndex, start);

      const content = group2.trim();
      if (content) {
        const randomSVGVariable = generateRandomVariableName('svg');
        setAttributeContent(randomSVGVariable, content);
        createPanel({
          type: 'svg',
          title: 'SVG Markup',
          attributes: [randomSVGVariable],
        });

        const replacement = await transform(
          getSvgTemplate(fullMatch, group1, group3, randomSVGVariable),
          { jsxRuntime: 'classic' }
        );

        result += replacement;
      } else {
        result += fullMatch;
      }

      lastIndex = end;
    }

    result += html.slice(lastIndex);
    return result;
  };
  const getSvgPanelTemplate = (panel) => {
    return panel.attributes && attributes[panel.attributes]
      ? `
    { (            
    <PanelBody title="${panel.title}">
      <PanelRow>
        <div>
          <TextareaControl
            label="SVG Content"
            help="Enter your SVG content..."
            value={ attributes.${panel.attributes} }
            onChange={ ( value ) => {
              setAttributes({ ${panel.attributes}: value });
            } }
          />
        </div>
      </PanelRow>
    </PanelBody>
    )}
  `
      : '';
  };

  const getMediaPanelTemplate = (panel) => {
    const mediaAtts =
      panel.attributes?.[0] && panel.attributes[1]
        ? `${panel.attributes[0]}: media.url,
                   ${panel.attributes[1]}: media.alt`
        : '';
    return panel.attributes &&
      panel.attributes[0] &&
      attributes[panel.attributes[0]]
      ? `              
      <PanelBody title="${panel.title}">
        <PanelRow>
          <div>
            <MediaUpload
              onSelect={ (media) => { 
                setAttributes({ 
                  ${mediaAtts}
                }); 
              } }
              type="image"
              value={ attributes.${panel.attributes?.[0]} }
              render={({ open }) => (
                  <Button variant="secondary" style={{ marginBottom: "20px" }} onClick={ open }>Select Image</Button>
              )}
            />
            {attributes.${panel.attributes?.[0]} && (
                <img src={attributes.${panel.attributes?.[0]}} alt={attributes.${panel.attributes?.[1]}} />
            )}
          </div>
        </PanelRow>
      </PanelBody>
      `
      : '';
  };

  const getPanelTemplate = (panel) => {
    switch (panel.type) {
      case 'svg':
        return getSvgPanelTemplate(panel);
      case 'media':
        return getMediaPanelTemplate(panel);
      default:
        return '';
    }
  };

  const getPanelsTemplate = () => {
    return panels
      .map((panel) => {
        return getPanelTemplate(panel);
      })
      .join('\n');
  };

  const createPanels = () => {
    return `
    <Panel>
      ${getPanelsTemplate()}
    </Panel>`;
  };

  const getSaveContent = (editContent) => {
    return editContent.replace(
      /<RichText((.|\n)*?)value=\{(.*?)\}((.|\n)*?)\/>/gi,
      '<RichText.Content value={$3} />'
    );
  };

  const saveHtmlContent = (editContent) => {
    return getSaveContent(editContent).replace(/className=/gi, 'class=');
  };

  const removeHref = (match) => {
    return match.replace(/href="(.*?)"/, '');
  };
  const replaceRichText = (match, group1, _group2, group3) => {
    return removeHref(match)
      .replace(group1, '<span')
      .replace(group3, '</span>');
  };
  const processLinks = (options) => {
    let htmlContent = options.htmlContent
      ? options.htmlContent.replace(
        /(<a)[^>]*>([\s\S]*?)(<\/a>)/gim,
        replaceRichText
      )
      : undefined;

    htmlContent = unwrapAnchor(htmlContent);

    return {
      ...options,
      htmlContent,
    };
  };

  const unwrapAnchor = (htmlContent) => {
    return htmlContent.replace(
      /<span([^>]*)>\s*<a([^>]*)>(.*?)<\/a>\s*<\/span>/gi,
      (_, spanAttrs, anchorAttrs, content) => {
        const allAttrs = {};
        const attrRegex = /(\S+)=["'](.*?)["']/g;

        let match;
        while ((match = attrRegex.exec(spanAttrs)) !== null) {
          allAttrs[match[1]] = match[2];
        }

        while ((match = attrRegex.exec(anchorAttrs)) !== null) {
          allAttrs[match[1]] = match[2];
        }

        return `<a ${Object.entries(allAttrs)
          .map(([key, value]) => `${key}="${value}"`)
          .join(' ')}>${content}</a>`;
      }
    );
  };

  const transformOnClickEvent = (img) => {
    return img.replace(/onClick={[^}]+}\s*/, '');
  };

  const processSaveImages = (htmlString) => {
    return htmlString.replace(
      /<MediaUpload\b[^>]*>([\s\S]*?(<img\b[^>]*>*\/>)[\s\S]*?)\/>/g,
      (_match, _attributes, img) => transformOnClickEvent(img)
    );
  };

  const getComponentAttributes = () => {
    return JSON.stringify(attributes, null, 2);
  };

  const getEdit = async (options) => {
    let { htmlContent } = options;

    if (htmlContent) {
      htmlContent = await editJsxContent(processLinks(options));
      return (await replaceSVGImages(htmlContent.replaceAll('../', '').replace(/style="([^"]+)"/g, (_, styleString) => {
        const styleObj = parseStyleString(styleString);
        return `style={${styleObj}}`;
      })));
    }
    return '';
  };
  const getSave = (edit) => {
    return processSaveImages(saveHtmlContent(edit));
  };
  const getBlock = async (htmlContent, settings) => {
    let {
      prefix,
      name,
      category,
      generateIconPreview,
      basePath,
      cssFiles,
      jsFiles,
    } = settings;
    const newName = convertName(name);
    const newPrefix = convertName(prefix);
    cssFiles = cssFiles || [];
    jsFiles = jsFiles || [];
    let iconPreview = "'shield'";
    let edit = await getEdit(settings);
    edit = edit.replace(
      /dangerouslySetInnerHTML="{" {="" __html:="" (.*?)="" }}=""/gm,
      `dangerouslySetInnerHTML={{ __html: $1 }}`
    );
    const save = getSave(edit);
    const blockPanels = createPanels();
    const blockAttributes = `${JSON.parse(
      JSON.stringify(getComponentAttributes(), null, 2)
    ).replace(/"var.url\+\'(.*?)\'(.*?)"/g, "vars.url+'$1'$2").replaceAll("var(.*?).url\+'(http.*?)'", 'http$2')}`;
    if (generateIconPreview) {
      try {
        await icon(htmlContent, { basePath, cssFiles, jsFiles });
        iconPreview = `(<img src="data:image/jpeg;base64,${await imageToBase64(
          path.join(basePath, 'preview.jpeg')
        )}" />)`;
      } catch (error) {
        console.log(`There was an error generating preview. ${error.message}`);
      }
    }
    const output = `
    (function () {
        ${imports}

        registerBlockType('${sanitizeAndReplaceNumbers(newPrefix)}/${sanitizeAndReplaceNumbers(newName)}', {
            title: '${name}',
            icon: ${iconPreview},
            category: '${category}',
            attributes: ${blockAttributes},
            edit(props) {
            const { attributes, setAttributes } = props;

            return (
                <div>
                    <InspectorControls>
                    ${blockPanels}
                    </InspectorControls>

                    ${edit}
                </div>
                );
            },
            save(props) {
            const { attributes } = props;

            return (
                ${save}
            );
            },
        });
        })();`;
    if (generateIconPreview) {
      return output.replace(/icon: \s * (')([^']*)(')/, 'icon: $2');
    }
    return output;
  };
  const setupVariables = async (htmlContent, options) => {
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    const linkRegex = /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;

    let match;

    htmlContent = htmlContent.replace(styleRegex, (_fullMatch, cssContent) => {
      styles.push({ type: 'inline', content: cssContent.trim() });
      return '';
    });

    const fetchCssPromises = [];
    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const url = match[1];
      const fetchCssPromise = fetch(url)
        .then((response) => response.text())
        .then((css) => styles.push({ type: 'external', content: css }))
        .catch(() => console.warn(`Failed to fetch: ${url}`));
      fetchCssPromises.push(fetchCssPromise);
    }

    htmlContent = htmlContent.replace(linkRegex, '');

    await Promise.all(fetchCssPromises);

    css = styles.map((style) => {
      return `${style.content}`;
    }).join('\n');

    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scriptSrcRegex =
      /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;

    let jsMatch;

    htmlContent = htmlContent.replace(scriptRegex, (_fullMatch, jsContent) => {
      if (jsContent.trim()) {
        scripts.push({ type: 'inline', content: jsContent });
      }
      return '';
    });

    const fetchJsPromises = [];
    while ((jsMatch = scriptSrcRegex.exec(htmlContent)) !== null) {
      const url = jsMatch[1];
      const fetchJsPromise = fetch(url)
        .then((response) => response.text())
        .then((js) => scripts.push({ type: 'external', content: js }))
        .catch(() => console.warn(`Failed to fetch script: ${url}`));
      fetchJsPromises.push(fetchJsPromise);
    }

    htmlContent = htmlContent.replace(scriptSrcRegex, '');

    await Promise.all(fetchJsPromises);

    js = scripts.map((script) => script.content).join('\n');

    let {
      basePath = process.cwd(),
      cssFiles = [],
      jsFiles = [],
      name = 'My block',
    } = options;
    const newDir = path.join(basePath, convertName(name));
    try {
      fs.mkdirSync(newDir, { recursive: true });
      return {
        ...options,
        jsFiles,
        cssFiles,
        htmlContent,
        basePath: newDir,
      };
    } catch (error) {
      logError(error);
    }
  };
  return saveFiles(await setupVariables(htmlContent, options));
};
export default block;
