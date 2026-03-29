import fetch from 'node-fetch';
import presetReact from '@babel/preset-react';
import * as babel from '@babel/core';
import * as cheerio from 'cheerio';
import scopeCss from 'css-scoping';
import extractAssets from './vendor/fetch-page-assets/index.js';
import fs from 'fs';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import convert from 'node-html-to-jsx';
import path from 'path';
import {
  createFileRecord,
  createJobId,
  inferContentType,
  uploadBufferToR2,
  zipEntriesToBuffer,
} from './r2.js';

import {
  imports,
  images,
  characters
} from './globals.js';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

export const createProfiler = (enabled) => {
  const marks = new Map();

  return {
    start(label) {
      if (enabled) {
        marks.set(label, process.hrtime.bigint());
      }
    },
    end(label) {
      if (enabled && marks.has(label)) {
        const start = marks.get(label);
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(`[profile] ${label}: ${elapsedMs.toFixed(2)}ms`);
        marks.delete(label);
      }
    },
  };
};

export const findSelfClosingJsxEnd = (content, startIndex) => {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateQuote = false;
  let braceDepth = 0;
  let parenDepth = 0;

  for (let i = startIndex; i < content.length - 1; i++) {
    const char = content[i];
    const next = content[i + 1];
    const prev = i > 0 ? content[i - 1] : '';
    const escaped = prev === '\\';

    if (!escaped) {
      if (!inDoubleQuote && !inTemplateQuote && char === '\'') {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (!inSingleQuote && !inTemplateQuote && char === '"') {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote && char === '`') {
        inTemplateQuote = !inTemplateQuote;
        continue;
      }
    }

    if (inSingleQuote || inDoubleQuote || inTemplateQuote) {
      continue;
    }

    if (char === '{') {
      braceDepth++;
      continue;
    }

    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === '(') {
      parenDepth++;
      continue;
    }

    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (char === '/' && next === '>' && braceDepth === 0 && parenDepth === 0) {
      return i + 2;
    }
  }

  return -1;
};

export const replaceSelfClosingJsxComponent = (content, componentName, replacer) => {
  const openTag = `<${componentName}`;

  if (!content.includes(openTag)) {
    return content;
  }

  let cursor = 0;
  let result = '';

  while (cursor < content.length) {
    const start = content.indexOf(openTag, cursor);

    if (start === -1) {
      result += content.slice(cursor);
      break;
    }

    result += content.slice(cursor, start);
    const end = findSelfClosingJsxEnd(content, start);

    if (end === -1) {
      result += content.slice(start);
      break;
    }

    result += replacer(content.slice(start, end));
    cursor = end;
  }

  return result;
};

export const getMediaUploadSaveTemplate = (image) => {
  if (!image) {
    return '';
  }

  const { randomUrlVariable, randomAltVariable, imgClass } = image;
  const classNameAttr = imgClass ? ` className="${imgClass}"` : '';

  return `<img src={attributes.${randomUrlVariable}} alt={attributes.${randomAltVariable}}${classNameAttr} />`;
};

export const replaceMediaUploadComponents = (content, imageRegistry) => {
  let imageIndex = 0;

  return replaceSelfClosingJsxComponent(content, 'MediaUpload', () => {
    const template = getMediaUploadSaveTemplate(imageRegistry[imageIndex]);
    imageIndex++;
    return template;
  });
};

export const replaceRichTextComponents = (content) => {
  return replaceSelfClosingJsxComponent(content, 'RichText', (componentSource) => {
    const valueMatch = componentSource.match(/\bvalue=\{([^}]+)\}/);

    if (!valueMatch) {
      return componentSource;
    }

    return `<RichText.Content value={${valueMatch[1]}} />`;
  });
};

export const buildAssetExtractionOptions = (basePath, options = {}) => ({
  basePath,
  saveFile: false,
  verbose: false,
  maxRetryAttempts: 1,
  retryDelay: 0,
  concurrency: 8,
  uploadToR2: options.uploadToR2 || false,
  returnDetails: options.returnDetails || false,
  jobId: options.jobId,
  r2Prefix: options.r2Prefix,
});

