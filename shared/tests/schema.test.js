// 共享层 schema / registry / css-tokens 的最小单测
// 跑法：node shared/tests/schema.test.js（CI 全仓 pnpm test 会自动找到）

import assert from 'node:assert/strict';
import {
  validateSkin,
  validateRegistry,
  register,
  list,
  get,
  _clearForTests,
  DEFAULT_VARS,
  writeVars,
  readVars,
  installDefaultTokens,
} from '../index.js';

const okSkin = {
  id: 'bone-white',
  name: '骨白',
  nameEn: 'Bone White',
  tagline: '冷白底 + 大量负空间 + 安静克制',
  description: '...',
  tags: ['light', 'minimal'],
  vars: {
    '--dsh-bg-primary': '#fafaf7',
    '--dsh-bg-secondary': '#f0eee8',
    '--dsh-bg-elevated': '#ffffff',
    '--dsh-fg-primary': '#1a1a1a',
    '--dsh-fg-secondary': '#4a4a48',
    '--dsh-fg-tertiary': '#8a8a86',
    '--dsh-fg-disabled': '#b8b8b4',
    '--dsh-border': 'rgba(0,0,0,.06)',
    '--dsh-border-strong': 'rgba(0,0,0,.12)',
    '--dsh-accent': '#1a1a1a',
    '--dsh-accent-fg': '#ffffff',
    '--dsh-glass-bg': 'rgba(250,250,247,.78)',
    '--dsh-glass-border': 'rgba(0,0,0,.06)',
    '--dsh-glass-blur': 22,
    '--dsh-shadow': '0 1px 2px rgba(0,0,0,.04)',
    '--dsh-glow-1': 'rgba(0,0,0,.04)',
    '--dsh-glow-2': 'rgba(0,0,0,.02)',
    '--dsh-mode': 'light',
  },
};

// validateSkin: 正例
{
  const r = validateSkin(okSkin);
  assert.equal(r.ok, true, 'ok skin should validate; errors=' + JSON.stringify(r.errors));
  console.log('[1] validateSkin: ok path passed');
}

// validateSkin: 必填字段缺失
{
  const r = validateSkin({ ...okSkin, id: 'Bad_ID', name: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 2, 'should report id + name issues');
  console.log('[2] validateSkin: rejection path passed (errors=' + r.errors.length + ')');
}

// validateRegistry: 重复 id
{
  const r = validateRegistry([okSkin, { ...okSkin }]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.duplicates, ['bone-white']);
  console.log('[3] validateRegistry: dup detection passed');
}

// register / list / get
{
  _clearForTests();
  const off1 = register(okSkin);
  const off2 = register({ ...okSkin, id: 'graphite', name: '石墨', nameEn: 'Graphite' });
  assert.equal(list().length, 2);
  assert.equal(get('bone-white').id, 'bone-white');
  assert.equal(get('nope'), undefined);
  off1();
  assert.equal(list().length, 1);
  off2();
  assert.equal(list().length, 0);
  console.log('[4] register / list / get / unregister passed');
}

// 重复 register 同 id → 覆盖
{
  _clearForTests();
  register(okSkin);
  register({ ...okSkin, tagline: 'updated' });
  assert.equal(get('bone-white').tagline, 'updated');
  _clearForTests();
  console.log('[5] re-register overrides passed');
}

// DEFAULT_VARS 完整
{
  const required = [
    '--dsh-bg-primary', '--dsh-bg-secondary', '--dsh-bg-elevated',
    '--dsh-fg-primary', '--dsh-fg-secondary', '--dsh-fg-tertiary', '--dsh-fg-disabled',
    '--dsh-border', '--dsh-border-strong',
    '--dsh-accent', '--dsh-accent-fg',
    '--dsh-glass-bg', '--dsh-glass-border', '--dsh-glass-blur',
    '--dsh-shadow', '--dsh-glow-1', '--dsh-glow-2', '--dsh-mode',
  ];
  for (const k of required) {
    assert.ok(k in DEFAULT_VARS, `DEFAULT_VARS missing ${k}`);
  }
  console.log('[6] DEFAULT_VARS complete passed (n=' + required.length + ')');
}

// writeVars / readVars 在 JSDOM 缺失时退化为 identity（不抛）
{
  // 没有 document 时不抛
  writeVars({ '--dsh-bg-primary': '#abc' }, null);
  const r = readVars(null);
  assert.equal(r['--dsh-bg-primary'], DEFAULT_VARS['--dsh-bg-primary']);
  console.log('[7] writeVars / readVars null-doc safe passed');
}

// installDefaultTokens 在无 document 时不抛
{
  installDefaultTokens(null);
  console.log('[8] installDefaultTokens null-doc safe passed');
}

console.log('--- shared: all 8 tests passed');
