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
