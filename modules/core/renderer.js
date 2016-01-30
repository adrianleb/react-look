import StyleContainer from '../utils/StyleContainer'
import generateClassName from '../utils/generateClassName'
import sortPseudoClasses from '../utils/sortPseudoClasses'
import isMediaQuery from '../utils/isMediaQuery'
import isPseudo from '../utils/isPseudo'

/**
 * Extracts all possible dynamic styles out of a style object
 * To be able to render all other (static) styles directly to CSS
 * @param {Object} styles - pure style object which gets parsed
 */
export function extractDynamicStyles(styles) {
  return Object.keys(styles).reduce((dynamic, property) => {
    const value = styles[property]; // eslint-disable-line
    const valueType = typeof value

    if (valueType === 'object' && !Array.isArray(value)) {
      // only consider pseudo classes and media queries
      // that contain inner dynamic styles
      if (isPseudo(property) || isMediaQuery(property)) {
        const valueCount = Object.keys(value).length

        const innerDynamic = extractDynamicStyles(value)
        const innerDynamicCount = Object.keys(innerDynamic).length

        // if the inner styles contain dynamic styles
        // extract them into the output object
        if (innerDynamicCount > 0) {
          dynamic[property] = innerDynamic
        }

        // Remove the property if all inner styles
        // are actually dynamic styles
        if (innerDynamicCount === valueCount) {
          delete styles[property]
        }
      } else {
        dynamic[property] = value
        delete styles[property]
      }
    }

    // function are considered stateful styles and therefore
    // treated as dynamic styles
    if (valueType === 'function') {
      dynamic[property] = value
      delete styles[property]
    }

    return dynamic; // eslint-disable-line
  }, { })
}

/**
 * Renders special styles as pseudo classes and media queries
 * and adds them to the CSS StyleContainer
 * @param {string} selector - base selector used as className
 * @param {Object} styles - static styles containing special extensions
 * @param {string} pseudo - prior outer pseudo class
 * @param {string} media - prior outer media query
 */
export function renderSpecialStyles(selector, styles, pseudo = '', media = '') {
  return Object.keys(styles).sort(sortPseudoClasses).reduce((extension, property) => {
    const value = styles[property]
    if (typeof value === 'object') {
      if (isPseudo(property)) {
        const innerStyles = renderSpecialStyles(selector, value, pseudo + property, media)
        // Adds a pseudo class to an existing selector
        StyleContainer.add('.' + selector + pseudo + property, innerStyles, media)
      }
      if (isMediaQuery(property)) {
        // Concatenate multiple media queries if a media query already exists
        const newMedia = (media !== '' ? ' and' : '') + property.replace('@media', '')
        const innerStyles = renderSpecialStyles(selector, value, pseudo, newMedia)
        // Adds the selector to the media group
        StyleContainer.add('.' + selector + pseudo, innerStyles, newMedia)
      }
    } else {
      extension[property] = value
    }
    return extension; // eslint-disable-line
  }, { })
}


/**
 * Renders static styles to the CSS StyleContainer
 * and directly scopes them to the Component
 * @param {Object} styles - static styles to be rendered
 * @param {string} scope - scope selector
 * @param {string} selector - base selector used as className
 */
export default function renderStaticStyles(styles, scope, selector) {
  // Extracts dynamic parts remaining only static styles
  const dynamicStyles = extractDynamicStyles(styles)

  // Determines the base styles used to generate the className
  const baseStyles = Object.keys(styles).reduce((base, property) => {
    const value = styles[property]
    if (typeof value !== 'object' || Array.isArray(value)) {
      base[property] = value
      delete styles[property]
    }
    return base; // eslint-disable-line
  }, { })

  // Generate a unique className based on the base styles
  const className = scope + '-' + (selector || 'default') + '-' + generateClassName(baseStyles)

  // Add the className to the global style container if it has styles
  if (Object.keys(baseStyles).length > 0) {
    StyleContainer.add('.' + className, baseStyles)
  }

  // Also add the dynamic styles if they exist
  if (Object.keys(dynamicStyles).length > 0) {
    StyleContainer.addDynamic(className, dynamicStyles)
  }

  // Renders pseudo classes and media queries to the style container
  renderSpecialStyles(className, styles)

  return className
}