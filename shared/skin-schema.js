/**
 * dsh-desktop 皮肤 token schema
 *
 * 每款皮肤是一组 token，由 skin-center 读出后批量写入 document.documentElement
 * 上的 CSS 变量。`vars` 是「完整覆写」，不要做 partial merge——保证每款皮肤都是
 * 独立自洽的。
 *
 * 设计原则：
 *   - 极简 editorial：所有 token 收敛到 ~30 个，不堆砌「个性化」维度。
 *   - 高对比：--dsh-fg-primary 与 --dsh-bg-primary 对比度 >= 7:1 (AAA)。
 *   - 冷白基线：--dsh-bg-primary 默认在 #fafaf7 / #f7f7f4 / 极低饱和冷白之间。
 *   - 单 accent：每款皮肤只暴露一个 --dsh-accent，避免视觉噪音。
 *
 * @typedef {Object} SkinVars
 * @property {string} '--dsh-bg-primary'       主背景
 * @property {string} '--dsh-bg-secondary'     二级背景（面板/抽屉）
 * @property {string} '--dsh-bg-elevated'      浮层背景（弹窗/菜单）
 * @property {string} '--dsh-fg-primary'       主前景（标题/正文）
 * @property {string} '--dsh-fg-secondary'     次要前景（次级文字）
 * @property {string} '--dsh-fg-tertiary'      辅助前景（占位/说明）
 * @property {string} '--dsh-fg-disabled'      禁用前景
 * @property {string} '--dsh-border'           描边
 * @property {string} '--dsh-border-strong'    强描边
 * @property {string} '--dsh-accent'           单 accent 色
 * @property {string} '--dsh-accent-fg'        accent 之上文字
 * @property {string} '--dsh-glass-bg'         玻璃面板背景
 * @property {string} '--dsh-glass-border'     玻璃面板描边
 * @property {number} '--dsh-glass-blur'       玻璃面板模糊 (px)
 * @property {string} '--dsh-shadow'           主阴影
 * @property {string} '--dsh-glow-1'           光晕 1（背景）
 * @property {string} '--dsh-glow-2'           光晕 2（背景）
 * @property {'light' | 'dark'} '--dsh-mode'    暗亮基调（影响图标与状态色派生）
 *
 * @typedef {Object} SkinMeta
 * @property {string} id                      皮肤 id（小写连字符，全仓唯一）
 * @property {string} name                    显示名（中文）
 * @property {string} nameEn                  显示名（英文）
 * @property {string} [author='dsh-desktop']  作者署名
 * @property {string} tagline                 一句话标语
 * @property {string} description             详细描述
 * @property {string[]} tags                  标签（light/dark/minimal/...）
 * @property {SkinVars} vars                  完整 token 表
 * @property {string} [css]                   额外 CSS 注入（可选，作用域 :root[data-dsh-skin=<id>]）
 * @property {string} [preview]               预览图相对路径
 * @property {number} [order=100]             列表顺序
 */

/**
 * 校验单个 skin 元数据是否合法。返回 ok / errors[]，调用方可降级。
 * @param {unknown} skin
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSkin(skin) {
  const errors = [];
  if (!skin || typeof skin !== 'object') {
    return { ok: false, errors: ['skin must be an object'] };
  }
  const s = /** @type {any} */ (skin);
  if (typeof s.id !== 'string' || !/^[a-z][a-z0-9-]{1,32}$/.test(s.id)) {
    errors.push('id must be kebab-case ascii, 2-33 chars');
  }
  if (typeof s.name !== 'string' || s.name.length === 0) errors.push('name required');
  if (typeof s.nameEn !== 'string' || s.nameEn.length === 0) errors.push('nameEn required');
  if (typeof s.tagline !== 'string') errors.push('tagline required');
  if (typeof s.description !== 'string') errors.push('description required');
  if (!Array.isArray(s.tags)) errors.push('tags must be string[]');

  if (!s.vars || typeof s.vars !== 'object') {
    errors.push('vars object required');
  } else {
    const required = [
      '--dsh-bg-primary', '--dsh-bg-secondary', '--dsh-bg-elevated',
      '--dsh-fg-primary', '--dsh-fg-secondary', '--dsh-fg-tertiary', '--dsh-fg-disabled',
      '--dsh-border', '--dsh-border-strong',
      '--dsh-accent', '--dsh-accent-fg',
      '--dsh-glass-bg', '--dsh-glass-border', '--dsh-glass-blur',
      '--dsh-shadow', '--dsh-glow-1', '--dsh-glow-2', '--dsh-mode',
    ];
    for (const k of required) {
      if (typeof s.vars[k] !== 'string' && typeof s.vars[k] !== 'number') {
        errors.push('vars.' + k + ' required (string or number)');
      }
    }
    if (s.vars['--dsh-mode'] && !['light', 'dark'].includes(s.vars['--dsh-mode'])) {
      errors.push("vars.--dsh-mode must be 'light' or 'dark'");
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * 校验全注册表（用于 skin-center:check CI 门禁）
 * @param {unknown} skins
 * @returns {{ ok: boolean, errors: string[], duplicates: string[] }}
 */
export function validateRegistry(skins) {
  const errors = [];
  const duplicates = [];
  if (!Array.isArray(skins)) return { ok: false, errors: ['registry must be an array'], duplicates: [] };
  const seen = new Set();
  for (let i = 0; i < skins.length; i++) {
    const r = validateSkin(skins[i]);
    if (!r.ok) for (const e of r.errors) errors.push(`skin[${i}]: ${e}`);
    if (skins[i] && skins[i].id) {
      if (seen.has(skins[i].id)) duplicates.push(skins[i].id);
      seen.add(skins[i].id);
    }
  }
  return { ok: errors.length === 0 && duplicates.length === 0, errors, duplicates };
}
