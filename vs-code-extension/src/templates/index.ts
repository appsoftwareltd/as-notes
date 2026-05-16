/**
 * Template set infrastructure for AS Notes publishing.
 * Each template set provides layouts, themes, and includes (header/footer/icon).
 */

import * as github from './github';
import * as tailwind from './tailwind';

export interface TemplateSet {
    layouts: Record<string, string>;
    themes: Record<string, string>;
    header: string;
    footer: string;
    icon: string;
}

export const TEMPLATE_SETS: Record<string, TemplateSet> = {
    github: {
        layouts: github.LAYOUT_TEMPLATES,
        themes: github.THEME_TEMPLATES,
        header: github.DEFAULT_HEADER_HTML,
        footer: github.DEFAULT_FOOTER_HTML,
        icon: github.DEFAULT_ICON_SVG,
    },
    tailwind: {
        layouts: tailwind.LAYOUT_TEMPLATES,
        themes: tailwind.THEME_TEMPLATES,
        header: tailwind.DEFAULT_HEADER_HTML,
        footer: tailwind.DEFAULT_FOOTER_HTML,
        icon: tailwind.DEFAULT_ICON_SVG,
    },
};
