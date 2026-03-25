import * as cheerio from 'cheerio';

/**
 * Process SVG to adjust dimensions based on line count
 * Similar to Markless implementation
 */
export function processSvg(svgString: string, height: number): string {
  const $ = cheerio.load(svgString, { xmlMode: true });
  const svgNode = $('svg').first();
  
  if (svgNode.length === 0) {
    return svgString;
  }

  // Get original dimensions from height attribute or viewBox
  // Note: width might be "100%" which we need to handle
  const widthAttr = svgNode.attr('width') || '0';
  let originalHeight = parseFloat(svgNode.attr('height') || '0');
  let originalWidth = widthAttr === '100%' ? 0 : parseFloat(widthAttr) || 0;
  
  // If height/width not in attributes, try viewBox
  if ((originalHeight === 0 || originalWidth === 0) && svgNode.attr('viewBox')) {
    const viewBox = svgNode.attr('viewBox')!.split(/\s+/);
    if (viewBox.length >= 4) {
      const viewBoxWidth = parseFloat(viewBox[2]) || 0;
      const viewBoxHeight = parseFloat(viewBox[3]) || 0;
      if (originalWidth === 0 && viewBoxWidth > 0) {
        originalWidth = viewBoxWidth;
      }
      if (originalHeight === 0 && viewBoxHeight > 0) {
        originalHeight = viewBoxHeight;
      }
    }
  }
  
  // Fix invalid viewBox with zero width (bug in Mermaid gantt charts)
  // IMPORTANT: Preserve the original viewBox origin (min-x, min-y) to avoid mirroring
  const currentViewBox = svgNode.attr('viewBox');
  if (currentViewBox) {
    const viewBoxParts = currentViewBox.split(/\s+/);
    if (viewBoxParts.length >= 4) {
      const viewBoxMinX = parseFloat(viewBoxParts[0]) || 0;
      const viewBoxMinY = parseFloat(viewBoxParts[1]) || 0;
      const viewBoxWidth = parseFloat(viewBoxParts[2]) || 0;
      const viewBoxHeight = parseFloat(viewBoxParts[3]) || 0;
      
      // If viewBox width is 0, fix it by using calculated width or minimum
      if (viewBoxWidth === 0 && viewBoxHeight > 0) {
        // Try to get width from SVG content bounds, or use a calculated width
        let fixedWidth = originalWidth;
        
        // If we still don't have a width, calculate from aspect ratio or use minimum
        if (fixedWidth === 0) {
          // For gantt charts, we need a wider viewBox to accommodate the content
          // Gantt charts often have content that extends beyond the initial viewBox
          // Use a wider aspect ratio (at least 3:1) to ensure content fits
          // Also account for potential negative coordinates by using a larger width
          fixedWidth = Math.max(600, viewBoxHeight * 3);
        }
        
        // Fix the viewBox attribute - preserve original origin coordinates
        // For gantt charts with negative coordinates, we might need to adjust min-x
        // But to avoid mirroring, we'll keep the original origin
        const fixedViewBox = `${viewBoxMinX} ${viewBoxMinY} ${fixedWidth} ${viewBoxHeight}`;
        svgNode.attr('viewBox', fixedViewBox);
        
        // Always update originalWidth and width attribute when fixing viewBox
        // This ensures we have valid dimensions for later calculations
        originalWidth = fixedWidth;
        // Remove percentage-based width and set explicit pixel value
        svgNode.attr('width', `${fixedWidth}`);
        
      }
    }
  }
  
  // Calculate width from aspect ratio using height as the limiting factor
  // Formula: newWidth = (originalWidth / originalHeight) * limitingHeight
  // This maintains aspect ratio for both wide and tall charts
  // Use viewBox dimensions if available, as they're more reliable
  let calculatedWidth: number | undefined;
  let aspectRatio: number | undefined;
  
  // Get final dimensions from viewBox if available (after any fixes)
  // Re-read viewBox after potential fix to ensure we have the latest value
  const finalViewBox = svgNode.attr('viewBox');
  if (finalViewBox) {
    const viewBoxParts = finalViewBox.split(/\s+/);
    if (viewBoxParts.length >= 4) {
      const viewBoxWidth = parseFloat(viewBoxParts[2]) || 0;
      const viewBoxHeight = parseFloat(viewBoxParts[3]) || 0;
      if (viewBoxWidth > 0 && viewBoxHeight > 0) {
        // Use viewBox dimensions for aspect ratio (most reliable)
        aspectRatio = viewBoxWidth / viewBoxHeight;
        calculatedWidth = aspectRatio * height;
        // Update originalWidth to match fixed viewBox for consistency
        if (originalWidth === 0 || originalWidth !== viewBoxWidth) {
          originalWidth = viewBoxWidth;
        }
      }
    }
  }
  
  // Fallback to attribute dimensions if viewBox calculation didn't work
  if (!calculatedWidth && originalWidth > 0 && originalHeight > 0) {
    aspectRatio = originalWidth / originalHeight;
    calculatedWidth = aspectRatio * height;
  }
  
  // Final fallback: use reasonable default
  // Ensure calculatedWidth is always assigned
  if (!calculatedWidth || calculatedWidth <= 0) {
    // For wide charts (like gantt), assume at least 2:1 ratio
    calculatedWidth = Math.max(400, height * 2);
    if (!aspectRatio) {
      aspectRatio = calculatedWidth / height;
    }
  }

  // Set explicit width and height attributes to maintain aspect ratio
  // Remove any CSS max-width that might constrain wide charts
  svgNode.css('max-width', '');
  
  // Set dimensions - but preserve the original viewBox to avoid mirroring
  // The viewBox defines the coordinate system, so we should keep it as-is
  // calculatedWidth is guaranteed to be assigned at this point
  svgNode.attr('width', `${calculatedWidth}px`);
  svgNode.attr('height', `${height}px`);
  
  // Keep original preserveAspectRatio to maintain alignment
  // Use 'meet' to ensure content fits within bounds while maintaining aspect ratio
  if (!svgNode.attr('preserveAspectRatio')) {
    svgNode.attr('preserveAspectRatio', 'xMinYMin meet');
  }

  // Extract only the SVG element, not the full HTML document
  // Use toString() to get the SVG element with its attributes (like Markless)
  const processedSvg = svgNode.toString();

  return processedSvg;
}

