import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../parser.js';

describe('parse — meta directives', () => {
  it('reads @page bare keyword as title', () => {
    const doc = parse('@page login');
    expect(doc.page?.title).toBe('Login');
    expect(doc.page?.theme).toBe('');
  });

  it('reads @page quoted string as title', () => {
    const doc = parse('@page "User Settings" dark');
    expect(doc.page?.title).toBe('User Settings');
    expect(doc.page?.theme).toBe('dark');
  });

  it('reads @spec version', () => {
    const doc = parse('@spec 1\n@page test');
    expect(doc.specVersion).toBe(1);
  });

  it('reads @meta tags', () => {
    const doc = parse('@meta "description" "A test page"\n@page test');
    expect(doc.metaTags).toEqual([{ key: 'description', value: 'A test page' }]);
  });
});

describe('parse — block commands', () => {
  it('parses @card with children', () => {
    const doc = parse('@page test\n@card\n  @title "Hello"\n@end');
    expect(doc.body).toHaveLength(1);
    expect(doc.body[0]!.command).toBe('card');
    expect(doc.body[0]!.children[0]!.command).toBe('title');
  });

  it('parses nested blocks', () => {
    const doc = parse('@page test\n@card\n  @cols 2\n    @stat "1" "Users"\n  @end\n@end');
    const card = doc.body[0]!;
    const cols = card.children[0]!;
    expect(cols.command).toBe('cols');
    expect(cols.children[0]!.command).toBe('stat');
  });

  it('throws on @end without open block', () => {
    expect(() => parse('@page test\n@end')).toThrow(ParseError);
  });

  it('throws on unclosed block', () => {
    expect(() => parse('@page test\n@card\n  @title "Hello"')).toThrow(ParseError);
  });
});

describe('parse — argument types', () => {
  it('parses string args', () => {
    const doc = parse('@page test\n@card\n  @title "Hello World"\n@end');
    const title = doc.body[0]!.children[0]!;
    expect(title.args[0]).toEqual({ type: 'string', value: 'Hello World' });
  });

  it('parses keyword args', () => {
    const doc = parse('@page test\n@card\n  @button "Go" primary\n@end');
    const btn = doc.body[0]!.children[0]!;
    expect(btn.args[1]).toEqual({ type: 'keyword', value: 'primary' });
  });

  it('parses number args', () => {
    const doc = parse('@page test\n@card\n  @progress "Storage" 72 100\n@end');
    const prog = doc.body[0]!.children[0]!;
    expect(prog.args[1]).toEqual({ type: 'number', value: 72 });
    expect(prog.args[2]).toEqual({ type: 'number', value: 100 });
  });

  it('parses key=value args', () => {
    const doc = parse('@page test\n@card\n  @field email "Email" value="test@example.com"\n@end');
    const field = doc.body[0]!.children[0]!;
    const kv = field.args.find(a => a.type === 'keyvalue');
    expect(kv).toEqual({ type: 'keyvalue', key: 'value', value: 'test@example.com' });
  });

  it('parses key="quoted value" args', () => {
    const doc = parse('@page test\n@card\n  @field text "Name" placeholder="Enter name"\n@end');
    const field = doc.body[0]!.children[0]!;
    const kv = field.args.find(a => a.type === 'keyvalue');
    expect(kv).toEqual({ type: 'keyvalue', key: 'placeholder', value: 'Enter name' });
  });
});

describe('parse — codeblock raw mode', () => {
  it('treats content inside @codeblock as raw lines', () => {
    const vml = '@page test\n@card\n  @codeblock ts\nconst x = 1;\n  @@end\n@end';
    const doc = parse(vml);
    const cb = doc.body[0]!.children[0]!;
    expect(cb.command).toBe('codeblock');
    expect(cb.rawLines[0]).toBe('const x = 1;');
  });

  it('@end inside codeblock is treated as content, not a block closer', () => {
    const vml = '@page test\n@card\n  @codeblock vml\n@card\n  @title "Hi"\n@end\n  @@end\n@end';
    const doc = parse(vml);
    const cb = doc.body[0]!.children[0]!;
    expect(cb.rawLines).toContain('@end');
  });

  it('@@end closes a codeblock', () => {
    const vml = '@page test\n@card\n  @codeblock bash\necho hello\n  @@end\n  @text "after"\n@end';
    const doc = parse(vml);
    const children = doc.body[0]!.children;
    expect(children[0]!.command).toBe('codeblock');
    expect(children[1]!.command).toBe('text');
  });
});

describe('parse — comments and blanks', () => {
  it('strips @# comment lines', () => {
    const doc = parse('@# this is a comment\n@page test\n@# another\n@card\n@end');
    expect(doc.body).toHaveLength(1);
  });

  it('ignores blank lines', () => {
    const doc = parse('\n\n@page test\n\n@card\n\n  @title "Hi"\n\n@end\n\n');
    expect(doc.body[0]!.children).toHaveLength(1);
  });
});

describe('parse — reserved commands', () => {
  it('throws on @if', () => {
    expect(() => parse('@page test\n@card\n  @if true\n@end')).toThrow(ParseError);
  });

  it('throws on @agent', () => {
    expect(() => parse('@page test\n@card\n  @agent "task"\n@end')).toThrow(ParseError);
  });
});

describe('parse — unknown commands', () => {
  it('throws on unknown command', () => {
    expect(() => parse('@page test\n@card\n  @foobar\n@end')).toThrow(ParseError);
    expect(() => parse('@page test\n@card\n  @foobar\n@end')).toThrow(/Unknown command/);
  });
});
