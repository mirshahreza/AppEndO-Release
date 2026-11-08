import { describe, expect, it } from 'vitest';
import { renderTemplate, TemplateSyntaxError } from '../templateEngine';

describe('renderTemplate (p-99/WFT-10)', () => {
  describe('backward compatibility with the old flat {{key}} substitution', () => {
    it('substitutes a flat key', () => {
      expect(renderTemplate('Hello {{name}}!', { name: 'Ada' })).toBe('Hello Ada!');
    });

    it('leaves an unresolved placeholder exactly as written (including internal whitespace)', () => {
      expect(renderTemplate('Hello {{ missing }}!', { name: 'Ada' })).toBe('Hello {{ missing }}!');
    });

    it('stringifies numbers and booleans', () => {
      expect(renderTemplate('{{count}} / {{active}}', { count: 3, active: true })).toBe('3 / true');
    });

    it('renders an object value as its JSON text (never [object Object])', () => {
      expect(renderTemplate('{{obj}}', { obj: { a: 1 } })).toBe('{"a":1}');
    });
  });

  describe('nested dot-path lookups (new)', () => {
    it('resolves a nested object path', () => {
      expect(renderTemplate('{{user.name}}', { user: { name: 'Grace' } })).toBe('Grace');
    });

    it('resolves an array index segment', () => {
      expect(renderTemplate('{{items.0.title}}', { items: [{ title: 'first' }, { title: 'second' }] })).toBe('first');
    });

    it('leaves the placeholder unresolved when an intermediate segment is missing', () => {
      expect(renderTemplate('{{user.address.city}}', { user: { name: 'Grace' } })).toBe('{{user.address.city}}');
    });
  });

  describe('#each iteration', () => {
    it('renders the body once per array item, with the item as the new context', () => {
      const result = renderTemplate('{{#each items}}[{{name}}]{{/each}}', { items: [{ name: 'a' }, { name: 'b' }] });
      expect(result).toBe('[a][b]');
    });

    it('{{.}} and {{this}} refer to the whole current item (useful for primitive arrays)', () => {
      expect(renderTemplate('{{#each tags}}({{.}}){{/each}}', { tags: ['x', 'y'] })).toBe('(x)(y)');
      expect(renderTemplate('{{#each tags}}({{this}}){{/each}}', { tags: ['x', 'y'] })).toBe('(x)(y)');
    });

    it('{{@index}} is the 0-based iteration index', () => {
      expect(renderTemplate('{{#each items}}{{@index}}:{{name}} {{/each}}', { items: [{ name: 'a' }, { name: 'b' }] })).toBe('0:a 1:b ');
    });

    it('renders zero iterations (never throws) when the path is missing or not an array', () => {
      expect(renderTemplate('[{{#each items}}x{{/each}}]', {})).toBe('[]');
      expect(renderTemplate('[{{#each items}}x{{/each}}]', { items: 'not-an-array' })).toBe('[]');
    });

    it('does not fall back to the outer scope for a name missed on the current item (deliberate V1 scope boundary)', () => {
      const result = renderTemplate('{{#each items}}{{outerOnly}}{{/each}}', { outerOnly: 'nope', items: [{}] });
      expect(result).toBe('{{outerOnly}}');
    });

    it('supports nesting an #each inside another #each', () => {
      const result = renderTemplate(
        '{{#each groups}}{{name}}:{{#each members}}{{.}},{{/each}};{{/each}}',
        { groups: [{ name: 'g1', members: ['a', 'b'] }, { name: 'g2', members: ['c'] }] },
      );
      expect(result).toBe('g1:a,b,;g2:c,;');
    });
  });

  describe('#if / {{else}} / #unless', () => {
    it('renders the then-branch when the path is truthy', () => {
      expect(renderTemplate('{{#if active}}YES{{/if}}', { active: true })).toBe('YES');
    });

    it('renders nothing when the path is falsy and there is no {{else}}', () => {
      expect(renderTemplate('[{{#if active}}YES{{/if}}]', { active: false })).toBe('[]');
    });

    it('renders the else-branch when the path is falsy', () => {
      expect(renderTemplate('{{#if active}}YES{{else}}NO{{/if}}', { active: false })).toBe('NO');
    });

    it('treats an empty array/object and 0/""/null/undefined as falsy', () => {
      for (const falsy of [0, '', null, undefined, [], {}]) {
        expect(renderTemplate('{{#if v}}Y{{else}}N{{/if}}', { v: falsy })).toBe('N');
      }
    });

    it('treats a non-empty array/object as truthy', () => {
      expect(renderTemplate('{{#if v}}Y{{else}}N{{/if}}', { v: [1] })).toBe('Y');
      expect(renderTemplate('{{#if v}}Y{{else}}N{{/if}}', { v: { a: 1 } })).toBe('Y');
    });

    it('#unless is the negation of #if, with no {{else}} support', () => {
      expect(renderTemplate('{{#unless active}}HIDDEN{{/unless}}', { active: false })).toBe('HIDDEN');
      expect(renderTemplate('[{{#unless active}}HIDDEN{{/unless}}]', { active: true })).toBe('[]');
    });

    it('#if inside #each evaluates against the current item', () => {
      const result = renderTemplate('{{#each items}}{{#if flagged}}!{{/if}}{{name}} {{/each}}', {
        items: [{ name: 'a', flagged: true }, { name: 'b', flagged: false }],
      });
      expect(result).toBe('!a b ');
    });
  });

  describe('syntax errors', () => {
    it('throws TemplateSyntaxError for an unclosed #each', () => {
      expect(() => renderTemplate('{{#each items}}x', {})).toThrow(TemplateSyntaxError);
    });

    it('throws TemplateSyntaxError for an unclosed #if', () => {
      expect(() => renderTemplate('{{#if x}}y', {})).toThrow(TemplateSyntaxError);
    });

    it('throws TemplateSyntaxError for a stray closing tag', () => {
      expect(() => renderTemplate('{{/each}}', {})).toThrow(TemplateSyntaxError);
    });
  });
});