/**
 * Reduce number precision in attribute values
 * Rounds numbers to 2 decimal places, removes trailing zeros
 * This can significantly reduce SVG size for diagrams with many coordinates
 */
function reduceNumberPrecision(value: string): string {
  // Match numbers with 3+ decimal places (including decimals and negative numbers)
  // Also match numbers in space-separated lists (like viewBox, transform)
  return value.replace(/(-?\d+\.\d{3,})/g, (match) => {
    const num = parseFloat(match);
    if (isNaN(num)) return match;
    // Round to 2 decimal places
    const rounded = Math.round(num * 100) / 100;
    // Convert to string and remove trailing zeros, but keep decimal point if needed
    const str = rounded.toString();
    // If it's a whole number, return without decimal point
    if (rounded % 1 === 0) {
      return Math.round(rounded).toString();
    }
    // Otherwise remove trailing zeros but keep at least one decimal place
    return str.replace(/\.?0+$/, '');
  });
}

/**
 * Simplify SVG path data by reducing precision
 * Paths often contain many decimal places that can be rounded
 */
function simplifyPathData(pathData: string): string {
  // Path data contains commands (M, L, C, etc.) followed by coordinates
  // Reduce precision of all numbers in path data
  return pathData.replace(/(-?\d+\.\d{3,})/g, (match) => {
    const num = parseFloat(match);
    if (isNaN(num)) return match;
    // Round to 1 decimal place for paths (paths can tolerate more rounding)
    const rounded = Math.round(num * 10) / 10;
    return rounded.toString().replace(/\.?0+$/, '');
  });
}

