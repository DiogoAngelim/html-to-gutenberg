import axios from 'axios';
import * as cheerio from 'cheerio';
import convert from 'node-html-to-jsx';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { spawnSync } from 'child_process';
import { Buffer } from 'buffer';
import extractAssets from 'fetch-page-assets';
import { imports, panels, images, browserOptions, userAgent, pageOptions, characters, webpackConfig, packageJson, babelrc, editorStyles, } from './globals.js';
;
const attributes = {};
const convertName = (name) => {
    const regex = new RegExp(/\W|\s/, 'g');
    return name.replace(regex, '_').toLowerCase();
};
const saveFile = (fileName, contents, options) => {
    const { basePath } = options;
    try {
        const filePath = path.join(basePath, fileName);
        fs.writeFileSync(filePath, contents);
        return contents;
    }
    catch (error) {
        logError(error);
    }
};
const parseRequirements = async (files) => {
    let output = '';
    for (const file of files) {
        try {
            const { data } = await axios.get(file, { responseType: 'text' });
            output += data;
        }
        catch (error) {
            logError(error);
        }
    }
    return output;
};
const formCss = async (options) => {
    const { cssFiles } = options;
    return parseRequirements(cssFiles);
};
const formJs = async (options) => {
    const { jsFiles } = options;
    return parseRequirements(jsFiles);
};
const getPhp = (options) => {
    const { name, prefix } = options;
    const newName = convertName(name);
    return `
  <?php
  /*
    * Plugin Name:       ${name}
    * Version:           1.0
    * Author:            Diogo Angelim
    * Author URI:        https://github.com/DiogoAngelim/
  */

  if ( ! defined( 'ABSPATH' ) ) {
    exit;
  }

  add_action( 'enqueue_block_editor_assets', '${prefix}_${newName}_editor_assets' );

  function ${prefix}_${newName}_editor_assets() {
    wp_enqueue_script(
      '${prefix}-${newName}',
      plugins_url( 'block.build.js', __FILE__ ),
      array( 'wp-blocks', 'wp-components', 'wp-element' ,'wp-editor'),
      filemtime( plugin_dir_path( __FILE__ ) . 'block.build.js' )
    );

    wp_localize_script( '${prefix}-${newName}', 'vars', array( 'url' => plugin_dir_url( __FILE__ ) ) );

    wp_enqueue_style(
      '${prefix}-${newName}-editor',
      plugins_url( 'editor.css', __FILE__ ),
      array( 'wp-edit-blocks' ),
      filemtime( plugin_dir_path( __FILE__ ) . 'editor.css' )
    );
  }

  add_action( 'enqueue_block_assets', '${prefix}_${newName}_block_assets' );

  function ${prefix}_${newName}_block_assets() {
    $args = array(
      'handle' => '${prefix}-${newName}-frontend',
      'src'    => plugins_url( 'style.css', __FILE__ ),
    );
    
    wp_enqueue_block_style(
      '${prefix}/${newName}',
      $args
    );

    wp_enqueue_script(
      '${prefix}-${newName}-js',
      plugins_url( 'scripts.js', __FILE__ ),
      array(),
      filemtime( plugin_dir_path( __FILE__ ) . 'scripts.js' )
    );

    wp_localize_script( '${prefix}-${newName}-js', 'vars', array( 'url' => plugin_dir_url( __FILE__ ) ) );
  }

  `;
};
const saveFiles = async (options) => {
    const css = await formCss(options);
    const editor = `
    ${editorStyles}

    ${css}
  `;
    saveFile('style.css', css, options);
    saveFile('editor.css', editor, options);
    saveFile('scripts.js', await formJs(options), options);
    saveFile('package.json', packageJson, options);
    saveFile('webpack.config.js', webpackConfig, options);
    saveFile('.babelrc', babelrc, options);
    saveFile('index.php', getPhp(options), options);
    return saveFile('block.js', await getBlock(options), options);
};
const logError = (error) => {
    console.error(`[Error] ${error.message}`);
};
const generateRandomVariableName = (prefix = 'content', length = 3) => {
    let suffix = '';
    for (let i = 0; i < length; i++) {
        suffix += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `${prefix}${suffix}`;
};
const setAttributeContent = (randomVariableName, content) => {
    attributes[randomVariableName] = { type: 'string', default: content };
};
const hasAbsoluteKeyword = (str) => {
    return !!(str && str.toLowerCase().includes('absolute'));
};
const getImageTemplate = (image) => {
    const { randomUrlVariable, randomAltVariable, imgClass } = image;
    return `
    <MediaUpload 
      onSelect={ (media) => { 
        setAttributes({ 
          ${randomUrlVariable}: media.url,
          ${randomAltVariable}: media.alt
        }); 
      } }
      type="image" 
      render={ ({ open }) => (
        <img
          src={ attributes.${randomUrlVariable} } 
          alt={ attributes.${randomAltVariable} } 
          onClick={ open } 
          className="${imgClass}"
        /> 
      )} 
    />`;
};
const replaceHtmlImage = (html, image) => {
    const { randomUrlVariable } = image;
    const regex = new RegExp(`(<img.*?${randomUrlVariable}.*?>)`, 'gi');
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
    const newHtml = await extractAssets(htmlContent, {
        basePath,
        saveFile: false,
        verbose: false,
    });
    return cheerio.load(newHtml, {
        xml: true,
        decodeEntities: false,
    });
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
const isBackgroundImage = (imgStyle, imgClass, previousStyle, previousClass) => {
    return hasAbsoluteKeyword(imgStyle) || hasAbsoluteKeyword(imgClass) || hasAbsoluteKeyword(previousStyle) || hasAbsoluteKeyword(previousClass);
};
const getImageProperties = (imgTag) => {
    const imgSrc = getImageSource(imgTag);
    const imgAlt = getImageAlt(imgTag);
    const parentElement = getParentElement(imgTag);
    const imgStyle = getImageStyle(imgTag);
    const imgClass = getImageClass(imgTag);
    const previousStyle = getPreviousStyle(parentElement);
    const previousClass = getParentClass(parentElement);
    const isBackground = isBackgroundImage(imgStyle, imgClass, previousStyle, previousClass);
    return { imgTag, imgSrc, imgAlt, imgClass, isBackground };
};
const setImageAttribute = (properties) => {
    const { imgTag, imgSrc, imgAlt, attribute, type, prefix } = properties;
    const randomVariable = generateRandomVariableName(`${type}${prefix}`);
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
    const randomUrlVariable = setImageAttribute({ ...properties, attribute: 'src', prefix: 'Url' });
    const randomAltVariable = setImageAttribute({ ...properties, attribute: 'alt', prefix: 'Alt' });
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
    let fixedHTML = html.replace(/ onChange="{" \(newtext\)=""\>/gi, ' onChange={ (newtext) => ');
    fixedHTML = fixedHTML.replace(/\<\/RichText\>/gi, '');
    return fixedHTML.replace(/value="{(.*?)}"/gi, 'value={$1}');
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
    default="${variableContent.trim()}" 
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
    const regex = />([^<]+)</g;
    return content.replace(regex, (match, variableContent) => {
        if (match.replace(/\s\S/g, '').replace(/(<|>)/g, '').trim() === '') {
            return match;
        }
        return convertToRichText(variableContent);
    });
};
const editJsxContent = async (options) => {
    const { htmlContent } = options;
    options = {
        ...options,
        htmlContent: convert(parseContent(htmlContent))
    };
    return await processEditImages(options);
};
const createPanel = (values) => {
    panels.push(values);
};
const getSvgTemplate = (match, group1, group3, randomSVGVariable) => {
    return `
    <svg
       ${group1}
        dangerouslySetInnerHTML={ { __html: attributes.${randomSVGVariable} }}
      >
    ${group3}
    `;
};
const getSvg = (match, group1, group2, group3) => {
    const randomSVGVariable = generateRandomVariableName('svg');
    setAttributeContent(randomSVGVariable, group2);
    createPanel({
        type: 'svg',
        title: 'SVG Markup',
        attributes: [randomSVGVariable]
    });
    return getSvgTemplate(match, group1, group3, randomSVGVariable);
};
const replaceSVGImages = (html) => {
    const regex = /<\s*svg\b((?:[^>'"]|"[^"]*"|'[^']*')*)>(\s*(?:[^<]|<(?!\/svg\s*>))*)(<\/\s*svg\s*>)/gm;
    return html.replace(regex, (match, group1, group2, group3) => {
        return getSvg(match, group1, group2, group3);
    });
};
const getSvgPanelTemplate = (panel) => {
    const { attributes, title } = panel;
    return `
    { (            
    <PanelBody title="${title}">
      <PanelRow>
        <div>
          <TextareaControl
            label="SVG Content"
            help="Enter your SVG content..."
            value={ attributes.${attributes[0]} }
            onChange={ ( value ) => {
              setAttributes({ ${attributes[0]}: value });
            } }
          />
        </div>
      </PanelRow>
    </PanelBody>
    )}
  `;
};
const getMediaPanelTemplate = (panel) => {
    const { title, attributes } = panel;
    return `              
    <PanelBody title="${title}">
      <PanelRow>
        <div>
          <MediaUpload
            onSelect={ (media) => { 
              setAttributes({ 
                ${attributes[0]}: media.url,
                ${attributes[1]}: media.alt
              }); 
            } }
            type="image"
            value={ attributes.${attributes?.[0]} }
            render={({ open }) => (
                <button onClick={ open }>Select Image</button>
            )}
          />
          {attributes.${attributes?.[0]} && (
              <img src={attributes.${attributes?.[0]}} alt={attributes.${attributes?.[1]}} />
          )}
        </div>
      </PanelRow>
    </PanelBody>
    `;
};
const getPanelTemplate = (panel) => {
    const { type } = panel;
    switch (type) {
        case 'svg':
            return getSvgPanelTemplate(panel);
        case 'media':
            return getMediaPanelTemplate(panel);
        default:
            return '';
    }
};
const getPanelsTemplate = () => {
    return panels.map((panel) => {
        return getPanelTemplate(panel);
    }).join('\n');
};
const createPanels = () => {
    return `
  <Panel>
    ${getPanelsTemplate()}
  </Panel>`;
};
const getSaveContent = (editContent) => {
    const regex = /<RichText((.|\n)*?)value=\{(.*?)\}((.|\n)*?)\/>/gi;
    return editContent.replace(regex, '<RichText.Content value={$3} />');
};
const saveHtmlContent = (editContent) => {
    const saveContent = getSaveContent(editContent);
    const regex = /className=/gi;
    return saveContent.replace(regex, 'class=');
};
const removeHref = (match) => {
    return match.replace(/href="(.*?)"/, '');
};
const replaceRichText = (match, group1, group2, group3) => {
    match = removeHref(match);
    match = match.replace(group1, '<span');
    return match.replace(group3, '</span>');
};
const processLinks = (options) => {
    let { htmlContent } = options;
    const regex = /(<a)[^>]*>([\s\S]*?)(<\/a>)/gim;
    htmlContent = htmlContent.replace(regex, (match, group1, group2, group3) => {
        return replaceRichText(match, group1, group2, group3);
    });
    return {
        ...options,
        htmlContent
    };
};
const transformOnClickEvent = (img) => {
    return img.replace(/onClick={[^}]+}\s*/, '');
};
const processSaveImages = (htmlString) => {
    const regex = /<MediaUpload\b[^>]*>([\s\S]*?(<img\b[^>]*>*\/>)[\s\S]*?)\/>/g;
    return htmlString.replace(regex, (_match, _attributes, img) => {
        return transformOnClickEvent(img);
    });
};
const getComponentAttributes = () => {
    return JSON.stringify(attributes, null, 2);
};
const getEdit = async (options) => {
    const htmlContent = await editJsxContent(processLinks(options));
    return replaceSVGImages(htmlContent);
};
const getSave = (edit) => {
    return processSaveImages(saveHtmlContent(edit));
};
const getBlock = async (settings) => {
    const { prefix, name, category, icon } = settings;
    const newName = convertName(name);
    const edit = await getEdit(settings);
    const save = getSave(edit);
    const panels = createPanels();
    let attributes = JSON.stringify(getComponentAttributes(), null, 2);
    attributes = `${JSON.parse(attributes).replace(/"var.url\+\'(.*?)\'(.*?)"/g, 'vars.url+\'$1\'$2')}`;
    return `
    ${imports}

    registerBlockType('${prefix}/${newName}', {
      title: '${newName}',
      icon: ${icon},
      category: '${category}',
      attributes: ${attributes},
      edit(props) {
        const { attributes, setAttributes } = props;

        return (
            <div>
              <InspectorControls>
              ${panels}
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
  `;
};
const setupVariables = async (htmlContent, options) => {
    let { basePath, cssFiles, jsFiles, icon, generateIcon, chromePath, name } = options;
    basePath = basePath || process.cwd();
    cssFiles = cssFiles || [];
    jsFiles = jsFiles || [];
    icon = icon || 'shield';
    generateIcon = typeof generateIcon === 'boolean' ? generateIcon : false;
    if (generateIcon && !chromePath) {
        throw new Error('A path to a chrome executable must be provided.');
    }
    const newDir = path.join(basePath, convertName(name));
    try {
        fs.mkdirSync(newDir, { recursive: true });
        icon = generateIcon && chromePath ? await generateImagePreview({ ...options, htmlContent, cssFiles, jsFiles, basePath: newDir }) : icon;
        return { ...options, icon, htmlContent, cssFiles, jsFiles, basePath: newDir };
    }
    catch (error) {
        logError(error);
    }
};
const block = async (htmlContent, options) => {
    const settings = await setupVariables(htmlContent, options);
    return saveFiles(settings);
};
const testHtmlContent = (htmlContent) => {
    const hasHTMLTags = /<html[^>]*>/i.test(htmlContent);
    const hasHeadTags = /<head[^>]*>/i.test(htmlContent);
    const hasBodyTags = /<body[^>]*>/i.test(htmlContent);
    return { hasHTMLTags, hasHeadTags, hasBodyTags };
};
const getNewFiles = (files, existingFiles) => {
    return files.filter((file) => !existingFiles.has(file));
};
const formJsTag = (file) => {
    return `<script src="${file}"></script>`;
};
const formCssTag = (file) => {
    return `<link rel="stylesheet" href="${file}">`;
};
const mapNewFilesAs = (files, type) => {
    return files.map((file) => {
        return type === 'javascript' ? formJsTag(file) : formCssTag(file);
    }).join('\n');
};
const getNewCssFiles = (imageSettings) => {
    const { htmlContent, cssFiles } = imageSettings;
    const existingCSSFiles = new Set(htmlContent.match(/<link[^>]*href="([^"]+)"/gi) || []);
    return getNewFiles(cssFiles, existingCSSFiles);
};
const parseCssFiles = (imageSettings) => {
    const newCSSFiles = getNewCssFiles(imageSettings);
    return mapNewFilesAs(newCSSFiles, 'css');
};
const getNewJsFiles = (imageSettings) => {
    const { htmlContent, jsFiles } = imageSettings;
    const existingJSFiles = new Set(htmlContent.match(/<script[^>]*src="([^"]+)"/gi) || []);
    return getNewFiles(jsFiles, existingJSFiles);
};
const parseJsFiles = (imageSettings) => {
    const newJSFiles = getNewJsFiles(imageSettings);
    return mapNewFilesAs(newJSFiles, 'javascript');
};
const parseFiles = (imageSettings) => {
    const css = parseCssFiles(imageSettings);
    const js = parseJsFiles(imageSettings);
    return { js, css };
};
const formHtmlPage = (imageSettings) => {
    const { htmlContent } = imageSettings;
    const { hasHTMLTags, hasHeadTags, hasBodyTags } = testHtmlContent(htmlContent);
    const { js, css } = parseFiles(imageSettings);
    let htmlPage = '';
    if (!hasHTMLTags) {
        htmlPage += `<!DOCTYPE html><html lang="en">`;
    }
    if (!hasHeadTags) {
        htmlPage += `<head>${css}${js}</head>`;
    }
    if (!hasBodyTags) {
        htmlPage += `<body>`;
    }
    htmlPage += htmlContent;
    if (hasHeadTags) {
        htmlPage += `${css}${js}`;
    }
    if (!hasBodyTags) {
        htmlPage += `</body>`;
    }
    if (!hasHTMLTags) {
        htmlPage += `</html>`;
    }
    return htmlPage;
};
const configurePage = async (page) => {
    await page.setViewport({ height: 300, width: 1440 });
    await page.setUserAgent(userAgent);
};
const openPage = async (page, htmlContent) => {
    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`, pageOptions);
};
const getScreenshot = async (page) => {
    const clip = await getElementDimensions(page);
    return await page.screenshot({
        clip,
        type: 'jpeg',
        quality: 70
    });
};
const getBufferFromPage = async (browser, htmlContent) => {
    const page = await browser.newPage();
    await configurePage(page);
    await openPage(page, htmlContent);
    return await getScreenshot(page);
};
const bufferToString = (buffer) => {
    return Buffer.from(buffer).toString('base64');
};
const saveBuffer = (filePath, buffer) => {
    fs.writeFileSync(filePath, buffer);
    return bufferToString(buffer);
};
const getImageBuffer = async (browser, filePath, htmlContent) => {
    const imageBuffer = await getBufferFromPage(browser, htmlContent);
    await browser.close();
    return saveBuffer(filePath, imageBuffer);
};
const getElementDimensions = async (page) => {
    return page.evaluate(async (innerSelector) => {
        const elem = document.querySelector(innerSelector);
        if (!elem) {
            throw new Error("element not found");
        }
        elem.scrollIntoViewIfNeeded();
        const boundingBox = elem.getBoundingClientRect();
        return {
            width: Math.round(boundingBox.width),
            height: Math.round(boundingBox.height),
            x: Math.round(boundingBox.x),
            y: Math.round(boundingBox.y),
        };
    }, 'body');
};
const connect = async (browserWSEndpoint) => {
    return await puppeteer.connect({ browserWSEndpoint });
};
const saveImage = async (imageSettings) => {
    const { basePath } = imageSettings;
    const browserWSEndpoint = await launchBrowser();
    const filePath = path.join(basePath, 'preview.jpeg');
    const htmlContent = formHtmlPage(imageSettings);
    const browser = await connect(browserWSEndpoint);
    return await getImageBuffer(browser, filePath, htmlContent);
};
const launchBrowser = async () => {
    const browser = await puppeteer.launch();
    return browser.wsEndpoint();
};
const getIcon = async (imageOptions) => {
    const icon = await saveImage(imageOptions);
    return `(<img src="data:image/jpeg;base64,${icon}" />)`;
};
const generateImagePreview = async (blockOptions) => {
    let { chromePath, generateIcon, icon } = blockOptions;
    if (generateIcon && chromePath) {
        try {
            spawnSync(chromePath, browserOptions);
            return getIcon(blockOptions);
        }
        catch (error) {
            logError(error);
        }
    }
    return icon;
};
export default block;
const htmlContent = `
<div class="relative bg-white overflow-hidden">
  <div class="hidden lg:block lg:absolute lg:inset-0" aria-hidden="true">
    <svg class="absolute top-0 left-1/2 transform translate-x-64 -translate-y-8" width="640" height="784" fill="none" viewBox="0 0 640 784">
      <defs>
        <pattern id="9ebea6f4-a1f5-4d96-8c4e-4c2abf658047" x="118" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="4" height="4" class="text-gray-200" fill="currentColor" />
        </pattern>
      </defs>
      <rect y="72" width="640" height="640" class="text-gray-50" fill="currentColor" />
      <rect x="118" width="404" height="784" fill="url(#9ebea6f4-a1f5-4d96-8c4e-4c2abf658047)" />
    </svg>
  </div>
  <div class="relative pt-6 pb-16 sm:pb-24 lg:pb-32">
    <div>
      <nav class="relative max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6" aria-label="Global">
        <div class="flex items-center flex-1">
          <div class="flex items-center justify-between w-full md:w-auto">
            <a href="#">
              <span class="sr-only">Workflow</span>
              <img class="h-8 w-auto sm:h-10" src="https://tailwindui.com/img/logos/workflow-mark-indigo-600.svg" alt="">
            </a>
            <div class="-mr-2 flex items-center md:hidden">
              <button type="button" class="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500" aria-expanded="false">
                <span class="sr-only">Open main menu</span>
                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
          <div class="hidden md:block md:ml-10 md:space-x-10">
            <a href="#" class="font-medium text-gray-500 hover:text-gray-900">Product</a>

            <a href="#" class="font-medium text-gray-500 hover:text-gray-900">Features</a>

            <a href="#" class="font-medium text-gray-500 hover:text-gray-900">Marketplace</a>

            <a href="#" class="font-medium text-gray-500 hover:text-gray-900">Company</a>
          </div>
        </div>
        <div class="hidden md:block text-right">
          <span class="inline-flex rounded-md shadow-md ring-1 ring-black ring-opacity-5">
            <a href="#" class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50"> Log in </a>
          </span>
        </div>
      </nav>
      <div class="absolute z-10 top-0 inset-x-0 p-2 transition transform origin-top-right md:hidden">
        <div class="rounded-lg shadow-md bg-white ring-1 ring-black ring-opacity-5 overflow-hidden">
          <div class="px-5 pt-4 flex items-center justify-between">
            <div>
              <img class="h-8 w-auto" src="https://tailwindui.com/img/logos/workflow-mark-indigo-600.svg" alt="">
            </div>
            <div class="-mr-2">
              <button type="button" class="bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                <span class="sr-only">Close main menu</span>
                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div class="px-2 pt-2 pb-3 space-y-1">
            <a href="#" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">Product</a>

            <a href="#" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">Features</a>

            <a href="#" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">Marketplace</a>

            <a href="#" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">Company</a>
          </div>
          <a href="#" class="block w-full px-5 py-3 text-center font-medium text-indigo-600 bg-gray-50 hover:bg-gray-100"> Log in </a>
        </div>
      </div>
    </div>

    <main class="mt-16 mx-auto max-w-7xl px-4 sm:mt-24 sm:px-6 lg:mt-32">
      <div class="lg:grid lg:grid-cols-12 lg:gap-8">
        <div class="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
          <h1>
            <span class="block text-sm font-semibold uppercase tracking-wide text-gray-500 sm:text-base lg:text-sm xl:text-base">Coming soon</span>
            <span class="mt-1 block text-4xl tracking-tight font-extrabold sm:text-5xl xl:text-6xl">
              <span class="block text-gray-900">Data to enrich your</span>
              <span class="block text-indigo-600">online business</span>
            </span>
          </h1>
          <p class="mt-3 text-base text-gray-500 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo. Elit sunt amet fugiat veniam occaecat fugiat aliqua ad ad non deserunt sunt.</p>
          <div class="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
            <p class="text-base font-medium text-gray-900">Sign up to get notified when it’s ready.</p>
            <form action="#" method="POST" class="mt-3 sm:flex">
              <label for="email" class="sr-only">Email</label>
              <input type="email" name="email" id="email" class="block w-full py-3 text-base rounded-md placeholder-gray-500 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:flex-1 border-gray-300" placeholder="Enter your email">
              <button type="submit" class="mt-3 w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-800 shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:flex-shrink-0 sm:inline-flex sm:items-center sm:w-auto">Notify me</button>
            </form>
            <p class="mt-3 text-sm text-gray-500">
              We care about the protection of your data. Read our
              <a href="#" class="font-medium text-gray-900 underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
        <div class="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
          <svg class="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-8 scale-75 origin-top sm:scale-100 lg:hidden" width="640" height="784" fill="none" viewBox="0 0 640 784" aria-hidden="true">
            <defs>
              <pattern id="4f4f415c-a0e9-44c2-9601-6ded5a34a13e" x="118" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="4" height="4" class="text-gray-200" fill="currentColor" />
              </pattern>
            </defs>
            <rect y="72" width="640" height="640" class="text-gray-50" fill="currentColor" />
            <rect x="118" width="404" height="784" fill="url(#4f4f415c-a0e9-44c2-9601-6ded5a34a13e)" />
          </svg>
          <div class="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
            <button type="button" class="relative block w-full bg-white rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <span class="sr-only">Watch our video to learn more</span>
              <img class="w-full" src="https://images.unsplash.com/photo-1556740758-90de374c12ad?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80" alt="">
              <div class="absolute inset-0 w-full h-full flex items-center justify-center" aria-hidden="true">
                <svg class="h-20 w-20 text-indigo-500" fill="currentColor" viewBox="0 0 84 84">
                  <circle opacity="0.9" cx="42" cy="42" r="42" fill="white" />
                  <path d="M55.5039 40.3359L37.1094 28.0729C35.7803 27.1869 34 28.1396 34 29.737V54.263C34 55.8604 35.7803 56.8131 37.1094 55.9271L55.5038 43.6641C56.6913 42.8725 56.6913 41.1275 55.5039 40.3359Z" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</div>
`;
