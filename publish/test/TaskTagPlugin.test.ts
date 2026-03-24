import { describe, it, expect } from 'vitest';
import MarkdownIt from 'markdown-it';
import { taskTagPlugin } from '../src/TaskTagPlugin.js';

function render(markdown: string): string {
    const md = new MarkdownIt({ html: true });
    md.use(taskTagPlugin);
    return md.render(markdown);
}

describe('TaskTagPlugin', () => {
    describe('priority tags', () => {
        it('should render #P1 as Priority 1 badge', () => {
            const html = render('- [ ] #P1 Fix critical bug');
            expect(html).toContain('<span class="task-tag priority-1">Priority 1</span>');
            expect(html).toContain('Fix critical bug');
            expect(html).not.toContain('#P1');
        });

        it('should render #P2 as Priority 2 badge', () => {
            const html = render('- [ ] #P2 Write docs');
            expect(html).toContain('<span class="task-tag priority-2">Priority 2</span>');
            expect(html).not.toContain('#P2');
        });

        it('should render #P3 as Priority 3 badge', () => {
            const html = render('- [x] #P3 Nice to have');
            expect(html).toContain('<span class="task-tag priority-3">Priority 3</span>');
            expect(html).not.toContain('#P3');
        });
    });

    describe('waiting tag', () => {
        it('should render #W as Waiting badge', () => {
            const html = render('- [ ] #W Blocked on review');
            expect(html).toContain('<span class="task-tag waiting">Waiting</span>');
            expect(html).not.toContain('#W');
        });
    });

    describe('due date tag', () => {
        it('should render #D-YYYY-MM-DD as Due badge', () => {
            const html = render('- [ ] #D-2026-03-15 Ship feature');
            expect(html).toContain('<span class="task-tag due-date">Due 2026-03-15</span>');
            expect(html).not.toContain('#D-2026-03-15');
        });
    });

    describe('completion date tag', () => {
        it('should render #C-YYYY-MM-DD as Completed badge', () => {
            const html = render('- [x] #C-2026-03-15 Shipped');
            expect(html).toContain('<span class="task-tag completed-date">Completed 2026-03-15</span>');
            expect(html).not.toContain('#C-2026-03-15');
        });
    });

    describe('multiple tags', () => {
        it('should render all leading tags as badges', () => {
            const html = render('- [ ] #P1 #W #D-2026-03-15 Do the thing');
            expect(html).toContain('<span class="task-tag priority-1">Priority 1</span>');
            expect(html).toContain('<span class="task-tag waiting">Waiting</span>');
            expect(html).toContain('<span class="task-tag due-date">Due 2026-03-15</span>');
            expect(html).toContain('Do the thing');
        });

        it('should render all four tag types together', () => {
            const html = render('- [x] #P2 #W #D-2026-04-01 #C-2026-04-02 Done item');
            expect(html).toContain('<span class="task-tag priority-2">Priority 2</span>');
            expect(html).toContain('<span class="task-tag waiting">Waiting</span>');
            expect(html).toContain('<span class="task-tag due-date">Due 2026-04-01</span>');
            expect(html).toContain('<span class="task-tag completed-date">Completed 2026-04-02</span>');
            expect(html).toContain('Done item');
        });
    });

    describe('non-leading tags', () => {
        it('should NOT transform tags embedded mid-text', () => {
            const html = render('- [ ] Fix #P1 later');
            expect(html).toContain('#P1');
            expect(html).not.toContain('task-tag');
        });
    });

    describe('tags only (no trailing text)', () => {
        it('should render badges with no trailing text', () => {
            const html = render('- [ ] #P1 #W');
            expect(html).toContain('<span class="task-tag priority-1">Priority 1</span>');
            expect(html).toContain('<span class="task-tag waiting">Waiting</span>');
        });
    });

    describe('code blocks', () => {
        it('should NOT transform tags inside inline code', () => {
            const html = render('Use `#P1` to set priority');
            expect(html).toContain('<code>#P1</code>');
            expect(html).not.toContain('task-tag');
        });

        it('should NOT transform tags inside fenced code blocks', () => {
            const html = render('```\n- [ ] #P1 Task\n```');
            expect(html).toContain('#P1');
            expect(html).not.toContain('task-tag');
        });
    });

    describe('non-task lines', () => {
        it('should NOT transform tags on plain text lines', () => {
            const html = render('#P1 This is not a task');
            expect(html).not.toContain('task-tag');
        });

        it('should NOT transform tags on regular list items', () => {
            const html = render('- #P1 Not a task item');
            expect(html).not.toContain('task-tag');
        });
    });

    describe('checkbox rendering', () => {
        it('should render unchecked checkbox as disabled HTML input', () => {
            const html = render('- [ ] Buy groceries');
            expect(html).toContain('<input type="checkbox" disabled>');
            expect(html).not.toContain('[ ]');
            expect(html).toContain('Buy groceries');
        });

        it('should render checked checkbox as checked disabled HTML input', () => {
            const html = render('- [x] Done task');
            expect(html).toContain('<input type="checkbox" checked disabled>');
            expect(html).not.toContain('[x]');
            expect(html).toContain('Done task');
        });

        it('should render uppercase [X] as checked', () => {
            const html = render('- [X] Also done');
            expect(html).toContain('<input type="checkbox" checked disabled>');
            expect(html).not.toContain('[X]');
        });

        it('should render checkbox with tags', () => {
            const html = render('- [ ] #P1 Important task');
            expect(html).toContain('<input type="checkbox" disabled>');
            expect(html).toContain('<span class="task-tag priority-1">Priority 1</span>');
            expect(html).toContain('Important task');
        });

        it('should add task-list-item class to task list items', () => {
            const html = render('- [ ] Task one\n- [x] Task two');
            expect(html).toContain('class="task-list-item"');
        });

        it('should add task-list class to parent list', () => {
            const html = render('- [ ] Task one\n- [x] Task two');
            expect(html).toContain('class="task-list"');
        });

        it('should NOT add checkbox to regular list items', () => {
            const html = render('- Regular item');
            expect(html).not.toContain('<input');
            expect(html).not.toContain('task-list');
        });
    });
});
