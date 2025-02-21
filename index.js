import axios from 'axios';
import * as cheerio from 'cheerio';
import convert from 'node-html-to-jsx';
import fs from 'fs';
import path from 'path';
import extractAssets from 'fetch-page-assets';
import icon from 'html-screenshots';
import imageToBase64 from 'image-to-base64';
import {
  imports,
  panels,
  images,
  characters,
  webpackConfig,
  packageJson,
  babelrc,
  editorStyles,
} from './globals.js';

let css = '';
let js = '';
const scripts = [];
const styles = [];
const block = async (
  htmlContent,
  options = {
    name: 'My block',
    prefix: 'uai',
    category: 'common',
    basePath: process.cwd(),
  }
) => {
  const attributes = {};
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
      return `${string.replaceAll('-', '_')}${generateRandomVariableName(
        'func',
        3
      )}`;
    }

    return '';
  };
  const getPhp = (options) => {
    const { name, prefix } = options;
    const newName = convertName(name);
    const phpName = convertToUnderscores(name);
    const phpPrefix = convertToUnderscores(prefix);
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

    add_action( 'enqueue_block_editor_assets', '${phpPrefix}_${phpName}_editor_assets' );

      function ${phpPrefix}_${phpName}_editor_assets() {
      $filepath = plugin_dir_path(__FILE__) . 'block.build.js';
      $version = file_exists($filepath) ? filemtime($filepath) : time();

      wp_enqueue_script(
        '${prefix}-${newName}',
        plugins_url( 'block.build.js', __FILE__ ),
        array( 'wp-blocks', 'wp-components', 'wp-element' ,'wp-editor'),
        $version
      );

      wp_localize_script( '${prefix}-${newName}', 'vars', array( 'url' => plugin_dir_url( __FILE__ ) ) );

      $filepath = plugin_dir_path(__FILE__) . 'editor.css';
      $version = file_exists($filepath) ? filemtime($filepath) : time();

      wp_enqueue_style(
        '${prefix}-${newName}-editor',
        plugins_url( 'editor.css', __FILE__ ),
        array( 'wp-edit-blocks' ),
        $version
      );
    }

    add_action( 'enqueue_block_assets', '${phpPrefix}_${phpName}_block_assets' );

    function ${phpPrefix}_${phpName}_block_assets() {
      $args = array(
        'handle' => '${prefix}-${newName}-frontend',
        'src'    => plugins_url( 'style.css', __FILE__ ),
      );
      
      wp_enqueue_block_style(
        '${prefix}/${newName}',
        $args
      );

      $filepath = plugin_dir_path(__FILE__) . 'script.js';
      $version = file_exists($filepath) ? filemtime($filepath) : time();

      wp_enqueue_script(
        '${prefix}-${newName}-js',
        plugins_url( 'scripts.js', __FILE__ ),
        array(),
        $version
      );

      wp_localize_script( '${prefix}-${newName}-js', 'vars', array( 'url' => plugin_dir_url( __FILE__ ) ) );
    }

    `;
  };
  const setEditor = (css) => {
    return `
      ${editorStyles}

      ${css}
    `;
  };
  const saveFiles = async (options) => {
    const { cssFiles = [] } = options;
    css += await parseRequirements(cssFiles);

    saveFile('style.css', css, options);
    saveFile('editor.css', setEditor(css), options);
    saveFile('scripts.js', js, options);
    saveFile('package.json', packageJson, options);
    saveFile('webpack.config.js', webpackConfig, options);
    saveFile('.babelrc', babelrc, options);
    saveFile('index.php', getPhp(options), options);
    return saveFile('block.js', await getBlock(htmlContent, options), options);
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
    if (htmlContent) {
      const newHtml = await extractAssets(htmlContent, {
        basePath,
        saveFile: false,
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
    content = `<div>${content}</div>`;
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
  const replaceSVGImages = (html) => {
    return html.replace(
      /<\s*svg\b((?:[^>'"]|"[^"]*"|'[^']*')*)>(\s*(?:[^<]|<(?!\/svg\s*>))*)(<\/\s*svg\s*>)/gim,
      (match, group1, group2, group3) => {
        const content = group2.trim();
        if (content) {
          const randomSVGVariable = generateRandomVariableName('svg');
          setAttributeContent(randomSVGVariable, content);
          createPanel({
            type: 'svg',
            title: 'SVG Markup',
            attributes: [randomSVGVariable],
          });
          return getSvgTemplate(match, group1, group3, randomSVGVariable);
        }
        return match;
      }
    );
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
                  <button onClick={ open }>Select Image</button>
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
    const htmlContent = options.htmlContent
      ? options.htmlContent.replace(
          /(<a)[^>]*>([\s\S]*?)(<\/a>)/gim,
          replaceRichText
        )
      : undefined;
    return {
      ...options,
      htmlContent,
    };
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
      return replaceSVGImages(htmlContent);
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
    ).replace(/"var.url\+\'(.*?)\'(.*?)"/g, "vars.url+'$1'$2")}`;
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
        ${imports}

        registerBlockType('${newPrefix}/${newName}', {
            title: '${newName}',
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
        `;
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
      styles.push({ type: 'inline', content: cssContent });
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

    css = styles.map((style) => style.content).join('\n');

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
      fetchPromises.push(fetchJsPromise);
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