export const slugifyBlockValue = (value = '') => {
  return String(value)
    .replace(/\W|_/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
};

export const formatCategoryLabel = (category = '') => {
  return String(category)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const normalizeBlockOptions = (options = {}) => {
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(options, key);
  const title = options.title ?? options.name ?? 'My block';
  const slug = slugifyBlockValue(options.slug ?? title) || 'my-block';
  const namespace = options.namespace ?? options.prefix ?? 'wp';
  const baseUrl = options.baseUrl ?? options.source ?? null;
  const outputPath = options.outputPath ?? options.basePath ?? process.cwd();
  const hasExplicitLocalOutputPreference =
    hasOwn('writeFiles') ||
    hasOwn('outputPath') ||
    hasOwn('shouldSaveFiles') ||
    hasOwn('basePath');
  const hasExplicitJobPreference = hasOwn('uploadToR2') || hasOwn('jobId');
  const outputMode =
    options.outputMode ??
    (hasExplicitJobPreference ? 'job' : hasExplicitLocalOutputPreference ? 'legacy' : 'job');
  const writeFiles = options.writeFiles ?? options.shouldSaveFiles ?? (outputMode === 'legacy');
  const generatePreviewImage =
    options.generatePreviewImage ?? options.generateIconPreview ?? false;

  return {
    ...options,
    title,
    name: title,
    slug,
    namespace,
    prefix: namespace,
    baseUrl,
    source: baseUrl,
    category: options.category ?? 'common',
    registerCategoryIfMissing: options.registerCategoryIfMissing ?? false,
    outputPath,
    basePath: outputPath,
    writeFiles,
    shouldSaveFiles: writeFiles,
    generatePreviewImage,
    generateIconPreview: generatePreviewImage,
    jsFiles: options.jsFiles ?? [],
    cssFiles: options.cssFiles ?? [],
    outputMode,
    uploadToR2: options.uploadToR2 ?? outputMode === 'job',
    jobId: options.jobId,
  };
};

export const replaceRelativeUrls = (html, replacer) => {
  const urlAttributes = [
    'src', 'href', 'action', 'srcset', 'poster', 'data', 'formaction'
  ];

  const regex = new RegExp(
    `\\b(${urlAttributes.join('|')}|data-[a-zA-Z0-9_-]+)\\s*=\\s*(['"])(?!https?:|//|mailto:|tel:|#)([^'"]+)\\2`,
    'gi'
  );

  return html.replace(regex, (_match, attr, quote, url) => {
    const newUrl = replacer(url);
    return `${attr}=${quote}${newUrl}${quote}`;
  });
};

export const replaceRelativeUrlsInCss = (css, replacer) => {
  const regex = /url\(\s*(['"]?)(.+?)\1\s*\)/gi;

  return css.replace(regex, (match, quote, url) => {
    if (/^(https?:|\/\/|data:|mailto:|tel:|#)/.test(url.trim())) {
      return match;
    }

    const newUrl = replacer(url);
    return `url(${quote}${newUrl}${quote})`;
  });
};

export const replaceRelativeUrlsInHtml = (html, baseUrl) => {
  return replaceRelativeUrls(html, (url) => {
    return new URL(url, baseUrl).href;
  });
};

export const replaceRelativeUrlsInCssWithBase = (css, cssFileUrl) => {
  return replaceRelativeUrlsInCss(css, (url) => {
    return new URL(url, cssFileUrl).href;
  });
};

export const unwrapBody = (code) => {
  try {
    return code.replace(/<\/?(html|body)[^>]*>/gi, '');
  } catch (_error) {
    return code;
  }
};

export const transformBlockFile = (blockCode) => {
  let transformedCode = '';

  try {
    transformedCode = babel.transformSync(blockCode, {
      presets: [[presetReact, { pragma: 'wp.element.createElement' }]],
      filename: 'block.js'
    });
  } catch (error) {
    console.log(error);
  }

  return transformedCode;
};

export const getSnapApiUrl = () => {
  return process.env.SNAPAPI_URL || 'https://api.snapapi.pics/v1/screenshot';
};

const uploadJobPackage = async ({ jobId, generatedFiles, assetFiles, previewArtifact }) => {
  const allFiles = [];
  const zipEntries = [];
  let sourceIndex = 1;
  let assetIndex = 1;

  for (const [name, contents] of Object.entries(generatedFiles)) {
    const body = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : Buffer.from(contents || '');
    const storageKey = `generated/${jobId}/${name}`;
    const uploadResult = await uploadBufferToR2({
      storageKey,
      body,
      contentType: inferContentType(name),
    });

    allFiles.push(
      createFileRecord({
        id: `file_${sourceIndex++}`,
        name,
        kind: 'source',
        storageKey: uploadResult.storageKey,
        size: uploadResult.size,
        type: uploadResult.type,
        url: uploadResult.url,
      })
    );

    zipEntries.push({ name, body });
  }

  for (const assetFile of assetFiles) {
    allFiles.push({
      id: `file_${sourceIndex + assetIndex - 1}`,
      name: assetFile.name,
      type: assetFile.type,
      size: assetFile.size,
      path: assetFile.path,
      url: assetFile.url,
      kind: assetFile.kind || 'asset',
    });

    if (assetFile.buffer) {
      zipEntries.push({
        name: path.posix.relative(`generated/${jobId}`, assetFile.path.replace(/^\//, '')),
        body: assetFile.buffer,
      });
    }

    assetIndex++;
  }

  if (previewArtifact) {
    allFiles.push(previewArtifact.file);
    zipEntries.push({
      name: previewArtifact.file.name,
      body: previewArtifact.buffer,
    });
  }

  const zipBuffer = await zipEntriesToBuffer(zipEntries);
  const bundleUpload = await uploadBufferToR2({
    storageKey: `generated/${jobId}/output.zip`,
    body: zipBuffer,
    contentType: 'application/zip',
  });
  const bundleFile = createFileRecord({
    id: 'file_bundle',
    name: 'output.zip',
    kind: 'bundle',
    storageKey: bundleUpload.storageKey,
    size: bundleUpload.size,
    type: bundleUpload.type,
    url: bundleUpload.url,
  });

  return {
    jobId,
    status: 'completed',
    output: {
      files: allFiles,
      bundle: {
        id: bundleFile.id,
        name: bundleFile.name,
        type: bundleFile.type,
        size: bundleFile.size,
        path: bundleFile.path,
        url: bundleFile.url,
        zipUrl: bundleUpload.url,
      },
    },
  };
};

const block = async (
  htmlContent,
  rawOptions = {}
) => {
  const options = normalizeBlockOptions(rawOptions);
  const panels = [];
  const styles = [];
  const scripts = [];
  const attributes = {};
  const formVars = {};
  const extractedAssets = [];
  images.length = 0;

  const { name, prefix, source, slug, registerCategoryIfMissing } = options;
  const outputMode = options.outputMode;
  const useR2Storage = options.uploadToR2;
  const jobId = options.jobId || createJobId();

  let js = '';
  let css = '';
  let phpEmailData = '';
  let emailTemplate = '';
  let previewArtifact = null;
  const profiler = createProfiler(process.env.HTG_PROFILE === '1');

  function hasTailwindCdnSource(jsFiles) {
    const tailwindCdnRegex = /https:\/\/(cdn\.tailwindcss\.com(\?[^"'\s]*)?|cdn\.jsdelivr\.net\/npm\/@tailwindcss\/browser@4(\.\d+){0,2})/;

      return jsFiles.some(url => tailwindCdnRegex.test(url));
  }

  function replaceSourceUrlVars(str, source) {
    if (!source) return str;

    const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`var\.url\+'${escapedSource}([^']+)'`, 'g');
    return str.replace(pattern, (match, path) => `\${vars.url}${path}`);
  }

  function sanitizeAndReplaceLeadingNumbers(str) {
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
        return digit;
      })
      .replace(/^[^a-z]+/, '');
  }
   
  const replaceUnderscoresSpacesAndUppercaseLetters = (name = '') => slugifyBlockValue(name);

  const saveFile = (fileName, contents, options) => {
    try {
      const filePath = path.join(options.basePath, fileName);
      
      fs.writeFileSync(filePath, contents);
      
      return contents;
    } catch (error) {
      logError(error);
    }
  };

  const parseRequirements = async (files, options) => {
    const { source } = options;
    let output = '';

    for (const file of files) {
      try {
        const response = await fetch(file);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        let data = await response.text();

        if (source) {
          data = replaceRelativeUrlsInCssWithBase(data, file);
        }

        output += `${data}\n\n`;
      } catch (error) {
        logError(error);
      }
    }

    return output;
  };

  const convertDashesSpacesAndUppercaseToUnderscoresAndLowercase = (string) => {
    if (string) {
      return `${string.replaceAll('-', '_').replaceAll(' ', '_').toLowerCase()}`;
    }

    return '';
  };

  const newName = slug;
  const normalizedNamespace = replaceUnderscoresSpacesAndUppercaseLetters(prefix);
  const blockName = `${sanitizeAndReplaceLeadingNumbers(normalizedNamespace)}/${sanitizeAndReplaceLeadingNumbers(newName)}`;
  const blockNameHandle = `${normalizedNamespace}-${newName}`;

  const getPhp = (options) => {
    const { name, prefix, jsFiles, cssFiles } = options;
    const phpName = convertDashesSpacesAndUppercaseToUnderscoresAndLowercase(name);
    const phpPrefix = `${functionSufix}${convertDashesSpacesAndUppercaseToUnderscoresAndLowercase(prefix)}`;
    const tailwindFix = hasTailwindCdnSource(jsFiles) ? 'function forceTailwindUpdate(){let e=setInterval(()=>{if("undefined"!=typeof tailwind){clearInterval(e);let n=document.documentElement.outerHTML;tailwind.config.content=[{raw:n,extension:"html"}]}},100)}forceTailwindUpdate();': '';
    const tailwindFooter = hasTailwindCdnSource(jsFiles) ? '(()=>{if(window.__tailwindObserverActive)return;window.__tailwindObserverActive=!0;let e=new MutationObserver(()=>{let t=[...document.querySelectorAll("style")].find(e=>e.innerText.includes("--tw-"));t&&(document.body.appendChild(t),e.disconnect(),window.__tailwindObserverActive=!1)});e.observe(document.documentElement,{childList:!0,subtree:!0})})();' : '';
    const inlineRemoteLoader = `var remoteUrls = ${JSON.stringify(jsFiles)};(function loadScripts() {window._loadedRemoteScripts = window._loadedRemoteScripts || new Set();const style = document.createElement('style');remoteUrls.forEach((url) => {if (window._loadedRemoteScripts.has(url)) return;const script = document.createElement('script');script.src = url;document.head.appendChild(script);window._loadedRemoteScripts.add(url);});})();${tailwindFix}${tailwindFooter}`;

    const enqueueRemoteStyles = cssFiles
      .map((remoteUrl) => {
        return `
      wp_enqueue_style(
        '${blockNameHandle}-${remoteUrl
          .split('/')
          .pop()
          .replace(/\.\w+$/, '')}',
        '${remoteUrl}',
        array(),
        null
      );
    `;
      })
      .join('\n');

    return `<?php
  /*
    * Plugin Name:       ${name}
    * Version:           ${version}
    * Author:            Html to Gutenberg
    * Author URI:        https://www.html-to-gutenberg.io/
    * Description:       A custom editable block built with Html to Gutenberg

  */

  if ( ! defined( 'ABSPATH' ) ) {
    exit;
  }

  function parse_form_placeholders_${functionSufix}($content, $post_data)
  {
    return preg_replace_callback('/{{(.*?)}}/', function ($matches) use ($post_data) {
      $key = trim($matches[1]);
      return isset($post_data[$key]) ? sanitize_text_field($post_data[$key]) : '';
    }, $content);
  }

  add_action('wp_ajax_send_test_email_${functionSufix}}', function() {
    //check_ajax_referer('wp_rest');

    $post_data = $_POST;
    $to = sanitize_email(parse_form_placeholders_${functionSufix}($post_data['to'], $post_data));
    $from = sanitize_email(parse_form_placeholders_${functionSufix}($post_data['from'], $post_data));
    $subject = sanitize_text_field(parse_form_placeholders_${functionSufix}($post_data['subject'], $post_data));
    $message = wp_kses_post(parse_form_placeholders_${functionSufix}($post_data['message'], $post_data));

    if (empty($to) || empty($from)) {
      wp_send_json_error('Missing email addresses.');
    }

    $sent = wp_mail($to, $subject, $message, [
      'Content-Type: text/html; charset=UTF-8',
      'From: ' . $from
    ]);

    if ($sent) {
      wp_send_json_success('Email sent');
    } else {
      error_log('Failed to send. To: ' . $to . ' | From: ' . $from);
      wp_send_json_error('Failed to send email.');
    }
  });  

  ${phpEmailData}

  function ${phpPrefix}_${phpName}_add_custom_editor_styles() {
    echo '<style>span.block-editor-rich-text__editable.rich-text{all:unset!important}a br[data-rich-text-line-break=true],span.block-editor-block-icon.block-editor-block-switcher__toggle.has-colors img{display:none}.block-editor-block-types-list__list-item{width:100%!important}.block-editor-block-list__layout.is-root-container>:where(:not(.alignleft):not(.alignright):not(.alignfull)){max-width:100%;margin:0}[aria-label="Empty block; start writing or type forward slash to choose a block"]{max-width:1200px!important}span.block-editor-block-types-list__item-icon img{max-width:100%;width:100%;margin:0;display:block}span.block-editor-block-icon.has-colors{all:inherit;order:2;flex:0 0 100%;width:100%}span.block-editor-block-icon.has-colors svg{margin-left:auto;margin-right:auto}.block-editor-block-card{display:flex!important;flex-wrap:wrap}.block-editor-inserter__preview-content-missing{display:none!important}</style>';
  }

  add_action('admin_footer', function () {
    $screen = get_current_screen();
    
    if ($screen && method_exists($screen, 'is_block_editor') && $screen->is_block_editor()) {
        $href = esc_url(plugins_url('editor.css', __FILE__));
        echo "<link rel='stylesheet' id='${blockNameHandle}-style' href='$href' type='text/css' media='all' />";
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
      '${blockNameHandle}',
      plugins_url( 'block.js', __FILE__ ),
      array( 'wp-blocks', 'wp-components', 'wp-element' ,'wp-editor'),
      $version
    );

    wp_localize_script( '${blockNameHandle}', 'vars', array( 'url' => plugin_dir_url( __FILE__ ) ) );

    ${enqueueRemoteStyles}

    ${phpPrefix}_${phpName}_add_custom_editor_styles();

    wp_dequeue_style('${blockNameHandle}-frontend');
    wp_deregister_style('${blockNameHandle}-frontend');

    wp_enqueue_script(
      '${blockNameHandle}-remote-loader',
      plugins_url('remote-loader.js', __FILE__),
      array(),
      null,
      true
    );

    wp_add_inline_script(
      '${blockNameHandle}-remote-loader',
      ${JSON.stringify(inlineRemoteLoader)}
    );
  }

  add_action('enqueue_block_editor_assets', function () {
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('wp-block-library-theme');
    wp_dequeue_style('wc-block-style');
    wp_dequeue_style('wp-format-library');
}, 100);


  add_action('init', function () {
    wp_register_script(
        '${blockNameHandle}-scripts',
        plugins_url('scripts.js', __FILE__),
        array(),
        null,
        true
    );

    wp_register_style(
      '${blockNameHandle}-frontend',
      plugins_url('style.css', __FILE__)
    );

    wp_register_script(
      '${blockNameHandle}-remote-loader',
        plugins_url('remote-loader.js', __FILE__),
        array(),
        null,
        true
    );
  });

  add_action( 'wp_enqueue_scripts', '${phpPrefix}_${phpName}_block_assets', 999 );

  function ${phpPrefix}_${phpName}_block_assets() {
    global $wp_query;

    $used = false;

    if (!empty($wp_query->posts)) {
        foreach ($wp_query->posts as $post) {
            $blocks = parse_blocks($post->post_content);

            foreach ($blocks as $block) {
                if ($block['blockName'] === '${blockName}') {
                    $used = true;
                    break 2;
                }
            }
        }
    }

    if ($used) {
        $handle = '${blockNameHandle}';

        wp_enqueue_style($handle . '-frontend');

        wp_enqueue_script($handle . '-scripts');

        wp_localize_script(
            $handle . '-scripts',
            'vars',
            array(
                'postId' => get_queried_object_id(),
                'ajaxUrl' => admin_url('admin-ajax.php')
            )
        );

        wp_enqueue_script($handle . '-remote-loader');

        wp_add_inline_script(
            $handle . '-remote-loader',
            ${JSON.stringify(inlineRemoteLoader)}
        );
    }
  }
  `;
  };

  const saveFiles = async (options) => {
    const { cssFiles = [], jsFiles = [], shouldSaveFiles, name, prefix } = options;
    const tailwindRegex = /(class|className)\s*=\s*["'][^"']*\b(items-center|justify-center|gap-\d+|rounded(-[a-z]+)?|text-[a-z]+-\d{3}|bg-[a-z]+-\d{3}|w-(full|screen)|h-(full|screen)|max-w-[\w\[\]-]+|p-\d+|m-\d+)\b[^"']*["']/i;
    const hasTailwind = tailwindRegex.test(htmlContent);
    const hasTailwindCdn = hasTailwindCdnSource(jsFiles);

    css = hasTailwind && hasTailwindCdn ? '' : `
    *:not(.components-button) { 
      all: revert-layer; 
    }\n`;

    css += await parseRequirements(cssFiles, options);    

    for (const style of styles) {
      css += style.content;
    }

    css = css.replace(/[^{}]+:is\([^)]*\[.*?['"].*?\)[^{}]*\{[^}]*\}/g, '');

    const scopedCssFrontend = scopeCss(css, `.wp-block-${sanitizeAndReplaceLeadingNumbers(replaceUnderscoresSpacesAndUppercaseLetters(prefix))}-${sanitizeAndReplaceLeadingNumbers(replaceUnderscoresSpacesAndUppercaseLetters(name))}`);
    const editorStyleFile = scopeCss(css, `[data-type="${blockName}"]`);
    const scriptFile = js;

     htmlContent = htmlContent
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

    profiler.start('getBlock');
    let blockCode = await getBlock(options);
    profiler.end('getBlock');

    // Ensure all <img> tags are self-closing for valid JSX
    blockCode = blockCode.replace(/<img([^>/]*?)>/g, '<img$1 />');
    blockCode = blockCode.replaceAll(' / dangerouslySetInnerHTML', ' dangerouslySetInnerHTML')

    const indexFile = getPhp(options);
    let blockFile = '';

    profiler.start('transformBlockFile');
    blockFile = transformBlockFile(blockCode).code
      ?.replace(/name: \"\{field.name\}\"/g, 'name: field.name')
      ?.replace(/key: \"\{index\}\"/g, 'key: index');
    profiler.end('transformBlockFile');
    
    const finalScriptsFile = `${scriptFile}\n\n${emailTemplate}`;
    const remoteLoaderFile = '';

    if (shouldSaveFiles && outputMode === 'legacy') {
      saveFile('style.css', scopedCssFrontend, options);
      saveFile('editor.css', editorStyleFile, options);
      saveFile('scripts.js', finalScriptsFile, options);
      saveFile('index.php', indexFile, options);
      saveFile('block.js', blockFile, options);
      saveFile('remote-loader.js', remoteLoaderFile, options);
    }

    return {
      'style.css': scopedCssFrontend,
      'editor.css': editorStyleFile,
      'scripts.js': finalScriptsFile,
      'index.php': indexFile,
      'block.js': blockFile,
      'remote-loader.js': remoteLoaderFile,
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

  const functionSufix = generateRandomVariableName('func');

  const setRandomAttributeContent = (randomVariableName, content) => {
    const isArray = Array.isArray(content);
    

    attributes[randomVariableName] = { type: isArray ? 'array' : 'string', default: content };
    
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
              cursor: 'pointer'
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
      const extracted = await extractAssets(
        htmlContent,
        buildAssetExtractionOptions(basePath, {
          uploadToR2: useR2Storage,
          returnDetails: useR2Storage,
          jobId,
          r2Prefix: `generated/${jobId}/assets`,
        })
      );
      const newHtml = typeof extracted === 'string' ? extracted : extracted.html;

      if (typeof extracted !== 'string' && Array.isArray(extracted.assets)) {
        extractedAssets.push(...extracted.assets);
      }

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
    const newPrefix = replaceUnderscoresSpacesAndUppercaseLetters(prefix);
    const randomVariable = generateRandomVariableName(`${type}${newPrefix}`);

    let imgSrcWithoutOrigin = imgSrc;
    try {
      if (typeof imgSrc === 'string') {
        if (/^https?:\/\//.test(imgSrc)) {
          const urlObj = new URL(imgSrc);
          imgSrcWithoutOrigin = urlObj.pathname + urlObj.search + urlObj.hash;
        } else if (source && imgSrc.startsWith(source)) {
          imgSrcWithoutOrigin = imgSrc.slice(source.length);
          if (imgSrcWithoutOrigin.startsWith('/')) imgSrcWithoutOrigin = imgSrcWithoutOrigin.slice(1);
        }
      }
    } catch (e) {
      imgSrcWithoutOrigin = imgSrc;
    }
    let imgSrcNoLeadingSlash = imgSrcWithoutOrigin;
    if (typeof imgSrcNoLeadingSlash === 'string' && imgSrcNoLeadingSlash.startsWith('/')) {
      imgSrcNoLeadingSlash = imgSrcNoLeadingSlash.slice(1);
    }
    attributes[randomVariable] = {
      attribute,
      type: 'string',
      selector: 'img',
      default: attribute === 'alt' ? imgAlt : `{vars.url}${imgSrcNoLeadingSlash}`.replace(/^\u007f/, '$'),
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

  const createPanelsForForm = () => {
    const randomFormIdVariable = generateRandomVariableName('form');
    const randomHiddenFieldsAttr = generateRandomVariableName('hiddenFields');
    const randomSendEmailVariable = generateRandomVariableName('send');
    const randomEmailFromVariable = generateRandomVariableName('emailFrom');
    const randomEmailToVariable = generateRandomVariableName('emailTo');
    const randomEmailSubjectVariable = generateRandomVariableName('emailSubj');
    const randomEmailMessageVariable = generateRandomVariableName('emailMsg');
    const randomTestFeedbackAttr = generateRandomVariableName('emailTestMsg');
  
    Object.assign(formVars, {
      randomFormIdVariable,
      randomSendEmailVariable,
      randomEmailFromVariable,
      randomEmailToVariable,
      randomEmailSubjectVariable,
      randomEmailMessageVariable,
      randomTestFeedbackAttr,
      randomHiddenFieldsAttr
    });
  
    setRandomAttributeContent(randomFormIdVariable, `form-${randomFormIdVariable}`);
    setRandomAttributeContent(randomSendEmailVariable, false);
    setRandomAttributeContent(randomEmailFromVariable, '');
    setRandomAttributeContent(randomEmailToVariable, '');
    setRandomAttributeContent(randomEmailSubjectVariable, 'New Form Submission');
    setRandomAttributeContent(randomEmailMessageVariable, 'Form data:\n{{fields}}');
    setRandomAttributeContent(randomTestFeedbackAttr, '');
    setRandomAttributeContent(randomHiddenFieldsAttr, []);
  
    createPanel({
      type: 'formSettings',
      title: 'Form Settings',
      attributes: [randomFormIdVariable, randomSendEmailVariable],
    });
  
    createPanel({
      type: 'emailSettings',
      title: 'Email Settings',
      attributes: [
        randomSendEmailVariable,
        randomEmailFromVariable,
        randomEmailToVariable,
        randomEmailSubjectVariable,
        randomEmailMessageVariable,
        randomTestFeedbackAttr,
        randomFormIdVariable
      ],
    });
  
    createPanel({
      type: 'hiddenFields',
      title: 'Hidden Fields',
      attributes: [randomHiddenFieldsAttr],
    });
  };
  
  const getFormVariables = () => ({ ...formVars });
  
  const transformFormToDynamicJSX = (htmlContent) => {
    const regex = /<form([\s\S]*?)>([\s\S]*?)<\/form>/gi
    const formExists = regex.test(htmlContent);
  
    if (!formExists) {
      return htmlContent;
    }

  
    return htmlContent.replace(
      /<form([\s\S]*?)>([\s\S]*?)<\/form>/gi,
      (_match, formAttributes, innerContent) => {
        createPanelsForForm();

        const {
          randomFormIdVariable,
          randomHiddenFieldsAttr
        } = getFormVariables();

        return `
          <form
            ${formAttributes.trim()}
            id={attributes.${randomFormIdVariable}}
          >
            ${innerContent}
            
            { (attributes.${randomHiddenFieldsAttr} || []).map((field, index) => (<input key={index} name={field.name} value={field.value} type="hidden" /> )) }
          </form>
          `;
      }
    );
  };

  const getFixedHtml = (html) => {
    function parseStyleString(style) {
      const entries = style.split(';').filter(Boolean).map(rule => {
        let [key, value] = rule.split(':');
        if (!key || !value) return null;
        key = key.trim().replace(/^[-\s]+/, '');
        const camelKey = key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        return [camelKey, value.trim()];
      }).filter(Boolean);
      const styleObject = Object.fromEntries(entries);
      return JSON.stringify(styleObject).replace(/"([^"\n]+)":/g, '$1:');
    }
    return html
      .replace(/style="([^"]+)"/g, (_, styleString) => {
        const styleObj = parseStyleString(styleString);
        return `style={${styleObj}}`;
      })
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
    
    setRandomAttributeContent(randomVariable, variableContent);
    
    return getRichTextTemplate(randomVariable, variableContent);
  };

  const parseContent = (content) => {
    return content.replace(/>([^<]+)</g, (match, variableContent) => {
      const regex = /{|}|\(|\)|=>/;

      if (regex.test(variableContent.trim())) {
        return match;
      }
  
      if (variableContent.trim() === '') {
        return match;
      }
  
      return convertToRichText(variableContent);
    });
  };
  
  const getEditJsxContent = async (options) => {    
    let content = transformFormToDynamicJSX(options.htmlContent);

    content = content.replaceAll(/<!--(.*?)-->/gs, '');

    content = `<div className="custom-block">${content}</div>`;

    const processedImages = await processEditImages({
      ...options,
      htmlContent: parseContent(content),
    });

    return replaceSVGImages(processedImages);
  };

  const createPanel = (values) => {
    if (values.attributes && values.attributes.length > 0) {
      panels.push(values);
    }
  };

  const getSvgTemplate = (_match, group1, _group3, randomSVGVariable) => {
    return `<svg ${group1} dangerouslySetInnerHTML={ { __html: attributes.${randomSVGVariable} }}></svg>`;
  };
  const replaceSVGImages = async (html) => {
    // Improved SVG handling: preserve nesting and avoid splitting SVG from parent
    const svgRegex = /(<svg[\s\S]*?<\/svg>)/gi;
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = svgRegex.exec(html)) !== null) {
      const [svgBlock] = match;
      const start = match.index;
      const end = start + svgBlock.length;

      // Add preceding HTML
      result += html.slice(lastIndex, start);

      // Extract attributes and inner content
      const attrMatch = svgBlock.match(/^<svg([^>]*)>([\s\S]*?)<\/svg>$/i);
      if (attrMatch) {
        const group1 = attrMatch[1];
        const group2 = attrMatch[2];
        const randomSVGVariable = generateRandomVariableName('svg');
        setRandomAttributeContent(randomSVGVariable, group2.replaceAll('className', 'class'));
        createPanel({
          type: 'svg',
          title: 'SVG Markup',
          attributes: [randomSVGVariable],
        });
        // Replace with JSX template, preserving parent context
        result += getSvgTemplate(svgBlock, group1, '</svg>', randomSVGVariable);
      }
      lastIndex = end;
    }
    result += html.slice(lastIndex);
    return result;
  };
  const getSvgPanelTemplate = (panel) => {
    return `
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
  };

  const getMediaPanelTemplate = (panel) => {
    const mediaAtts =
      panel.attributes?.[0] && panel.attributes[1]
        ? `${panel.attributes[0]}: media.url,
                   ${panel.attributes[1]}: media.alt`
        : '';

    return `              
      <PanelBody title="${panel.title}">
        <PanelRow>
          <div>
            <MediaUpload
              onSelect={ (media) => { setAttributes({ ${mediaAtts} }); 
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
      `;
  };

  const getFormSettingsPanelTemplate = (panel) => {
    const [formIdAttr, sendEmailAttr] = panel.attributes;
  
    return `
      <PanelBody title="${panel.title}" initialOpen={true}>
        <TextControl
          label="Form ID"
          disabled="true"
          value={attributes.${formIdAttr}}
          onChange={(val) => setAttributes({ ${formIdAttr}: val })}
        />
        <ToggleControl
          label="Send Email on Submit"
          checked={attributes.${sendEmailAttr}}
          onChange={(val) => setAttributes({ ${sendEmailAttr}: val })}
        />
      </PanelBody>
    `;
  };

  const getPhpEmailData = (formIdAttr, fromAttr, toAttr, subjectAttr, messageAttr) => {
    return `
    add_action('wp_ajax_send_email_${formIdAttr}', function() {
        //check_ajax_referer('wp_rest');

        $post_id = $_POST['postId'];

        if (!$post_id) {
          wp_send_json_error('Missing post ID.');
        }

        $post_data = $_POST; 
        $post = get_post($post_id);

        if (!$post) {
          wp_send_json_error('Post not found.');
        }

        $blocks = parse_blocks($post->post_content);

        $target_block = null;

        foreach ($blocks as $block) {
          if ($block['blockName'] === '${blockName}') {
            $target_block = $block;
            break;
          }
        }

        if (!$target_block) {
          wp_send_json_error('Block not found.');
        }

        $attrs = $target_block['attrs'] ?? [];

        $to      = sanitize_email(parse_form_placeholders_${functionSufix}($attrs['${toAttr}'] ?? '', $post_data));
        $from    = sanitize_email(parse_form_placeholders_${functionSufix}($attrs['${fromAttr}'] ?? '', $post_data));
        $subject = sanitize_text_field(parse_form_placeholders_${functionSufix}($attrs['${subjectAttr}'] ?? '', $post_data));
        $message = wp_kses_post(parse_form_placeholders_${functionSufix}($attrs['${messageAttr}'] ?? '', $post_data));

        if (empty($to) || empty($from)) {
          wp_send_json_error('Missing email addresses.');
        }

        $sent = wp_mail($to, $subject, $message, [
          'Content-Type: text/html; charset=UTF-8',
          'From: ' . $from
        ]);

        if ($sent) {
          wp_send_json_success('Email sent');
        } else {
          error_log('Failed to send. To: ' . $to . ' | From: ' . $from);
          wp_send_json_error('Failed to send email.');
        }
      });
    `;
  }

  const getEmailSettingsPanelTemplate = (panel) => {
    const [
      sendEmailAttr,
      fromAttr,
      toAttr,
      subjectAttr,
      messageAttr,
      testFeedbackAttr,
      formIdAttr,
    ] = panel.attributes;

    emailTemplate += getEmailSaveTemplate(formIdAttr);
    phpEmailData += getPhpEmailData(formIdAttr, fromAttr, toAttr, subjectAttr, messageAttr);
  
    return `
      { attributes.${sendEmailAttr} && (
        <PanelBody title="${panel.title}" initialOpen={true}>
          <TextControl
            label="From"
            value={attributes.${fromAttr}}
            onChange={(val) => setAttributes({ ${fromAttr}: val })}
          />
          <TextControl
            label="To"
            value={attributes.${toAttr}}
            onChange={(val) => setAttributes({ ${toAttr}: val })}
          />
          <TextControl
            label="Subject"
            value={attributes.${subjectAttr}}
            onChange={(val) => setAttributes({ ${subjectAttr}: val })}
          />
          <TextareaControl
            label="Message Template (HTML Supported)"
            help="Use {{fieldName}} to insert field values."
            value={attributes.${messageAttr}}
            onChange={(val) => setAttributes({ ${messageAttr}: val })}
          />
  
          <Button
            variant="primary"
            onClick={() => {
              const form = document.getElementById('form-${formIdAttr}');
              const inputs = form.querySelectorAll('input, select, textarea');
              const body = new URLSearchParams();

              inputs.forEach(input => {
                if (input.name && !input.disabled) {
                  body.append(input.name, input.value);
                }
              });

              body.append('action', 'send_test_email_${functionSufix}');
              body.append('from', attributes?.${fromAttr} || '');
              body.append('to', attributes?.${toAttr} || '');
              body.append('subject', attributes?.${subjectAttr} || '');
              body.append('message', attributes?.${messageAttr} || '');

              fetch(vars.ajaxUrl, {
                method: 'POST',
                body
              })
              .then(res => res.json())
              .then(data => {
                setAttributes({ ${testFeedbackAttr}: data.success ? 'Test Email Sent!' : data.error });
              })
              .catch(() => {
                setAttributes({ ${testFeedbackAttr}: 'Failed to send test email.' });
              });
            }}
          >
            Send Test Email
          </Button>
  
          {attributes.${testFeedbackAttr} && (
            <Notice status="info" isDismissible={false}>
              {attributes.${testFeedbackAttr}}
            </Notice>
          )}
        </PanelBody>
      )}
    `;
  };

  const getEmailSaveTemplate = (formIdAttr) => {
    return `
      document.addEventListener('DOMContentLoaded', function() {
        const form = document.getElementById('form-${formIdAttr}');

        form.addEventListener('submit', function(event) {
          event.preventDefault();
          
          const inputs = form.querySelectorAll('input, select, textarea');
          const body = new URLSearchParams();

          inputs.forEach(input => {
            if (input.name && !input.disabled) {
              body.append(input.name, input.value);
            }
          });

          body.append('action', 'send_email_${formIdAttr}');
          body.append('postId', vars.postId);

          fetch(vars.ajaxUrl, {
            method: 'POST',
            body
          })
          .then(res => res.json())
          .then(data => {
            console.log(data.success ? 'Test Email Sent!' : data.error);
          })
          .catch(() => {
            console.log('Failed to send test email.');
          });

          form.reset()
        });
      });   
    `;
  };

  const getHiddenFieldsPanelTemplate = (panel) => {
    const [hiddenFieldsAttr] = panel.attributes;
  
    return `
      <PanelBody title="${panel.title}" initialOpen={false}>
        { (attributes.${hiddenFieldsAttr} || []).map((field, index) => (
          <div key={index} style={{ marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
            <TextControl
              label="Name"
              value={field.name}
              onChange={(val) => {
                const newFields = [...attributes.${hiddenFieldsAttr}];
                newFields[index].name = val;
                setAttributes({ ${hiddenFieldsAttr}: newFields });
              }}
            />
            <TextControl
              label="Value"
              value={field.value}
              onChange={(val) => {
                const newFields = [...attributes.${hiddenFieldsAttr}];
                newFields[index].value = val;
                setAttributes({ ${hiddenFieldsAttr}: newFields });
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                const newFields = [...attributes.${hiddenFieldsAttr}];
                newFields.splice(index, 1);
                setAttributes({ ${hiddenFieldsAttr}: newFields });
              }}
            >
              Remove
            </Button>
          </div>
        ))}
  
        <Button
          variant="primary"
          onClick={() => {
            const newFields = [...(attributes.${hiddenFieldsAttr} || [])];
            newFields.push({ name: '', value: '' });
            setAttributes({ ${hiddenFieldsAttr}: newFields });
          }}
        >
          Add Hidden Field
        </Button>
      </PanelBody>
    `;
  };
  

  const findAndGetPanelTemplate = (panel) => {
    switch (panel.type) {
      case 'svg':
        return getSvgPanelTemplate(panel);
      case 'media':
        return getMediaPanelTemplate(panel);
      case 'formSettings':  
        return getFormSettingsPanelTemplate(panel);
      case 'emailSettings':
        return getEmailSettingsPanelTemplate(panel);
      case 'hiddenFields':
        return getHiddenFieldsPanelTemplate(panel);
      default:
        return '';
    }
  };

  const getPanelsTemplate = () => {
    return panels
      .map((panel) => {
        return findAndGetPanelTemplate(panel);
      })
      .join('\n');
  };

  const createPanels = () => {
    return `
    <Panel>
      ${getPanelsTemplate()}
    </Panel>`;
  };

  const buildSaveContent = (editContent) => {
    let output = replaceRichTextComponents(editContent);
    output = output.replaceAll('class=', 'className=');
    output = replaceMediaUploadComponents(output, images);
    return output;
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
    let { htmlContent } = options;

    htmlContent = htmlContent
      ? htmlContent.replace(
          /(<a)[^>]*>([\s\S]*?)(<\/a>)/gim,
          replaceRichText
        )
      : undefined;

    return {
      ...options,
      htmlContent,
    };
  };

  const getComponentAttributes = () => {
    return Object.entries(attributes)
    .map(([key, value]) => {
      return `${key}: { ${Object.entries(value).map(([k, v]) => `${k}: \`${v}\``).join(', ')} }`;
    })
    .join(',\n');
  };

  const getEdit = async (options) => {
    let { htmlContent } = options;

    if (htmlContent) {
      profiler.start('getEdit');
      options.htmlContent = unwrapBody(htmlContent);            
      const postProcessLinks = processLinks(options);
      const postGetEditJsx = await getEditJsxContent(postProcessLinks);
      const preConvert = await postGetEditJsx.replace(/<\/br>/g, '<br/>').replace(/<\/hr>/g, '<hr/>')
      const converted = convert(preConvert);
      profiler.end('getEdit');
      return converted;
    }

    return '';
  };
  
  const parseBlockAttributes = () => {
  const attrs = `{${getComponentAttributes()}}`;
  return replaceSourceUrlVars(attrs, options.source);
  }

  const getBlock = async (settings) => {
    let {
      name,
      category,
      generateIconPreview,
    } = settings;

    const iconPreview = generateIconPreview ? `(<img src={vars.url + 'preview.jpeg'} />)` : "'shield'";
    const categoryRegistration = registerCategoryIfMissing
      ? `
        (function ensureBlockCategory() {
          if (
            typeof wp === 'undefined' ||
            !wp.blocks ||
            !wp.blocks.setCategories ||
            !wp.blocks.store ||
            !wp.data ||
            !wp.data.select
          ) {
            return;
          }

          const categorySelector = wp.data.select(wp.blocks.store);
          const existingCategories =
            categorySelector && typeof categorySelector.getCategories === 'function'
              ? categorySelector.getCategories()
              : [];

          if (existingCategories.some((item) => item && item.slug === ${JSON.stringify(category)})) {
            return;
          }

          wp.blocks.setCategories([
            ...existingCategories,
            {
              slug: ${JSON.stringify(category)},
              title: ${JSON.stringify(formatCategoryLabel(category) || category)},
            },
          ]);
        })();
      `
      : '';
    profiler.start('getBlock:getEdit');
    const edit = await getEdit(settings);    
    profiler.end('getBlock:getEdit');
    profiler.start('getBlock:buildSaveContent');
    const save = buildSaveContent(edit);
    profiler.end('getBlock:buildSaveContent');
    profiler.start('getBlock:createPanels');
    const blockPanels = createPanels(); 
    profiler.end('getBlock:createPanels');

    const output = `
    (function () {
        ${imports}
        ${categoryRegistration}

        registerBlockType('${blockName}', {
            title: '${name}',
            icon: ${iconPreview},
            category: '${category}',
            attributes: ${parseBlockAttributes()},
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

    return output;
  };

  const setupVariables = async (htmlContent, options) => {
 
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const linkRegex = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi;

    let match;

    htmlContent = htmlContent.replace(styleRegex, (_fullMatch, cssContent) => {
      styles.push({ type: 'inline', content: cssContent.trim() });
      return '';
    });

    const fetchCssPromises = [];
    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const url = match[1];
      const fetchCssPromise = fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          return response.text();
        })
        .then((css) => styles.push({ type: 'external', content: css }))
        .catch(() => console.warn(`Failed to fetch: ${url}`));
      fetchCssPromises.push(fetchCssPromise);
    }

    htmlContent = htmlContent.replace(linkRegex, '');

    await Promise.all(fetchCssPromises);

    css += styles.map((style) => {
      return `${style.content}`;
    }).join('\n');

    const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    const scriptSrcRegex =
      /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi;

    let jsMatch;

    const fetchJsPromises = [];

    while ((jsMatch = scriptSrcRegex.exec(htmlContent)) !== null) {
      const url = jsMatch[1];
      const fetchJsPromise = fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          return response.text();
        })
        .then((js) => scripts.push({ type: 'external', content: js }))
        .catch(() => console.warn(`Failed to fetch script: ${url}`));
      fetchJsPromises.push(fetchJsPromise);
    }

    htmlContent = htmlContent.replace(scriptSrcRegex, '');

    htmlContent = htmlContent.replace(scriptRegex, (_fullMatch, jsContent) => {
      if (jsContent.trim()) {
        scripts.push({ type: 'inline', content: jsContent });
      }
      return '';
    });

    await Promise.all(fetchJsPromises);

    js += scripts.map((script) => script.content).join('\n');

    let {
      basePath = process.cwd(),
      cssFiles = [],
      jsFiles = [],
      name = 'My block',
      slug = replaceUnderscoresSpacesAndUppercaseLetters(name),
    } = options;

    const newDir = path.join(basePath, slug);

    const $ = cheerio.load(htmlContent, {
      xmlMode: true,
      decodeEntities: false,
    });

    $('head, script, style').remove();
    
    htmlContent = $('body').html();

    if (outputMode === 'legacy' && options.shouldSaveFiles) {
      fs.mkdirSync(newDir, { recursive: true });
    }

    return {
      ...options,
      jsFiles,
      cssFiles,
      htmlContent,
      basePath: newDir,
    };
  };

  if (source) {
    htmlContent = replaceRelativeUrlsInHtml(htmlContent, source);
    htmlContent = replaceRelativeUrlsInCssWithBase(htmlContent, source);
  }
  


  // Screenshot generation using SnapAPI
  dotenv.config({ quiet: true });
  if (options.generateIconPreview && options.source) {
    try {
      const snapApiKey = process.env.SNAPAPI_KEY;
      if (!snapApiKey) {
        throw new Error('SNAPAPI_KEY is not set in environment variables.');
      }
      const snapApiUrl = getSnapApiUrl();
      const snapApiBody = {
        url: options.source,
        fullPage: true,
        delay: 4000,
        blockAds: true,
        blockCookieBanners: true
      };
      const response = await fetch(snapApiUrl, {
        method: 'POST',
        headers: {
          'X-Api-Key': snapApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(snapApiBody)
      });
      if (!response.ok) {
        throw new Error(`SnapAPI error: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      if (outputMode === 'legacy' && options.shouldSaveFiles) {
        const previewPath = path.join(options.basePath, options.slug, 'preview.jpeg');
        fs.writeFileSync(previewPath, buffer);
      } else if (useR2Storage) {
        const uploadResult = await uploadBufferToR2({
          storageKey: `generated/${jobId}/preview.jpeg`,
          body: buffer,
          contentType: 'image/jpeg',
        });

        previewArtifact = {
          buffer,
          file: createFileRecord({
            id: `file_preview`,
            name: 'preview.jpeg',
            kind: 'asset',
            storageKey: uploadResult.storageKey,
            size: uploadResult.size,
            type: uploadResult.type,
            url: uploadResult.url,
          }),
        };
      }
    } catch (error) {
      console.log(`There was an error generating preview with SnapAPI. ${error.message}`);
    }
  }

  profiler.start('setupVariables');
  const preparedOptions = await setupVariables(htmlContent, options);
  profiler.end('setupVariables');
  profiler.start('saveFiles');
  const result = await saveFiles(preparedOptions);
  profiler.end('saveFiles');

  if (outputMode === 'legacy') {
    return result;
  }

  return uploadJobPackage({
    jobId,
    generatedFiles: result,
    assetFiles: extractedAssets,
    previewArtifact,
  });
};

export default block;
