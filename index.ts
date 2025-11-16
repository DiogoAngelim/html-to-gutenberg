import presetReact from '@babel/preset-react';
import * as babel from '@babel/core';
import * as cheerio from 'cheerio';
import scopeCss from 'css-scoping';
import extractAssets from 'fetch-page-assets';
import fs from 'fs';
import icon from 'html-screenshots';
import { createRequire } from 'module';
import convert from 'node-html-to-jsx';
import path from 'path';

import {
  imports,
  images,
  characters
} from './globals.js';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

const block = async (
  htmlContent,
  options = {
    name: 'My block',
    prefix: 'wp',
    category: 'common',
    basePath: process.cwd(),
    shouldSaveFiles: true,
    generateIconPreview: false,
    jsFiles: [],
    cssFiles: [],
    source: null,
  }
) => {
  const panels = [];
  const styles = [];
  const scripts = [];
  const attributes = {};
  const formVars = {};

  const { name, prefix, source } = options;

  let js = '';
  let css = '';
  let phpEmailData = '';
  let emailTemplate = '';

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

  const replaceUnderscoresSpacesAndUppercaseLetters = (name = '') => {
    return name.replace(new RegExp(/\W|_/, 'g'), '-').toLowerCase();
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

  function replaceRelativeUrls(html, replacer) {
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
  }


  function replaceRelativeUrlsInCss(css, replacer) {
    const regex = /url\(\s*(['"]?)(.+?)\1\s*\)/gi;

    return css.replace(regex, (match, quote, url) => {
      if (/^(https?:|\/\/|data:|mailto:|tel:|#)/.test(url.trim())) {
        return match;
      }
      const newUrl = replacer(url);
      return `url(${quote}${newUrl}${quote})`;
    });
  }

  function replaceRelativeUrlsInHtml(html, baseUrl) {
    return replaceRelativeUrls(html, (url) => {
      return new URL(url, baseUrl).href;
    });
  }

  function replaceRelativeUrlsInCssWithBase(css, cssFileUrl) {
    return replaceRelativeUrlsInCss(css, (url) => {
      if (/^(https?:|\/\/|data:|mailto:|tel:|#)/.test(url.trim())) {
        return url;
      }
      return new URL(url, cssFileUrl).href;
    });
  }

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

  const newName = replaceUnderscoresSpacesAndUppercaseLetters(name);
  const blockName = `${sanitizeAndReplaceLeadingNumbers(replaceUnderscoresSpacesAndUppercaseLetters(prefix))}/${sanitizeAndReplaceLeadingNumbers(replaceUnderscoresSpacesAndUppercaseLetters(name))}`;
  const blockNameHandle = `${prefix}-${newName}`;

  const getPhp = (options) => {
    const { name, prefix, jsFiles, cssFiles } = options;
    const phpName = convertDashesSpacesAndUppercaseToUnderscoresAndLowercase(name);
    const phpPrefix = `${functionSufix}${convertDashesSpacesAndUppercaseToUnderscoresAndLowercase(prefix)}`;
    const tailwindFix = hasTailwindCdnSource(jsFiles) ? 'function forceTailwindUpdate(){let e=setInterval(()=>{if("undefined"!=typeof tailwind){clearInterval(e);let n=document.documentElement.outerHTML;tailwind.config.content=[{raw:n,extension:"html"}]}},100)}forceTailwindUpdate();' : '';
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

  function preprocessSvgAttributes(code) {
    return code.replace(/(<svg[\s\S]*?>[\s\S]*?<\/svg>)/gi, (svgBlock) => {
      let processed = svgBlock.replace(/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)=/g, (match, p1, p2) => {
        const camel = p1 + p2.charAt(0).toUpperCase() + p2.slice(1);
        return camel + '=';
      });
      return processed;
    });
  }

  function unwrapBody(code) {
    try {
      return code.replace(/<\/?(html|body)[^>]*>/gi, '');
    } catch (e) {
      return code;
    }
  }

  function transformBlockFile(blockCode) {
    let test = '';

    try {
      test = babel.transformSync(blockCode, {
        presets: [[presetReact, { pragma: 'wp.element.createElement' }]],
        filename: 'block.js'
      });
    } catch (error) {
      console.log(error);

    }

    return test;
  }

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

    console.log('[CSS BEFORE]', css);


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


    let blockCode = await getBlock(options);

    blockCode = blockCode.replaceAll(' / dangerouslySetInnerHTML', ' dangerouslySetInnerHTML')

    const indexFile = getPhp(options);
    let blockFile = '';

    try {
      blockFile = transformBlockFile(blockCode).code
        ?.replace(/name: \"\{field.name\}\"/g, 'name: field.name')
        ?.replace(/key: \"\{index\}\"/g, 'key: index')
    } catch (error) {

      console.log(error);

    }

    console.log(blockFile);


    if (shouldSaveFiles) {
      try {
        saveFile('style.css', scopedCssFrontend, options);
        saveFile('editor.css', editorStyleFile, options);
        saveFile('scripts.js', `${scriptFile}\n\n${emailTemplate}`, options);
        saveFile('index.php', indexFile, options);
        saveFile('block.js', blockFile, options);
        saveFile('remote-loader.js', '', options);
      } catch (error) {
        console.log(error);

      }
    }

    return {
      'style.css': scopedCssFrontend,
      'editor.css': editorStyleFile,
      'scripts.js': scriptFile,
      'index.php': indexFile,
      'block.js': blockFile,
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
      const newHtml = await extractAssets(htmlContent, {
        basePath,
        saveFile: true,
        verbose: false,
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
    const newPrefix = prefix ? replaceUnderscoresSpacesAndUppercaseLetters(prefix) : 'wp';
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
        const [key, value] = rule.split(':');
        if (!key || !value) return null;
        const camelKey = key.trim().replace(/-([a-z])/g, (_, char) => char.toUpperCase());
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

    return await processEditImages({
      ...options,
      htmlContent: parseContent(content),
    });
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
        setRandomAttributeContent(randomSVGVariable, content.replaceAll('className', 'class'));
        createPanel({
          type: 'svg',
          title: 'SVG Markup',
          attributes: [randomSVGVariable],
        });


        const replacement = getSvgTemplate(fullMatch, group1, group3, randomSVGVariable)

        result += replacement;
      } else {
        result += fullMatch;
      }

      lastIndex = end;
    }

    result += html.slice(lastIndex);

    console.log(result);

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
      `
      : '';
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

    emailTemplate += sendEmailAttr ? getEmailSaveTemplate(formIdAttr) : '';
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
    return editContent.replace(
      /<RichText((.|\n)*?)value=\{(.*?)\}((.|\n)*?)\/>/gi,
      '<RichText.Content value={$3} />'
    )
      .replaceAll('class=', 'className=')
      .replace(
        /<MediaUpload\b[^>]*>([\s\S]*?(<img\b[^>]*>*\/>)[\s\S]*?)\/>/g,
        (_match, _attributes, img) => {
          return img.replace(/onClick={[^}]+}\s*/, '');
        }
      );
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

  const getComponentAttributes = () => {
    return Object.entries(attributes)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `${key}: { ${Object.entries(value).map(([k, v]) => `${k}: \`${v}\``).join(', ')} }`;
        } else {
          return `${key}:\`${value}\``;
        }
      })
      .join(',\n');
  };

  const getEdit = async (options) => {
    let { htmlContent } = options;

    if (htmlContent) {
      options.htmlContent = unwrapBody(htmlContent);
      const postProcessLinks = processLinks(options);
      const postGetEditJsx = await getEditJsxContent(postProcessLinks);
      const preConvert = await postGetEditJsx.replace(/<\/br>/g, '<br/>').replace(/<\/hr>/g, '<hr/>')
      return convert(preConvert)
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
    const edit = await getEdit(settings);
    const save = buildSaveContent(edit);
    const blockPanels = createPanels();

    const output = `
    (function () {
        ${imports}

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
    const linkRegex = /<link\b[^>]*((\brel=["']stylesheet["'])|\bhref=["'][^"']+\.css["'])[^>]*>/gi;

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

    css += styles.map((style) => {
      return `${style.content}`;
    }).join('\n');


    console.log('[CSSFETCHED]', css);



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

    js += scripts.map((script) => script.content).join('\n');

    let {
      basePath = process.cwd(),
      cssFiles = [],
      jsFiles = [],
      name = 'My block',
    } = options;

    const newDir = path.join(basePath, replaceUnderscoresSpacesAndUppercaseLetters(name));

    const $ = cheerio.load(htmlContent, {
      xmlMode: true,
      decodeEntities: false,
    });

    $('head, script, style').remove();

    htmlContent = $('body').html();

    options.html


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

  if (source) {
    htmlContent = replaceRelativeUrlsInHtml(htmlContent, source);
    htmlContent = replaceRelativeUrlsInCssWithBase(htmlContent, source);
  }

  try {
    icon(htmlContent, { basePath: path.join(options.basePath, replaceUnderscoresSpacesAndUppercaseLetters(options.name)) });
  } catch (error) {
    console.log(`There was an error generating preview. ${error.message}`);
  }

  return saveFiles(await setupVariables(htmlContent, options));
};

export default block;