/**
 * Aggressively optimize SVG by removing unnecessary content and reducing precision
 * This helps reduce size for large SVGs that might be truncated in VS Code hover
 */
function optimizeSvg(svgString: string): string {
  const $ = cheerio.load(svgString, { xmlMode: true });
  const svgNode = $('svg').first();
  
  if (svgNode.length === 0) {
    return svgString;
  }
  
  // Remove XML comments
  $('*').contents().filter(function() {
    return this.nodeType === 8; // Comment node
  }).remove();
  
  // Remove empty groups and elements (but preserve structure that might be needed)
  $('g').each(function() {
    const $group = $(this);
    if ($group.children().length === 0 && !$group.attr('id') && !$group.attr('class')) {
      $group.remove();
    }
  });
  
  // Optimize all elements: reduce precision and clean attributes
  svgNode.find('*').each(function() {
    const $elem = $(this);
    
    // Simplify path data (paths often have many high-precision coordinates)
    const d = $elem.attr('d');
    if (d) {
      $elem.attr('d', simplifyPathData(d));
    }
    
    // Reduce precision in numeric attributes (x, y, width, height, cx, cy, r, etc.)
    const numericAttrs = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 
                          'x1', 'y1', 'x2', 'y2', 'transform', 'viewBox'];
    for (const attr of numericAttrs) {
      const value = $elem.attr(attr);
      if (value && typeof value === 'string') {
        // Reduce precision in numeric values
        const optimized = reduceNumberPrecision(value);
        if (optimized !== value) {
          $elem.attr(attr, optimized);
        }
      }
    }
    
    // Clean up other attribute values (remove extra spaces)
    for (const attr of this.attribs ? Object.keys(this.attribs) : []) {
      if (!numericAttrs.includes(attr) && attr !== 'd') {
        const value = this.attribs[attr];
        if (typeof value === 'string') {
          // Remove leading/trailing whitespace from attribute values
          const cleaned = value.trim().replace(/\s+/g, ' ');
          if (cleaned !== value) {
            $elem.attr(attr, cleaned);
          }
        }
      }
    }
  });
  
  // Also optimize SVG root attributes
  const viewBox = svgNode.attr('viewBox');
  if (viewBox) {
    svgNode.attr('viewBox', reduceNumberPrecision(viewBox));
  }
  
  // Get optimized SVG string
  let optimized = svgNode.toString();
  
  // Remove unnecessary whitespace between tags
  optimized = optimized.replace(/>\s+</g, '><');
  
  // Remove leading/trailing whitespace
  optimized = optimized.trim();
  
  return optimized;
}

/**
 * Ensure SVG has explicit width and height attributes for proper display
 * Some Mermaid diagrams (especially state diagrams) may have percentage-based
 * or missing dimensions that need to be set explicitly
 */
export function ensureSvgDimensions(svgString: string, width: number, height: number): string {
  const $ = cheerio.load(svgString, { xmlMode: true });
  const svgNode = $('svg').first();
  
  if (svgNode.length === 0) {
    return svgString;
  }
  
  // Set explicit pixel-based dimensions
  svgNode.attr('width', `${width}px`);
  svgNode.attr('height', `${height}px`);
  
  // Ensure viewBox exists if it doesn't, using the calculated dimensions
  if (!svgNode.attr('viewBox')) {
    svgNode.attr('viewBox', `0 0 ${width} ${height}`);
  }
  
  // Remove any percentage-based width that might interfere
  const currentWidth = svgNode.attr('width');
  if (currentWidth && currentWidth.includes('%')) {
    svgNode.attr('width', `${width}px`);
  }
  
  const result = svgNode.toString();
  
  // Optimize the SVG to reduce size (helps with VS Code hover truncation)
  return optimizeSvg(result);
}

/**
 * Convert SVG string to data URI using URL encoding
 * URL encoding is typically shorter for SVG content
 */
export function svgToDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/**
 * Convert SVG string to data URI using Base64 encoding
 * Base64 might be handled differently by VS Code and could have different size limits
 */
export function svgToDataUriBase64(svg: string): string {
  const encoded = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}
