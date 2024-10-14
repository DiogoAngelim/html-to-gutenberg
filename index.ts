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
  editorStyles
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
  generateIconPreview?: boolean,
  cssFiles?: string[],
  jsFiles?: string[],
}

const block = async (htmlContent: string, options: BlockOptions = { name: 'My block', prefix: 'uai', category: 'common', basePath: process.cwd() }): Promise<string> => {
  const attributes: Attributes = {};

  const convertName = (name: string): string => {
    return name.replace(new RegExp(/\W|_/, 'g'), '-').toLowerCase();
  }

  const saveFile = (fileName: string, contents: string, options: BlockOptions): any => {
    try {
      const filePath = path.join(options.basePath, fileName);

      fs.writeFileSync(filePath, contents);

      return contents;

    } catch (error: any) {
      logError(error);
    }
  }

  const parseRequirements = async (files: string[]): Promise<string> => {
    let output = '';

    for (const file of files) {
      try {
        const { data } = await axios.get(file, { responseType: 'text' });

        output += data;
      } catch (error: any) {
        logError(error);
      }
    }

    return output;
  }

  const convertToUnderscores = (string: string): string => {
    return `${string.replaceAll('-', '_')}${generateRandomVariableName('func', 3)}`;
  }

  const getPhp = (options: BlockOptions): string => {
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
  }

  const setEditor = (css: string): string => {
    return `
      ${editorStyles}

      ${css}
    `;
  }

  const saveFiles = async (options: BlockOptions): Promise<string> => {
    const { cssFiles = [] } = options;

    const css = await parseRequirements(cssFiles);

    saveFile('style.css', css, options);
    saveFile('editor.css', setEditor(css), options);

    saveFile('scripts.js', '', options);
    saveFile('package.json', packageJson, options);
    saveFile('webpack.config.js', webpackConfig, options);
    saveFile('.babelrc', babelrc, options);
    saveFile('index.php', getPhp(options), options);

    return saveFile('block.js', (await getBlock(htmlContent, options)), options);
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
    const parentElement = getParentElement(imgTag);
    const imgStyle = getImageStyle(imgTag);
    const imgClass = getImageClass(imgTag);
    const previousStyle = getPreviousStyle(parentElement);
    const previousClass = getParentClass(parentElement);
    const isBackground = isBackgroundImage(imgStyle, imgClass, previousStyle, previousClass);

    return {
      imgTag,
      imgClass,
      isBackground,
      imgSrc: getImageSource(imgTag),
      imgAlt: getImageAlt(imgTag),
    };
  }

  const setImageAttribute = (properties: ImageProperties): string => {
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
  }

  const processImage = (properties: ImageProperties): void => {
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
  }

  const getFixedHtml = (html: string): string => {
    return html.replace(/ onChange="{" \(newtext\)=""\>/gi, ' onChange={ (newtext) => ').replace(/\<\/RichText\>/gi, '').replace(/value="{(.*?)}"/gi, 'value={$1}').replace(/"{attributes.(.*?)}"/gi, '{attributes.$1}');
  }

  const processImages = (imgTag: any): void => {
    const properties = getImageProperties(imgTag);
    const { isBackground } = properties;

    if (!isBackground) {
      processImage({ ...properties, type: 'image' });
      return;
    }

    processImage({ ...properties, type: 'background' });
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
    return content.replace(/>([^<]+)</g, (match, variableContent) => {
      if (match.replace(/\s\S/g, '').replace(/(<|>)/g, '').trim() === '') {
        return match;
      }

      return convertToRichText(variableContent);
    });
  }

  const editJsxContent = async (options: BlockOptions): Promise<string> => {
    let content;

    if (options.htmlContent) {
      content = options.htmlContent.replaceAll(/<!--(.*?)-->/sg, '');
    }

    content = `<div>${content}</div>`;

    return await processEditImages({ ...options, htmlContent: convert(parseContent(content)) });
  }

  const createPanel = (values: Panel): void => {
    if (values.attributes && values.attributes.length > 0) {
      panels.push(values);
    }
  }

  const getSvgTemplate = (_match: string, group1: string, group3: string, randomSVGVariable: string): string => {
    return `
      <svg
        ${group1}
          dangerouslySetInnerHTML={ { __html: attributes.${randomSVGVariable} }}
        >
      ${group3}
      `;
  }

  const replaceSVGImages = (html: string): string => {
    return html.replace(/<\s*svg\b((?:[^>'"]|"[^"]*"|'[^']*')*)>(\s*(?:[^<]|<(?!\/svg\s*>))*)(<\/\s*svg\s*>)/gim, (match: string, group1: string, group2: string, group3: string): string => {
      const content = group2.trim();

      if (content) {
        const randomSVGVariable = generateRandomVariableName('svg');

        setAttributeContent(randomSVGVariable, content);

        createPanel({
          type: 'svg',
          title: 'SVG Markup',
          attributes: [randomSVGVariable]
        })

        return getSvgTemplate(match, group1, group3, randomSVGVariable);
      }

      return match;
    });
  }

  const getSvgPanelTemplate = (panel: Panel): string => {
    return panel.attributes && attributes[panel.attributes] ? `
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
  ` : '';

  }

  const getMediaPanelTemplate = (panel: Panel): string => {
    const mediaAtts = panel.attributes?.[0] && panel.attributes[1] ? `${panel.attributes[0]}: media.url,
                   ${panel.attributes[1]}: media.alt` : '';

    return panel.attributes && panel.attributes[0] && attributes[panel.attributes[0]] ? `              
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
      ` : '';
  }

  const getPanelTemplate = (panel: Panel): string => {
    switch (panel.type) {
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
    return editContent.replace(/<RichText((.|\n)*?)value=\{(.*?)\}((.|\n)*?)\/>/gi, '<RichText.Content value={$3} />');
  }

  const saveHtmlContent = (editContent: string): string => {
    return getSaveContent(editContent).replace(/className=/gi, 'class=');
  }

  const removeHref = (match: string): string => {
    return match.replace(/href="(.*?)"/, '');
  }

  const replaceRichText = (match: string, group1: string, _group2: string, group3: string): string => {
    return removeHref(match).replace(group1, '<span').replace(group3, '</span>');
  }

  const processLinks = (options: BlockOptions): BlockOptions => {
    const htmlContent = options.htmlContent ? options.htmlContent.replace(/(<a)[^>]*>([\s\S]*?)(<\/a>)/gim, replaceRichText) : undefined;

    return {
      ...options,
      htmlContent,
    }
  }

  const transformOnClickEvent = (img: string): string => {
    return img.replace(/onClick={[^}]+}\s*/, '');
  }

  const processSaveImages = (htmlString: string) => {
    return htmlString.replace(/<MediaUpload\b[^>]*>([\s\S]*?(<img\b[^>]*>*\/>)[\s\S]*?)\/>/g, (_match, _attributes, img) => transformOnClickEvent(img));
  }

  const getComponentAttributes = (): string => {
    return JSON.stringify(attributes, null, 2);
  }

  const getEdit = async (options: BlockOptions): Promise<string> => {
    let { htmlContent } = options

    if (htmlContent) {
      htmlContent = await editJsxContent(processLinks(options))
      return replaceSVGImages(htmlContent);
    }

    return '';
  }

  const getSave = (edit: string): string => {
    return processSaveImages(saveHtmlContent(edit));
  }

  const getBlock = async (htmlContent: string, settings: BlockOptions): Promise<string> => {
    let { prefix, name, category, generateIconPreview, basePath, cssFiles, jsFiles } = settings;
    const newName = convertName(name);
    const newPrefix = convertName(prefix);

    cssFiles = cssFiles || [];
    jsFiles = jsFiles || [];

    let iconPreview = '\'shield\'';
    let edit = await getEdit(settings);
    edit = edit.replace(/dangerouslySetInnerHTML="{" {="" __html:="" (.*?)="" }}=""/gm, `dangerouslySetInnerHTML={{ __html: $1 }}`);
    const save = getSave(edit);
    const blockPanels = createPanels();
    const blockAttributes = `${JSON.parse(JSON.stringify(getComponentAttributes(), null, 2)).replace(/"var.url\+\'(.*?)\'(.*?)"/g, 'vars.url+\'$1\'$2')}`;

    if (generateIconPreview) {
      try {
        await icon(htmlContent, { basePath, cssFiles, jsFiles })
        iconPreview = `(<img src="data:image/jpeg;base64,${await imageToBase64(path.join(basePath, 'preview.jpeg'))}" />)`;
      } catch (error: any) {
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
  }

  const setupVariables = async (htmlContent: string, options: BlockOptions): Promise<any> => {
    let { basePath = process.cwd(), cssFiles = [], jsFiles = [], name = 'My block' } = options;

    const newDir = path.join(basePath, convertName(name));

    try {
      fs.mkdirSync(newDir, { recursive: true });

      return {
        ...options,
        jsFiles,
        cssFiles,
        htmlContent,
        basePath: newDir
      }
    } catch (error: any) {
      logError(error);
    }
  }

  return saveFiles(await setupVariables(htmlContent, options));
}

export default block;