/**
 * dsh-desktop 皮肤注册表 API
 *
 * 浏览器端（skin-center 卡 + 6 款皮肤）共享的注册表。
 * 每款皮肤 import { register } 后 register(meta) 把自己的元数据塞进来。
 * 任意时刻 SkinCenterSection 渲染时调 list() 拿到全部。
 *
 * 注册时机：皮肤包是 cordis bundle，注入位置 settings.section（init 阶段），
 * 因此 register 早于 list 调用。倒序注册无副作用——list() 按 order 排序。
 */

import { validateSkin } from './skin-schema.js';

const _skins = [];

/**
 * 注册一款皮肤，返回 unregister 函数。
 * @param {import('./skin-schema.js').SkinMeta} skin
 * @returns {() => void}
 */
export function register(skin) {
  const v = validateSkin(skin);
  if (!v.ok) {
    // 静默失败 + console.warn：让皮肤中心仍能展示其它皮肤，不阻断 GUI
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[dsh-desktop/skin] register rejected:', skin && skin.id, v.errors);
    }
    return () => {};
  }
  // 重复注册同 id → 后者覆盖前者（皮肤热重载场景）
  const idx = _skins.findIndex((s) => s.id === skin.id);
  if (idx >= 0) _skins.splice(idx, 1);
  _skins.push(skin);
  return () => {
    const i = _skins.findIndex((s) => s.id === skin.id);
    if (i >= 0) _skins.splice(i, 1);
  };
}

/**
 * 列出全部已注册皮肤（按 order 升序排）。返回的是浅拷贝，外部修改不影响。
 * @returns {import('./skin-schema.js').SkinMeta[]}
 */
export function list() {
  return _skins.slice().sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/**
 * 按 id 查
 * @param {string} id
 * @returns {import('./skin-schema.js').SkinMeta|undefined}
 */
export function get(id) {
  return _skins.find((s) => s.id === id);
}

/** 清空注册表（仅供测试） */
export function _clearForTests() {
  _skins.length = 0;
}
