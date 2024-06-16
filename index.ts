import axios from 'axios';
import * as cheerio from 'cheerio';
import convert from 'node-html-to-jsx';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { spawnSync } from 'child_process';
import { Buffer } from 'buffer';
import extractAssets from 'fetch-page-assets';

import { 
  imports, 
  panels, 
  images, 
  browserOptions, 
  userAgent, 
  pageOptions, 
  characters,
  webpackConfig,
  packageJson,
  babelrc,
  editorStyles,
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
  attributes?: string[],
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

interface HtmlValidation {
  hasHTMLTags: boolean,
  hasHeadTags: boolean, 
  hasBodyTags: boolean,
}

interface BlockOptions {
  name: string,
  prefix: string,
  category: string,
  icon?: string,
  basePath?: string,
  cssFiles?: string[],
  jsFiles?: string[],
  generateIcon?: boolean,
  chromePath?: string,
  htmlContent?: string,
}

interface ImageSettings {
  name: string,
  htmlContent: string, 
  basePath?: string, 
  cssFiles?: string[],
  jsFiles?: string[],
}

const attributes: Attributes = {};

const convertName = (name: string): string => {
  const regex = new RegExp(/\W|\s/, 'g');

  return name.replace(regex, '_').toLowerCase();
}

const saveFile = (fileName: string, contents: string, options: BlockOptions): string => {
  const { basePath } = options;
  
  try {
    const filePath = path.join(basePath, fileName);
  
    fs.writeFileSync(filePath, contents);

    return contents;

  } catch (error) {
    logError(error);
  }
}

const parseRequirements = async (files: string[]): Promise<string> => {
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
}

const formCss = async (options: BlockOptions): Promise<string> => {
  const { cssFiles } = options; 
  
  return parseRequirements(cssFiles);
}

const formJs = async (options: BlockOptions): Promise<string> => {
  const { jsFiles } = options; 
  
  return parseRequirements(jsFiles);
}

const getPhp = (options: BlockOptions): string => {
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
}

const saveFiles = async (options: BlockOptions): Promise<string> => {
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
}

const logError = (error: Error): void => {
  console.error(`[Error] ${error.message}`);
}

const generateRandomVariableName = (prefix: string = 'content', length: number = 3): string => {
  let suffix = '';

  for (let i = 0; i < length; i++) {
    suffix += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return `${prefix}${suffix}`;
}

const setAttributeContent = (randomVariableName: string, content: string): void => {
  attributes[randomVariableName] = { type: 'string', default: content };
}

const hasAbsoluteKeyword = (str: string): boolean => {
  return !!(str && str.toLowerCase().includes('absolute'));
};

const getImageTemplate = (image: Image): string => {
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
    />`
}

const replaceHtmlImage = (html: string, image: Image): string => {
  const { randomUrlVariable } = image;
  const regex = new RegExp(`(<img.*?${randomUrlVariable}.*?>)`, 'gi');

  return html.replace(regex, getImageTemplate(image));
}

const replaceImageComponents = (html: string): string => {
  images.forEach((image: Image) => {
    html = replaceHtmlImage(html, image);
  });

  return html;
}

const loadHtml = async (options: BlockOptions): Promise<any> => {
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
}

const getImageSource = (imgTag: any): string => {
  return imgTag.attr('src') || '';
}

const getImageAlt = (imgTag: any): string => {
  return imgTag.attr('alt') || '';
}

const getParentElement = (imgTag: any): any => {
  return imgTag.parent();
}

const getImageStyle = (imgTag: any): string => {
  return imgTag.attr('style') || ''
}

const getImageClass = (imgTag: any): string => {
  return imgTag.attr('class') || imgTag.attr('className') || ''
}

const getPreviousStyle = (parentElement: any): string => {
  return parentElement.attr('style') || ''
}

const getParentClass = (parentElement: any): string => {
  return parentElement.attr('class') || parentElement.attr('className') || '';
}

const isBackgroundImage = (imgStyle: string, imgClass: string, previousStyle: string, previousClass: string): boolean => {
  return hasAbsoluteKeyword(imgStyle) || hasAbsoluteKeyword(imgClass) || hasAbsoluteKeyword(previousStyle) || hasAbsoluteKeyword(previousClass);
}

const getImageProperties = (imgTag: any): ImageProperties => {
  const imgSrc = getImageSource(imgTag);
  const imgAlt = getImageAlt(imgTag);
  const parentElement = getParentElement(imgTag);
  const imgStyle = getImageStyle(imgTag);
  const imgClass = getImageClass(imgTag);
  const previousStyle = getPreviousStyle(parentElement);
  const previousClass = getParentClass(parentElement);
  const isBackground = isBackgroundImage(imgStyle, imgClass, previousStyle, previousClass);

  return { imgTag, imgSrc, imgAlt, imgClass, isBackground };
}

const setImageAttribute = (properties: ImageProperties): string => {
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
}

const processImage = (properties: ImageProperties): void => {
  const { imgClass, type } = properties;

  const randomUrlVariable = setImageAttribute({...properties, attribute: 'src', prefix: 'Url' });
  const randomAltVariable = setImageAttribute({...properties, attribute: 'alt', prefix: 'Alt' });
  
  if (type !== 'background') {
    images.push({ randomUrlVariable, randomAltVariable, imgClass });

    return;
  } 

  createPanel({
    type: 'media',
    title: 'Background Image',
    attributes: [randomUrlVariable, randomAltVariable],
  });
}

const getFixedHtml = (html: string): string => {
  let fixedHTML = html.replace(
    / onChange="{" \(newtext\)=""\>/gi,
    ' onChange={ (newtext) => '
  );

  fixedHTML = fixedHTML.replace(/\<\/RichText\>/gi, '');

  return fixedHTML.replace(/value="{(.*?)}"/gi, 'value={$1}');
}

const processImages = (imgTag: any): void => {
  const properties = getImageProperties(imgTag);
  const { isBackground } = properties;

    if (!isBackground) {
      processImage({...properties, type: 'image' });
      return;
    } 

    processImage({...properties, type: 'background' });
}

const loopImages = ($: any): void => {
  $('img').each((_index: any, img: any): void => {
    processImages($(img));
  });
}

const getHtml = ($: any): string => {
  return $.html({ xml: false, decodeEntities: false });
}

const processEditImages = async (options: BlockOptions): Promise<string> => {
  const $ = await loadHtml(options);

  loopImages($);

  return replaceImageComponents(getFixedHtml(getHtml($)));
}

const getRichTextTemplate = (randomVariable: string, variableContent: string): string => {
  return `
  ><RichText 
    tagName="span"
    value={attributes.${randomVariable}} 
    default="${variableContent.trim()}" 
    onChange={ (newtext) => {
      setAttributes({ ${randomVariable}: newtext });
    }}
  /><`;
}

const convertToRichText = (variableContent: string): string => {
  const randomVariable = generateRandomVariableName('content');

  setAttributeContent(randomVariable, variableContent);

  return getRichTextTemplate(randomVariable, variableContent);
}

const parseContent = (content: string): string => {
  const regex = />([^<]+)</g;

  return content.replace(regex, (match, variableContent) => {
    if (match.replace(/\s\S/g, '').replace(/(<|>)/g, '').trim() === '') {
      return match;
    }

    return convertToRichText(variableContent);
  });
}

const editJsxContent = async (options: BlockOptions): Promise<string> => {
  const { htmlContent } = options;

  options = {
    ...options,
    htmlContent: convert(parseContent(htmlContent))
  }

  return await processEditImages(options);
}

const createPanel = (values: Panel): void => {
  panels.push(values);
}

const getSvgTemplate = (match: string, group1: string, group3: string, randomSVGVariable: string): string => {
  return `
    <svg
       ${group1}
        dangerouslySetInnerHTML={ { __html: attributes.${randomSVGVariable} }}
      >
    ${group3}
    `;
}

const getSvg = (match: string, group1: string, group2: string, group3: string): string => {
  const randomSVGVariable = generateRandomVariableName('svg');

  setAttributeContent(randomSVGVariable, group2);

  createPanel({ 
    type: 'svg',
    title: 'SVG Markup',
    attributes: [randomSVGVariable] 
  });

  return getSvgTemplate(match, group1, group3, randomSVGVariable);
}

const replaceSVGImages = (html: string): string =>  {
  const regex =
    /<\s*svg\b((?:[^>'"]|"[^"]*"|'[^']*')*)>(\s*(?:[^<]|<(?!\/svg\s*>))*)(<\/\s*svg\s*>)/gm;

  return html.replace(regex, (match, group1, group2, group3) => {
    return getSvg(match, group1, group2, group3);
  });
}

const getSvgPanelTemplate = (panel: Panel): string => {
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
}

const getMediaPanelTemplate = (panel: Panel): string => {
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
}

const getPanelTemplate = (panel: Panel): string => {
  const { type } = panel;

  switch (type) {
    case 'svg':
      return getSvgPanelTemplate(panel);
    case 'media':
      return getMediaPanelTemplate(panel);
    default:
      return '';
  }
}

const getPanelsTemplate = (): string => {
  return panels.map((panel: Panel) => {
    return getPanelTemplate(panel);
  }).join('\n');
}

const createPanels = (): string => {
  return `
  <Panel>
    ${getPanelsTemplate()}
  </Panel>`;
}

const getSaveContent = (editContent: string): string => {
  const regex = /<RichText((.|\n)*?)value=\{(.*?)\}((.|\n)*?)\/>/gi;
  return editContent.replace(regex, '<RichText.Content value={$3} />');
}

const saveHtmlContent = (editContent: string): string => {
  const saveContent = getSaveContent(editContent);
  const regex = /className=/gi;

  return saveContent.replace(regex, 'class=');
}

const removeHref = (match: string): string => {
  return match.replace(
    /href="(.*?)"/,
    ''
  );
}

const replaceRichText = (match: string, group1: string, group2: string, group3: string): string => {
  match = removeHref(match);
  
  match = match.replace(
    group1,
    '<span'
  );

  return match.replace(group3, '</span>');
}

const processLinks = (options: BlockOptions): BlockOptions => {
  let { htmlContent } = options;
  const regex = /(<a)[^>]*>([\s\S]*?)(<\/a>)/gim;

  htmlContent = htmlContent.replace(regex, (match, group1, group2, group3) => {
    return replaceRichText(match, group1, group2, group3);
  });

  return {
    ...options,
    htmlContent
  }

}

const transformOnClickEvent = (img: string): string => {
  return img.replace(/onClick={[^}]+}\s*/, '');
}

const processSaveImages = (htmlString: string) => {
  const regex =
    /<MediaUpload\b[^>]*>([\s\S]*?(<img\b[^>]*>*\/>)[\s\S]*?)\/>/g;

  return htmlString.replace(regex, (_match, _attributes, img) => {
    return transformOnClickEvent(img);
  });
}

const getComponentAttributes = (): string => {
  return JSON.stringify(attributes, null, 2);
}

const getEdit = async (options: BlockOptions): Promise<string> => {
  const htmlContent = await editJsxContent(processLinks(options));
  return replaceSVGImages(htmlContent);
}

const getSave = (edit: string): string => {
  return processSaveImages(saveHtmlContent(edit));
}

const getBlock = async (settings: BlockOptions): Promise<string> => {
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
}

const setupVariables = async (htmlContent: string, options: BlockOptions): Promise<BlockOptions> => {
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

    return { ...options, icon, htmlContent, cssFiles, jsFiles, basePath: newDir }
  } catch (error) {
    logError(error);
  }
}

const block = async (htmlContent: string, options: BlockOptions): Promise<string> => {
  const settings = await setupVariables(htmlContent, options);

  return saveFiles(settings);
}

const testHtmlContent = (htmlContent: string): HtmlValidation => {
  const hasHTMLTags = /<html[^>]*>/i.test(htmlContent);
  const hasHeadTags = /<head[^>]*>/i.test(htmlContent);
  const hasBodyTags = /<body[^>]*>/i.test(htmlContent);

  return { hasHTMLTags, hasHeadTags, hasBodyTags };
}

const getNewFiles = (files: string[], existingFiles: Set<any>): string[] => {
  return files.filter((file) => !existingFiles.has(file));
}

const formJsTag = (file: string): string => {
  return `<script src="${file}"></script>`;
}

const formCssTag = (file: string): string => {
  return `<link rel="stylesheet" href="${file}">`;
}

const mapNewFilesAs = (files: string[], type: string): string => {
  return files.map((file) => {
    return type === 'javascript' ? formJsTag(file) : formCssTag(file);
  }).join('\n');
}

const getNewCssFiles = (imageSettings: ImageSettings): string[] => {
  const { htmlContent, cssFiles } = imageSettings;
  const existingCSSFiles = new Set(
    htmlContent.match(/<link[^>]*href="([^"]+)"/gi) || []
  );

  return getNewFiles(cssFiles, existingCSSFiles);
}

const parseCssFiles = (imageSettings: ImageSettings): string => {
  const newCSSFiles = getNewCssFiles(imageSettings);
  
  return mapNewFilesAs(newCSSFiles, 'css');
}

const getNewJsFiles = (imageSettings: ImageSettings): string[] => {
  const { htmlContent, jsFiles } = imageSettings;

  const existingJSFiles = new Set(
    htmlContent.match(/<script[^>]*src="([^"]+)"/gi) || []
  );

  return getNewFiles(jsFiles, existingJSFiles);
}

const parseJsFiles = (imageSettings: ImageSettings): string => {
  const newJSFiles = getNewJsFiles(imageSettings);

  return mapNewFilesAs(newJSFiles, 'javascript');
}

const parseFiles = (imageSettings: ImageSettings): { js: string, css: string } => {
  const css = parseCssFiles(imageSettings);
  const js = parseJsFiles(imageSettings);

  return { js, css };
}

const formHtmlPage = (imageSettings: ImageSettings): string => {
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
}

const configurePage = async (page: any): Promise<void> => {
  await page.setViewport({ height: 300, width: 1440 });
  await page.setUserAgent(userAgent);
}

const openPage = async (page: any, htmlContent: string): Promise<void> => {
  await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`, pageOptions);
}

const getScreenshot = async (page: any): Promise<Buffer> => {
  const clip = await getElementDimensions(page);

  return await page.screenshot({
    clip,
    type: 'jpeg',
    quality: 70
  });
}

const getBufferFromPage = async (browser: any, htmlContent: string): Promise<Buffer> => {
  const page = await browser.newPage();

  await configurePage(page);
  await openPage(page, htmlContent);

  return await getScreenshot(page);
}

const bufferToString = (buffer: Buffer): string => {
  return Buffer.from(buffer).toString('base64');
}

const saveBuffer = (filePath: string, buffer: Buffer): string => {
  fs.writeFileSync(filePath, buffer);

  return bufferToString(buffer);
}

const getImageBuffer = async (browser: any, filePath: string, htmlContent: string): Promise<string> => {
  const imageBuffer = await getBufferFromPage(browser, htmlContent);
  
  await browser.close();

  return saveBuffer(filePath, imageBuffer);
}

const getElementDimensions = async (page: any) => {
  return page.evaluate(async (innerSelector: any) => {
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

const connect = async (browserWSEndpoint: string): Promise<any> => {
  return await puppeteer.connect({ browserWSEndpoint });
}

const saveImage = async (imageSettings: ImageSettings): Promise<string> => {
  const { basePath } = imageSettings;

  const browserWSEndpoint = await launchBrowser();
  const filePath = path.join(basePath, 'preview.jpeg');
  const htmlContent = formHtmlPage(imageSettings);
  const browser = await connect(browserWSEndpoint);
  
  return await getImageBuffer(browser, filePath, htmlContent);
}

const launchBrowser = async (): Promise<string> => {
  const browser = await puppeteer.launch();

  return browser.wsEndpoint();
}

const getIcon = async (imageOptions: ImageSettings): Promise<string> => {
  const icon = await saveImage(imageOptions);

  return `(<img src="data:image/jpeg;base64,${icon}" />)`;
}

const generateImagePreview = async (blockOptions: any): Promise<string> => {
  let { chromePath, generateIcon, icon } = blockOptions;
  
  if (generateIcon && chromePath) {
    try {
      spawnSync(chromePath, browserOptions);
      
      return getIcon(blockOptions);
    } catch (error) {
      logError(error);
    }
  }

  return icon;
}

export default block;