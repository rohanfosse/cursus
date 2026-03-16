/**
* @vue/shared v3.5.30
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
// @__NO_SIDE_EFFECTS__
function makeMap(str) {
  const map = /* @__PURE__ */ Object.create(null);
  for (const key of str.split(",")) map[key] = 1;
  return (val) => val in map;
}
const EMPTY_OBJ = {};
const EMPTY_ARR = [];
const NOOP = () => {
};
const NO = () => false;
const isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
(key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
const isModelListener = (key) => key.startsWith("onUpdate:");
const extend = Object.assign;
const remove = (arr, el) => {
  const i = arr.indexOf(el);
  if (i > -1) {
    arr.splice(i, 1);
  }
};
const hasOwnProperty$1 = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
const isArray$1 = Array.isArray;
const isMap = (val) => toTypeString(val) === "[object Map]";
const isSet = (val) => toTypeString(val) === "[object Set]";
const isDate = (val) => toTypeString(val) === "[object Date]";
const isFunction = (val) => typeof val === "function";
const isString = (val) => typeof val === "string";
const isSymbol = (val) => typeof val === "symbol";
const isObject = (val) => val !== null && typeof val === "object";
const isPromise = (val) => {
  return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
};
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const toRawType = (value) => {
  return toTypeString(value).slice(8, -1);
};
const isPlainObject$1 = (val) => toTypeString(val) === "[object Object]";
const isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
const isReservedProp = /* @__PURE__ */ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
);
const cacheStringFunction = (fn) => {
  const cache = /* @__PURE__ */ Object.create(null);
  return ((str) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  });
};
const camelizeRE = /-\w/g;
const camelize = cacheStringFunction(
  (str) => {
    return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
  }
);
const hyphenateRE = /\B([A-Z])/g;
const hyphenate = cacheStringFunction(
  (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
);
const capitalize = cacheStringFunction((str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});
const toHandlerKey = cacheStringFunction(
  (str) => {
    const s = str ? `on${capitalize(str)}` : ``;
    return s;
  }
);
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
const invokeArrayFns = (fns, ...arg) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](...arg);
  }
};
const def = (obj, key, value, writable = false) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    writable,
    value
  });
};
const looseToNumber = (val) => {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
};
const toNumber = (val) => {
  const n = isString(val) ? Number(val) : NaN;
  return isNaN(n) ? val : n;
};
let _globalThis;
const getGlobalThis = () => {
  return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
};
function normalizeStyle(value) {
  if (isArray$1(value)) {
    const res = {};
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key];
        }
      }
    }
    return res;
  } else if (isString(value) || isObject(value)) {
    return value;
  }
}
const listDelimiterRE = /;(?![^(]*\))/g;
const propertyDelimiterRE = /:([^]+)/;
const styleCommentRE = /\/\*[^]*?\*\//g;
function parseStringStyle(cssText) {
  const ret = {};
  cssText.replace(styleCommentRE, "").split(listDelimiterRE).forEach((item) => {
    if (item) {
      const tmp = item.split(propertyDelimiterRE);
      tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
    }
  });
  return ret;
}
function normalizeClass(value) {
  let res = "";
  if (isString(value)) {
    res = value;
  } else if (isArray$1(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i]);
      if (normalized) {
        res += normalized + " ";
      }
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + " ";
      }
    }
  }
  return res.trim();
}
const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
const isSpecialBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs);
function includeBooleanAttr(value) {
  return !!value || value === "";
}
function looseCompareArrays(a, b) {
  if (a.length !== b.length) return false;
  let equal = true;
  for (let i = 0; equal && i < a.length; i++) {
    equal = looseEqual(a[i], b[i]);
  }
  return equal;
}
function looseEqual(a, b) {
  if (a === b) return true;
  let aValidType = isDate(a);
  let bValidType = isDate(b);
  if (aValidType || bValidType) {
    return aValidType && bValidType ? a.getTime() === b.getTime() : false;
  }
  aValidType = isSymbol(a);
  bValidType = isSymbol(b);
  if (aValidType || bValidType) {
    return a === b;
  }
  aValidType = isArray$1(a);
  bValidType = isArray$1(b);
  if (aValidType || bValidType) {
    return aValidType && bValidType ? looseCompareArrays(a, b) : false;
  }
  aValidType = isObject(a);
  bValidType = isObject(b);
  if (aValidType || bValidType) {
    if (!aValidType || !bValidType) {
      return false;
    }
    const aKeysCount = Object.keys(a).length;
    const bKeysCount = Object.keys(b).length;
    if (aKeysCount !== bKeysCount) {
      return false;
    }
    for (const key in a) {
      const aHasKey = a.hasOwnProperty(key);
      const bHasKey = b.hasOwnProperty(key);
      if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key])) {
        return false;
      }
    }
  }
  return String(a) === String(b);
}
function looseIndexOf(arr, val) {
  return arr.findIndex((item) => looseEqual(item, val));
}
const isRef$1 = (val) => {
  return !!(val && val["__v_isRef"] === true);
};
const toDisplayString = (val) => {
  return isString(val) ? val : val == null ? "" : isArray$1(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef$1(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
};
const replacer = (_key, val) => {
  if (isRef$1(val)) {
    return replacer(_key, val.value);
  } else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce(
        (entries, [key, val2], i) => {
          entries[stringifySymbol(key, i) + " =>"] = val2;
          return entries;
        },
        {}
      )
    };
  } else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
    };
  } else if (isSymbol(val)) {
    return stringifySymbol(val);
  } else if (isObject(val) && !isArray$1(val) && !isPlainObject$1(val)) {
    return String(val);
  }
  return val;
};
const stringifySymbol = (v, i = "") => {
  var _a;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v
  );
};
/**
* @vue/reactivity v3.5.30
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
let activeEffectScope;
class EffectScope {
  // TODO isolatedDeclarations "__v_skip"
  constructor(detached = false) {
    this.detached = detached;
    this._active = true;
    this._on = 0;
    this.effects = [];
    this.cleanups = [];
    this._isPaused = false;
    this.__v_skip = true;
    this.parent = activeEffectScope;
    if (!detached && activeEffectScope) {
      this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
        this
      ) - 1;
    }
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = true;
      let i, l;
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].pause();
        }
      }
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].pause();
      }
    }
  }
  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume() {
    if (this._active) {
      if (this._isPaused) {
        this._isPaused = false;
        let i, l;
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume();
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].resume();
        }
      }
    }
  }
  run(fn) {
    if (this._active) {
      const currentEffectScope = activeEffectScope;
      try {
        activeEffectScope = this;
        return fn();
      } finally {
        activeEffectScope = currentEffectScope;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    if (++this._on === 1) {
      this.prevScope = activeEffectScope;
      activeEffectScope = this;
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      activeEffectScope = this.prevScope;
      this.prevScope = void 0;
    }
  }
  stop(fromParent) {
    if (this._active) {
      this._active = false;
      let i, l;
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop();
      }
      this.effects.length = 0;
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]();
      }
      this.cleanups.length = 0;
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true);
        }
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !fromParent) {
        const last = this.parent.scopes.pop();
        if (last && last !== this) {
          this.parent.scopes[this.index] = last;
          last.index = this.index;
        }
      }
      this.parent = void 0;
    }
  }
}
function effectScope(detached) {
  return new EffectScope(detached);
}
function getCurrentScope() {
  return activeEffectScope;
}
function onScopeDispose(fn, failSilently = false) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn);
  }
}
let activeSub;
const pausedQueueEffects = /* @__PURE__ */ new WeakSet();
class ReactiveEffect {
  constructor(fn) {
    this.fn = fn;
    this.deps = void 0;
    this.depsTail = void 0;
    this.flags = 1 | 4;
    this.next = void 0;
    this.cleanup = void 0;
    this.scheduler = void 0;
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this);
    }
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    if (this.flags & 64) {
      this.flags &= -65;
      if (pausedQueueEffects.has(this)) {
        pausedQueueEffects.delete(this);
        this.trigger();
      }
    }
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags & 2 && !(this.flags & 32)) {
      return;
    }
    if (!(this.flags & 8)) {
      batch(this);
    }
  }
  run() {
    if (!(this.flags & 1)) {
      return this.fn();
    }
    this.flags |= 2;
    cleanupEffect(this);
    prepareDeps(this);
    const prevEffect = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = this;
    shouldTrack = true;
    try {
      return this.fn();
    } finally {
      cleanupDeps(this);
      activeSub = prevEffect;
      shouldTrack = prevShouldTrack;
      this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let link = this.deps; link; link = link.nextDep) {
        removeSub(link);
      }
      this.deps = this.depsTail = void 0;
      cleanupEffect(this);
      this.onStop && this.onStop();
      this.flags &= -2;
    }
  }
  trigger() {
    if (this.flags & 64) {
      pausedQueueEffects.add(this);
    } else if (this.scheduler) {
      this.scheduler();
    } else {
      this.runIfDirty();
    }
  }
  /**
   * @internal
   */
  runIfDirty() {
    if (isDirty(this)) {
      this.run();
    }
  }
  get dirty() {
    return isDirty(this);
  }
}
let batchDepth = 0;
let batchedSub;
let batchedComputed;
function batch(sub, isComputed2 = false) {
  sub.flags |= 8;
  if (isComputed2) {
    sub.next = batchedComputed;
    batchedComputed = sub;
    return;
  }
  sub.next = batchedSub;
  batchedSub = sub;
}
function startBatch() {
  batchDepth++;
}
function endBatch() {
  if (--batchDepth > 0) {
    return;
  }
  if (batchedComputed) {
    let e = batchedComputed;
    batchedComputed = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= -9;
      e = next;
    }
  }
  let error;
  while (batchedSub) {
    let e = batchedSub;
    batchedSub = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= -9;
      if (e.flags & 1) {
        try {
          ;
          e.trigger();
        } catch (err) {
          if (!error) error = err;
        }
      }
      e = next;
    }
  }
  if (error) throw error;
}
function prepareDeps(sub) {
  for (let link = sub.deps; link; link = link.nextDep) {
    link.version = -1;
    link.prevActiveLink = link.dep.activeLink;
    link.dep.activeLink = link;
  }
}
function cleanupDeps(sub) {
  let head;
  let tail = sub.depsTail;
  let link = tail;
  while (link) {
    const prev = link.prevDep;
    if (link.version === -1) {
      if (link === tail) tail = prev;
      removeSub(link);
      removeDep(link);
    } else {
      head = link;
    }
    link.dep.activeLink = link.prevActiveLink;
    link.prevActiveLink = void 0;
    link = prev;
  }
  sub.deps = head;
  sub.depsTail = tail;
}
function isDirty(sub) {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
      return true;
    }
  }
  if (sub._dirty) {
    return true;
  }
  return false;
}
function refreshComputed(computed2) {
  if (computed2.flags & 4 && !(computed2.flags & 16)) {
    return;
  }
  computed2.flags &= -17;
  if (computed2.globalVersion === globalVersion) {
    return;
  }
  computed2.globalVersion = globalVersion;
  if (!computed2.isSSR && computed2.flags & 128 && (!computed2.deps && !computed2._dirty || !isDirty(computed2))) {
    return;
  }
  computed2.flags |= 2;
  const dep = computed2.dep;
  const prevSub = activeSub;
  const prevShouldTrack = shouldTrack;
  activeSub = computed2;
  shouldTrack = true;
  try {
    prepareDeps(computed2);
    const value = computed2.fn(computed2._value);
    if (dep.version === 0 || hasChanged(value, computed2._value)) {
      computed2.flags |= 128;
      computed2._value = value;
      dep.version++;
    }
  } catch (err) {
    dep.version++;
    throw err;
  } finally {
    activeSub = prevSub;
    shouldTrack = prevShouldTrack;
    cleanupDeps(computed2);
    computed2.flags &= -3;
  }
}
function removeSub(link, soft = false) {
  const { dep, prevSub, nextSub } = link;
  if (prevSub) {
    prevSub.nextSub = nextSub;
    link.prevSub = void 0;
  }
  if (nextSub) {
    nextSub.prevSub = prevSub;
    link.nextSub = void 0;
  }
  if (dep.subs === link) {
    dep.subs = prevSub;
    if (!prevSub && dep.computed) {
      dep.computed.flags &= -5;
      for (let l = dep.computed.deps; l; l = l.nextDep) {
        removeSub(l, true);
      }
    }
  }
  if (!soft && !--dep.sc && dep.map) {
    dep.map.delete(dep.key);
  }
}
function removeDep(link) {
  const { prevDep, nextDep } = link;
  if (prevDep) {
    prevDep.nextDep = nextDep;
    link.prevDep = void 0;
  }
  if (nextDep) {
    nextDep.prevDep = prevDep;
    link.nextDep = void 0;
  }
}
let shouldTrack = true;
const trackStack = [];
function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}
function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === void 0 ? true : last;
}
function cleanupEffect(e) {
  const { cleanup } = e;
  e.cleanup = void 0;
  if (cleanup) {
    const prevSub = activeSub;
    activeSub = void 0;
    try {
      cleanup();
    } finally {
      activeSub = prevSub;
    }
  }
}
let globalVersion = 0;
class Link {
  constructor(sub, dep) {
    this.sub = sub;
    this.dep = dep;
    this.version = dep.version;
    this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class Dep {
  // TODO isolatedDeclarations "__v_skip"
  constructor(computed2) {
    this.computed = computed2;
    this.version = 0;
    this.activeLink = void 0;
    this.subs = void 0;
    this.map = void 0;
    this.key = void 0;
    this.sc = 0;
    this.__v_skip = true;
  }
  track(debugInfo) {
    if (!activeSub || !shouldTrack || activeSub === this.computed) {
      return;
    }
    let link = this.activeLink;
    if (link === void 0 || link.sub !== activeSub) {
      link = this.activeLink = new Link(activeSub, this);
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link;
      } else {
        link.prevDep = activeSub.depsTail;
        activeSub.depsTail.nextDep = link;
        activeSub.depsTail = link;
      }
      addSub(link);
    } else if (link.version === -1) {
      link.version = this.version;
      if (link.nextDep) {
        const next = link.nextDep;
        next.prevDep = link.prevDep;
        if (link.prevDep) {
          link.prevDep.nextDep = next;
        }
        link.prevDep = activeSub.depsTail;
        link.nextDep = void 0;
        activeSub.depsTail.nextDep = link;
        activeSub.depsTail = link;
        if (activeSub.deps === link) {
          activeSub.deps = next;
        }
      }
    }
    return link;
  }
  trigger(debugInfo) {
    this.version++;
    globalVersion++;
    this.notify(debugInfo);
  }
  notify(debugInfo) {
    startBatch();
    try {
      if (false) ;
      for (let link = this.subs; link; link = link.prevSub) {
        if (link.sub.notify()) {
          ;
          link.sub.dep.notify();
        }
      }
    } finally {
      endBatch();
    }
  }
}
function addSub(link) {
  link.dep.sc++;
  if (link.sub.flags & 4) {
    const computed2 = link.dep.computed;
    if (computed2 && !link.dep.subs) {
      computed2.flags |= 4 | 16;
      for (let l = computed2.deps; l; l = l.nextDep) {
        addSub(l);
      }
    }
    const currentTail = link.dep.subs;
    if (currentTail !== link) {
      link.prevSub = currentTail;
      if (currentTail) currentTail.nextSub = link;
    }
    link.dep.subs = link;
  }
}
const targetMap = /* @__PURE__ */ new WeakMap();
const ITERATE_KEY = /* @__PURE__ */ Symbol(
  ""
);
const MAP_KEY_ITERATE_KEY = /* @__PURE__ */ Symbol(
  ""
);
const ARRAY_ITERATE_KEY = /* @__PURE__ */ Symbol(
  ""
);
function track(target, type, key) {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = new Dep());
      dep.map = depsMap;
      dep.key = key;
    }
    {
      dep.track();
    }
  }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    globalVersion++;
    return;
  }
  const run = (dep) => {
    if (dep) {
      {
        dep.trigger();
      }
    }
  };
  startBatch();
  if (type === "clear") {
    depsMap.forEach(run);
  } else {
    const targetIsArray = isArray$1(target);
    const isArrayIndex = targetIsArray && isIntegerKey(key);
    if (targetIsArray && key === "length") {
      const newLength = Number(newValue);
      depsMap.forEach((dep, key2) => {
        if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) {
          run(dep);
        }
      });
    } else {
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key));
      }
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY));
      }
      switch (type) {
        case "add":
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          } else if (isArrayIndex) {
            run(depsMap.get("length"));
          }
          break;
        case "delete":
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          }
          break;
        case "set":
          if (isMap(target)) {
            run(depsMap.get(ITERATE_KEY));
          }
          break;
      }
    }
  }
  endBatch();
}
function getDepFromReactive(object, key) {
  const depMap = targetMap.get(object);
  return depMap && depMap.get(key);
}
function reactiveReadArray(array) {
  const raw = /* @__PURE__ */ toRaw(array);
  if (raw === array) return raw;
  track(raw, "iterate", ARRAY_ITERATE_KEY);
  return /* @__PURE__ */ isShallow(array) ? raw : raw.map(toReactive);
}
function shallowReadArray(arr) {
  track(arr = /* @__PURE__ */ toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
  return arr;
}
function toWrapped(target, item) {
  if (/* @__PURE__ */ isReadonly(target)) {
    return /* @__PURE__ */ isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
  }
  return toReactive(item);
}
const arrayInstrumentations = {
  __proto__: null,
  [Symbol.iterator]() {
    return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
  },
  concat(...args) {
    return reactiveReadArray(this).concat(
      ...args.map((x) => isArray$1(x) ? reactiveReadArray(x) : x)
    );
  },
  entries() {
    return iterator(this, "entries", (value) => {
      value[1] = toWrapped(this, value[1]);
      return value;
    });
  },
  every(fn, thisArg) {
    return apply(this, "every", fn, thisArg, void 0, arguments);
  },
  filter(fn, thisArg) {
    return apply(
      this,
      "filter",
      fn,
      thisArg,
      (v) => v.map((item) => toWrapped(this, item)),
      arguments
    );
  },
  find(fn, thisArg) {
    return apply(
      this,
      "find",
      fn,
      thisArg,
      (item) => toWrapped(this, item),
      arguments
    );
  },
  findIndex(fn, thisArg) {
    return apply(this, "findIndex", fn, thisArg, void 0, arguments);
  },
  findLast(fn, thisArg) {
    return apply(
      this,
      "findLast",
      fn,
      thisArg,
      (item) => toWrapped(this, item),
      arguments
    );
  },
  findLastIndex(fn, thisArg) {
    return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(fn, thisArg) {
    return apply(this, "forEach", fn, thisArg, void 0, arguments);
  },
  includes(...args) {
    return searchProxy(this, "includes", args);
  },
  indexOf(...args) {
    return searchProxy(this, "indexOf", args);
  },
  join(separator) {
    return reactiveReadArray(this).join(separator);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...args) {
    return searchProxy(this, "lastIndexOf", args);
  },
  map(fn, thisArg) {
    return apply(this, "map", fn, thisArg, void 0, arguments);
  },
  pop() {
    return noTracking(this, "pop");
  },
  push(...args) {
    return noTracking(this, "push", args);
  },
  reduce(fn, ...args) {
    return reduce(this, "reduce", fn, args);
  },
  reduceRight(fn, ...args) {
    return reduce(this, "reduceRight", fn, args);
  },
  shift() {
    return noTracking(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(fn, thisArg) {
    return apply(this, "some", fn, thisArg, void 0, arguments);
  },
  splice(...args) {
    return noTracking(this, "splice", args);
  },
  toReversed() {
    return reactiveReadArray(this).toReversed();
  },
  toSorted(comparer) {
    return reactiveReadArray(this).toSorted(comparer);
  },
  toSpliced(...args) {
    return reactiveReadArray(this).toSpliced(...args);
  },
  unshift(...args) {
    return noTracking(this, "unshift", args);
  },
  values() {
    return iterator(this, "values", (item) => toWrapped(this, item));
  }
};
function iterator(self2, method, wrapValue) {
  const arr = shallowReadArray(self2);
  const iter = arr[method]();
  if (arr !== self2 && !/* @__PURE__ */ isShallow(self2)) {
    iter._next = iter.next;
    iter.next = () => {
      const result = iter._next();
      if (!result.done) {
        result.value = wrapValue(result.value);
      }
      return result;
    };
  }
  return iter;
}
const arrayProto = Array.prototype;
function apply(self2, method, fn, thisArg, wrappedRetFn, args) {
  const arr = shallowReadArray(self2);
  const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
  const methodFn = arr[method];
  if (methodFn !== arrayProto[method]) {
    const result2 = methodFn.apply(self2, args);
    return needsWrap ? toReactive(result2) : result2;
  }
  let wrappedFn = fn;
  if (arr !== self2) {
    if (needsWrap) {
      wrappedFn = function(item, index) {
        return fn.call(this, toWrapped(self2, item), index, self2);
      };
    } else if (fn.length > 2) {
      wrappedFn = function(item, index) {
        return fn.call(this, item, index, self2);
      };
    }
  }
  const result = methodFn.call(arr, wrappedFn, thisArg);
  return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
}
function reduce(self2, method, fn, args) {
  const arr = shallowReadArray(self2);
  const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
  let wrappedFn = fn;
  let wrapInitialAccumulator = false;
  if (arr !== self2) {
    if (needsWrap) {
      wrapInitialAccumulator = args.length === 0;
      wrappedFn = function(acc, item, index) {
        if (wrapInitialAccumulator) {
          wrapInitialAccumulator = false;
          acc = toWrapped(self2, acc);
        }
        return fn.call(this, acc, toWrapped(self2, item), index, self2);
      };
    } else if (fn.length > 3) {
      wrappedFn = function(acc, item, index) {
        return fn.call(this, acc, item, index, self2);
      };
    }
  }
  const result = arr[method](wrappedFn, ...args);
  return wrapInitialAccumulator ? toWrapped(self2, result) : result;
}
function searchProxy(self2, method, args) {
  const arr = /* @__PURE__ */ toRaw(self2);
  track(arr, "iterate", ARRAY_ITERATE_KEY);
  const res = arr[method](...args);
  if ((res === -1 || res === false) && /* @__PURE__ */ isProxy(args[0])) {
    args[0] = /* @__PURE__ */ toRaw(args[0]);
    return arr[method](...args);
  }
  return res;
}
function noTracking(self2, method, args = []) {
  pauseTracking();
  startBatch();
  const res = (/* @__PURE__ */ toRaw(self2))[method].apply(self2, args);
  endBatch();
  resetTracking();
  return res;
}
const isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
);
function hasOwnProperty(key) {
  if (!isSymbol(key)) key = String(key);
  const obj = /* @__PURE__ */ toRaw(this);
  track(obj, "has", key);
  return obj.hasOwnProperty(key);
}
class BaseReactiveHandler {
  constructor(_isReadonly = false, _isShallow = false) {
    this._isReadonly = _isReadonly;
    this._isShallow = _isShallow;
  }
  get(target, key, receiver) {
    if (key === "__v_skip") return target["__v_skip"];
    const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_isShallow") {
      return isShallow2;
    } else if (key === "__v_raw") {
      if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
        return target;
      }
      return;
    }
    const targetIsArray = isArray$1(target);
    if (!isReadonly2) {
      let fn;
      if (targetIsArray && (fn = arrayInstrumentations[key])) {
        return fn;
      }
      if (key === "hasOwnProperty") {
        return hasOwnProperty;
      }
    }
    const res = Reflect.get(
      target,
      key,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ isRef(target) ? target : receiver
    );
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }
    if (!isReadonly2) {
      track(target, "get", key);
    }
    if (isShallow2) {
      return res;
    }
    if (/* @__PURE__ */ isRef(res)) {
      const value = targetIsArray && isIntegerKey(key) ? res : res.value;
      return isReadonly2 && isObject(value) ? /* @__PURE__ */ readonly(value) : value;
    }
    if (isObject(res)) {
      return isReadonly2 ? /* @__PURE__ */ readonly(res) : /* @__PURE__ */ reactive(res);
    }
    return res;
  }
}
class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(false, isShallow2);
  }
  set(target, key, value, receiver) {
    let oldValue = target[key];
    const isArrayWithIntegerKey = isArray$1(target) && isIntegerKey(key);
    if (!this._isShallow) {
      const isOldValueReadonly = /* @__PURE__ */ isReadonly(oldValue);
      if (!/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
        oldValue = /* @__PURE__ */ toRaw(oldValue);
        value = /* @__PURE__ */ toRaw(value);
      }
      if (!isArrayWithIntegerKey && /* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
        if (isOldValueReadonly) {
          return true;
        } else {
          oldValue.value = value;
          return true;
        }
      }
    }
    const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
    const result = Reflect.set(
      target,
      key,
      value,
      /* @__PURE__ */ isRef(target) ? target : receiver
    );
    if (target === /* @__PURE__ */ toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, "add", key, value);
      } else if (hasChanged(value, oldValue)) {
        trigger(target, "set", key, value);
      }
    }
    return result;
  }
  deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, "delete", key, void 0);
    }
    return result;
  }
  has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, "has", key);
    }
    return result;
  }
  ownKeys(target) {
    track(
      target,
      "iterate",
      isArray$1(target) ? "length" : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
  }
}
class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(true, isShallow2);
  }
  set(target, key) {
    return true;
  }
  deleteProperty(target, key) {
    return true;
  }
}
const mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
const readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
const shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(true);
const shallowReadonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler(true);
const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function createIterableMethod(method, isReadonly2, isShallow2) {
  return function(...args) {
    const target = this["__v_raw"];
    const rawTarget = /* @__PURE__ */ toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
    !isReadonly2 && track(
      rawTarget,
      "iterate",
      isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
    );
    return extend(
      // inheriting all iterator properties
      Object.create(innerIterator),
      {
        // iterator protocol
        next() {
          const { value, done } = innerIterator.next();
          return done ? { value, done } : {
            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
            done
          };
        }
      }
    );
  };
}
function createReadonlyMethod(type) {
  return function(...args) {
    return type === "delete" ? false : type === "clear" ? void 0 : this;
  };
}
function createInstrumentations(readonly2, shallow) {
  const instrumentations = {
    get(key) {
      const target = this["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const rawKey = /* @__PURE__ */ toRaw(key);
      if (!readonly2) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, "get", key);
        }
        track(rawTarget, "get", rawKey);
      }
      const { has } = getProto(rawTarget);
      const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
      if (has.call(rawTarget, key)) {
        return wrap(target.get(key));
      } else if (has.call(rawTarget, rawKey)) {
        return wrap(target.get(rawKey));
      } else if (target !== rawTarget) {
        target.get(key);
      }
    },
    get size() {
      const target = this["__v_raw"];
      !readonly2 && track(/* @__PURE__ */ toRaw(target), "iterate", ITERATE_KEY);
      return target.size;
    },
    has(key) {
      const target = this["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const rawKey = /* @__PURE__ */ toRaw(key);
      if (!readonly2) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, "has", key);
        }
        track(rawTarget, "has", rawKey);
      }
      return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
    },
    forEach(callback, thisArg) {
      const observed = this;
      const target = observed["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
      !readonly2 && track(rawTarget, "iterate", ITERATE_KEY);
      return target.forEach((value, key) => {
        return callback.call(thisArg, wrap(value), wrap(key), observed);
      });
    }
  };
  extend(
    instrumentations,
    readonly2 ? {
      add: createReadonlyMethod("add"),
      set: createReadonlyMethod("set"),
      delete: createReadonlyMethod("delete"),
      clear: createReadonlyMethod("clear")
    } : {
      add(value) {
        const target = /* @__PURE__ */ toRaw(this);
        const proto = getProto(target);
        const rawValue = /* @__PURE__ */ toRaw(value);
        const valueToAdd = !shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value) ? rawValue : value;
        const hadKey = proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue);
        if (!hadKey) {
          target.add(valueToAdd);
          trigger(target, "add", valueToAdd, valueToAdd);
        }
        return this;
      },
      set(key, value) {
        if (!shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
          value = /* @__PURE__ */ toRaw(value);
        }
        const target = /* @__PURE__ */ toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = /* @__PURE__ */ toRaw(key);
          hadKey = has.call(target, key);
        }
        const oldValue = get.call(target, key);
        target.set(key, value);
        if (!hadKey) {
          trigger(target, "add", key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set", key, value);
        }
        return this;
      },
      delete(key) {
        const target = /* @__PURE__ */ toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = /* @__PURE__ */ toRaw(key);
          hadKey = has.call(target, key);
        }
        get ? get.call(target, key) : void 0;
        const result = target.delete(key);
        if (hadKey) {
          trigger(target, "delete", key, void 0);
        }
        return result;
      },
      clear() {
        const target = /* @__PURE__ */ toRaw(this);
        const hadItems = target.size !== 0;
        const result = target.clear();
        if (hadItems) {
          trigger(
            target,
            "clear",
            void 0,
            void 0
          );
        }
        return result;
      }
    }
  );
  const iteratorMethods = [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ];
  iteratorMethods.forEach((method) => {
    instrumentations[method] = createIterableMethod(method, readonly2, shallow);
  });
  return instrumentations;
}
function createInstrumentationGetter(isReadonly2, shallow) {
  const instrumentations = createInstrumentations(isReadonly2, shallow);
  return (target, key, receiver) => {
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_raw") {
      return target;
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target ? instrumentations : target,
      key,
      receiver
    );
  };
}
const mutableCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, false)
};
const shallowCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, true)
};
const readonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, false)
};
const shallowReadonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, true)
};
const reactiveMap = /* @__PURE__ */ new WeakMap();
const shallowReactiveMap = /* @__PURE__ */ new WeakMap();
const readonlyMap = /* @__PURE__ */ new WeakMap();
const shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
function targetTypeMap(rawType) {
  switch (rawType) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
function getTargetType(value) {
  return value["__v_skip"] || !Object.isExtensible(value) ? 0 : targetTypeMap(toRawType(value));
}
// @__NO_SIDE_EFFECTS__
function reactive(target) {
  if (/* @__PURE__ */ isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
// @__NO_SIDE_EFFECTS__
function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}
// @__NO_SIDE_EFFECTS__
function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}
// @__NO_SIDE_EFFECTS__
function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  );
}
function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
  if (!isObject(target)) {
    return target;
  }
  if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
    return target;
  }
  const targetType = getTargetType(target);
  if (targetType === 0) {
    return target;
  }
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const proxy = new Proxy(
    target,
    targetType === 2 ? collectionHandlers : baseHandlers
  );
  proxyMap.set(target, proxy);
  return proxy;
}
// @__NO_SIDE_EFFECTS__
function isReactive(value) {
  if (/* @__PURE__ */ isReadonly(value)) {
    return /* @__PURE__ */ isReactive(value["__v_raw"]);
  }
  return !!(value && value["__v_isReactive"]);
}
// @__NO_SIDE_EFFECTS__
function isReadonly(value) {
  return !!(value && value["__v_isReadonly"]);
}
// @__NO_SIDE_EFFECTS__
function isShallow(value) {
  return !!(value && value["__v_isShallow"]);
}
// @__NO_SIDE_EFFECTS__
function isProxy(value) {
  return value ? !!value["__v_raw"] : false;
}
// @__NO_SIDE_EFFECTS__
function toRaw(observed) {
  const raw = observed && observed["__v_raw"];
  return raw ? /* @__PURE__ */ toRaw(raw) : observed;
}
function markRaw(value) {
  if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) {
    def(value, "__v_skip", true);
  }
  return value;
}
const toReactive = (value) => isObject(value) ? /* @__PURE__ */ reactive(value) : value;
const toReadonly = (value) => isObject(value) ? /* @__PURE__ */ readonly(value) : value;
// @__NO_SIDE_EFFECTS__
function isRef(r) {
  return r ? r["__v_isRef"] === true : false;
}
// @__NO_SIDE_EFFECTS__
function ref(value) {
  return createRef(value, false);
}
// @__NO_SIDE_EFFECTS__
function shallowRef(value) {
  return createRef(value, true);
}
function createRef(rawValue, shallow) {
  if (/* @__PURE__ */ isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}
class RefImpl {
  constructor(value, isShallow2) {
    this.dep = new Dep();
    this["__v_isRef"] = true;
    this["__v_isShallow"] = false;
    this._rawValue = isShallow2 ? value : /* @__PURE__ */ toRaw(value);
    this._value = isShallow2 ? value : toReactive(value);
    this["__v_isShallow"] = isShallow2;
  }
  get value() {
    {
      this.dep.track();
    }
    return this._value;
  }
  set value(newValue) {
    const oldValue = this._rawValue;
    const useDirectValue = this["__v_isShallow"] || /* @__PURE__ */ isShallow(newValue) || /* @__PURE__ */ isReadonly(newValue);
    newValue = useDirectValue ? newValue : /* @__PURE__ */ toRaw(newValue);
    if (hasChanged(newValue, oldValue)) {
      this._rawValue = newValue;
      this._value = useDirectValue ? newValue : toReactive(newValue);
      {
        this.dep.trigger();
      }
    }
  }
}
function unref(ref2) {
  return /* @__PURE__ */ isRef(ref2) ? ref2.value : ref2;
}
const shallowUnwrapHandlers = {
  get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key];
    if (/* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
      oldValue.value = value;
      return true;
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  }
};
function proxyRefs(objectWithRefs) {
  return /* @__PURE__ */ isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}
// @__NO_SIDE_EFFECTS__
function toRefs(object) {
  const ret = isArray$1(object) ? new Array(object.length) : {};
  for (const key in object) {
    ret[key] = propertyToRef(object, key);
  }
  return ret;
}
class ObjectRefImpl {
  constructor(_object, _key, _defaultValue) {
    this._object = _object;
    this._key = _key;
    this._defaultValue = _defaultValue;
    this["__v_isRef"] = true;
    this._value = void 0;
    this._raw = /* @__PURE__ */ toRaw(_object);
    let shallow = true;
    let obj = _object;
    if (!isArray$1(_object) || !isIntegerKey(String(_key))) {
      do {
        shallow = !/* @__PURE__ */ isProxy(obj) || /* @__PURE__ */ isShallow(obj);
      } while (shallow && (obj = obj["__v_raw"]));
    }
    this._shallow = shallow;
  }
  get value() {
    let val = this._object[this._key];
    if (this._shallow) {
      val = unref(val);
    }
    return this._value = val === void 0 ? this._defaultValue : val;
  }
  set value(newVal) {
    if (this._shallow && /* @__PURE__ */ isRef(this._raw[this._key])) {
      const nestedRef = this._object[this._key];
      if (/* @__PURE__ */ isRef(nestedRef)) {
        nestedRef.value = newVal;
        return;
      }
    }
    this._object[this._key] = newVal;
  }
  get dep() {
    return getDepFromReactive(this._raw, this._key);
  }
}
function propertyToRef(source, key, defaultValue) {
  return new ObjectRefImpl(source, key, defaultValue);
}
class ComputedRefImpl {
  constructor(fn, setter, isSSR) {
    this.fn = fn;
    this.setter = setter;
    this._value = void 0;
    this.dep = new Dep(this);
    this.__v_isRef = true;
    this.deps = void 0;
    this.depsTail = void 0;
    this.flags = 16;
    this.globalVersion = globalVersion - 1;
    this.next = void 0;
    this.effect = this;
    this["__v_isReadonly"] = !setter;
    this.isSSR = isSSR;
  }
  /**
   * @internal
   */
  notify() {
    this.flags |= 16;
    if (!(this.flags & 8) && // avoid infinite self recursion
    activeSub !== this) {
      batch(this, true);
      return true;
    }
  }
  get value() {
    const link = this.dep.track();
    refreshComputed(this);
    if (link) {
      link.version = this.dep.version;
    }
    return this._value;
  }
  set value(newValue) {
    if (this.setter) {
      this.setter(newValue);
    }
  }
}
// @__NO_SIDE_EFFECTS__
function computed$1(getterOrOptions, debugOptions, isSSR = false) {
  let getter;
  let setter;
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  const cRef = new ComputedRefImpl(getter, setter, isSSR);
  return cRef;
}
const INITIAL_WATCHER_VALUE = {};
const cleanupMap = /* @__PURE__ */ new WeakMap();
let activeWatcher = void 0;
function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
  if (owner) {
    let cleanups = cleanupMap.get(owner);
    if (!cleanups) cleanupMap.set(owner, cleanups = []);
    cleanups.push(cleanupFn);
  }
}
function watch$1(source, cb, options = EMPTY_OBJ) {
  const { immediate, deep, once, scheduler, augmentJob, call } = options;
  const reactiveGetter = (source2) => {
    if (deep) return source2;
    if (/* @__PURE__ */ isShallow(source2) || deep === false || deep === 0)
      return traverse(source2, 1);
    return traverse(source2);
  };
  let effect2;
  let getter;
  let cleanup;
  let boundCleanup;
  let forceTrigger = false;
  let isMultiSource = false;
  if (/* @__PURE__ */ isRef(source)) {
    getter = () => source.value;
    forceTrigger = /* @__PURE__ */ isShallow(source);
  } else if (/* @__PURE__ */ isReactive(source)) {
    getter = () => reactiveGetter(source);
    forceTrigger = true;
  } else if (isArray$1(source)) {
    isMultiSource = true;
    forceTrigger = source.some((s) => /* @__PURE__ */ isReactive(s) || /* @__PURE__ */ isShallow(s));
    getter = () => source.map((s) => {
      if (/* @__PURE__ */ isRef(s)) {
        return s.value;
      } else if (/* @__PURE__ */ isReactive(s)) {
        return reactiveGetter(s);
      } else if (isFunction(s)) {
        return call ? call(s, 2) : s();
      } else ;
    });
  } else if (isFunction(source)) {
    if (cb) {
      getter = call ? () => call(source, 2) : source;
    } else {
      getter = () => {
        if (cleanup) {
          pauseTracking();
          try {
            cleanup();
          } finally {
            resetTracking();
          }
        }
        const currentEffect = activeWatcher;
        activeWatcher = effect2;
        try {
          return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
        } finally {
          activeWatcher = currentEffect;
        }
      };
    }
  } else {
    getter = NOOP;
  }
  if (cb && deep) {
    const baseGetter = getter;
    const depth = deep === true ? Infinity : deep;
    getter = () => traverse(baseGetter(), depth);
  }
  const scope = getCurrentScope();
  const watchHandle = () => {
    effect2.stop();
    if (scope && scope.active) {
      remove(scope.effects, effect2);
    }
  };
  if (once && cb) {
    const _cb = cb;
    cb = (...args) => {
      _cb(...args);
      watchHandle();
    };
  }
  let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
  const job = (immediateFirstRun) => {
    if (!(effect2.flags & 1) || !effect2.dirty && !immediateFirstRun) {
      return;
    }
    if (cb) {
      const newValue = effect2.run();
      if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
        if (cleanup) {
          cleanup();
        }
        const currentWatcher = activeWatcher;
        activeWatcher = effect2;
        try {
          const args = [
            newValue,
            // pass undefined as the old value when it's changed for the first time
            oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
            boundCleanup
          ];
          oldValue = newValue;
          call ? call(cb, 3, args) : (
            // @ts-expect-error
            cb(...args)
          );
        } finally {
          activeWatcher = currentWatcher;
        }
      }
    } else {
      effect2.run();
    }
  };
  if (augmentJob) {
    augmentJob(job);
  }
  effect2 = new ReactiveEffect(getter);
  effect2.scheduler = scheduler ? () => scheduler(job, false) : job;
  boundCleanup = (fn) => onWatcherCleanup(fn, false, effect2);
  cleanup = effect2.onStop = () => {
    const cleanups = cleanupMap.get(effect2);
    if (cleanups) {
      if (call) {
        call(cleanups, 4);
      } else {
        for (const cleanup2 of cleanups) cleanup2();
      }
      cleanupMap.delete(effect2);
    }
  };
  if (cb) {
    if (immediate) {
      job(true);
    } else {
      oldValue = effect2.run();
    }
  } else if (scheduler) {
    scheduler(job.bind(null, true), true);
  } else {
    effect2.run();
  }
  watchHandle.pause = effect2.pause.bind(effect2);
  watchHandle.resume = effect2.resume.bind(effect2);
  watchHandle.stop = watchHandle;
  return watchHandle;
}
function traverse(value, depth = Infinity, seen) {
  if (depth <= 0 || !isObject(value) || value["__v_skip"]) {
    return value;
  }
  seen = seen || /* @__PURE__ */ new Map();
  if ((seen.get(value) || 0) >= depth) {
    return value;
  }
  seen.set(value, depth);
  depth--;
  if (/* @__PURE__ */ isRef(value)) {
    traverse(value.value, depth, seen);
  } else if (isArray$1(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen);
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v) => {
      traverse(v, depth, seen);
    });
  } else if (isPlainObject$1(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen);
    }
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        traverse(value[key], depth, seen);
      }
    }
  }
  return value;
}
/**
* @vue/runtime-core v3.5.30
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
const stack = [];
let isWarning = false;
function warn$1(msg, ...args) {
  if (isWarning) return;
  isWarning = true;
  pauseTracking();
  const instance = stack.length ? stack[stack.length - 1].component : null;
  const appWarnHandler = instance && instance.appContext.config.warnHandler;
  const trace = getComponentTrace();
  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      11,
      [
        // eslint-disable-next-line no-restricted-syntax
        msg + args.map((a) => {
          var _a, _b;
          return (_b = (_a = a.toString) == null ? void 0 : _a.call(a)) != null ? _b : JSON.stringify(a);
        }).join(""),
        instance && instance.proxy,
        trace.map(
          ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
        ).join("\n"),
        trace
      ]
    );
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args];
    if (trace.length && // avoid spamming console during tests
    true) {
      warnArgs.push(`
`, ...formatTrace(trace));
    }
    console.warn(...warnArgs);
  }
  resetTracking();
  isWarning = false;
}
function getComponentTrace() {
  let currentVNode = stack[stack.length - 1];
  if (!currentVNode) {
    return [];
  }
  const normalizedStack = [];
  while (currentVNode) {
    const last = normalizedStack[0];
    if (last && last.vnode === currentVNode) {
      last.recurseCount++;
    } else {
      normalizedStack.push({
        vnode: currentVNode,
        recurseCount: 0
      });
    }
    const parentInstance = currentVNode.component && currentVNode.component.parent;
    currentVNode = parentInstance && parentInstance.vnode;
  }
  return normalizedStack;
}
function formatTrace(trace) {
  const logs = [];
  trace.forEach((entry, i) => {
    logs.push(...i === 0 ? [] : [`
`], ...formatTraceEntry(entry));
  });
  return logs;
}
function formatTraceEntry({ vnode, recurseCount }) {
  const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
  const isRoot = vnode.component ? vnode.component.parent == null : false;
  const open = ` at <${formatComponentName(
    vnode.component,
    vnode.type,
    isRoot
  )}`;
  const close = `>` + postfix;
  return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
}
function formatProps(props) {
  const res = [];
  const keys = Object.keys(props);
  keys.slice(0, 3).forEach((key) => {
    res.push(...formatProp(key, props[key]));
  });
  if (keys.length > 3) {
    res.push(` ...`);
  }
  return res;
}
function formatProp(key, value, raw) {
  if (isString(value)) {
    value = JSON.stringify(value);
    return raw ? value : [`${key}=${value}`];
  } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return raw ? value : [`${key}=${value}`];
  } else if (/* @__PURE__ */ isRef(value)) {
    value = formatProp(key, /* @__PURE__ */ toRaw(value.value), true);
    return raw ? value : [`${key}=Ref<`, value, `>`];
  } else if (isFunction(value)) {
    return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
  } else {
    value = /* @__PURE__ */ toRaw(value);
    return raw ? value : [`${key}=`, value];
  }
}
function callWithErrorHandling(fn, instance, type, args) {
  try {
    return args ? fn(...args) : fn();
  } catch (err) {
    handleError(err, instance, type);
  }
}
function callWithAsyncErrorHandling(fn, instance, type, args) {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, instance, type, args);
    if (res && isPromise(res)) {
      res.catch((err) => {
        handleError(err, instance, type);
      });
    }
    return res;
  }
  if (isArray$1(fn)) {
    const values = [];
    for (let i = 0; i < fn.length; i++) {
      values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
    }
    return values;
  }
}
function handleError(err, instance, type, throwInDev = true) {
  const contextVNode = instance ? instance.vnode : null;
  const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
  if (instance) {
    let cur = instance.parent;
    const exposedInstance = instance.proxy;
    const errorInfo = `https://vuejs.org/error-reference/#runtime-${type}`;
    while (cur) {
      const errorCapturedHooks = cur.ec;
      if (errorCapturedHooks) {
        for (let i = 0; i < errorCapturedHooks.length; i++) {
          if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
            return;
          }
        }
      }
      cur = cur.parent;
    }
    if (errorHandler) {
      pauseTracking();
      callWithErrorHandling(errorHandler, null, 10, [
        err,
        exposedInstance,
        errorInfo
      ]);
      resetTracking();
      return;
    }
  }
  logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
}
function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
  if (throwInProd) {
    throw err;
  } else {
    console.error(err);
  }
}
const queue = [];
let flushIndex = -1;
const pendingPostFlushCbs = [];
let activePostFlushCbs = null;
let postFlushIndex = 0;
const resolvedPromise = /* @__PURE__ */ Promise.resolve();
let currentFlushPromise = null;
function nextTick(fn) {
  const p2 = currentFlushPromise || resolvedPromise;
  return fn ? p2.then(this ? fn.bind(this) : fn) : p2;
}
function findInsertionIndex$1(id) {
  let start = flushIndex + 1;
  let end = queue.length;
  while (start < end) {
    const middle = start + end >>> 1;
    const middleJob = queue[middle];
    const middleJobId = getId(middleJob);
    if (middleJobId < id || middleJobId === id && middleJob.flags & 2) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }
  return start;
}
function queueJob(job) {
  if (!(job.flags & 1)) {
    const jobId = getId(job);
    const lastJob = queue[queue.length - 1];
    if (!lastJob || // fast path when the job id is larger than the tail
    !(job.flags & 2) && jobId >= getId(lastJob)) {
      queue.push(job);
    } else {
      queue.splice(findInsertionIndex$1(jobId), 0, job);
    }
    job.flags |= 1;
    queueFlush();
  }
}
function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}
function queuePostFlushCb(cb) {
  if (!isArray$1(cb)) {
    if (activePostFlushCbs && cb.id === -1) {
      activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
    } else if (!(cb.flags & 1)) {
      pendingPostFlushCbs.push(cb);
      cb.flags |= 1;
    }
  } else {
    pendingPostFlushCbs.push(...cb);
  }
  queueFlush();
}
function flushPreFlushCbs(instance, seen, i = flushIndex + 1) {
  for (; i < queue.length; i++) {
    const cb = queue[i];
    if (cb && cb.flags & 2) {
      if (instance && cb.id !== instance.uid) {
        continue;
      }
      queue.splice(i, 1);
      i--;
      if (cb.flags & 4) {
        cb.flags &= -2;
      }
      cb();
      if (!(cb.flags & 4)) {
        cb.flags &= -2;
      }
    }
  }
}
function flushPostFlushCbs(seen) {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)].sort(
      (a, b) => getId(a) - getId(b)
    );
    pendingPostFlushCbs.length = 0;
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped);
      return;
    }
    activePostFlushCbs = deduped;
    for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
      const cb = activePostFlushCbs[postFlushIndex];
      if (cb.flags & 4) {
        cb.flags &= -2;
      }
      if (!(cb.flags & 8)) cb();
      cb.flags &= -2;
    }
    activePostFlushCbs = null;
    postFlushIndex = 0;
  }
}
const getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
function flushJobs(seen) {
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job && !(job.flags & 8)) {
        if (false) ;
        if (job.flags & 4) {
          job.flags &= ~1;
        }
        callWithErrorHandling(
          job,
          job.i,
          job.i ? 15 : 14
        );
        if (!(job.flags & 4)) {
          job.flags &= ~1;
        }
      }
    }
  } finally {
    for (; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job) {
        job.flags &= -2;
      }
    }
    flushIndex = -1;
    queue.length = 0;
    flushPostFlushCbs();
    currentFlushPromise = null;
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs();
    }
  }
}
let currentRenderingInstance = null;
let currentScopeId = null;
function setCurrentRenderingInstance(instance) {
  const prev = currentRenderingInstance;
  currentRenderingInstance = instance;
  currentScopeId = instance && instance.type.__scopeId || null;
  return prev;
}
function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
  if (!ctx) return fn;
  if (fn._n) {
    return fn;
  }
  const renderFnWithContext = (...args) => {
    if (renderFnWithContext._d) {
      setBlockTracking(-1);
    }
    const prevInstance = setCurrentRenderingInstance(ctx);
    let res;
    try {
      res = fn(...args);
    } finally {
      setCurrentRenderingInstance(prevInstance);
      if (renderFnWithContext._d) {
        setBlockTracking(1);
      }
    }
    return res;
  };
  renderFnWithContext._n = true;
  renderFnWithContext._c = true;
  renderFnWithContext._d = true;
  return renderFnWithContext;
}
function withDirectives(vnode, directives) {
  if (currentRenderingInstance === null) {
    return vnode;
  }
  const instance = getComponentPublicInstance(currentRenderingInstance);
  const bindings = vnode.dirs || (vnode.dirs = []);
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
    if (dir) {
      if (isFunction(dir)) {
        dir = {
          mounted: dir,
          updated: dir
        };
      }
      if (dir.deep) {
        traverse(value);
      }
      bindings.push({
        dir,
        instance,
        value,
        oldValue: void 0,
        arg,
        modifiers
      });
    }
  }
  return vnode;
}
function invokeDirectiveHook(vnode, prevVNode, instance, name) {
  const bindings = vnode.dirs;
  const oldBindings = prevVNode && prevVNode.dirs;
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i];
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value;
    }
    let hook = binding.dir[name];
    if (hook) {
      pauseTracking();
      callWithAsyncErrorHandling(hook, instance, 8, [
        vnode.el,
        binding,
        vnode,
        prevVNode
      ]);
      resetTracking();
    }
  }
}
function provide(key, value) {
  if (currentInstance) {
    let provides = currentInstance.provides;
    const parentProvides = currentInstance.parent && currentInstance.parent.provides;
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides);
    }
    provides[key] = value;
  }
}
function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = getCurrentInstance();
  if (instance || currentApp) {
    let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
    if (provides && key in provides) {
      return provides[key];
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
    } else ;
  }
}
function hasInjectionContext() {
  return !!(getCurrentInstance() || currentApp);
}
const ssrContextKey = /* @__PURE__ */ Symbol.for("v-scx");
const useSSRContext = () => {
  {
    const ctx = inject(ssrContextKey);
    return ctx;
  }
};
function watch(source, cb, options) {
  return doWatch(source, cb, options);
}
function doWatch(source, cb, options = EMPTY_OBJ) {
  const { immediate, deep, flush, once } = options;
  const baseWatchOptions = extend({}, options);
  const runsImmediately = cb && immediate || !cb && flush !== "post";
  let ssrCleanup;
  if (isInSSRComponentSetup) {
    if (flush === "sync") {
      const ctx = useSSRContext();
      ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
    } else if (!runsImmediately) {
      const watchStopHandle = () => {
      };
      watchStopHandle.stop = NOOP;
      watchStopHandle.resume = NOOP;
      watchStopHandle.pause = NOOP;
      return watchStopHandle;
    }
  }
  const instance = currentInstance;
  baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
  let isPre = false;
  if (flush === "post") {
    baseWatchOptions.scheduler = (job) => {
      queuePostRenderEffect(job, instance && instance.suspense);
    };
  } else if (flush !== "sync") {
    isPre = true;
    baseWatchOptions.scheduler = (job, isFirstRun) => {
      if (isFirstRun) {
        job();
      } else {
        queueJob(job);
      }
    };
  }
  baseWatchOptions.augmentJob = (job) => {
    if (cb) {
      job.flags |= 4;
    }
    if (isPre) {
      job.flags |= 2;
      if (instance) {
        job.id = instance.uid;
        job.i = instance;
      }
    }
  };
  const watchHandle = watch$1(source, cb, baseWatchOptions);
  if (isInSSRComponentSetup) {
    if (ssrCleanup) {
      ssrCleanup.push(watchHandle);
    } else if (runsImmediately) {
      watchHandle();
    }
  }
  return watchHandle;
}
function instanceWatch(source, value, options) {
  const publicThis = this.proxy;
  const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
  let cb;
  if (isFunction(value)) {
    cb = value;
  } else {
    cb = value.handler;
    options = value;
  }
  const reset = setCurrentInstance(this);
  const res = doWatch(getter, cb.bind(publicThis), options);
  reset();
  return res;
}
function createPathGetter(ctx, path) {
  const segments = path.split(".");
  return () => {
    let cur = ctx;
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]];
    }
    return cur;
  };
}
const TeleportEndKey = /* @__PURE__ */ Symbol("_vte");
const isTeleport = (type) => type.__isTeleport;
const isTeleportDisabled = (props) => props && (props.disabled || props.disabled === "");
const isTeleportDeferred = (props) => props && (props.defer || props.defer === "");
const isTargetSVG = (target) => typeof SVGElement !== "undefined" && target instanceof SVGElement;
const isTargetMathML = (target) => typeof MathMLElement === "function" && target instanceof MathMLElement;
const resolveTarget = (props, select) => {
  const targetSelector = props && props.to;
  if (isString(targetSelector)) {
    if (!select) {
      return null;
    } else {
      const target = select(targetSelector);
      return target;
    }
  } else {
    return targetSelector;
  }
};
const TeleportImpl = {
  name: "Teleport",
  __isTeleport: true,
  process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals) {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment }
    } = internals;
    const disabled = isTeleportDisabled(n2.props);
    let { shapeFlag, children, dynamicChildren } = n2;
    if (n1 == null) {
      const placeholder = n2.el = createText("");
      const mainAnchor = n2.anchor = createText("");
      insert(placeholder, container, anchor);
      insert(mainAnchor, container, anchor);
      const mount = (container2, anchor2) => {
        if (shapeFlag & 16) {
          mountChildren(
            children,
            container2,
            anchor2,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      };
      const mountToTarget = () => {
        const target = n2.target = resolveTarget(n2.props, querySelector);
        const targetAnchor = prepareAnchor(target, n2, createText, insert);
        if (target) {
          if (namespace !== "svg" && isTargetSVG(target)) {
            namespace = "svg";
          } else if (namespace !== "mathml" && isTargetMathML(target)) {
            namespace = "mathml";
          }
          if (parentComponent && parentComponent.isCE) {
            (parentComponent.ce._teleportTargets || (parentComponent.ce._teleportTargets = /* @__PURE__ */ new Set())).add(target);
          }
          if (!disabled) {
            mount(target, targetAnchor);
            updateCssVars(n2, false);
          }
        }
      };
      if (disabled) {
        mount(container, mainAnchor);
        updateCssVars(n2, true);
      }
      if (isTeleportDeferred(n2.props)) {
        n2.el.__isMounted = false;
        queuePostRenderEffect(() => {
          mountToTarget();
          delete n2.el.__isMounted;
        }, parentSuspense);
      } else {
        mountToTarget();
      }
    } else {
      if (isTeleportDeferred(n2.props) && n1.el.__isMounted === false) {
        queuePostRenderEffect(() => {
          TeleportImpl.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals
          );
        }, parentSuspense);
        return;
      }
      n2.el = n1.el;
      n2.targetStart = n1.targetStart;
      const mainAnchor = n2.anchor = n1.anchor;
      const target = n2.target = n1.target;
      const targetAnchor = n2.targetAnchor = n1.targetAnchor;
      const wasDisabled = isTeleportDisabled(n1.props);
      const currentContainer = wasDisabled ? container : target;
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;
      if (namespace === "svg" || isTargetSVG(target)) {
        namespace = "svg";
      } else if (namespace === "mathml" || isTargetMathML(target)) {
        namespace = "mathml";
      }
      if (dynamicChildren) {
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          currentContainer,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds
        );
        traverseStaticChildren(n1, n2, true);
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          currentContainer,
          currentAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          false
        );
      }
      if (disabled) {
        if (!wasDisabled) {
          moveTeleport(
            n2,
            container,
            mainAnchor,
            internals,
            1
          );
        } else {
          if (n2.props && n1.props && n2.props.to !== n1.props.to) {
            n2.props.to = n1.props.to;
          }
        }
      } else {
        if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          const nextTarget = n2.target = resolveTarget(
            n2.props,
            querySelector
          );
          if (nextTarget) {
            moveTeleport(
              n2,
              nextTarget,
              null,
              internals,
              0
            );
          }
        } else if (wasDisabled) {
          moveTeleport(
            n2,
            target,
            targetAnchor,
            internals,
            1
          );
        }
      }
      updateCssVars(n2, disabled);
    }
  },
  remove(vnode, parentComponent, parentSuspense, { um: unmount, o: { remove: hostRemove } }, doRemove) {
    const {
      shapeFlag,
      children,
      anchor,
      targetStart,
      targetAnchor,
      target,
      props
    } = vnode;
    if (target) {
      hostRemove(targetStart);
      hostRemove(targetAnchor);
    }
    doRemove && hostRemove(anchor);
    if (shapeFlag & 16) {
      const shouldRemove = doRemove || !isTeleportDisabled(props);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        unmount(
          child,
          parentComponent,
          parentSuspense,
          shouldRemove,
          !!child.dynamicChildren
        );
      }
    }
  },
  move: moveTeleport,
  hydrate: hydrateTeleport
};
function moveTeleport(vnode, container, parentAnchor, { o: { insert }, m: move }, moveType = 2) {
  if (moveType === 0) {
    insert(vnode.targetAnchor, container, parentAnchor);
  }
  const { el, anchor, shapeFlag, children, props } = vnode;
  const isReorder = moveType === 2;
  if (isReorder) {
    insert(el, container, parentAnchor);
  }
  if (!isReorder || isTeleportDisabled(props)) {
    if (shapeFlag & 16) {
      for (let i = 0; i < children.length; i++) {
        move(
          children[i],
          container,
          parentAnchor,
          2
        );
      }
    }
  }
  if (isReorder) {
    insert(anchor, container, parentAnchor);
  }
}
function hydrateTeleport(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized, {
  o: { nextSibling, parentNode, querySelector, insert, createText }
}, hydrateChildren) {
  function hydrateAnchor(target2, targetNode) {
    let targetAnchor = targetNode;
    while (targetAnchor) {
      if (targetAnchor && targetAnchor.nodeType === 8) {
        if (targetAnchor.data === "teleport start anchor") {
          vnode.targetStart = targetAnchor;
        } else if (targetAnchor.data === "teleport anchor") {
          vnode.targetAnchor = targetAnchor;
          target2._lpa = vnode.targetAnchor && nextSibling(vnode.targetAnchor);
          break;
        }
      }
      targetAnchor = nextSibling(targetAnchor);
    }
  }
  function hydrateDisabledTeleport(node2, vnode2) {
    vnode2.anchor = hydrateChildren(
      nextSibling(node2),
      vnode2,
      parentNode(node2),
      parentComponent,
      parentSuspense,
      slotScopeIds,
      optimized
    );
  }
  const target = vnode.target = resolveTarget(
    vnode.props,
    querySelector
  );
  const disabled = isTeleportDisabled(vnode.props);
  if (target) {
    const targetNode = target._lpa || target.firstChild;
    if (vnode.shapeFlag & 16) {
      if (disabled) {
        hydrateDisabledTeleport(node, vnode);
        hydrateAnchor(target, targetNode);
        if (!vnode.targetAnchor) {
          prepareAnchor(
            target,
            vnode,
            createText,
            insert,
            // if target is the same as the main view, insert anchors before current node
            // to avoid hydrating mismatch
            parentNode(node) === target ? node : null
          );
        }
      } else {
        vnode.anchor = nextSibling(node);
        hydrateAnchor(target, targetNode);
        if (!vnode.targetAnchor) {
          prepareAnchor(target, vnode, createText, insert);
        }
        hydrateChildren(
          targetNode && nextSibling(targetNode),
          vnode,
          target,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized
        );
      }
    }
    updateCssVars(vnode, disabled);
  } else if (disabled) {
    if (vnode.shapeFlag & 16) {
      hydrateDisabledTeleport(node, vnode);
      vnode.targetStart = node;
      vnode.targetAnchor = nextSibling(node);
    }
  }
  return vnode.anchor && nextSibling(vnode.anchor);
}
const Teleport = TeleportImpl;
function updateCssVars(vnode, isDisabled) {
  const ctx = vnode.ctx;
  if (ctx && ctx.ut) {
    let node, anchor;
    if (isDisabled) {
      node = vnode.el;
      anchor = vnode.anchor;
    } else {
      node = vnode.targetStart;
      anchor = vnode.targetAnchor;
    }
    while (node && node !== anchor) {
      if (node.nodeType === 1) node.setAttribute("data-v-owner", ctx.uid);
      node = node.nextSibling;
    }
    ctx.ut();
  }
}
function prepareAnchor(target, vnode, createText, insert, anchor = null) {
  const targetStart = vnode.targetStart = createText("");
  const targetAnchor = vnode.targetAnchor = createText("");
  targetStart[TeleportEndKey] = targetAnchor;
  if (target) {
    insert(targetStart, target, anchor);
    insert(targetAnchor, target, anchor);
  }
  return targetAnchor;
}
const leaveCbKey = /* @__PURE__ */ Symbol("_leaveCb");
const enterCbKey = /* @__PURE__ */ Symbol("_enterCb");
function useTransitionState() {
  const state = {
    isMounted: false,
    isLeaving: false,
    isUnmounting: false,
    leavingVNodes: /* @__PURE__ */ new Map()
  };
  onMounted(() => {
    state.isMounted = true;
  });
  onBeforeUnmount(() => {
    state.isUnmounting = true;
  });
  return state;
}
const TransitionHookValidator = [Function, Array];
const BaseTransitionPropsValidators = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  // enter
  onBeforeEnter: TransitionHookValidator,
  onEnter: TransitionHookValidator,
  onAfterEnter: TransitionHookValidator,
  onEnterCancelled: TransitionHookValidator,
  // leave
  onBeforeLeave: TransitionHookValidator,
  onLeave: TransitionHookValidator,
  onAfterLeave: TransitionHookValidator,
  onLeaveCancelled: TransitionHookValidator,
  // appear
  onBeforeAppear: TransitionHookValidator,
  onAppear: TransitionHookValidator,
  onAfterAppear: TransitionHookValidator,
  onAppearCancelled: TransitionHookValidator
};
const recursiveGetSubtree = (instance) => {
  const subTree = instance.subTree;
  return subTree.component ? recursiveGetSubtree(subTree.component) : subTree;
};
const BaseTransitionImpl = {
  name: `BaseTransition`,
  props: BaseTransitionPropsValidators,
  setup(props, { slots }) {
    const instance = getCurrentInstance();
    const state = useTransitionState();
    return () => {
      const children = slots.default && getTransitionRawChildren(slots.default(), true);
      if (!children || !children.length) {
        return;
      }
      const child = findNonCommentChild(children);
      const rawProps = /* @__PURE__ */ toRaw(props);
      const { mode } = rawProps;
      if (state.isLeaving) {
        return emptyPlaceholder(child);
      }
      const innerChild = getInnerChild$1(child);
      if (!innerChild) {
        return emptyPlaceholder(child);
      }
      let enterHooks = resolveTransitionHooks(
        innerChild,
        rawProps,
        state,
        instance,
        // #11061, ensure enterHooks is fresh after clone
        (hooks) => enterHooks = hooks
      );
      if (innerChild.type !== Comment) {
        setTransitionHooks(innerChild, enterHooks);
      }
      let oldInnerChild = instance.subTree && getInnerChild$1(instance.subTree);
      if (oldInnerChild && oldInnerChild.type !== Comment && !isSameVNodeType(oldInnerChild, innerChild) && recursiveGetSubtree(instance).type !== Comment) {
        let leavingHooks = resolveTransitionHooks(
          oldInnerChild,
          rawProps,
          state,
          instance
        );
        setTransitionHooks(oldInnerChild, leavingHooks);
        if (mode === "out-in" && innerChild.type !== Comment) {
          state.isLeaving = true;
          leavingHooks.afterLeave = () => {
            state.isLeaving = false;
            if (!(instance.job.flags & 8)) {
              instance.update();
            }
            delete leavingHooks.afterLeave;
            oldInnerChild = void 0;
          };
          return emptyPlaceholder(child);
        } else if (mode === "in-out" && innerChild.type !== Comment) {
          leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
            const leavingVNodesCache = getLeavingNodesForType(
              state,
              oldInnerChild
            );
            leavingVNodesCache[String(oldInnerChild.key)] = oldInnerChild;
            el[leaveCbKey] = () => {
              earlyRemove();
              el[leaveCbKey] = void 0;
              delete enterHooks.delayedLeave;
              oldInnerChild = void 0;
            };
            enterHooks.delayedLeave = () => {
              delayedLeave();
              delete enterHooks.delayedLeave;
              oldInnerChild = void 0;
            };
          };
        } else {
          oldInnerChild = void 0;
        }
      } else if (oldInnerChild) {
        oldInnerChild = void 0;
      }
      return child;
    };
  }
};
function findNonCommentChild(children) {
  let child = children[0];
  if (children.length > 1) {
    for (const c of children) {
      if (c.type !== Comment) {
        child = c;
        break;
      }
    }
  }
  return child;
}
const BaseTransition = BaseTransitionImpl;
function getLeavingNodesForType(state, vnode) {
  const { leavingVNodes } = state;
  let leavingVNodesCache = leavingVNodes.get(vnode.type);
  if (!leavingVNodesCache) {
    leavingVNodesCache = /* @__PURE__ */ Object.create(null);
    leavingVNodes.set(vnode.type, leavingVNodesCache);
  }
  return leavingVNodesCache;
}
function resolveTransitionHooks(vnode, props, state, instance, postClone) {
  const {
    appear,
    mode,
    persisted = false,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled,
    onBeforeAppear,
    onAppear,
    onAfterAppear,
    onAppearCancelled
  } = props;
  const key = String(vnode.key);
  const leavingVNodesCache = getLeavingNodesForType(state, vnode);
  const callHook2 = (hook, args) => {
    hook && callWithAsyncErrorHandling(
      hook,
      instance,
      9,
      args
    );
  };
  const callAsyncHook = (hook, args) => {
    const done = args[1];
    callHook2(hook, args);
    if (isArray$1(hook)) {
      if (hook.every((hook2) => hook2.length <= 1)) done();
    } else if (hook.length <= 1) {
      done();
    }
  };
  const hooks = {
    mode,
    persisted,
    beforeEnter(el) {
      let hook = onBeforeEnter;
      if (!state.isMounted) {
        if (appear) {
          hook = onBeforeAppear || onBeforeEnter;
        } else {
          return;
        }
      }
      if (el[leaveCbKey]) {
        el[leaveCbKey](
          true
          /* cancelled */
        );
      }
      const leavingVNode = leavingVNodesCache[key];
      if (leavingVNode && isSameVNodeType(vnode, leavingVNode) && leavingVNode.el[leaveCbKey]) {
        leavingVNode.el[leaveCbKey]();
      }
      callHook2(hook, [el]);
    },
    enter(el) {
      if (leavingVNodesCache[key] === vnode) return;
      let hook = onEnter;
      let afterHook = onAfterEnter;
      let cancelHook = onEnterCancelled;
      if (!state.isMounted) {
        if (appear) {
          hook = onAppear || onEnter;
          afterHook = onAfterAppear || onAfterEnter;
          cancelHook = onAppearCancelled || onEnterCancelled;
        } else {
          return;
        }
      }
      let called = false;
      el[enterCbKey] = (cancelled) => {
        if (called) return;
        called = true;
        if (cancelled) {
          callHook2(cancelHook, [el]);
        } else {
          callHook2(afterHook, [el]);
        }
        if (hooks.delayedLeave) {
          hooks.delayedLeave();
        }
        el[enterCbKey] = void 0;
      };
      const done = el[enterCbKey].bind(null, false);
      if (hook) {
        callAsyncHook(hook, [el, done]);
      } else {
        done();
      }
    },
    leave(el, remove2) {
      const key2 = String(vnode.key);
      if (el[enterCbKey]) {
        el[enterCbKey](
          true
          /* cancelled */
        );
      }
      if (state.isUnmounting) {
        return remove2();
      }
      callHook2(onBeforeLeave, [el]);
      let called = false;
      el[leaveCbKey] = (cancelled) => {
        if (called) return;
        called = true;
        remove2();
        if (cancelled) {
          callHook2(onLeaveCancelled, [el]);
        } else {
          callHook2(onAfterLeave, [el]);
        }
        el[leaveCbKey] = void 0;
        if (leavingVNodesCache[key2] === vnode) {
          delete leavingVNodesCache[key2];
        }
      };
      const done = el[leaveCbKey].bind(null, false);
      leavingVNodesCache[key2] = vnode;
      if (onLeave) {
        callAsyncHook(onLeave, [el, done]);
      } else {
        done();
      }
    },
    clone(vnode2) {
      const hooks2 = resolveTransitionHooks(
        vnode2,
        props,
        state,
        instance,
        postClone
      );
      if (postClone) postClone(hooks2);
      return hooks2;
    }
  };
  return hooks;
}
function emptyPlaceholder(vnode) {
  if (isKeepAlive(vnode)) {
    vnode = cloneVNode(vnode);
    vnode.children = null;
    return vnode;
  }
}
function getInnerChild$1(vnode) {
  if (!isKeepAlive(vnode)) {
    if (isTeleport(vnode.type) && vnode.children) {
      return findNonCommentChild(vnode.children);
    }
    return vnode;
  }
  if (vnode.component) {
    return vnode.component.subTree;
  }
  const { shapeFlag, children } = vnode;
  if (children) {
    if (shapeFlag & 16) {
      return children[0];
    }
    if (shapeFlag & 32 && isFunction(children.default)) {
      return children.default();
    }
  }
}
function setTransitionHooks(vnode, hooks) {
  if (vnode.shapeFlag & 6 && vnode.component) {
    vnode.transition = hooks;
    setTransitionHooks(vnode.component.subTree, hooks);
  } else if (vnode.shapeFlag & 128) {
    vnode.ssContent.transition = hooks.clone(vnode.ssContent);
    vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
  } else {
    vnode.transition = hooks;
  }
}
function getTransitionRawChildren(children, keepComment = false, parentKey) {
  let ret = [];
  let keyedFragmentCount = 0;
  for (let i = 0; i < children.length; i++) {
    let child = children[i];
    const key = parentKey == null ? child.key : String(parentKey) + String(child.key != null ? child.key : i);
    if (child.type === Fragment) {
      if (child.patchFlag & 128) keyedFragmentCount++;
      ret = ret.concat(
        getTransitionRawChildren(child.children, keepComment, key)
      );
    } else if (keepComment || child.type !== Comment) {
      ret.push(key != null ? cloneVNode(child, { key }) : child);
    }
  }
  if (keyedFragmentCount > 1) {
    for (let i = 0; i < ret.length; i++) {
      ret[i].patchFlag = -2;
    }
  }
  return ret;
}
// @__NO_SIDE_EFFECTS__
function defineComponent(options, extraOptions) {
  return isFunction(options) ? (
    // #8236: extend call and options.name access are considered side-effects
    // by Rollup, so we have to wrap it in a pure-annotated IIFE.
    /* @__PURE__ */ (() => extend({ name: options.name }, extraOptions, { setup: options }))()
  ) : options;
}
function markAsyncBoundary(instance) {
  instance.ids = [instance.ids[0] + instance.ids[2]++ + "-", 0, 0];
}
function isTemplateRefKey(refs, key) {
  let desc;
  return !!((desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable);
}
const pendingSetRefMap = /* @__PURE__ */ new WeakMap();
function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
  if (isArray$1(rawRef)) {
    rawRef.forEach(
      (r, i) => setRef(
        r,
        oldRawRef && (isArray$1(oldRawRef) ? oldRawRef[i] : oldRawRef),
        parentSuspense,
        vnode,
        isUnmount
      )
    );
    return;
  }
  if (isAsyncWrapper(vnode) && !isUnmount) {
    if (vnode.shapeFlag & 512 && vnode.type.__asyncResolved && vnode.component.subTree.component) {
      setRef(rawRef, oldRawRef, parentSuspense, vnode.component.subTree);
    }
    return;
  }
  const refValue = vnode.shapeFlag & 4 ? getComponentPublicInstance(vnode.component) : vnode.el;
  const value = isUnmount ? null : refValue;
  const { i: owner, r: ref3 } = rawRef;
  const oldRef = oldRawRef && oldRawRef.r;
  const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
  const setupState = owner.setupState;
  const rawSetupState = /* @__PURE__ */ toRaw(setupState);
  const canSetSetupRef = setupState === EMPTY_OBJ ? NO : (key) => {
    if (isTemplateRefKey(refs, key)) {
      return false;
    }
    return hasOwn(rawSetupState, key);
  };
  const canSetRef = (ref22, key) => {
    if (key && isTemplateRefKey(refs, key)) {
      return false;
    }
    return true;
  };
  if (oldRef != null && oldRef !== ref3) {
    invalidatePendingSetRef(oldRawRef);
    if (isString(oldRef)) {
      refs[oldRef] = null;
      if (canSetSetupRef(oldRef)) {
        setupState[oldRef] = null;
      }
    } else if (/* @__PURE__ */ isRef(oldRef)) {
      const oldRawRefAtom = oldRawRef;
      if (canSetRef(oldRef, oldRawRefAtom.k)) {
        oldRef.value = null;
      }
      if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null;
    }
  }
  if (isFunction(ref3)) {
    callWithErrorHandling(ref3, owner, 12, [value, refs]);
  } else {
    const _isString = isString(ref3);
    const _isRef = /* @__PURE__ */ isRef(ref3);
    if (_isString || _isRef) {
      const doSet = () => {
        if (rawRef.f) {
          const existing = _isString ? canSetSetupRef(ref3) ? setupState[ref3] : refs[ref3] : canSetRef() || !rawRef.k ? ref3.value : refs[rawRef.k];
          if (isUnmount) {
            isArray$1(existing) && remove(existing, refValue);
          } else {
            if (!isArray$1(existing)) {
              if (_isString) {
                refs[ref3] = [refValue];
                if (canSetSetupRef(ref3)) {
                  setupState[ref3] = refs[ref3];
                }
              } else {
                const newVal = [refValue];
                if (canSetRef(ref3, rawRef.k)) {
                  ref3.value = newVal;
                }
                if (rawRef.k) refs[rawRef.k] = newVal;
              }
            } else if (!existing.includes(refValue)) {
              existing.push(refValue);
            }
          }
        } else if (_isString) {
          refs[ref3] = value;
          if (canSetSetupRef(ref3)) {
            setupState[ref3] = value;
          }
        } else if (_isRef) {
          if (canSetRef(ref3, rawRef.k)) {
            ref3.value = value;
          }
          if (rawRef.k) refs[rawRef.k] = value;
        } else ;
      };
      if (value) {
        const job = () => {
          doSet();
          pendingSetRefMap.delete(rawRef);
        };
        job.id = -1;
        pendingSetRefMap.set(rawRef, job);
        queuePostRenderEffect(job, parentSuspense);
      } else {
        invalidatePendingSetRef(rawRef);
        doSet();
      }
    }
  }
}
function invalidatePendingSetRef(rawRef) {
  const pendingSetRef = pendingSetRefMap.get(rawRef);
  if (pendingSetRef) {
    pendingSetRef.flags |= 8;
    pendingSetRefMap.delete(rawRef);
  }
}
getGlobalThis().requestIdleCallback || ((cb) => setTimeout(cb, 1));
getGlobalThis().cancelIdleCallback || ((id) => clearTimeout(id));
const isAsyncWrapper = (i) => !!i.type.__asyncLoader;
const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
function onActivated(hook, target) {
  registerKeepAliveHook(hook, "a", target);
}
function onDeactivated(hook, target) {
  registerKeepAliveHook(hook, "da", target);
}
function registerKeepAliveHook(hook, type, target = currentInstance) {
  const wrappedHook = hook.__wdc || (hook.__wdc = () => {
    let current = target;
    while (current) {
      if (current.isDeactivated) {
        return;
      }
      current = current.parent;
    }
    return hook();
  });
  injectHook(type, wrappedHook, target);
  if (target) {
    let current = target.parent;
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current);
      }
      current = current.parent;
    }
  }
}
function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
  const injected = injectHook(
    type,
    hook,
    keepAliveRoot,
    true
    /* prepend */
  );
  onUnmounted(() => {
    remove(keepAliveRoot[type], injected);
  }, target);
}
function injectHook(type, hook, target = currentInstance, prepend = false) {
  if (target) {
    const hooks = target[type] || (target[type] = []);
    const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
      pauseTracking();
      const reset = setCurrentInstance(target);
      const res = callWithAsyncErrorHandling(hook, target, type, args);
      reset();
      resetTracking();
      return res;
    });
    if (prepend) {
      hooks.unshift(wrappedHook);
    } else {
      hooks.push(wrappedHook);
    }
    return wrappedHook;
  }
}
const createHook = (lifecycle) => (hook, target = currentInstance) => {
  if (!isInSSRComponentSetup || lifecycle === "sp") {
    injectHook(lifecycle, (...args) => hook(...args), target);
  }
};
const onBeforeMount = createHook("bm");
const onMounted = createHook("m");
const onBeforeUpdate = createHook(
  "bu"
);
const onUpdated = createHook("u");
const onBeforeUnmount = createHook(
  "bum"
);
const onUnmounted = createHook("um");
const onServerPrefetch = createHook(
  "sp"
);
const onRenderTriggered = createHook("rtg");
const onRenderTracked = createHook("rtc");
function onErrorCaptured(hook, target = currentInstance) {
  injectHook("ec", hook, target);
}
const COMPONENTS = "components";
function resolveComponent(name, maybeSelfReference) {
  return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name;
}
const NULL_DYNAMIC_COMPONENT = /* @__PURE__ */ Symbol.for("v-ndc");
function resolveDynamicComponent(component) {
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component;
  } else {
    return component || NULL_DYNAMIC_COMPONENT;
  }
}
function resolveAsset(type, name, warnMissing = true, maybeSelfReference = false) {
  const instance = currentRenderingInstance || currentInstance;
  if (instance) {
    const Component = instance.type;
    {
      const selfName = getComponentName(
        Component,
        false
      );
      if (selfName && (selfName === name || selfName === camelize(name) || selfName === capitalize(camelize(name)))) {
        return Component;
      }
    }
    const res = (
      // local registration
      // check instance[type] first which is resolved for options API
      resolve(instance[type] || Component[type], name) || // global registration
      resolve(instance.appContext[type], name)
    );
    if (!res && maybeSelfReference) {
      return Component;
    }
    return res;
  }
}
function resolve(registry, name) {
  return registry && (registry[name] || registry[camelize(name)] || registry[capitalize(camelize(name))]);
}
function renderList(source, renderItem, cache, index) {
  let ret;
  const cached = cache;
  const sourceIsArray = isArray$1(source);
  if (sourceIsArray || isString(source)) {
    const sourceIsReactiveArray = sourceIsArray && /* @__PURE__ */ isReactive(source);
    let needsWrap = false;
    let isReadonlySource = false;
    if (sourceIsReactiveArray) {
      needsWrap = !/* @__PURE__ */ isShallow(source);
      isReadonlySource = /* @__PURE__ */ isReadonly(source);
      source = shallowReadArray(source);
    }
    ret = new Array(source.length);
    for (let i = 0, l = source.length; i < l; i++) {
      ret[i] = renderItem(
        needsWrap ? isReadonlySource ? toReadonly(toReactive(source[i])) : toReactive(source[i]) : source[i],
        i,
        void 0,
        cached
      );
    }
  } else if (typeof source === "number") {
    {
      ret = new Array(source);
      for (let i = 0; i < source; i++) {
        ret[i] = renderItem(i + 1, i, void 0, cached);
      }
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator]) {
      ret = Array.from(
        source,
        (item, i) => renderItem(item, i, void 0, cached)
      );
    } else {
      const keys = Object.keys(source);
      ret = new Array(keys.length);
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        ret[i] = renderItem(source[key], key, i, cached);
      }
    }
  } else {
    ret = [];
  }
  return ret;
}
function renderSlot(slots, name, props = {}, fallback, noSlotted) {
  if (currentRenderingInstance.ce || currentRenderingInstance.parent && isAsyncWrapper(currentRenderingInstance.parent) && currentRenderingInstance.parent.ce) {
    const hasProps = Object.keys(props).length > 0;
    return openBlock(), createBlock(
      Fragment,
      null,
      [createVNode("slot", props, fallback)],
      hasProps ? -2 : 64
    );
  }
  let slot = slots[name];
  if (slot && slot._c) {
    slot._d = false;
  }
  openBlock();
  const validSlotContent = slot && ensureValidVNode(slot(props));
  const slotKey = props.key || // slot content array of a dynamic conditional slot may have a branch
  // key attached in the `createSlots` helper, respect that
  validSlotContent && validSlotContent.key;
  const rendered = createBlock(
    Fragment,
    {
      key: (slotKey && !isSymbol(slotKey) ? slotKey : `_${name}`) + // #7256 force differentiate fallback content from actual content
      (!validSlotContent && fallback ? "_fb" : "")
    },
    validSlotContent || [],
    validSlotContent && slots._ === 1 ? 64 : -2
  );
  if (slot && slot._c) {
    slot._d = true;
  }
  return rendered;
}
function ensureValidVNode(vnodes) {
  return vnodes.some((child) => {
    if (!isVNode(child)) return true;
    if (child.type === Comment) return false;
    if (child.type === Fragment && !ensureValidVNode(child.children))
      return false;
    return true;
  }) ? vnodes : null;
}
const getPublicInstance = (i) => {
  if (!i) return null;
  if (isStatefulComponent(i)) return getComponentPublicInstance(i);
  return getPublicInstance(i.parent);
};
const publicPropertiesMap = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ extend(/* @__PURE__ */ Object.create(null), {
    $: (i) => i,
    $el: (i) => i.vnode.el,
    $data: (i) => i.data,
    $props: (i) => i.props,
    $attrs: (i) => i.attrs,
    $slots: (i) => i.slots,
    $refs: (i) => i.refs,
    $parent: (i) => getPublicInstance(i.parent),
    $root: (i) => getPublicInstance(i.root),
    $host: (i) => i.ce,
    $emit: (i) => i.emit,
    $options: (i) => resolveMergedOptions(i),
    $forceUpdate: (i) => i.f || (i.f = () => {
      queueJob(i.update);
    }),
    $nextTick: (i) => i.n || (i.n = nextTick.bind(i.proxy)),
    $watch: (i) => instanceWatch.bind(i)
  })
);
const hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    if (key === "__v_skip") {
      return true;
    }
    const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
    if (key[0] !== "$") {
      const n = accessCache[key];
      if (n !== void 0) {
        switch (n) {
          case 1:
            return setupState[key];
          case 2:
            return data[key];
          case 4:
            return ctx[key];
          case 3:
            return props[key];
        }
      } else if (hasSetupBinding(setupState, key)) {
        accessCache[key] = 1;
        return setupState[key];
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache[key] = 2;
        return data[key];
      } else if (hasOwn(props, key)) {
        accessCache[key] = 3;
        return props[key];
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4;
        return ctx[key];
      } else if (shouldCacheAccess) {
        accessCache[key] = 0;
      }
    }
    const publicGetter = publicPropertiesMap[key];
    let cssModule, globalProperties;
    if (publicGetter) {
      if (key === "$attrs") {
        track(instance.attrs, "get", "");
      }
      return publicGetter(instance);
    } else if (
      // css module (injected by vue-loader)
      (cssModule = type.__cssModules) && (cssModule = cssModule[key])
    ) {
      return cssModule;
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      accessCache[key] = 4;
      return ctx[key];
    } else if (
      // global properties
      globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)
    ) {
      {
        return globalProperties[key];
      }
    } else ;
  },
  set({ _: instance }, key, value) {
    const { data, setupState, ctx } = instance;
    if (hasSetupBinding(setupState, key)) {
      setupState[key] = value;
      return true;
    } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value;
      return true;
    } else if (hasOwn(instance.props, key)) {
      return false;
    }
    if (key[0] === "$" && key.slice(1) in instance) {
      return false;
    } else {
      {
        ctx[key] = value;
      }
    }
    return true;
  },
  has({
    _: { data, setupState, accessCache, ctx, appContext, props, type }
  }, key) {
    let cssModules;
    return !!(accessCache[key] || data !== EMPTY_OBJ && key[0] !== "$" && hasOwn(data, key) || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
  },
  defineProperty(target, key, descriptor) {
    if (descriptor.get != null) {
      target._.accessCache[key] = 0;
    } else if (hasOwn(descriptor, "value")) {
      this.set(target, key, descriptor.value, null);
    }
    return Reflect.defineProperty(target, key, descriptor);
  }
};
function normalizePropsOrEmits(props) {
  return isArray$1(props) ? props.reduce(
    (normalized, p2) => (normalized[p2] = null, normalized),
    {}
  ) : props;
}
let shouldCacheAccess = true;
function applyOptions(instance) {
  const options = resolveMergedOptions(instance);
  const publicThis = instance.proxy;
  const ctx = instance.ctx;
  shouldCacheAccess = false;
  if (options.beforeCreate) {
    callHook$1(options.beforeCreate, instance, "bc");
  }
  const {
    // state
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // lifecycle
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    renderTracked,
    renderTriggered,
    errorCaptured,
    serverPrefetch,
    // public API
    expose,
    inheritAttrs,
    // assets
    components,
    directives,
    filters
  } = options;
  const checkDuplicateProperties = null;
  if (injectOptions) {
    resolveInjections(injectOptions, ctx, checkDuplicateProperties);
  }
  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key];
      if (isFunction(methodHandler)) {
        {
          ctx[key] = methodHandler.bind(publicThis);
        }
      }
    }
  }
  if (dataOptions) {
    const data = dataOptions.call(publicThis, publicThis);
    if (!isObject(data)) ;
    else {
      instance.data = /* @__PURE__ */ reactive(data);
    }
  }
  shouldCacheAccess = true;
  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = computedOptions[key];
      const get = isFunction(opt) ? opt.bind(publicThis, publicThis) : isFunction(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP;
      const set = !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : NOOP;
      const c = computed({
        get,
        set
      });
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c.value,
        set: (v) => c.value = v
      });
    }
  }
  if (watchOptions) {
    for (const key in watchOptions) {
      createWatcher(watchOptions[key], ctx, publicThis, key);
    }
  }
  if (provideOptions) {
    const provides = isFunction(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
    Reflect.ownKeys(provides).forEach((key) => {
      provide(key, provides[key]);
    });
  }
  if (created) {
    callHook$1(created, instance, "c");
  }
  function registerLifecycleHook(register, hook) {
    if (isArray$1(hook)) {
      hook.forEach((_hook) => register(_hook.bind(publicThis)));
    } else if (hook) {
      register(hook.bind(publicThis));
    }
  }
  registerLifecycleHook(onBeforeMount, beforeMount);
  registerLifecycleHook(onMounted, mounted);
  registerLifecycleHook(onBeforeUpdate, beforeUpdate);
  registerLifecycleHook(onUpdated, updated);
  registerLifecycleHook(onActivated, activated);
  registerLifecycleHook(onDeactivated, deactivated);
  registerLifecycleHook(onErrorCaptured, errorCaptured);
  registerLifecycleHook(onRenderTracked, renderTracked);
  registerLifecycleHook(onRenderTriggered, renderTriggered);
  registerLifecycleHook(onBeforeUnmount, beforeUnmount);
  registerLifecycleHook(onUnmounted, unmounted);
  registerLifecycleHook(onServerPrefetch, serverPrefetch);
  if (isArray$1(expose)) {
    if (expose.length) {
      const exposed = instance.exposed || (instance.exposed = {});
      expose.forEach((key) => {
        Object.defineProperty(exposed, key, {
          get: () => publicThis[key],
          set: (val) => publicThis[key] = val,
          enumerable: true
        });
      });
    } else if (!instance.exposed) {
      instance.exposed = {};
    }
  }
  if (render && instance.render === NOOP) {
    instance.render = render;
  }
  if (inheritAttrs != null) {
    instance.inheritAttrs = inheritAttrs;
  }
  if (components) instance.components = components;
  if (directives) instance.directives = directives;
  if (serverPrefetch) {
    markAsyncBoundary(instance);
  }
}
function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
  if (isArray$1(injectOptions)) {
    injectOptions = normalizeInject(injectOptions);
  }
  for (const key in injectOptions) {
    const opt = injectOptions[key];
    let injected;
    if (isObject(opt)) {
      if ("default" in opt) {
        injected = inject(
          opt.from || key,
          opt.default,
          true
        );
      } else {
        injected = inject(opt.from || key);
      }
    } else {
      injected = inject(opt);
    }
    if (/* @__PURE__ */ isRef(injected)) {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => injected.value,
        set: (v) => injected.value = v
      });
    } else {
      ctx[key] = injected;
    }
  }
}
function callHook$1(hook, instance, type) {
  callWithAsyncErrorHandling(
    isArray$1(hook) ? hook.map((h2) => h2.bind(instance.proxy)) : hook.bind(instance.proxy),
    instance,
    type
  );
}
function createWatcher(raw, ctx, publicThis, key) {
  let getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
  if (isString(raw)) {
    const handler = ctx[raw];
    if (isFunction(handler)) {
      {
        watch(getter, handler);
      }
    }
  } else if (isFunction(raw)) {
    {
      watch(getter, raw.bind(publicThis));
    }
  } else if (isObject(raw)) {
    if (isArray$1(raw)) {
      raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
    } else {
      const handler = isFunction(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
      if (isFunction(handler)) {
        watch(getter, handler, raw);
      }
    }
  } else ;
}
function resolveMergedOptions(instance) {
  const base = instance.type;
  const { mixins, extends: extendsOptions } = base;
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies }
  } = instance.appContext;
  const cached = cache.get(base);
  let resolved;
  if (cached) {
    resolved = cached;
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    {
      resolved = base;
    }
  } else {
    resolved = {};
    if (globalMixins.length) {
      globalMixins.forEach(
        (m) => mergeOptions$1(resolved, m, optionMergeStrategies, true)
      );
    }
    mergeOptions$1(resolved, base, optionMergeStrategies);
  }
  if (isObject(base)) {
    cache.set(base, resolved);
  }
  return resolved;
}
function mergeOptions$1(to, from, strats, asMixin = false) {
  const { mixins, extends: extendsOptions } = from;
  if (extendsOptions) {
    mergeOptions$1(to, extendsOptions, strats, true);
  }
  if (mixins) {
    mixins.forEach(
      (m) => mergeOptions$1(to, m, strats, true)
    );
  }
  for (const key in from) {
    if (asMixin && key === "expose") ;
    else {
      const strat = internalOptionMergeStrats[key] || strats && strats[key];
      to[key] = strat ? strat(to[key], from[key]) : from[key];
    }
  }
  return to;
}
const internalOptionMergeStrats = {
  data: mergeDataFn,
  props: mergeEmitsOrPropsOptions,
  emits: mergeEmitsOrPropsOptions,
  // objects
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  // lifecycle
  beforeCreate: mergeAsArray,
  created: mergeAsArray,
  beforeMount: mergeAsArray,
  mounted: mergeAsArray,
  beforeUpdate: mergeAsArray,
  updated: mergeAsArray,
  beforeDestroy: mergeAsArray,
  beforeUnmount: mergeAsArray,
  destroyed: mergeAsArray,
  unmounted: mergeAsArray,
  activated: mergeAsArray,
  deactivated: mergeAsArray,
  errorCaptured: mergeAsArray,
  serverPrefetch: mergeAsArray,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  // watch
  watch: mergeWatchOptions,
  // provide / inject
  provide: mergeDataFn,
  inject: mergeInject
};
function mergeDataFn(to, from) {
  if (!from) {
    return to;
  }
  if (!to) {
    return from;
  }
  return function mergedDataFn() {
    return extend(
      isFunction(to) ? to.call(this, this) : to,
      isFunction(from) ? from.call(this, this) : from
    );
  };
}
function mergeInject(to, from) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
}
function normalizeInject(raw) {
  if (isArray$1(raw)) {
    const res = {};
    for (let i = 0; i < raw.length; i++) {
      res[raw[i]] = raw[i];
    }
    return res;
  }
  return raw;
}
function mergeAsArray(to, from) {
  return to ? [...new Set([].concat(to, from))] : from;
}
function mergeObjectOptions(to, from) {
  return to ? extend(/* @__PURE__ */ Object.create(null), to, from) : from;
}
function mergeEmitsOrPropsOptions(to, from) {
  if (to) {
    if (isArray$1(to) && isArray$1(from)) {
      return [.../* @__PURE__ */ new Set([...to, ...from])];
    }
    return extend(
      /* @__PURE__ */ Object.create(null),
      normalizePropsOrEmits(to),
      normalizePropsOrEmits(from != null ? from : {})
    );
  } else {
    return from;
  }
}
function mergeWatchOptions(to, from) {
  if (!to) return from;
  if (!from) return to;
  const merged = extend(/* @__PURE__ */ Object.create(null), to);
  for (const key in from) {
    merged[key] = mergeAsArray(to[key], from[key]);
  }
  return merged;
}
function createAppContext() {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: /* @__PURE__ */ Object.create(null),
    optionsCache: /* @__PURE__ */ new WeakMap(),
    propsCache: /* @__PURE__ */ new WeakMap(),
    emitsCache: /* @__PURE__ */ new WeakMap()
  };
}
let uid$1 = 0;
function createAppAPI(render, hydrate) {
  return function createApp2(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      rootComponent = extend({}, rootComponent);
    }
    if (rootProps != null && !isObject(rootProps)) {
      rootProps = null;
    }
    const context = createAppContext();
    const installedPlugins = /* @__PURE__ */ new WeakSet();
    const pluginCleanupFns = [];
    let isMounted = false;
    const app2 = context.app = {
      _uid: uid$1++,
      _component: rootComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,
      version,
      get config() {
        return context.config;
      },
      set config(v) {
      },
      use(plugin, ...options) {
        if (installedPlugins.has(plugin)) ;
        else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin);
          plugin.install(app2, ...options);
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin);
          plugin(app2, ...options);
        } else ;
        return app2;
      },
      mixin(mixin) {
        {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin);
          }
        }
        return app2;
      },
      component(name, component) {
        if (!component) {
          return context.components[name];
        }
        context.components[name] = component;
        return app2;
      },
      directive(name, directive) {
        if (!directive) {
          return context.directives[name];
        }
        context.directives[name] = directive;
        return app2;
      },
      mount(rootContainer, isHydrate, namespace) {
        if (!isMounted) {
          const vnode = app2._ceVNode || createVNode(rootComponent, rootProps);
          vnode.appContext = context;
          if (namespace === true) {
            namespace = "svg";
          } else if (namespace === false) {
            namespace = void 0;
          }
          {
            render(vnode, rootContainer, namespace);
          }
          isMounted = true;
          app2._container = rootContainer;
          rootContainer.__vue_app__ = app2;
          return getComponentPublicInstance(vnode.component);
        }
      },
      onUnmount(cleanupFn) {
        pluginCleanupFns.push(cleanupFn);
      },
      unmount() {
        if (isMounted) {
          callWithAsyncErrorHandling(
            pluginCleanupFns,
            app2._instance,
            16
          );
          render(null, app2._container);
          delete app2._container.__vue_app__;
        }
      },
      provide(key, value) {
        context.provides[key] = value;
        return app2;
      },
      runWithContext(fn) {
        const lastApp = currentApp;
        currentApp = app2;
        try {
          return fn();
        } finally {
          currentApp = lastApp;
        }
      }
    };
    return app2;
  };
}
let currentApp = null;
const getModelModifiers = (props, modelName) => {
  return modelName === "modelValue" || modelName === "model-value" ? props.modelModifiers : props[`${modelName}Modifiers`] || props[`${camelize(modelName)}Modifiers`] || props[`${hyphenate(modelName)}Modifiers`];
};
function emit(instance, event, ...rawArgs) {
  if (instance.isUnmounted) return;
  const props = instance.vnode.props || EMPTY_OBJ;
  let args = rawArgs;
  const isModelListener2 = event.startsWith("update:");
  const modifiers = isModelListener2 && getModelModifiers(props, event.slice(7));
  if (modifiers) {
    if (modifiers.trim) {
      args = rawArgs.map((a) => isString(a) ? a.trim() : a);
    }
    if (modifiers.number) {
      args = rawArgs.map(looseToNumber);
    }
  }
  let handlerName;
  let handler = props[handlerName = toHandlerKey(event)] || // also try camelCase event handler (#2249)
  props[handlerName = toHandlerKey(camelize(event))];
  if (!handler && isModelListener2) {
    handler = props[handlerName = toHandlerKey(hyphenate(event))];
  }
  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      6,
      args
    );
  }
  const onceHandler = props[handlerName + `Once`];
  if (onceHandler) {
    if (!instance.emitted) {
      instance.emitted = {};
    } else if (instance.emitted[handlerName]) {
      return;
    }
    instance.emitted[handlerName] = true;
    callWithAsyncErrorHandling(
      onceHandler,
      instance,
      6,
      args
    );
  }
}
const mixinEmitsCache = /* @__PURE__ */ new WeakMap();
function normalizeEmitsOptions(comp, appContext, asMixin = false) {
  const cache = asMixin ? mixinEmitsCache : appContext.emitsCache;
  const cached = cache.get(comp);
  if (cached !== void 0) {
    return cached;
  }
  const raw = comp.emits;
  let normalized = {};
  let hasExtends = false;
  if (!isFunction(comp)) {
    const extendEmits = (raw2) => {
      const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
      if (normalizedFromExtend) {
        hasExtends = true;
        extend(normalized, normalizedFromExtend);
      }
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendEmits);
    }
    if (comp.extends) {
      extendEmits(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendEmits);
    }
  }
  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, null);
    }
    return null;
  }
  if (isArray$1(raw)) {
    raw.forEach((key) => normalized[key] = null);
  } else {
    extend(normalized, raw);
  }
  if (isObject(comp)) {
    cache.set(comp, normalized);
  }
  return normalized;
}
function isEmitListener(options, key) {
  if (!options || !isOn(key)) {
    return false;
  }
  key = key.slice(2).replace(/Once$/, "");
  return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate(key)) || hasOwn(options, key);
}
function markAttrsAccessed() {
}
function renderComponentRoot(instance) {
  const {
    type: Component,
    vnode,
    proxy,
    withProxy,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit: emit2,
    render,
    renderCache,
    props,
    data,
    setupState,
    ctx,
    inheritAttrs
  } = instance;
  const prev = setCurrentRenderingInstance(instance);
  let result;
  let fallthroughAttrs;
  try {
    if (vnode.shapeFlag & 4) {
      const proxyToUse = withProxy || proxy;
      const thisProxy = false ? new Proxy(proxyToUse, {
        get(target, key, receiver) {
          warn$1(
            `Property '${String(
              key
            )}' was accessed via 'this'. Avoid using 'this' in templates.`
          );
          return Reflect.get(target, key, receiver);
        }
      }) : proxyToUse;
      result = normalizeVNode(
        render.call(
          thisProxy,
          proxyToUse,
          renderCache,
          false ? /* @__PURE__ */ shallowReadonly(props) : props,
          setupState,
          data,
          ctx
        )
      );
      fallthroughAttrs = attrs;
    } else {
      const render2 = Component;
      if (false) ;
      result = normalizeVNode(
        render2.length > 1 ? render2(
          false ? /* @__PURE__ */ shallowReadonly(props) : props,
          false ? {
            get attrs() {
              markAttrsAccessed();
              return /* @__PURE__ */ shallowReadonly(attrs);
            },
            slots,
            emit: emit2
          } : { attrs, slots, emit: emit2 }
        ) : render2(
          false ? /* @__PURE__ */ shallowReadonly(props) : props,
          null
        )
      );
      fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
    }
  } catch (err) {
    blockStack.length = 0;
    handleError(err, instance, 1);
    result = createVNode(Comment);
  }
  let root = result;
  if (fallthroughAttrs && inheritAttrs !== false) {
    const keys = Object.keys(fallthroughAttrs);
    const { shapeFlag } = root;
    if (keys.length) {
      if (shapeFlag & (1 | 6)) {
        if (propsOptions && keys.some(isModelListener)) {
          fallthroughAttrs = filterModelListeners(
            fallthroughAttrs,
            propsOptions
          );
        }
        root = cloneVNode(root, fallthroughAttrs, false, true);
      }
    }
  }
  if (vnode.dirs) {
    root = cloneVNode(root, null, false, true);
    root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
  }
  if (vnode.transition) {
    setTransitionHooks(root, vnode.transition);
  }
  {
    result = root;
  }
  setCurrentRenderingInstance(prev);
  return result;
}
const getFunctionalFallthrough = (attrs) => {
  let res;
  for (const key in attrs) {
    if (key === "class" || key === "style" || isOn(key)) {
      (res || (res = {}))[key] = attrs[key];
    }
  }
  return res;
};
const filterModelListeners = (attrs, props) => {
  const res = {};
  for (const key in attrs) {
    if (!isModelListener(key) || !(key.slice(9) in props)) {
      res[key] = attrs[key];
    }
  }
  return res;
};
function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
  const { props: prevProps, children: prevChildren, component } = prevVNode;
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
  const emits = component.emitsOptions;
  if (nextVNode.dirs || nextVNode.transition) {
    return true;
  }
  if (optimized && patchFlag >= 0) {
    if (patchFlag & 1024) {
      return true;
    }
    if (patchFlag & 16) {
      if (!prevProps) {
        return !!nextProps;
      }
      return hasPropsChanged(prevProps, nextProps, emits);
    } else if (patchFlag & 8) {
      const dynamicProps = nextVNode.dynamicProps;
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i];
        if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emits, key)) {
          return true;
        }
      }
    }
  } else {
    if (prevChildren || nextChildren) {
      if (!nextChildren || !nextChildren.$stable) {
        return true;
      }
    }
    if (prevProps === nextProps) {
      return false;
    }
    if (!prevProps) {
      return !!nextProps;
    }
    if (!nextProps) {
      return true;
    }
    return hasPropsChanged(prevProps, nextProps, emits);
  }
  return false;
}
function hasPropsChanged(prevProps, nextProps, emitsOptions) {
  const nextKeys = Object.keys(nextProps);
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true;
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emitsOptions, key)) {
      return true;
    }
  }
  return false;
}
function hasPropValueChanged(nextProps, prevProps, key) {
  const nextProp = nextProps[key];
  const prevProp = prevProps[key];
  if (key === "style" && isObject(nextProp) && isObject(prevProp)) {
    return !looseEqual(nextProp, prevProp);
  }
  return nextProp !== prevProp;
}
function updateHOCHostEl({ vnode, parent }, el) {
  while (parent) {
    const root = parent.subTree;
    if (root.suspense && root.suspense.activeBranch === vnode) {
      root.el = vnode.el;
    }
    if (root === vnode) {
      (vnode = parent.vnode).el = el;
      parent = parent.parent;
    } else {
      break;
    }
  }
}
const internalObjectProto = {};
const createInternalObject = () => Object.create(internalObjectProto);
const isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
function initProps(instance, rawProps, isStateful, isSSR = false) {
  const props = {};
  const attrs = createInternalObject();
  instance.propsDefaults = /* @__PURE__ */ Object.create(null);
  setFullProps(instance, rawProps, props, attrs);
  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = void 0;
    }
  }
  if (isStateful) {
    instance.props = isSSR ? props : /* @__PURE__ */ shallowReactive(props);
  } else {
    if (!instance.type.props) {
      instance.props = attrs;
    } else {
      instance.props = props;
    }
  }
  instance.attrs = attrs;
}
function updateProps(instance, rawProps, rawPrevProps, optimized) {
  const {
    props,
    attrs,
    vnode: { patchFlag }
  } = instance;
  const rawCurrentProps = /* @__PURE__ */ toRaw(props);
  const [options] = instance.propsOptions;
  let hasAttrsChanged = false;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (optimized || patchFlag > 0) && !(patchFlag & 16)
  ) {
    if (patchFlag & 8) {
      const propsToUpdate = instance.vnode.dynamicProps;
      for (let i = 0; i < propsToUpdate.length; i++) {
        let key = propsToUpdate[i];
        if (isEmitListener(instance.emitsOptions, key)) {
          continue;
        }
        const value = rawProps[key];
        if (options) {
          if (hasOwn(attrs, key)) {
            if (value !== attrs[key]) {
              attrs[key] = value;
              hasAttrsChanged = true;
            }
          } else {
            const camelizedKey = camelize(key);
            props[camelizedKey] = resolvePropValue(
              options,
              rawCurrentProps,
              camelizedKey,
              value,
              instance,
              false
            );
          }
        } else {
          if (value !== attrs[key]) {
            attrs[key] = value;
            hasAttrsChanged = true;
          }
        }
      }
    }
  } else {
    if (setFullProps(instance, rawProps, props, attrs)) {
      hasAttrsChanged = true;
    }
    let kebabKey;
    for (const key in rawCurrentProps) {
      if (!rawProps || // for camelCase
      !hasOwn(rawProps, key) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey))) {
        if (options) {
          if (rawPrevProps && // for camelCase
          (rawPrevProps[key] !== void 0 || // for kebab-case
          rawPrevProps[kebabKey] !== void 0)) {
            props[key] = resolvePropValue(
              options,
              rawCurrentProps,
              key,
              void 0,
              instance,
              true
            );
          }
        } else {
          delete props[key];
        }
      }
    }
    if (attrs !== rawCurrentProps) {
      for (const key in attrs) {
        if (!rawProps || !hasOwn(rawProps, key) && true) {
          delete attrs[key];
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (hasAttrsChanged) {
    trigger(instance.attrs, "set", "");
  }
}
function setFullProps(instance, rawProps, props, attrs) {
  const [options, needCastKeys] = instance.propsOptions;
  let hasAttrsChanged = false;
  let rawCastValues;
  if (rawProps) {
    for (let key in rawProps) {
      if (isReservedProp(key)) {
        continue;
      }
      const value = rawProps[key];
      let camelKey;
      if (options && hasOwn(options, camelKey = camelize(key))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          props[camelKey] = value;
        } else {
          (rawCastValues || (rawCastValues = {}))[camelKey] = value;
        }
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value;
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (needCastKeys) {
    const rawCurrentProps = /* @__PURE__ */ toRaw(props);
    const castValues = rawCastValues || EMPTY_OBJ;
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i];
      props[key] = resolvePropValue(
        options,
        rawCurrentProps,
        key,
        castValues[key],
        instance,
        !hasOwn(castValues, key)
      );
    }
  }
  return hasAttrsChanged;
}
function resolvePropValue(options, props, key, value, instance, isAbsent) {
  const opt = options[key];
  if (opt != null) {
    const hasDefault = hasOwn(opt, "default");
    if (hasDefault && value === void 0) {
      const defaultValue = opt.default;
      if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
        const { propsDefaults } = instance;
        if (key in propsDefaults) {
          value = propsDefaults[key];
        } else {
          const reset = setCurrentInstance(instance);
          value = propsDefaults[key] = defaultValue.call(
            null,
            props
          );
          reset();
        }
      } else {
        value = defaultValue;
      }
      if (instance.ce) {
        instance.ce._setProp(key, value);
      }
    }
    if (opt[
      0
      /* shouldCast */
    ]) {
      if (isAbsent && !hasDefault) {
        value = false;
      } else if (opt[
        1
        /* shouldCastTrue */
      ] && (value === "" || value === hyphenate(key))) {
        value = true;
      }
    }
  }
  return value;
}
const mixinPropsCache = /* @__PURE__ */ new WeakMap();
function normalizePropsOptions(comp, appContext, asMixin = false) {
  const cache = asMixin ? mixinPropsCache : appContext.propsCache;
  const cached = cache.get(comp);
  if (cached) {
    return cached;
  }
  const raw = comp.props;
  const normalized = {};
  const needCastKeys = [];
  let hasExtends = false;
  if (!isFunction(comp)) {
    const extendProps = (raw2) => {
      hasExtends = true;
      const [props, keys] = normalizePropsOptions(raw2, appContext, true);
      extend(normalized, props);
      if (keys) needCastKeys.push(...keys);
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps);
    }
    if (comp.extends) {
      extendProps(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps);
    }
  }
  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, EMPTY_ARR);
    }
    return EMPTY_ARR;
  }
  if (isArray$1(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const normalizedKey = camelize(raw[i]);
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ;
      }
    }
  } else if (raw) {
    for (const key in raw) {
      const normalizedKey = camelize(key);
      if (validatePropName(normalizedKey)) {
        const opt = raw[key];
        const prop = normalized[normalizedKey] = isArray$1(opt) || isFunction(opt) ? { type: opt } : extend({}, opt);
        const propType = prop.type;
        let shouldCast = false;
        let shouldCastTrue = true;
        if (isArray$1(propType)) {
          for (let index = 0; index < propType.length; ++index) {
            const type = propType[index];
            const typeName = isFunction(type) && type.name;
            if (typeName === "Boolean") {
              shouldCast = true;
              break;
            } else if (typeName === "String") {
              shouldCastTrue = false;
            }
          }
        } else {
          shouldCast = isFunction(propType) && propType.name === "Boolean";
        }
        prop[
          0
          /* shouldCast */
        ] = shouldCast;
        prop[
          1
          /* shouldCastTrue */
        ] = shouldCastTrue;
        if (shouldCast || hasOwn(prop, "default")) {
          needCastKeys.push(normalizedKey);
        }
      }
    }
  }
  const res = [normalized, needCastKeys];
  if (isObject(comp)) {
    cache.set(comp, res);
  }
  return res;
}
function validatePropName(key) {
  if (key[0] !== "$" && !isReservedProp(key)) {
    return true;
  }
  return false;
}
const isInternalKey = (key) => key === "_" || key === "_ctx" || key === "$stable";
const normalizeSlotValue = (value) => isArray$1(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
const normalizeSlot$1 = (key, rawSlot, ctx) => {
  if (rawSlot._n) {
    return rawSlot;
  }
  const normalized = withCtx((...args) => {
    if (false) ;
    return normalizeSlotValue(rawSlot(...args));
  }, ctx);
  normalized._c = false;
  return normalized;
};
const normalizeObjectSlots = (rawSlots, slots, instance) => {
  const ctx = rawSlots._ctx;
  for (const key in rawSlots) {
    if (isInternalKey(key)) continue;
    const value = rawSlots[key];
    if (isFunction(value)) {
      slots[key] = normalizeSlot$1(key, value, ctx);
    } else if (value != null) {
      const normalized = normalizeSlotValue(value);
      slots[key] = () => normalized;
    }
  }
};
const normalizeVNodeSlots = (instance, children) => {
  const normalized = normalizeSlotValue(children);
  instance.slots.default = () => normalized;
};
const assignSlots = (slots, children, optimized) => {
  for (const key in children) {
    if (optimized || !isInternalKey(key)) {
      slots[key] = children[key];
    }
  }
};
const initSlots = (instance, children, optimized) => {
  const slots = instance.slots = createInternalObject();
  if (instance.vnode.shapeFlag & 32) {
    const type = children._;
    if (type) {
      assignSlots(slots, children, optimized);
      if (optimized) {
        def(slots, "_", type, true);
      }
    } else {
      normalizeObjectSlots(children, slots);
    }
  } else if (children) {
    normalizeVNodeSlots(instance, children);
  }
};
const updateSlots = (instance, children, optimized) => {
  const { vnode, slots } = instance;
  let needDeletionCheck = true;
  let deletionComparisonTarget = EMPTY_OBJ;
  if (vnode.shapeFlag & 32) {
    const type = children._;
    if (type) {
      if (optimized && type === 1) {
        needDeletionCheck = false;
      } else {
        assignSlots(slots, children, optimized);
      }
    } else {
      needDeletionCheck = !children.$stable;
      normalizeObjectSlots(children, slots);
    }
    deletionComparisonTarget = children;
  } else if (children) {
    normalizeVNodeSlots(instance, children);
    deletionComparisonTarget = { default: 1 };
  }
  if (needDeletionCheck) {
    for (const key in slots) {
      if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
        delete slots[key];
      }
    }
  }
};
const queuePostRenderEffect = queueEffectWithSuspense;
function createRenderer(options) {
  return baseCreateRenderer(options);
}
function baseCreateRenderer(options, createHydrationFns) {
  const target = getGlobalThis();
  target.__VUE__ = true;
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    insertStaticContent: hostInsertStaticContent
  } = options;
  const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
    if (n1 === n2) {
      return;
    }
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1);
      unmount(n1, parentComponent, parentSuspense, true);
      n1 = null;
    }
    if (n2.patchFlag === -2) {
      optimized = false;
      n2.dynamicChildren = null;
    }
    const { type, ref: ref3, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor);
        break;
      case Comment:
        processCommentNode(n1, n2, container, anchor);
        break;
      case Static:
        if (n1 == null) {
          mountStaticNode(n2, container, anchor, namespace);
        }
        break;
      case Fragment:
        processFragment(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
        break;
      default:
        if (shapeFlag & 1) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else if (shapeFlag & 6) {
          processComponent(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else if (shapeFlag & 64) {
          type.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals
          );
        } else if (shapeFlag & 128) {
          type.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized,
            internals
          );
        } else ;
    }
    if (ref3 != null && parentComponent) {
      setRef(ref3, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
    } else if (ref3 == null && n1 && n1.ref != null) {
      setRef(n1.ref, null, parentSuspense, n1, true);
    }
  };
  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        n2.el = hostCreateText(n2.children),
        container,
        anchor
      );
    } else {
      const el = n2.el = n1.el;
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children);
      }
    }
  };
  const processCommentNode = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        n2.el = hostCreateComment(n2.children || ""),
        container,
        anchor
      );
    } else {
      n2.el = n1.el;
    }
  };
  const mountStaticNode = (n2, container, anchor, namespace) => {
    [n2.el, n2.anchor] = hostInsertStaticContent(
      n2.children,
      container,
      anchor,
      namespace,
      n2.el,
      n2.anchor
    );
  };
  const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
    let next;
    while (el && el !== anchor) {
      next = hostNextSibling(el);
      hostInsert(el, container, nextSibling);
      el = next;
    }
    hostInsert(anchor, container, nextSibling);
  };
  const removeStaticNode = ({ el, anchor }) => {
    let next;
    while (el && el !== anchor) {
      next = hostNextSibling(el);
      hostRemove(el);
      el = next;
    }
    hostRemove(anchor);
  };
  const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    if (n2.type === "svg") {
      namespace = "svg";
    } else if (n2.type === "math") {
      namespace = "mathml";
    }
    if (n1 == null) {
      mountElement(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    } else {
      const customElement = n1.el && n1.el._isVueCE ? n1.el : null;
      try {
        if (customElement) {
          customElement._beginPatch();
        }
        patchElement(
          n1,
          n2,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } finally {
        if (customElement) {
          customElement._endPatch();
        }
      }
    }
  };
  const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    let el;
    let vnodeHook;
    const { props, shapeFlag, transition, dirs } = vnode;
    el = vnode.el = hostCreateElement(
      vnode.type,
      namespace,
      props && props.is,
      props
    );
    if (shapeFlag & 8) {
      hostSetElementText(el, vnode.children);
    } else if (shapeFlag & 16) {
      mountChildren(
        vnode.children,
        el,
        null,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(vnode, namespace),
        slotScopeIds,
        optimized
      );
    }
    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, "created");
    }
    setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
    if (props) {
      for (const key in props) {
        if (key !== "value" && !isReservedProp(key)) {
          hostPatchProp(el, key, null, props[key], namespace, parentComponent);
        }
      }
      if ("value" in props) {
        hostPatchProp(el, "value", null, props.value, namespace);
      }
      if (vnodeHook = props.onVnodeBeforeMount) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode);
      }
    }
    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
    }
    const needCallTransitionHooks = needTransition(parentSuspense, transition);
    if (needCallTransitionHooks) {
      transition.beforeEnter(el);
    }
    hostInsert(el, container, anchor);
    if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
        needCallTransitionHooks && transition.enter(el);
        dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
      }, parentSuspense);
    }
  };
  const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
    if (scopeId) {
      hostSetScopeId(el, scopeId);
    }
    if (slotScopeIds) {
      for (let i = 0; i < slotScopeIds.length; i++) {
        hostSetScopeId(el, slotScopeIds[i]);
      }
    }
    if (parentComponent) {
      let subTree = parentComponent.subTree;
      if (vnode === subTree || isSuspense(subTree.type) && (subTree.ssContent === vnode || subTree.ssFallback === vnode)) {
        const parentVNode = parentComponent.vnode;
        setScopeId(
          el,
          parentVNode,
          parentVNode.scopeId,
          parentVNode.slotScopeIds,
          parentComponent.parent
        );
      }
    }
  };
  const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
    for (let i = start; i < children.length; i++) {
      const child = children[i] = optimized ? cloneIfMounted(children[i]) : normalizeVNode(children[i]);
      patch(
        null,
        child,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    }
  };
  const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    const el = n2.el = n1.el;
    let { patchFlag, dynamicChildren, dirs } = n2;
    patchFlag |= n1.patchFlag & 16;
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    let vnodeHook;
    parentComponent && toggleRecurse(parentComponent, false);
    if (vnodeHook = newProps.onVnodeBeforeUpdate) {
      invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
    }
    if (dirs) {
      invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
    }
    parentComponent && toggleRecurse(parentComponent, true);
    if (oldProps.innerHTML && newProps.innerHTML == null || oldProps.textContent && newProps.textContent == null) {
      hostSetElementText(el, "");
    }
    if (dynamicChildren) {
      patchBlockChildren(
        n1.dynamicChildren,
        dynamicChildren,
        el,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(n2, namespace),
        slotScopeIds
      );
    } else if (!optimized) {
      patchChildren(
        n1,
        n2,
        el,
        null,
        parentComponent,
        parentSuspense,
        resolveChildrenNamespace(n2, namespace),
        slotScopeIds,
        false
      );
    }
    if (patchFlag > 0) {
      if (patchFlag & 16) {
        patchProps(el, oldProps, newProps, parentComponent, namespace);
      } else {
        if (patchFlag & 2) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, "class", null, newProps.class, namespace);
          }
        }
        if (patchFlag & 4) {
          hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
        }
        if (patchFlag & 8) {
          const propsToUpdate = n2.dynamicProps;
          for (let i = 0; i < propsToUpdate.length; i++) {
            const key = propsToUpdate[i];
            const prev = oldProps[key];
            const next = newProps[key];
            if (next !== prev || key === "value") {
              hostPatchProp(el, key, prev, next, namespace, parentComponent);
            }
          }
        }
      }
      if (patchFlag & 1) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children);
        }
      }
    } else if (!optimized && dynamicChildren == null) {
      patchProps(el, oldProps, newProps, parentComponent, namespace);
    }
    if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
        dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
      }, parentSuspense);
    }
  };
  const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
    for (let i = 0; i < newChildren.length; i++) {
      const oldVNode = oldChildren[i];
      const newVNode = newChildren[i];
      const container = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        oldVNode.el && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (oldVNode.type === Fragment || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !isSameVNodeType(oldVNode, newVNode) || // - In the case of a component, it could contain anything.
        oldVNode.shapeFlag & (6 | 64 | 128)) ? hostParentNode(oldVNode.el) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          fallbackContainer
        )
      );
      patch(
        oldVNode,
        newVNode,
        container,
        null,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        true
      );
    }
  };
  const patchProps = (el, oldProps, newProps, parentComponent, namespace) => {
    if (oldProps !== newProps) {
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!isReservedProp(key) && !(key in newProps)) {
            hostPatchProp(
              el,
              key,
              oldProps[key],
              null,
              namespace,
              parentComponent
            );
          }
        }
      }
      for (const key in newProps) {
        if (isReservedProp(key)) continue;
        const next = newProps[key];
        const prev = oldProps[key];
        if (next !== prev && key !== "value") {
          hostPatchProp(el, key, prev, next, namespace, parentComponent);
        }
      }
      if ("value" in newProps) {
        hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
      }
    }
  };
  const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
    const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
    let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
    if (fragmentSlotScopeIds) {
      slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
    }
    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor);
      hostInsert(fragmentEndAnchor, container, anchor);
      mountChildren(
        // #10007
        // such fragment like `<></>` will be compiled into
        // a fragment which doesn't have a children.
        // In this case fallback to an empty array
        n2.children || [],
        container,
        fragmentEndAnchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    } else {
      if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && // #2715 the previous fragment could've been a BAILed one as a result
      // of renderSlot() with no valid children
      n1.dynamicChildren && n1.dynamicChildren.length === dynamicChildren.length) {
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          container,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds
        );
        if (
          // #2080 if the stable fragment has a key, it's a <template v-for> that may
          //  get moved around. Make sure all root level vnodes inherit el.
          // #2134 or if it's a component root, it may also get moved around
          // as the component is being moved.
          n2.key != null || parentComponent && n2 === parentComponent.subTree
        ) {
          traverseStaticChildren(
            n1,
            n2,
            true
            /* shallow */
          );
        }
      } else {
        patchChildren(
          n1,
          n2,
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
    }
  };
  const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    n2.slotScopeIds = slotScopeIds;
    if (n1 == null) {
      if (n2.shapeFlag & 512) {
        parentComponent.ctx.activate(
          n2,
          container,
          anchor,
          namespace,
          optimized
        );
      } else {
        mountComponent(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          optimized
        );
      }
    } else {
      updateComponent(n1, n2, optimized);
    }
  };
  const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
    const instance = initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent,
      parentSuspense
    );
    if (isKeepAlive(initialVNode)) {
      instance.ctx.renderer = internals;
    }
    {
      setupComponent(instance, false, optimized);
    }
    if (instance.asyncDep) {
      parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect, optimized);
      if (!initialVNode.el) {
        const placeholder = instance.subTree = createVNode(Comment);
        processCommentNode(null, placeholder, container, anchor);
        initialVNode.placeholder = placeholder.el;
      }
    } else {
      setupRenderEffect(
        instance,
        initialVNode,
        container,
        anchor,
        parentSuspense,
        namespace,
        optimized
      );
    }
  };
  const updateComponent = (n1, n2, optimized) => {
    const instance = n2.component = n1.component;
    if (shouldUpdateComponent(n1, n2, optimized)) {
      if (instance.asyncDep && !instance.asyncResolved) {
        updateComponentPreRender(instance, n2, optimized);
        return;
      } else {
        instance.next = n2;
        instance.update();
      }
    } else {
      n2.el = n1.el;
      instance.vnode = n2;
    }
  };
  const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        let vnodeHook;
        const { el, props } = initialVNode;
        const { bm, m, parent, root, type } = instance;
        const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
        toggleRecurse(instance, false);
        if (bm) {
          invokeArrayFns(bm);
        }
        if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) {
          invokeVNodeHook(vnodeHook, parent, initialVNode);
        }
        toggleRecurse(instance, true);
        {
          if (root.ce && root.ce._hasShadowRoot()) {
            root.ce._injectChildStyle(
              type,
              instance.parent ? instance.parent.type : void 0
            );
          }
          const subTree = instance.subTree = renderComponentRoot(instance);
          patch(
            null,
            subTree,
            container,
            anchor,
            instance,
            parentSuspense,
            namespace
          );
          initialVNode.el = subTree.el;
        }
        if (m) {
          queuePostRenderEffect(m, parentSuspense);
        }
        if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
          const scopedInitialVNode = initialVNode;
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode),
            parentSuspense
          );
        }
        if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) {
          instance.a && queuePostRenderEffect(instance.a, parentSuspense);
        }
        instance.isMounted = true;
        initialVNode = container = anchor = null;
      } else {
        let { next, bu, u, parent, vnode } = instance;
        {
          const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance);
          if (nonHydratedAsyncRoot) {
            if (next) {
              next.el = vnode.el;
              updateComponentPreRender(instance, next, optimized);
            }
            nonHydratedAsyncRoot.asyncDep.then(() => {
              queuePostRenderEffect(() => {
                if (!instance.isUnmounted) update();
              }, parentSuspense);
            });
            return;
          }
        }
        let originNext = next;
        let vnodeHook;
        toggleRecurse(instance, false);
        if (next) {
          next.el = vnode.el;
          updateComponentPreRender(instance, next, optimized);
        } else {
          next = vnode;
        }
        if (bu) {
          invokeArrayFns(bu);
        }
        if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) {
          invokeVNodeHook(vnodeHook, parent, next, vnode);
        }
        toggleRecurse(instance, true);
        const nextTree = renderComponentRoot(instance);
        const prevTree = instance.subTree;
        instance.subTree = nextTree;
        patch(
          prevTree,
          nextTree,
          // parent may have changed if it's in a teleport
          hostParentNode(prevTree.el),
          // anchor may have changed if it's in a fragment
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          namespace
        );
        next.el = nextTree.el;
        if (originNext === null) {
          updateHOCHostEl(instance, nextTree.el);
        }
        if (u) {
          queuePostRenderEffect(u, parentSuspense);
        }
        if (vnodeHook = next.props && next.props.onVnodeUpdated) {
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook, parent, next, vnode),
            parentSuspense
          );
        }
      }
    };
    instance.scope.on();
    const effect2 = instance.effect = new ReactiveEffect(componentUpdateFn);
    instance.scope.off();
    const update = instance.update = effect2.run.bind(effect2);
    const job = instance.job = effect2.runIfDirty.bind(effect2);
    job.i = instance;
    job.id = instance.uid;
    effect2.scheduler = () => queueJob(job);
    toggleRecurse(instance, true);
    update();
  };
  const updateComponentPreRender = (instance, nextVNode, optimized) => {
    nextVNode.component = instance;
    const prevProps = instance.vnode.props;
    instance.vnode = nextVNode;
    instance.next = null;
    updateProps(instance, nextVNode.props, prevProps, optimized);
    updateSlots(instance, nextVNode.children, optimized);
    pauseTracking();
    flushPreFlushCbs(instance);
    resetTracking();
  };
  const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
    const c1 = n1 && n1.children;
    const prevShapeFlag = n1 ? n1.shapeFlag : 0;
    const c2 = n2.children;
    const { patchFlag, shapeFlag } = n2;
    if (patchFlag > 0) {
      if (patchFlag & 128) {
        patchKeyedChildren(
          c1,
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
        return;
      } else if (patchFlag & 256) {
        patchUnkeyedChildren(
          c1,
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
        return;
      }
    }
    if (shapeFlag & 8) {
      if (prevShapeFlag & 16) {
        unmountChildren(c1, parentComponent, parentSuspense);
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2);
      }
    } else {
      if (prevShapeFlag & 16) {
        if (shapeFlag & 16) {
          patchKeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          unmountChildren(c1, parentComponent, parentSuspense, true);
        }
      } else {
        if (prevShapeFlag & 8) {
          hostSetElementText(container, "");
        }
        if (shapeFlag & 16) {
          mountChildren(
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      }
    }
  };
  const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    c1 = c1 || EMPTY_ARR;
    c2 = c2 || EMPTY_ARR;
    const oldLength = c1.length;
    const newLength = c2.length;
    const commonLength = Math.min(oldLength, newLength);
    let i;
    for (i = 0; i < commonLength; i++) {
      const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
      patch(
        c1[i],
        nextChild,
        container,
        null,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized
      );
    }
    if (oldLength > newLength) {
      unmountChildren(
        c1,
        parentComponent,
        parentSuspense,
        true,
        false,
        commonLength
      );
    } else {
      mountChildren(
        c2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        namespace,
        slotScopeIds,
        optimized,
        commonLength
      );
    }
  };
  const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
    let i = 0;
    const l2 = c2.length;
    let e1 = c1.length - 1;
    let e2 = l2 - 1;
    while (i <= e1 && i <= e2) {
      const n1 = c1[i];
      const n2 = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        break;
      }
      i++;
    }
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1];
      const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        break;
      }
      e1--;
      e2--;
    }
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1;
        const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
        while (i <= e2) {
          patch(
            null,
            c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]),
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          i++;
        }
      }
    } else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i], parentComponent, parentSuspense, true);
        i++;
      }
    } else {
      const s1 = i;
      const s2 = i;
      const keyToNewIndexMap = /* @__PURE__ */ new Map();
      for (i = s2; i <= e2; i++) {
        const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i);
        }
      }
      let j;
      let patched = 0;
      const toBePatched = e2 - s2 + 1;
      let moved = false;
      let maxNewIndexSoFar = 0;
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i];
        if (patched >= toBePatched) {
          unmount(prevChild, parentComponent, parentSuspense, true);
          continue;
        }
        let newIndex;
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key);
        } else {
          for (j = s2; j <= e2; j++) {
            if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
              newIndex = j;
              break;
            }
          }
        }
        if (newIndex === void 0) {
          unmount(prevChild, parentComponent, parentSuspense, true);
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex;
          } else {
            moved = true;
          }
          patch(
            prevChild,
            c2[newIndex],
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          patched++;
        }
      }
      const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
      j = increasingNewIndexSequence.length - 1;
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + i;
        const nextChild = c2[nextIndex];
        const anchorVNode = c2[nextIndex + 1];
        const anchor = nextIndex + 1 < l2 ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          anchorVNode.el || resolveAsyncComponentPlaceholder(anchorVNode)
        ) : parentAnchor;
        if (newIndexToOldIndexMap[i] === 0) {
          patch(
            null,
            nextChild,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else if (moved) {
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor, 2);
          } else {
            j--;
          }
        }
      }
    }
  };
  const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
    const { el, type, transition, children, shapeFlag } = vnode;
    if (shapeFlag & 6) {
      move(vnode.component.subTree, container, anchor, moveType);
      return;
    }
    if (shapeFlag & 128) {
      vnode.suspense.move(container, anchor, moveType);
      return;
    }
    if (shapeFlag & 64) {
      type.move(vnode, container, anchor, internals);
      return;
    }
    if (type === Fragment) {
      hostInsert(el, container, anchor);
      for (let i = 0; i < children.length; i++) {
        move(children[i], container, anchor, moveType);
      }
      hostInsert(vnode.anchor, container, anchor);
      return;
    }
    if (type === Static) {
      moveStaticNode(vnode, container, anchor);
      return;
    }
    const needTransition2 = moveType !== 2 && shapeFlag & 1 && transition;
    if (needTransition2) {
      if (moveType === 0) {
        transition.beforeEnter(el);
        hostInsert(el, container, anchor);
        queuePostRenderEffect(() => transition.enter(el), parentSuspense);
      } else {
        const { leave, delayLeave, afterLeave } = transition;
        const remove22 = () => {
          if (vnode.ctx.isUnmounted) {
            hostRemove(el);
          } else {
            hostInsert(el, container, anchor);
          }
        };
        const performLeave = () => {
          if (el._isLeaving) {
            el[leaveCbKey](
              true
              /* cancelled */
            );
          }
          leave(el, () => {
            remove22();
            afterLeave && afterLeave();
          });
        };
        if (delayLeave) {
          delayLeave(el, remove22, performLeave);
        } else {
          performLeave();
        }
      }
    } else {
      hostInsert(el, container, anchor);
    }
  };
  const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
    const {
      type,
      props,
      ref: ref3,
      children,
      dynamicChildren,
      shapeFlag,
      patchFlag,
      dirs,
      cacheIndex
    } = vnode;
    if (patchFlag === -2) {
      optimized = false;
    }
    if (ref3 != null) {
      pauseTracking();
      setRef(ref3, null, parentSuspense, vnode, true);
      resetTracking();
    }
    if (cacheIndex != null) {
      parentComponent.renderCache[cacheIndex] = void 0;
    }
    if (shapeFlag & 256) {
      parentComponent.ctx.deactivate(vnode);
      return;
    }
    const shouldInvokeDirs = shapeFlag & 1 && dirs;
    const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
    let vnodeHook;
    if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) {
      invokeVNodeHook(vnodeHook, parentComponent, vnode);
    }
    if (shapeFlag & 6) {
      unmountComponent(vnode.component, parentSuspense, doRemove);
    } else {
      if (shapeFlag & 128) {
        vnode.suspense.unmount(parentSuspense, doRemove);
        return;
      }
      if (shouldInvokeDirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
      }
      if (shapeFlag & 64) {
        vnode.type.remove(
          vnode,
          parentComponent,
          parentSuspense,
          internals,
          doRemove
        );
      } else if (dynamicChildren && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !dynamicChildren.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (type !== Fragment || patchFlag > 0 && patchFlag & 64)) {
        unmountChildren(
          dynamicChildren,
          parentComponent,
          parentSuspense,
          false,
          true
        );
      } else if (type === Fragment && patchFlag & (128 | 256) || !optimized && shapeFlag & 16) {
        unmountChildren(children, parentComponent, parentSuspense);
      }
      if (doRemove) {
        remove2(vnode);
      }
    }
    if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
        shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
      }, parentSuspense);
    }
  };
  const remove2 = (vnode) => {
    const { type, el, anchor, transition } = vnode;
    if (type === Fragment) {
      {
        removeFragment(el, anchor);
      }
      return;
    }
    if (type === Static) {
      removeStaticNode(vnode);
      return;
    }
    const performRemove = () => {
      hostRemove(el);
      if (transition && !transition.persisted && transition.afterLeave) {
        transition.afterLeave();
      }
    };
    if (vnode.shapeFlag & 1 && transition && !transition.persisted) {
      const { leave, delayLeave } = transition;
      const performLeave = () => leave(el, performRemove);
      if (delayLeave) {
        delayLeave(vnode.el, performRemove, performLeave);
      } else {
        performLeave();
      }
    } else {
      performRemove();
    }
  };
  const removeFragment = (cur, end) => {
    let next;
    while (cur !== end) {
      next = hostNextSibling(cur);
      hostRemove(cur);
      cur = next;
    }
    hostRemove(end);
  };
  const unmountComponent = (instance, parentSuspense, doRemove) => {
    const { bum, scope, job, subTree, um, m, a } = instance;
    invalidateMount(m);
    invalidateMount(a);
    if (bum) {
      invokeArrayFns(bum);
    }
    scope.stop();
    if (job) {
      job.flags |= 8;
      unmount(subTree, instance, parentSuspense, doRemove);
    }
    if (um) {
      queuePostRenderEffect(um, parentSuspense);
    }
    queuePostRenderEffect(() => {
      instance.isUnmounted = true;
    }, parentSuspense);
  };
  const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
    }
  };
  const getNextHostNode = (vnode) => {
    if (vnode.shapeFlag & 6) {
      return getNextHostNode(vnode.component.subTree);
    }
    if (vnode.shapeFlag & 128) {
      return vnode.suspense.next();
    }
    const el = hostNextSibling(vnode.anchor || vnode.el);
    const teleportEnd = el && el[TeleportEndKey];
    return teleportEnd ? hostNextSibling(teleportEnd) : el;
  };
  let isFlushing = false;
  const render = (vnode, container, namespace) => {
    let instance;
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true);
        instance = container._vnode.component;
      }
    } else {
      patch(
        container._vnode || null,
        vnode,
        container,
        null,
        null,
        null,
        namespace
      );
    }
    container._vnode = vnode;
    if (!isFlushing) {
      isFlushing = true;
      flushPreFlushCbs(instance);
      flushPostFlushCbs();
      isFlushing = false;
    }
  };
  const internals = {
    p: patch,
    um: unmount,
    m: move,
    r: remove2,
    mt: mountComponent,
    mc: mountChildren,
    pc: patchChildren,
    pbc: patchBlockChildren,
    n: getNextHostNode,
    o: options
  };
  let hydrate;
  return {
    render,
    hydrate,
    createApp: createAppAPI(render)
  };
}
function resolveChildrenNamespace({ type, props }, currentNamespace) {
  return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
}
function toggleRecurse({ effect: effect2, job }, allowed) {
  if (allowed) {
    effect2.flags |= 32;
    job.flags |= 4;
  } else {
    effect2.flags &= -33;
    job.flags &= -5;
  }
}
function needTransition(parentSuspense, transition) {
  return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
}
function traverseStaticChildren(n1, n2, shallow = false) {
  const ch1 = n1.children;
  const ch2 = n2.children;
  if (isArray$1(ch1) && isArray$1(ch2)) {
    for (let i = 0; i < ch1.length; i++) {
      const c1 = ch1[i];
      let c2 = ch2[i];
      if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
        if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
          c2 = ch2[i] = cloneIfMounted(ch2[i]);
          c2.el = c1.el;
        }
        if (!shallow && c2.patchFlag !== -2)
          traverseStaticChildren(c1, c2);
      }
      if (c2.type === Text) {
        if (c2.patchFlag === -1) {
          c2 = ch2[i] = cloneIfMounted(c2);
        }
        c2.el = c1.el;
      }
      if (c2.type === Comment && !c2.el) {
        c2.el = c1.el;
      }
    }
  }
}
function getSequence(arr) {
  const p2 = arr.slice();
  const result = [0];
  let i, j, u, v, c;
  const len = arr.length;
  for (i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      j = result[result.length - 1];
      if (arr[j] < arrI) {
        p2[i] = j;
        result.push(i);
        continue;
      }
      u = 0;
      v = result.length - 1;
      while (u < v) {
        c = u + v >> 1;
        if (arr[result[c]] < arrI) {
          u = c + 1;
        } else {
          v = c;
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p2[i] = result[u - 1];
        }
        result[u] = i;
      }
    }
  }
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p2[v];
  }
  return result;
}
function locateNonHydratedAsyncRoot(instance) {
  const subComponent = instance.subTree.component;
  if (subComponent) {
    if (subComponent.asyncDep && !subComponent.asyncResolved) {
      return subComponent;
    } else {
      return locateNonHydratedAsyncRoot(subComponent);
    }
  }
}
function invalidateMount(hooks) {
  if (hooks) {
    for (let i = 0; i < hooks.length; i++)
      hooks[i].flags |= 8;
  }
}
function resolveAsyncComponentPlaceholder(anchorVnode) {
  if (anchorVnode.placeholder) {
    return anchorVnode.placeholder;
  }
  const instance = anchorVnode.component;
  if (instance) {
    return resolveAsyncComponentPlaceholder(instance.subTree);
  }
  return null;
}
const isSuspense = (type) => type.__isSuspense;
function queueEffectWithSuspense(fn, suspense) {
  if (suspense && suspense.pendingBranch) {
    if (isArray$1(fn)) {
      suspense.effects.push(...fn);
    } else {
      suspense.effects.push(fn);
    }
  } else {
    queuePostFlushCb(fn);
  }
}
const Fragment = /* @__PURE__ */ Symbol.for("v-fgt");
const Text = /* @__PURE__ */ Symbol.for("v-txt");
const Comment = /* @__PURE__ */ Symbol.for("v-cmt");
const Static = /* @__PURE__ */ Symbol.for("v-stc");
const blockStack = [];
let currentBlock = null;
function openBlock(disableTracking = false) {
  blockStack.push(currentBlock = disableTracking ? null : []);
}
function closeBlock() {
  blockStack.pop();
  currentBlock = blockStack[blockStack.length - 1] || null;
}
let isBlockTreeEnabled = 1;
function setBlockTracking(value, inVOnce = false) {
  isBlockTreeEnabled += value;
  if (value < 0 && currentBlock && inVOnce) {
    currentBlock.hasOnce = true;
  }
}
function setupBlock(vnode) {
  vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
  closeBlock();
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(vnode);
  }
  return vnode;
}
function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
  return setupBlock(
    createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      true
    )
  );
}
function createBlock(type, props, children, patchFlag, dynamicProps) {
  return setupBlock(
    createVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      true
    )
  );
}
function isVNode(value) {
  return value ? value.__v_isVNode === true : false;
}
function isSameVNodeType(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}
const normalizeKey = ({ key }) => key != null ? key : null;
const normalizeRef = ({
  ref: ref3,
  ref_key,
  ref_for
}) => {
  if (typeof ref3 === "number") {
    ref3 = "" + ref3;
  }
  return ref3 != null ? isString(ref3) || /* @__PURE__ */ isRef(ref3) || isFunction(ref3) ? { i: currentRenderingInstance, r: ref3, k: ref_key, f: !!ref_for } : ref3 : null;
};
function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
    ctx: currentRenderingInstance
  };
  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children);
    if (shapeFlag & 128) {
      type.normalize(vnode);
    }
  } else if (children) {
    vnode.shapeFlag |= isString(children) ? 8 : 16;
  }
  if (isBlockTreeEnabled > 0 && // avoid a block node from tracking itself
  !isBlockNode && // has current parent block
  currentBlock && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (vnode.patchFlag > 0 || shapeFlag & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  vnode.patchFlag !== 32) {
    currentBlock.push(vnode);
  }
  return vnode;
}
const createVNode = _createVNode;
function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    type = Comment;
  }
  if (isVNode(type)) {
    const cloned = cloneVNode(
      type,
      props,
      true
      /* mergeRef: true */
    );
    if (children) {
      normalizeChildren(cloned, children);
    }
    if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
      if (cloned.shapeFlag & 6) {
        currentBlock[currentBlock.indexOf(type)] = cloned;
      } else {
        currentBlock.push(cloned);
      }
    }
    cloned.patchFlag = -2;
    return cloned;
  }
  if (isClassComponent(type)) {
    type = type.__vccOpts;
  }
  if (props) {
    props = guardReactiveProps(props);
    let { class: klass, style } = props;
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
    if (isObject(style)) {
      if (/* @__PURE__ */ isProxy(style) && !isArray$1(style)) {
        style = extend({}, style);
      }
      props.style = normalizeStyle(style);
    }
  }
  const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true
  );
}
function guardReactiveProps(props) {
  if (!props) return null;
  return /* @__PURE__ */ isProxy(props) || isInternalObject(props) ? extend({}, props) : props;
}
function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
  const { props, ref: ref3, patchFlag, children, transition } = vnode;
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
  const cloned = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref: extraProps && extraProps.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      mergeRef && ref3 ? isArray$1(ref3) ? ref3.concat(normalizeRef(extraProps)) : [ref3, normalizeRef(extraProps)] : normalizeRef(extraProps)
    ) : ref3,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children,
    target: vnode.target,
    targetStart: vnode.targetStart,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    placeholder: vnode.placeholder,
    el: vnode.el,
    anchor: vnode.anchor,
    ctx: vnode.ctx,
    ce: vnode.ce
  };
  if (transition && cloneTransition) {
    setTransitionHooks(
      cloned,
      transition.clone(cloned)
    );
  }
  return cloned;
}
function createTextVNode(text = " ", flag = 0) {
  return createVNode(Text, null, text, flag);
}
function createStaticVNode(content, numberOfNodes) {
  const vnode = createVNode(Static, null, content);
  vnode.staticCount = numberOfNodes;
  return vnode;
}
function createCommentVNode(text = "", asBlock = false) {
  return asBlock ? (openBlock(), createBlock(Comment, null, text)) : createVNode(Comment, null, text);
}
function normalizeVNode(child) {
  if (child == null || typeof child === "boolean") {
    return createVNode(Comment);
  } else if (isArray$1(child)) {
    return createVNode(
      Fragment,
      null,
      // #3666, avoid reference pollution when reusing vnode
      child.slice()
    );
  } else if (isVNode(child)) {
    return cloneIfMounted(child);
  } else {
    return createVNode(Text, null, String(child));
  }
}
function cloneIfMounted(child) {
  return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
}
function normalizeChildren(vnode, children) {
  let type = 0;
  const { shapeFlag } = vnode;
  if (children == null) {
    children = null;
  } else if (isArray$1(children)) {
    type = 16;
  } else if (typeof children === "object") {
    if (shapeFlag & (1 | 64)) {
      const slot = children.default;
      if (slot) {
        slot._c && (slot._d = false);
        normalizeChildren(vnode, slot());
        slot._c && (slot._d = true);
      }
      return;
    } else {
      type = 32;
      const slotFlag = children._;
      if (!slotFlag && !isInternalObject(children)) {
        children._ctx = currentRenderingInstance;
      } else if (slotFlag === 3 && currentRenderingInstance) {
        if (currentRenderingInstance.slots._ === 1) {
          children._ = 1;
        } else {
          children._ = 2;
          vnode.patchFlag |= 1024;
        }
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance };
    type = 32;
  } else {
    children = String(children);
    if (shapeFlag & 64) {
      type = 16;
      children = [createTextVNode(children)];
    } else {
      type = 8;
    }
  }
  vnode.children = children;
  vnode.shapeFlag |= type;
}
function mergeProps(...args) {
  const ret = {};
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i];
    for (const key in toMerge) {
      if (key === "class") {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class]);
        }
      } else if (key === "style") {
        ret.style = normalizeStyle([ret.style, toMerge.style]);
      } else if (isOn(key)) {
        const existing = ret[key];
        const incoming = toMerge[key];
        if (incoming && existing !== incoming && !(isArray$1(existing) && existing.includes(incoming))) {
          ret[key] = existing ? [].concat(existing, incoming) : incoming;
        }
      } else if (key !== "") {
        ret[key] = toMerge[key];
      }
    }
  }
  return ret;
}
function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
  callWithAsyncErrorHandling(hook, instance, 7, [
    vnode,
    prevVNode
  ]);
}
const emptyAppContext = createAppContext();
let uid = 0;
function createComponentInstance(vnode, parent, suspense) {
  const type = vnode.type;
  const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
  const instance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    job: null,
    scope: new EffectScope(
      true
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    ids: parent ? parent.ids : ["", 0, 0],
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: EMPTY_OBJ,
    // inheritAttrs
    inheritAttrs: type.inheritAttrs,
    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,
    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,
    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null
  };
  {
    instance.ctx = { _: instance };
  }
  instance.root = parent ? parent.root : instance;
  instance.emit = emit.bind(null, instance);
  if (vnode.ce) {
    vnode.ce(instance);
  }
  return instance;
}
let currentInstance = null;
const getCurrentInstance = () => currentInstance || currentRenderingInstance;
let internalSetCurrentInstance;
let setInSSRSetupState;
{
  const g = getGlobalThis();
  const registerGlobalSetter = (key, setter) => {
    let setters;
    if (!(setters = g[key])) setters = g[key] = [];
    setters.push(setter);
    return (v) => {
      if (setters.length > 1) setters.forEach((set) => set(v));
      else setters[0](v);
    };
  };
  internalSetCurrentInstance = registerGlobalSetter(
    `__VUE_INSTANCE_SETTERS__`,
    (v) => currentInstance = v
  );
  setInSSRSetupState = registerGlobalSetter(
    `__VUE_SSR_SETTERS__`,
    (v) => isInSSRComponentSetup = v
  );
}
const setCurrentInstance = (instance) => {
  const prev = currentInstance;
  internalSetCurrentInstance(instance);
  instance.scope.on();
  return () => {
    instance.scope.off();
    internalSetCurrentInstance(prev);
  };
};
const unsetCurrentInstance = () => {
  currentInstance && currentInstance.scope.off();
  internalSetCurrentInstance(null);
};
function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & 4;
}
let isInSSRComponentSetup = false;
function setupComponent(instance, isSSR = false, optimized = false) {
  isSSR && setInSSRSetupState(isSSR);
  const { props, children } = instance.vnode;
  const isStateful = isStatefulComponent(instance);
  initProps(instance, props, isStateful, isSSR);
  initSlots(instance, children, optimized || isSSR);
  const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
  isSSR && setInSSRSetupState(false);
  return setupResult;
}
function setupStatefulComponent(instance, isSSR) {
  const Component = instance.type;
  instance.accessCache = /* @__PURE__ */ Object.create(null);
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
  const { setup } = Component;
  if (setup) {
    pauseTracking();
    const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
    const reset = setCurrentInstance(instance);
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      0,
      [
        instance.props,
        setupContext
      ]
    );
    const isAsyncSetup = isPromise(setupResult);
    resetTracking();
    reset();
    if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
      markAsyncBoundary(instance);
    }
    if (isAsyncSetup) {
      setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
      if (isSSR) {
        return setupResult.then((resolvedResult) => {
          handleSetupResult(instance, resolvedResult);
        }).catch((e) => {
          handleError(e, instance, 0);
        });
      } else {
        instance.asyncDep = setupResult;
      }
    } else {
      handleSetupResult(instance, setupResult);
    }
  } else {
    finishComponentSetup(instance);
  }
}
function handleSetupResult(instance, setupResult, isSSR) {
  if (isFunction(setupResult)) {
    if (instance.type.__ssrInlineRender) {
      instance.ssrRender = setupResult;
    } else {
      instance.render = setupResult;
    }
  } else if (isObject(setupResult)) {
    instance.setupState = proxyRefs(setupResult);
  } else ;
  finishComponentSetup(instance);
}
function finishComponentSetup(instance, isSSR, skipOptions) {
  const Component = instance.type;
  if (!instance.render) {
    instance.render = Component.render || NOOP;
  }
  {
    const reset = setCurrentInstance(instance);
    pauseTracking();
    try {
      applyOptions(instance);
    } finally {
      resetTracking();
      reset();
    }
  }
}
const attrsProxyHandlers = {
  get(target, key) {
    track(target, "get", "");
    return target[key];
  }
};
function createSetupContext(instance) {
  const expose = (exposed) => {
    instance.exposed = exposed || {};
  };
  {
    return {
      attrs: new Proxy(instance.attrs, attrsProxyHandlers),
      slots: instance.slots,
      emit: instance.emit,
      expose
    };
  }
}
function getComponentPublicInstance(instance) {
  if (instance.exposed) {
    return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
      get(target, key) {
        if (key in target) {
          return target[key];
        } else if (key in publicPropertiesMap) {
          return publicPropertiesMap[key](instance);
        }
      },
      has(target, key) {
        return key in target || key in publicPropertiesMap;
      }
    }));
  } else {
    return instance.proxy;
  }
}
const classifyRE = /(?:^|[-_])\w/g;
const classify = (str) => str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, "");
function getComponentName(Component, includeInferred = true) {
  return isFunction(Component) ? Component.displayName || Component.name : Component.name || includeInferred && Component.__name;
}
function formatComponentName(instance, Component, isRoot = false) {
  let name = getComponentName(Component);
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/);
    if (match) {
      name = match[1];
    }
  }
  if (!name && instance) {
    const inferFromRegistry = (registry) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key;
        }
      }
    };
    name = inferFromRegistry(instance.components) || instance.parent && inferFromRegistry(
      instance.parent.type.components
    ) || inferFromRegistry(instance.appContext.components);
  }
  return name ? classify(name) : isRoot ? `App` : `Anonymous`;
}
function isClassComponent(value) {
  return isFunction(value) && "__vccOpts" in value;
}
const computed = (getterOrOptions, debugOptions) => {
  const c = /* @__PURE__ */ computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
  return c;
};
function h(type, propsOrChildren, children) {
  try {
    setBlockTracking(-1);
    const l = arguments.length;
    if (l === 2) {
      if (isObject(propsOrChildren) && !isArray$1(propsOrChildren)) {
        if (isVNode(propsOrChildren)) {
          return createVNode(type, null, [propsOrChildren]);
        }
        return createVNode(type, propsOrChildren);
      } else {
        return createVNode(type, null, propsOrChildren);
      }
    } else {
      if (l > 3) {
        children = Array.prototype.slice.call(arguments, 2);
      } else if (l === 3 && isVNode(children)) {
        children = [children];
      }
      return createVNode(type, propsOrChildren, children);
    }
  } finally {
    setBlockTracking(1);
  }
}
const version = "3.5.30";
/**
* @vue/runtime-dom v3.5.30
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
let policy = void 0;
const tt = typeof window !== "undefined" && window.trustedTypes;
if (tt) {
  try {
    policy = /* @__PURE__ */ tt.createPolicy("vue", {
      createHTML: (val) => val
    });
  } catch (e) {
  }
}
const unsafeToTrustedHTML = policy ? (val) => policy.createHTML(val) : (val) => val;
const svgNS = "http://www.w3.org/2000/svg";
const mathmlNS = "http://www.w3.org/1998/Math/MathML";
const doc = typeof document !== "undefined" ? document : null;
const templateContainer = doc && /* @__PURE__ */ doc.createElement("template");
const nodeOps = {
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null);
  },
  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },
  createElement: (tag, namespace, is, props) => {
    const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : is ? doc.createElement(tag, { is }) : doc.createElement(tag);
    if (tag === "select" && props && props.multiple != null) {
      el.setAttribute("multiple", props.multiple);
    }
    return el;
  },
  createText: (text) => doc.createTextNode(text),
  createComment: (text) => doc.createComment(text),
  setText: (node, text) => {
    node.nodeValue = text;
  },
  setElementText: (el, text) => {
    el.textContent = text;
  },
  parentNode: (node) => node.parentNode,
  nextSibling: (node) => node.nextSibling,
  querySelector: (selector) => doc.querySelector(selector),
  setScopeId(el, id) {
    el.setAttribute(id, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(content, parent, anchor, namespace, start, end) {
    const before = anchor ? anchor.previousSibling : parent.lastChild;
    if (start && (start === end || start.nextSibling)) {
      while (true) {
        parent.insertBefore(start.cloneNode(true), anchor);
        if (start === end || !(start = start.nextSibling)) break;
      }
    } else {
      templateContainer.innerHTML = unsafeToTrustedHTML(
        namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content
      );
      const template = templateContainer.content;
      if (namespace === "svg" || namespace === "mathml") {
        const wrapper = template.firstChild;
        while (wrapper.firstChild) {
          template.appendChild(wrapper.firstChild);
        }
        template.removeChild(wrapper);
      }
      parent.insertBefore(template, anchor);
    }
    return [
      // first
      before ? before.nextSibling : parent.firstChild,
      // last
      anchor ? anchor.previousSibling : parent.lastChild
    ];
  }
};
const TRANSITION = "transition";
const ANIMATION = "animation";
const vtcKey = /* @__PURE__ */ Symbol("_vtc");
const DOMTransitionPropsValidators = {
  name: String,
  type: String,
  css: {
    type: Boolean,
    default: true
  },
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String
};
const TransitionPropsValidators = /* @__PURE__ */ extend(
  {},
  BaseTransitionPropsValidators,
  DOMTransitionPropsValidators
);
const decorate$1 = (t) => {
  t.displayName = "Transition";
  t.props = TransitionPropsValidators;
  return t;
};
const Transition = /* @__PURE__ */ decorate$1(
  (props, { slots }) => h(BaseTransition, resolveTransitionProps(props), slots)
);
const callHook = (hook, args = []) => {
  if (isArray$1(hook)) {
    hook.forEach((h2) => h2(...args));
  } else if (hook) {
    hook(...args);
  }
};
const hasExplicitCallback = (hook) => {
  return hook ? isArray$1(hook) ? hook.some((h2) => h2.length > 1) : hook.length > 1 : false;
};
function resolveTransitionProps(rawProps) {
  const baseProps = {};
  for (const key in rawProps) {
    if (!(key in DOMTransitionPropsValidators)) {
      baseProps[key] = rawProps[key];
    }
  }
  if (rawProps.css === false) {
    return baseProps;
  }
  const {
    name = "v",
    type,
    duration,
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    appearFromClass = enterFromClass,
    appearActiveClass = enterActiveClass,
    appearToClass = enterToClass,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`
  } = rawProps;
  const durations = normalizeDuration(duration);
  const enterDuration = durations && durations[0];
  const leaveDuration = durations && durations[1];
  const {
    onBeforeEnter,
    onEnter,
    onEnterCancelled,
    onLeave,
    onLeaveCancelled,
    onBeforeAppear = onBeforeEnter,
    onAppear = onEnter,
    onAppearCancelled = onEnterCancelled
  } = baseProps;
  const finishEnter = (el, isAppear, done, isCancelled) => {
    el._enterCancelled = isCancelled;
    removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
    removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
    done && done();
  };
  const finishLeave = (el, done) => {
    el._isLeaving = false;
    removeTransitionClass(el, leaveFromClass);
    removeTransitionClass(el, leaveToClass);
    removeTransitionClass(el, leaveActiveClass);
    done && done();
  };
  const makeEnterHook = (isAppear) => {
    return (el, done) => {
      const hook = isAppear ? onAppear : onEnter;
      const resolve2 = () => finishEnter(el, isAppear, done);
      callHook(hook, [el, resolve2]);
      nextFrame(() => {
        removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
        addTransitionClass(el, isAppear ? appearToClass : enterToClass);
        if (!hasExplicitCallback(hook)) {
          whenTransitionEnds(el, type, enterDuration, resolve2);
        }
      });
    };
  };
  return extend(baseProps, {
    onBeforeEnter(el) {
      callHook(onBeforeEnter, [el]);
      addTransitionClass(el, enterFromClass);
      addTransitionClass(el, enterActiveClass);
    },
    onBeforeAppear(el) {
      callHook(onBeforeAppear, [el]);
      addTransitionClass(el, appearFromClass);
      addTransitionClass(el, appearActiveClass);
    },
    onEnter: makeEnterHook(false),
    onAppear: makeEnterHook(true),
    onLeave(el, done) {
      el._isLeaving = true;
      const resolve2 = () => finishLeave(el, done);
      addTransitionClass(el, leaveFromClass);
      if (!el._enterCancelled) {
        forceReflow(el);
        addTransitionClass(el, leaveActiveClass);
      } else {
        addTransitionClass(el, leaveActiveClass);
        forceReflow(el);
      }
      nextFrame(() => {
        if (!el._isLeaving) {
          return;
        }
        removeTransitionClass(el, leaveFromClass);
        addTransitionClass(el, leaveToClass);
        if (!hasExplicitCallback(onLeave)) {
          whenTransitionEnds(el, type, leaveDuration, resolve2);
        }
      });
      callHook(onLeave, [el, resolve2]);
    },
    onEnterCancelled(el) {
      finishEnter(el, false, void 0, true);
      callHook(onEnterCancelled, [el]);
    },
    onAppearCancelled(el) {
      finishEnter(el, true, void 0, true);
      callHook(onAppearCancelled, [el]);
    },
    onLeaveCancelled(el) {
      finishLeave(el);
      callHook(onLeaveCancelled, [el]);
    }
  });
}
function normalizeDuration(duration) {
  if (duration == null) {
    return null;
  } else if (isObject(duration)) {
    return [NumberOf(duration.enter), NumberOf(duration.leave)];
  } else {
    const n = NumberOf(duration);
    return [n, n];
  }
}
function NumberOf(val) {
  const res = toNumber(val);
  return res;
}
function addTransitionClass(el, cls) {
  cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
  (el[vtcKey] || (el[vtcKey] = /* @__PURE__ */ new Set())).add(cls);
}
function removeTransitionClass(el, cls) {
  cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
  const _vtc = el[vtcKey];
  if (_vtc) {
    _vtc.delete(cls);
    if (!_vtc.size) {
      el[vtcKey] = void 0;
    }
  }
}
function nextFrame(cb) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}
let endId = 0;
function whenTransitionEnds(el, expectedType, explicitTimeout, resolve2) {
  const id = el._endId = ++endId;
  const resolveIfNotStale = () => {
    if (id === el._endId) {
      resolve2();
    }
  };
  if (explicitTimeout != null) {
    return setTimeout(resolveIfNotStale, explicitTimeout);
  }
  const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
  if (!type) {
    return resolve2();
  }
  const endEvent = type + "end";
  let ended = 0;
  const end = () => {
    el.removeEventListener(endEvent, onEnd);
    resolveIfNotStale();
  };
  const onEnd = (e) => {
    if (e.target === el && ++ended >= propCount) {
      end();
    }
  };
  setTimeout(() => {
    if (ended < propCount) {
      end();
    }
  }, timeout + 1);
  el.addEventListener(endEvent, onEnd);
}
function getTransitionInfo(el, expectedType) {
  const styles = window.getComputedStyle(el);
  const getStyleProperties = (key) => (styles[key] || "").split(", ");
  const transitionDelays = getStyleProperties(`${TRANSITION}Delay`);
  const transitionDurations = getStyleProperties(`${TRANSITION}Duration`);
  const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
  const animationDelays = getStyleProperties(`${ANIMATION}Delay`);
  const animationDurations = getStyleProperties(`${ANIMATION}Duration`);
  const animationTimeout = getTimeout(animationDelays, animationDurations);
  let type = null;
  let timeout = 0;
  let propCount = 0;
  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION;
      timeout = transitionTimeout;
      propCount = transitionDurations.length;
    }
  } else if (expectedType === ANIMATION) {
    if (animationTimeout > 0) {
      type = ANIMATION;
      timeout = animationTimeout;
      propCount = animationDurations.length;
    }
  } else {
    timeout = Math.max(transitionTimeout, animationTimeout);
    type = timeout > 0 ? transitionTimeout > animationTimeout ? TRANSITION : ANIMATION : null;
    propCount = type ? type === TRANSITION ? transitionDurations.length : animationDurations.length : 0;
  }
  const hasTransform = type === TRANSITION && /\b(?:transform|all)(?:,|$)/.test(
    getStyleProperties(`${TRANSITION}Property`).toString()
  );
  return {
    type,
    timeout,
    propCount,
    hasTransform
  };
}
function getTimeout(delays, durations) {
  while (delays.length < durations.length) {
    delays = delays.concat(delays);
  }
  return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
}
function toMs(s) {
  if (s === "auto") return 0;
  return Number(s.slice(0, -1).replace(",", ".")) * 1e3;
}
function forceReflow(el) {
  const targetDocument = el ? el.ownerDocument : document;
  return targetDocument.body.offsetHeight;
}
function patchClass(el, value, isSVG) {
  const transitionClasses = el[vtcKey];
  if (transitionClasses) {
    value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
  }
  if (value == null) {
    el.removeAttribute("class");
  } else if (isSVG) {
    el.setAttribute("class", value);
  } else {
    el.className = value;
  }
}
const vShowOriginalDisplay = /* @__PURE__ */ Symbol("_vod");
const vShowHidden = /* @__PURE__ */ Symbol("_vsh");
const CSS_VAR_TEXT = /* @__PURE__ */ Symbol("");
const displayRE = /(?:^|;)\s*display\s*:/;
function patchStyle(el, prev, next) {
  const style = el.style;
  const isCssString = isString(next);
  let hasControlledDisplay = false;
  if (next && !isCssString) {
    if (prev) {
      if (!isString(prev)) {
        for (const key in prev) {
          if (next[key] == null) {
            setStyle(style, key, "");
          }
        }
      } else {
        for (const prevStyle of prev.split(";")) {
          const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
          if (next[key] == null) {
            setStyle(style, key, "");
          }
        }
      }
    }
    for (const key in next) {
      if (key === "display") {
        hasControlledDisplay = true;
      }
      setStyle(style, key, next[key]);
    }
  } else {
    if (isCssString) {
      if (prev !== next) {
        const cssVarText = style[CSS_VAR_TEXT];
        if (cssVarText) {
          next += ";" + cssVarText;
        }
        style.cssText = next;
        hasControlledDisplay = displayRE.test(next);
      }
    } else if (prev) {
      el.removeAttribute("style");
    }
  }
  if (vShowOriginalDisplay in el) {
    el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : "";
    if (el[vShowHidden]) {
      style.display = "none";
    }
  }
}
const importantRE = /\s*!important$/;
function setStyle(style, name, val) {
  if (isArray$1(val)) {
    val.forEach((v) => setStyle(style, name, v));
  } else {
    if (val == null) val = "";
    if (name.startsWith("--")) {
      style.setProperty(name, val);
    } else {
      const prefixed = autoPrefix(style, name);
      if (importantRE.test(val)) {
        style.setProperty(
          hyphenate(prefixed),
          val.replace(importantRE, ""),
          "important"
        );
      } else {
        style[prefixed] = val;
      }
    }
  }
}
const prefixes = ["Webkit", "Moz", "ms"];
const prefixCache = {};
function autoPrefix(style, rawName) {
  const cached = prefixCache[rawName];
  if (cached) {
    return cached;
  }
  let name = camelize(rawName);
  if (name !== "filter" && name in style) {
    return prefixCache[rawName] = name;
  }
  name = capitalize(name);
  for (let i = 0; i < prefixes.length; i++) {
    const prefixed = prefixes[i] + name;
    if (prefixed in style) {
      return prefixCache[rawName] = prefixed;
    }
  }
  return rawName;
}
const xlinkNS = "http://www.w3.org/1999/xlink";
function patchAttr(el, key, value, isSVG, instance, isBoolean = isSpecialBooleanAttr(key)) {
  if (isSVG && key.startsWith("xlink:")) {
    if (value == null) {
      el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
    } else {
      el.setAttributeNS(xlinkNS, key, value);
    }
  } else {
    if (value == null || isBoolean && !includeBooleanAttr(value)) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(
        key,
        isBoolean ? "" : isSymbol(value) ? String(value) : value
      );
    }
  }
}
function patchDOMProp(el, key, value, parentComponent, attrName) {
  if (key === "innerHTML" || key === "textContent") {
    if (value != null) {
      el[key] = key === "innerHTML" ? unsafeToTrustedHTML(value) : value;
    }
    return;
  }
  const tag = el.tagName;
  if (key === "value" && tag !== "PROGRESS" && // custom elements may use _value internally
  !tag.includes("-")) {
    const oldValue = tag === "OPTION" ? el.getAttribute("value") || "" : el.value;
    const newValue = value == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      el.type === "checkbox" ? "on" : ""
    ) : String(value);
    if (oldValue !== newValue || !("_value" in el)) {
      el.value = newValue;
    }
    if (value == null) {
      el.removeAttribute(key);
    }
    el._value = value;
    return;
  }
  let needRemove = false;
  if (value === "" || value == null) {
    const type = typeof el[key];
    if (type === "boolean") {
      value = includeBooleanAttr(value);
    } else if (value == null && type === "string") {
      value = "";
      needRemove = true;
    } else if (type === "number") {
      value = 0;
      needRemove = true;
    }
  }
  try {
    el[key] = value;
  } catch (e) {
  }
  needRemove && el.removeAttribute(attrName || key);
}
function addEventListener(el, event, handler, options) {
  el.addEventListener(event, handler, options);
}
function removeEventListener(el, event, handler, options) {
  el.removeEventListener(event, handler, options);
}
const veiKey = /* @__PURE__ */ Symbol("_vei");
function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
  const invokers = el[veiKey] || (el[veiKey] = {});
  const existingInvoker = invokers[rawName];
  if (nextValue && existingInvoker) {
    existingInvoker.value = nextValue;
  } else {
    const [name, options] = parseName(rawName);
    if (nextValue) {
      const invoker = invokers[rawName] = createInvoker(
        nextValue,
        instance
      );
      addEventListener(el, name, invoker, options);
    } else if (existingInvoker) {
      removeEventListener(el, name, existingInvoker, options);
      invokers[rawName] = void 0;
    }
  }
}
const optionsModifierRE = /(?:Once|Passive|Capture)$/;
function parseName(name) {
  let options;
  if (optionsModifierRE.test(name)) {
    options = {};
    let m;
    while (m = name.match(optionsModifierRE)) {
      name = name.slice(0, name.length - m[0].length);
      options[m[0].toLowerCase()] = true;
    }
  }
  const event = name[2] === ":" ? name.slice(3) : hyphenate(name.slice(2));
  return [event, options];
}
let cachedNow = 0;
const p = /* @__PURE__ */ Promise.resolve();
const getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
function createInvoker(initialValue, instance) {
  const invoker = (e) => {
    if (!e._vts) {
      e._vts = Date.now();
    } else if (e._vts <= invoker.attached) {
      return;
    }
    callWithAsyncErrorHandling(
      patchStopImmediatePropagation(e, invoker.value),
      instance,
      5,
      [e]
    );
  };
  invoker.value = initialValue;
  invoker.attached = getNow();
  return invoker;
}
function patchStopImmediatePropagation(e, value) {
  if (isArray$1(value)) {
    const originalStop = e.stopImmediatePropagation;
    e.stopImmediatePropagation = () => {
      originalStop.call(e);
      e._stopped = true;
    };
    return value.map(
      (fn) => (e2) => !e2._stopped && fn && fn(e2)
    );
  } else {
    return value;
  }
}
const isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // lowercase letter
key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
const patchProp = (el, key, prevValue, nextValue, namespace, parentComponent) => {
  const isSVG = namespace === "svg";
  if (key === "class") {
    patchClass(el, nextValue, isSVG);
  } else if (key === "style") {
    patchStyle(el, prevValue, nextValue);
  } else if (isOn(key)) {
    if (!isModelListener(key)) {
      patchEvent(el, key, prevValue, nextValue, parentComponent);
    }
  } else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
    patchDOMProp(el, key, nextValue);
    if (!el.tagName.includes("-") && (key === "value" || key === "checked" || key === "selected")) {
      patchAttr(el, key, nextValue, isSVG, parentComponent, key !== "value");
    }
  } else if (
    // #11081 force set props for possible async custom element
    el._isVueCE && // #12408 check if it's declared prop or it's async custom element
    (shouldSetAsPropForVueCE(el, key) || // @ts-expect-error _def is private
    el._def.__asyncLoader && (/[A-Z]/.test(key) || !isString(nextValue)))
  ) {
    patchDOMProp(el, camelize(key), nextValue, parentComponent, key);
  } else {
    if (key === "true-value") {
      el._trueValue = nextValue;
    } else if (key === "false-value") {
      el._falseValue = nextValue;
    }
    patchAttr(el, key, nextValue, isSVG);
  }
};
function shouldSetAsProp(el, key, value, isSVG) {
  if (isSVG) {
    if (key === "innerHTML" || key === "textContent") {
      return true;
    }
    if (key in el && isNativeOn(key) && isFunction(value)) {
      return true;
    }
    return false;
  }
  if (key === "spellcheck" || key === "draggable" || key === "translate" || key === "autocorrect") {
    return false;
  }
  if (key === "sandbox" && el.tagName === "IFRAME") {
    return false;
  }
  if (key === "form") {
    return false;
  }
  if (key === "list" && el.tagName === "INPUT") {
    return false;
  }
  if (key === "type" && el.tagName === "TEXTAREA") {
    return false;
  }
  if (key === "width" || key === "height") {
    const tag = el.tagName;
    if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") {
      return false;
    }
  }
  if (isNativeOn(key) && isString(value)) {
    return false;
  }
  return key in el;
}
function shouldSetAsPropForVueCE(el, key) {
  const props = (
    // @ts-expect-error _def is private
    el._def.props
  );
  if (!props) {
    return false;
  }
  const camelKey = camelize(key);
  return Array.isArray(props) ? props.some((prop) => camelize(prop) === camelKey) : Object.keys(props).some((prop) => camelize(prop) === camelKey);
}
const getModelAssigner = (vnode) => {
  const fn = vnode.props["onUpdate:modelValue"] || false;
  return isArray$1(fn) ? (value) => invokeArrayFns(fn, value) : fn;
};
function onCompositionStart(e) {
  e.target.composing = true;
}
function onCompositionEnd(e) {
  const target = e.target;
  if (target.composing) {
    target.composing = false;
    target.dispatchEvent(new Event("input"));
  }
}
const assignKey = /* @__PURE__ */ Symbol("_assign");
function castValue(value, trim, number) {
  if (trim) value = value.trim();
  if (number) value = looseToNumber(value);
  return value;
}
const vModelText = {
  created(el, { modifiers: { lazy, trim, number } }, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    const castToNumber = number || vnode.props && vnode.props.type === "number";
    addEventListener(el, lazy ? "change" : "input", (e) => {
      if (e.target.composing) return;
      el[assignKey](castValue(el.value, trim, castToNumber));
    });
    if (trim || castToNumber) {
      addEventListener(el, "change", () => {
        el.value = castValue(el.value, trim, castToNumber);
      });
    }
    if (!lazy) {
      addEventListener(el, "compositionstart", onCompositionStart);
      addEventListener(el, "compositionend", onCompositionEnd);
      addEventListener(el, "change", onCompositionEnd);
    }
  },
  // set value on mounted so it's after min/max for type="range"
  mounted(el, { value }) {
    el.value = value == null ? "" : value;
  },
  beforeUpdate(el, { value, oldValue, modifiers: { lazy, trim, number } }, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    if (el.composing) return;
    const elValue = (number || el.type === "number") && !/^0\d/.test(el.value) ? looseToNumber(el.value) : el.value;
    const newValue = value == null ? "" : value;
    if (elValue === newValue) {
      return;
    }
    if (document.activeElement === el && el.type !== "range") {
      if (lazy && value === oldValue) {
        return;
      }
      if (trim && el.value.trim() === newValue) {
        return;
      }
    }
    el.value = newValue;
  }
};
const vModelCheckbox = {
  // #4096 array checkboxes need to be deep traversed
  deep: true,
  created(el, _, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    addEventListener(el, "change", () => {
      const modelValue = el._modelValue;
      const elementValue = getValue(el);
      const checked = el.checked;
      const assign2 = el[assignKey];
      if (isArray$1(modelValue)) {
        const index = looseIndexOf(modelValue, elementValue);
        const found = index !== -1;
        if (checked && !found) {
          assign2(modelValue.concat(elementValue));
        } else if (!checked && found) {
          const filtered = [...modelValue];
          filtered.splice(index, 1);
          assign2(filtered);
        }
      } else if (isSet(modelValue)) {
        const cloned = new Set(modelValue);
        if (checked) {
          cloned.add(elementValue);
        } else {
          cloned.delete(elementValue);
        }
        assign2(cloned);
      } else {
        assign2(getCheckboxValue(el, checked));
      }
    });
  },
  // set initial checked on mount to wait for true-value/false-value
  mounted: setChecked,
  beforeUpdate(el, binding, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    setChecked(el, binding, vnode);
  }
};
function setChecked(el, { value, oldValue }, vnode) {
  el._modelValue = value;
  let checked;
  if (isArray$1(value)) {
    checked = looseIndexOf(value, vnode.props.value) > -1;
  } else if (isSet(value)) {
    checked = value.has(vnode.props.value);
  } else {
    if (value === oldValue) return;
    checked = looseEqual(value, getCheckboxValue(el, true));
  }
  if (el.checked !== checked) {
    el.checked = checked;
  }
}
const vModelRadio = {
  created(el, { value }, vnode) {
    el.checked = looseEqual(value, vnode.props.value);
    el[assignKey] = getModelAssigner(vnode);
    addEventListener(el, "change", () => {
      el[assignKey](getValue(el));
    });
  },
  beforeUpdate(el, { value, oldValue }, vnode) {
    el[assignKey] = getModelAssigner(vnode);
    if (value !== oldValue) {
      el.checked = looseEqual(value, vnode.props.value);
    }
  }
};
const vModelSelect = {
  // <select multiple> value need to be deep traversed
  deep: true,
  created(el, { value, modifiers: { number } }, vnode) {
    const isSetModel = isSet(value);
    addEventListener(el, "change", () => {
      const selectedVal = Array.prototype.filter.call(el.options, (o) => o.selected).map(
        (o) => number ? looseToNumber(getValue(o)) : getValue(o)
      );
      el[assignKey](
        el.multiple ? isSetModel ? new Set(selectedVal) : selectedVal : selectedVal[0]
      );
      el._assigning = true;
      nextTick(() => {
        el._assigning = false;
      });
    });
    el[assignKey] = getModelAssigner(vnode);
  },
  // set value in mounted & updated because <select> relies on its children
  // <option>s.
  mounted(el, { value }) {
    setSelected(el, value);
  },
  beforeUpdate(el, _binding, vnode) {
    el[assignKey] = getModelAssigner(vnode);
  },
  updated(el, { value }) {
    if (!el._assigning) {
      setSelected(el, value);
    }
  }
};
function setSelected(el, value) {
  const isMultiple = el.multiple;
  const isArrayValue = isArray$1(value);
  if (isMultiple && !isArrayValue && !isSet(value)) {
    return;
  }
  for (let i = 0, l = el.options.length; i < l; i++) {
    const option = el.options[i];
    const optionValue = getValue(option);
    if (isMultiple) {
      if (isArrayValue) {
        const optionType = typeof optionValue;
        if (optionType === "string" || optionType === "number") {
          option.selected = value.some((v) => String(v) === String(optionValue));
        } else {
          option.selected = looseIndexOf(value, optionValue) > -1;
        }
      } else {
        option.selected = value.has(optionValue);
      }
    } else if (looseEqual(getValue(option), value)) {
      if (el.selectedIndex !== i) el.selectedIndex = i;
      return;
    }
  }
  if (!isMultiple && el.selectedIndex !== -1) {
    el.selectedIndex = -1;
  }
}
function getValue(el) {
  return "_value" in el ? el._value : el.value;
}
function getCheckboxValue(el, checked) {
  const key = checked ? "_trueValue" : "_falseValue";
  return key in el ? el[key] : checked;
}
const systemModifiers = ["ctrl", "shift", "alt", "meta"];
const modifierGuards = {
  stop: (e) => e.stopPropagation(),
  prevent: (e) => e.preventDefault(),
  self: (e) => e.target !== e.currentTarget,
  ctrl: (e) => !e.ctrlKey,
  shift: (e) => !e.shiftKey,
  alt: (e) => !e.altKey,
  meta: (e) => !e.metaKey,
  left: (e) => "button" in e && e.button !== 0,
  middle: (e) => "button" in e && e.button !== 1,
  right: (e) => "button" in e && e.button !== 2,
  exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
};
const withModifiers = (fn, modifiers) => {
  if (!fn) return fn;
  const cache = fn._withMods || (fn._withMods = {});
  const cacheKey = modifiers.join(".");
  return cache[cacheKey] || (cache[cacheKey] = ((event, ...args) => {
    for (let i = 0; i < modifiers.length; i++) {
      const guard = modifierGuards[modifiers[i]];
      if (guard && guard(event, modifiers)) return;
    }
    return fn(event, ...args);
  }));
};
const keyNames = {
  esc: "escape",
  space: " ",
  up: "arrow-up",
  left: "arrow-left",
  right: "arrow-right",
  down: "arrow-down",
  delete: "backspace"
};
const withKeys = (fn, modifiers) => {
  const cache = fn._withKeys || (fn._withKeys = {});
  const cacheKey = modifiers.join(".");
  return cache[cacheKey] || (cache[cacheKey] = ((event) => {
    if (!("key" in event)) {
      return;
    }
    const eventKey = hyphenate(event.key);
    if (modifiers.some(
      (k) => k === eventKey || keyNames[k] === eventKey
    )) {
      return fn(event);
    }
  }));
};
const rendererOptions = /* @__PURE__ */ extend({ patchProp }, nodeOps);
let renderer;
function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions));
}
const createApp = ((...args) => {
  const app2 = ensureRenderer().createApp(...args);
  const { mount } = app2;
  app2.mount = (containerOrSelector) => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;
    const component = app2._component;
    if (!isFunction(component) && !component.render && !component.template) {
      component.template = container.innerHTML;
    }
    if (container.nodeType === 1) {
      container.textContent = "";
    }
    const proxy = mount(container, false, resolveRootNamespace(container));
    if (container instanceof Element) {
      container.removeAttribute("v-cloak");
      container.setAttribute("data-v-app", "");
    }
    return proxy;
  };
  return app2;
});
function resolveRootNamespace(container) {
  if (container instanceof SVGElement) {
    return "svg";
  }
  if (typeof MathMLElement === "function" && container instanceof MathMLElement) {
    return "mathml";
  }
}
function normalizeContainer(container) {
  if (isString(container)) {
    const res = document.querySelector(container);
    return res;
  }
  return container;
}
/*!
 * pinia v2.3.1
 * (c) 2025 Eduardo San Martin Morote
 * @license MIT
 */
let activePinia;
const setActivePinia = (pinia) => activePinia = pinia;
const piniaSymbol = (
  /* istanbul ignore next */
  Symbol()
);
function isPlainObject(o) {
  return o && typeof o === "object" && Object.prototype.toString.call(o) === "[object Object]" && typeof o.toJSON !== "function";
}
var MutationType;
(function(MutationType2) {
  MutationType2["direct"] = "direct";
  MutationType2["patchObject"] = "patch object";
  MutationType2["patchFunction"] = "patch function";
})(MutationType || (MutationType = {}));
function createPinia() {
  const scope = effectScope(true);
  const state = scope.run(() => /* @__PURE__ */ ref({}));
  let _p = [];
  let toBeInstalled = [];
  const pinia = markRaw({
    install(app2) {
      setActivePinia(pinia);
      {
        pinia._a = app2;
        app2.provide(piniaSymbol, pinia);
        app2.config.globalProperties.$pinia = pinia;
        toBeInstalled.forEach((plugin) => _p.push(plugin));
        toBeInstalled = [];
      }
    },
    use(plugin) {
      if (!this._a && true) {
        toBeInstalled.push(plugin);
      } else {
        _p.push(plugin);
      }
      return this;
    },
    _p,
    // it's actually undefined here
    // @ts-expect-error
    _a: null,
    _e: scope,
    _s: /* @__PURE__ */ new Map(),
    state
  });
  return pinia;
}
const noop$1 = () => {
};
function addSubscription(subscriptions, callback, detached, onCleanup = noop$1) {
  subscriptions.push(callback);
  const removeSubscription = () => {
    const idx = subscriptions.indexOf(callback);
    if (idx > -1) {
      subscriptions.splice(idx, 1);
      onCleanup();
    }
  };
  if (!detached && getCurrentScope()) {
    onScopeDispose(removeSubscription);
  }
  return removeSubscription;
}
function triggerSubscriptions(subscriptions, ...args) {
  subscriptions.slice().forEach((callback) => {
    callback(...args);
  });
}
const fallbackRunWithContext = (fn) => fn();
const ACTION_MARKER = Symbol();
const ACTION_NAME = Symbol();
function mergeReactiveObjects(target, patchToApply) {
  if (target instanceof Map && patchToApply instanceof Map) {
    patchToApply.forEach((value, key) => target.set(key, value));
  } else if (target instanceof Set && patchToApply instanceof Set) {
    patchToApply.forEach(target.add, target);
  }
  for (const key in patchToApply) {
    if (!patchToApply.hasOwnProperty(key))
      continue;
    const subPatch = patchToApply[key];
    const targetValue = target[key];
    if (isPlainObject(targetValue) && isPlainObject(subPatch) && target.hasOwnProperty(key) && !/* @__PURE__ */ isRef(subPatch) && !/* @__PURE__ */ isReactive(subPatch)) {
      target[key] = mergeReactiveObjects(targetValue, subPatch);
    } else {
      target[key] = subPatch;
    }
  }
  return target;
}
const skipHydrateSymbol = (
  /* istanbul ignore next */
  Symbol()
);
function shouldHydrate(obj) {
  return !isPlainObject(obj) || !obj.hasOwnProperty(skipHydrateSymbol);
}
const { assign: assign$1 } = Object;
function isComputed(o) {
  return !!(/* @__PURE__ */ isRef(o) && o.effect);
}
function createOptionsStore(id, options, pinia, hot) {
  const { state, actions, getters } = options;
  const initialState = pinia.state.value[id];
  let store;
  function setup() {
    if (!initialState && true) {
      {
        pinia.state.value[id] = state ? state() : {};
      }
    }
    const localState = /* @__PURE__ */ toRefs(pinia.state.value[id]);
    return assign$1(localState, actions, Object.keys(getters || {}).reduce((computedGetters, name) => {
      computedGetters[name] = markRaw(computed(() => {
        setActivePinia(pinia);
        const store2 = pinia._s.get(id);
        return getters[name].call(store2, store2);
      }));
      return computedGetters;
    }, {}));
  }
  store = createSetupStore(id, setup, options, pinia, hot, true);
  return store;
}
function createSetupStore($id, setup, options = {}, pinia, hot, isOptionsStore) {
  let scope;
  const optionsForPlugin = assign$1({ actions: {} }, options);
  const $subscribeOptions = { deep: true };
  let isListening;
  let isSyncListening;
  let subscriptions = [];
  let actionSubscriptions = [];
  let debuggerEvents;
  const initialState = pinia.state.value[$id];
  if (!isOptionsStore && !initialState && true) {
    {
      pinia.state.value[$id] = {};
    }
  }
  let activeListener;
  function $patch(partialStateOrMutator) {
    let subscriptionMutation;
    isListening = isSyncListening = false;
    if (typeof partialStateOrMutator === "function") {
      partialStateOrMutator(pinia.state.value[$id]);
      subscriptionMutation = {
        type: MutationType.patchFunction,
        storeId: $id,
        events: debuggerEvents
      };
    } else {
      mergeReactiveObjects(pinia.state.value[$id], partialStateOrMutator);
      subscriptionMutation = {
        type: MutationType.patchObject,
        payload: partialStateOrMutator,
        storeId: $id,
        events: debuggerEvents
      };
    }
    const myListenerId = activeListener = Symbol();
    nextTick().then(() => {
      if (activeListener === myListenerId) {
        isListening = true;
      }
    });
    isSyncListening = true;
    triggerSubscriptions(subscriptions, subscriptionMutation, pinia.state.value[$id]);
  }
  const $reset = isOptionsStore ? function $reset2() {
    const { state } = options;
    const newState = state ? state() : {};
    this.$patch(($state) => {
      assign$1($state, newState);
    });
  } : (
    /* istanbul ignore next */
    noop$1
  );
  function $dispose() {
    scope.stop();
    subscriptions = [];
    actionSubscriptions = [];
    pinia._s.delete($id);
  }
  const action = (fn, name = "") => {
    if (ACTION_MARKER in fn) {
      fn[ACTION_NAME] = name;
      return fn;
    }
    const wrappedAction = function() {
      setActivePinia(pinia);
      const args = Array.from(arguments);
      const afterCallbackList = [];
      const onErrorCallbackList = [];
      function after(callback) {
        afterCallbackList.push(callback);
      }
      function onError(callback) {
        onErrorCallbackList.push(callback);
      }
      triggerSubscriptions(actionSubscriptions, {
        args,
        name: wrappedAction[ACTION_NAME],
        store,
        after,
        onError
      });
      let ret;
      try {
        ret = fn.apply(this && this.$id === $id ? this : store, args);
      } catch (error) {
        triggerSubscriptions(onErrorCallbackList, error);
        throw error;
      }
      if (ret instanceof Promise) {
        return ret.then((value) => {
          triggerSubscriptions(afterCallbackList, value);
          return value;
        }).catch((error) => {
          triggerSubscriptions(onErrorCallbackList, error);
          return Promise.reject(error);
        });
      }
      triggerSubscriptions(afterCallbackList, ret);
      return ret;
    };
    wrappedAction[ACTION_MARKER] = true;
    wrappedAction[ACTION_NAME] = name;
    return wrappedAction;
  };
  const partialStore = {
    _p: pinia,
    // _s: scope,
    $id,
    $onAction: addSubscription.bind(null, actionSubscriptions),
    $patch,
    $reset,
    $subscribe(callback, options2 = {}) {
      const removeSubscription = addSubscription(subscriptions, callback, options2.detached, () => stopWatcher());
      const stopWatcher = scope.run(() => watch(() => pinia.state.value[$id], (state) => {
        if (options2.flush === "sync" ? isSyncListening : isListening) {
          callback({
            storeId: $id,
            type: MutationType.direct,
            events: debuggerEvents
          }, state);
        }
      }, assign$1({}, $subscribeOptions, options2)));
      return removeSubscription;
    },
    $dispose
  };
  const store = /* @__PURE__ */ reactive(partialStore);
  pinia._s.set($id, store);
  const runWithContext = pinia._a && pinia._a.runWithContext || fallbackRunWithContext;
  const setupStore = runWithContext(() => pinia._e.run(() => (scope = effectScope()).run(() => setup({ action }))));
  for (const key in setupStore) {
    const prop = setupStore[key];
    if (/* @__PURE__ */ isRef(prop) && !isComputed(prop) || /* @__PURE__ */ isReactive(prop)) {
      if (!isOptionsStore) {
        if (initialState && shouldHydrate(prop)) {
          if (/* @__PURE__ */ isRef(prop)) {
            prop.value = initialState[key];
          } else {
            mergeReactiveObjects(prop, initialState[key]);
          }
        }
        {
          pinia.state.value[$id][key] = prop;
        }
      }
    } else if (typeof prop === "function") {
      const actionValue = action(prop, key);
      {
        setupStore[key] = actionValue;
      }
      optionsForPlugin.actions[key] = prop;
    } else ;
  }
  {
    assign$1(store, setupStore);
    assign$1(/* @__PURE__ */ toRaw(store), setupStore);
  }
  Object.defineProperty(store, "$state", {
    get: () => pinia.state.value[$id],
    set: (state) => {
      $patch(($state) => {
        assign$1($state, state);
      });
    }
  });
  pinia._p.forEach((extender) => {
    {
      assign$1(store, scope.run(() => extender({
        store,
        app: pinia._a,
        pinia,
        options: optionsForPlugin
      })));
    }
  });
  if (initialState && isOptionsStore && options.hydrate) {
    options.hydrate(store.$state, initialState);
  }
  isListening = true;
  isSyncListening = true;
  return store;
}
/*! #__NO_SIDE_EFFECTS__ */
// @__NO_SIDE_EFFECTS__
function defineStore(idOrOptions, setup, setupOptions) {
  let id;
  let options;
  const isSetupStore = typeof setup === "function";
  if (typeof idOrOptions === "string") {
    id = idOrOptions;
    options = isSetupStore ? setupOptions : setup;
  } else {
    options = idOrOptions;
    id = idOrOptions.id;
  }
  function useStore(pinia, hot) {
    const hasContext = hasInjectionContext();
    pinia = // in test mode, ignore the argument provided as we can always retrieve a
    // pinia instance with getActivePinia()
    pinia || (hasContext ? inject(piniaSymbol, null) : null);
    if (pinia)
      setActivePinia(pinia);
    pinia = activePinia;
    if (!pinia._s.has(id)) {
      if (isSetupStore) {
        createSetupStore(id, setup, options, pinia);
      } else {
        createOptionsStore(id, options, pinia);
      }
    }
    const store = pinia._s.get(id);
    return store;
  }
  useStore.$id = id;
  return useStore;
}
/*!
 * vue-router v4.6.4
 * (c) 2025 Eduardo San Martin Morote
 * @license MIT
 */
const isBrowser = typeof document !== "undefined";
function isRouteComponent(component) {
  return typeof component === "object" || "displayName" in component || "props" in component || "__vccOpts" in component;
}
function isESModule(obj) {
  return obj.__esModule || obj[Symbol.toStringTag] === "Module" || obj.default && isRouteComponent(obj.default);
}
const assign = Object.assign;
function applyToParams(fn, params) {
  const newParams = {};
  for (const key in params) {
    const value = params[key];
    newParams[key] = isArray(value) ? value.map(fn) : fn(value);
  }
  return newParams;
}
const noop = () => {
};
const isArray = Array.isArray;
function mergeOptions(defaults, partialOptions) {
  const options = {};
  for (const key in defaults) options[key] = key in partialOptions ? partialOptions[key] : defaults[key];
  return options;
}
const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const IM_RE = /\?/g;
const PLUS_RE = /\+/g;
const ENC_BRACKET_OPEN_RE = /%5B/g;
const ENC_BRACKET_CLOSE_RE = /%5D/g;
const ENC_CARET_RE = /%5E/g;
const ENC_BACKTICK_RE = /%60/g;
const ENC_CURLY_OPEN_RE = /%7B/g;
const ENC_PIPE_RE = /%7C/g;
const ENC_CURLY_CLOSE_RE = /%7D/g;
const ENC_SPACE_RE = /%20/g;
function commonEncode(text) {
  return text == null ? "" : encodeURI("" + text).replace(ENC_PIPE_RE, "|").replace(ENC_BRACKET_OPEN_RE, "[").replace(ENC_BRACKET_CLOSE_RE, "]");
}
function encodeHash(text) {
  return commonEncode(text).replace(ENC_CURLY_OPEN_RE, "{").replace(ENC_CURLY_CLOSE_RE, "}").replace(ENC_CARET_RE, "^");
}
function encodeQueryValue(text) {
  return commonEncode(text).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CURLY_OPEN_RE, "{").replace(ENC_CURLY_CLOSE_RE, "}").replace(ENC_CARET_RE, "^");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function encodePath(text) {
  return commonEncode(text).replace(HASH_RE, "%23").replace(IM_RE, "%3F");
}
function encodeParam(text) {
  return encodePath(text).replace(SLASH_RE, "%2F");
}
function decode(text) {
  if (text == null) return null;
  try {
    return decodeURIComponent("" + text);
  } catch (err) {
  }
  return "" + text;
}
const TRAILING_SLASH_RE = /\/$/;
const removeTrailingSlash = (path) => path.replace(TRAILING_SLASH_RE, "");
function parseURL(parseQuery$1, location2, currentLocation = "/") {
  let path, query = {}, searchString = "", hash = "";
  const hashPos = location2.indexOf("#");
  let searchPos = location2.indexOf("?");
  searchPos = hashPos >= 0 && searchPos > hashPos ? -1 : searchPos;
  if (searchPos >= 0) {
    path = location2.slice(0, searchPos);
    searchString = location2.slice(searchPos, hashPos > 0 ? hashPos : location2.length);
    query = parseQuery$1(searchString.slice(1));
  }
  if (hashPos >= 0) {
    path = path || location2.slice(0, hashPos);
    hash = location2.slice(hashPos, location2.length);
  }
  path = resolveRelativePath(path != null ? path : location2, currentLocation);
  return {
    fullPath: path + searchString + hash,
    path,
    query,
    hash: decode(hash)
  };
}
function stringifyURL(stringifyQuery$1, location2) {
  const query = location2.query ? stringifyQuery$1(location2.query) : "";
  return location2.path + (query && "?") + query + (location2.hash || "");
}
function stripBase(pathname, base) {
  if (!base || !pathname.toLowerCase().startsWith(base.toLowerCase())) return pathname;
  return pathname.slice(base.length) || "/";
}
function isSameRouteLocation(stringifyQuery$1, a, b) {
  const aLastIndex = a.matched.length - 1;
  const bLastIndex = b.matched.length - 1;
  return aLastIndex > -1 && aLastIndex === bLastIndex && isSameRouteRecord(a.matched[aLastIndex], b.matched[bLastIndex]) && isSameRouteLocationParams(a.params, b.params) && stringifyQuery$1(a.query) === stringifyQuery$1(b.query) && a.hash === b.hash;
}
function isSameRouteRecord(a, b) {
  return (a.aliasOf || a) === (b.aliasOf || b);
}
function isSameRouteLocationParams(a, b) {
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (var key in a) if (!isSameRouteLocationParamsValue(a[key], b[key])) return false;
  return true;
}
function isSameRouteLocationParamsValue(a, b) {
  return isArray(a) ? isEquivalentArray(a, b) : isArray(b) ? isEquivalentArray(b, a) : a?.valueOf() === b?.valueOf();
}
function isEquivalentArray(a, b) {
  return isArray(b) ? a.length === b.length && a.every((value, i) => value === b[i]) : a.length === 1 && a[0] === b;
}
function resolveRelativePath(to, from) {
  if (to.startsWith("/")) return to;
  if (!to) return from;
  const fromSegments = from.split("/");
  const toSegments = to.split("/");
  const lastToSegment = toSegments[toSegments.length - 1];
  if (lastToSegment === ".." || lastToSegment === ".") toSegments.push("");
  let position = fromSegments.length - 1;
  let toPosition;
  let segment;
  for (toPosition = 0; toPosition < toSegments.length; toPosition++) {
    segment = toSegments[toPosition];
    if (segment === ".") continue;
    if (segment === "..") {
      if (position > 1) position--;
    } else break;
  }
  return fromSegments.slice(0, position).join("/") + "/" + toSegments.slice(toPosition).join("/");
}
const START_LOCATION_NORMALIZED = {
  path: "/",
  name: void 0,
  params: {},
  query: {},
  hash: "",
  fullPath: "/",
  matched: [],
  meta: {},
  redirectedFrom: void 0
};
let NavigationType = /* @__PURE__ */ (function(NavigationType$1) {
  NavigationType$1["pop"] = "pop";
  NavigationType$1["push"] = "push";
  return NavigationType$1;
})({});
let NavigationDirection = /* @__PURE__ */ (function(NavigationDirection$1) {
  NavigationDirection$1["back"] = "back";
  NavigationDirection$1["forward"] = "forward";
  NavigationDirection$1["unknown"] = "";
  return NavigationDirection$1;
})({});
function normalizeBase(base) {
  if (!base) if (isBrowser) {
    const baseEl = document.querySelector("base");
    base = baseEl && baseEl.getAttribute("href") || "/";
    base = base.replace(/^\w+:\/\/[^\/]+/, "");
  } else base = "/";
  if (base[0] !== "/" && base[0] !== "#") base = "/" + base;
  return removeTrailingSlash(base);
}
const BEFORE_HASH_RE = /^[^#]+#/;
function createHref(base, location2) {
  return base.replace(BEFORE_HASH_RE, "#") + location2;
}
function getElementPosition(el, offset) {
  const docRect = document.documentElement.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    behavior: offset.behavior,
    left: elRect.left - docRect.left - (offset.left || 0),
    top: elRect.top - docRect.top - (offset.top || 0)
  };
}
const computeScrollPosition = () => ({
  left: window.scrollX,
  top: window.scrollY
});
function scrollToPosition(position) {
  let scrollToOptions;
  if ("el" in position) {
    const positionEl = position.el;
    const isIdSelector = typeof positionEl === "string" && positionEl.startsWith("#");
    const el = typeof positionEl === "string" ? isIdSelector ? document.getElementById(positionEl.slice(1)) : document.querySelector(positionEl) : positionEl;
    if (!el) {
      return;
    }
    scrollToOptions = getElementPosition(el, position);
  } else scrollToOptions = position;
  if ("scrollBehavior" in document.documentElement.style) window.scrollTo(scrollToOptions);
  else window.scrollTo(scrollToOptions.left != null ? scrollToOptions.left : window.scrollX, scrollToOptions.top != null ? scrollToOptions.top : window.scrollY);
}
function getScrollKey(path, delta) {
  return (history.state ? history.state.position - delta : -1) + path;
}
const scrollPositions = /* @__PURE__ */ new Map();
function saveScrollPosition(key, scrollPosition) {
  scrollPositions.set(key, scrollPosition);
}
function getSavedScrollPosition(key) {
  const scroll = scrollPositions.get(key);
  scrollPositions.delete(key);
  return scroll;
}
function isRouteLocation(route) {
  return typeof route === "string" || route && typeof route === "object";
}
function isRouteName(name) {
  return typeof name === "string" || typeof name === "symbol";
}
let ErrorTypes = /* @__PURE__ */ (function(ErrorTypes$1) {
  ErrorTypes$1[ErrorTypes$1["MATCHER_NOT_FOUND"] = 1] = "MATCHER_NOT_FOUND";
  ErrorTypes$1[ErrorTypes$1["NAVIGATION_GUARD_REDIRECT"] = 2] = "NAVIGATION_GUARD_REDIRECT";
  ErrorTypes$1[ErrorTypes$1["NAVIGATION_ABORTED"] = 4] = "NAVIGATION_ABORTED";
  ErrorTypes$1[ErrorTypes$1["NAVIGATION_CANCELLED"] = 8] = "NAVIGATION_CANCELLED";
  ErrorTypes$1[ErrorTypes$1["NAVIGATION_DUPLICATED"] = 16] = "NAVIGATION_DUPLICATED";
  return ErrorTypes$1;
})({});
const NavigationFailureSymbol = Symbol("");
({
  [ErrorTypes.MATCHER_NOT_FOUND]({ location: location2, currentLocation }) {
    return `No match for
 ${JSON.stringify(location2)}${currentLocation ? "\nwhile being at\n" + JSON.stringify(currentLocation) : ""}`;
  },
  [ErrorTypes.NAVIGATION_GUARD_REDIRECT]({ from, to }) {
    return `Redirected from "${from.fullPath}" to "${stringifyRoute(to)}" via a navigation guard.`;
  },
  [ErrorTypes.NAVIGATION_ABORTED]({ from, to }) {
    return `Navigation aborted from "${from.fullPath}" to "${to.fullPath}" via a navigation guard.`;
  },
  [ErrorTypes.NAVIGATION_CANCELLED]({ from, to }) {
    return `Navigation cancelled from "${from.fullPath}" to "${to.fullPath}" with a new navigation.`;
  },
  [ErrorTypes.NAVIGATION_DUPLICATED]({ from, to }) {
    return `Avoided redundant navigation to current location: "${from.fullPath}".`;
  }
});
function createRouterError(type, params) {
  return assign(/* @__PURE__ */ new Error(), {
    type,
    [NavigationFailureSymbol]: true
  }, params);
}
function isNavigationFailure(error, type) {
  return error instanceof Error && NavigationFailureSymbol in error && (type == null || !!(error.type & type));
}
const propertiesToLog = [
  "params",
  "query",
  "hash"
];
function stringifyRoute(to) {
  if (typeof to === "string") return to;
  if (to.path != null) return to.path;
  const location2 = {};
  for (const key of propertiesToLog) if (key in to) location2[key] = to[key];
  return JSON.stringify(location2, null, 2);
}
function parseQuery(search) {
  const query = {};
  if (search === "" || search === "?") return query;
  const searchParams = (search[0] === "?" ? search.slice(1) : search).split("&");
  for (let i = 0; i < searchParams.length; ++i) {
    const searchParam = searchParams[i].replace(PLUS_RE, " ");
    const eqPos = searchParam.indexOf("=");
    const key = decode(eqPos < 0 ? searchParam : searchParam.slice(0, eqPos));
    const value = eqPos < 0 ? null : decode(searchParam.slice(eqPos + 1));
    if (key in query) {
      let currentValue = query[key];
      if (!isArray(currentValue)) currentValue = query[key] = [currentValue];
      currentValue.push(value);
    } else query[key] = value;
  }
  return query;
}
function stringifyQuery(query) {
  let search = "";
  for (let key in query) {
    const value = query[key];
    key = encodeQueryKey(key);
    if (value == null) {
      if (value !== void 0) search += (search.length ? "&" : "") + key;
      continue;
    }
    (isArray(value) ? value.map((v) => v && encodeQueryValue(v)) : [value && encodeQueryValue(value)]).forEach((value$1) => {
      if (value$1 !== void 0) {
        search += (search.length ? "&" : "") + key;
        if (value$1 != null) search += "=" + value$1;
      }
    });
  }
  return search;
}
function normalizeQuery(query) {
  const normalizedQuery = {};
  for (const key in query) {
    const value = query[key];
    if (value !== void 0) normalizedQuery[key] = isArray(value) ? value.map((v) => v == null ? null : "" + v) : value == null ? value : "" + value;
  }
  return normalizedQuery;
}
const matchedRouteKey = Symbol("");
const viewDepthKey = Symbol("");
const routerKey = Symbol("");
const routeLocationKey = Symbol("");
const routerViewLocationKey = Symbol("");
function useCallbacks() {
  let handlers = [];
  function add(handler) {
    handlers.push(handler);
    return () => {
      const i = handlers.indexOf(handler);
      if (i > -1) handlers.splice(i, 1);
    };
  }
  function reset() {
    handlers = [];
  }
  return {
    add,
    list: () => handlers.slice(),
    reset
  };
}
function guardToPromiseFn(guard, to, from, record, name, runWithContext = (fn) => fn()) {
  const enterCallbackArray = record && (record.enterCallbacks[name] = record.enterCallbacks[name] || []);
  return () => new Promise((resolve2, reject) => {
    const next = (valid) => {
      if (valid === false) reject(createRouterError(ErrorTypes.NAVIGATION_ABORTED, {
        from,
        to
      }));
      else if (valid instanceof Error) reject(valid);
      else if (isRouteLocation(valid)) reject(createRouterError(ErrorTypes.NAVIGATION_GUARD_REDIRECT, {
        from: to,
        to: valid
      }));
      else {
        if (enterCallbackArray && record.enterCallbacks[name] === enterCallbackArray && typeof valid === "function") enterCallbackArray.push(valid);
        resolve2();
      }
    };
    const guardReturn = runWithContext(() => guard.call(record && record.instances[name], to, from, next));
    let guardCall = Promise.resolve(guardReturn);
    if (guard.length < 3) guardCall = guardCall.then(next);
    guardCall.catch((err) => reject(err));
  });
}
function extractComponentsGuards(matched, guardType, to, from, runWithContext = (fn) => fn()) {
  const guards = [];
  for (const record of matched) {
    for (const name in record.components) {
      let rawComponent = record.components[name];
      if (guardType !== "beforeRouteEnter" && !record.instances[name]) continue;
      if (isRouteComponent(rawComponent)) {
        const guard = (rawComponent.__vccOpts || rawComponent)[guardType];
        guard && guards.push(guardToPromiseFn(guard, to, from, record, name, runWithContext));
      } else {
        let componentPromise = rawComponent();
        guards.push(() => componentPromise.then((resolved) => {
          if (!resolved) throw new Error(`Couldn't resolve component "${name}" at "${record.path}"`);
          const resolvedComponent = isESModule(resolved) ? resolved.default : resolved;
          record.mods[name] = resolved;
          record.components[name] = resolvedComponent;
          const guard = (resolvedComponent.__vccOpts || resolvedComponent)[guardType];
          return guard && guardToPromiseFn(guard, to, from, record, name, runWithContext)();
        }));
      }
    }
  }
  return guards;
}
function extractChangingRecords(to, from) {
  const leavingRecords = [];
  const updatingRecords = [];
  const enteringRecords = [];
  const len = Math.max(from.matched.length, to.matched.length);
  for (let i = 0; i < len; i++) {
    const recordFrom = from.matched[i];
    if (recordFrom) if (to.matched.find((record) => isSameRouteRecord(record, recordFrom))) updatingRecords.push(recordFrom);
    else leavingRecords.push(recordFrom);
    const recordTo = to.matched[i];
    if (recordTo) {
      if (!from.matched.find((record) => isSameRouteRecord(record, recordTo))) enteringRecords.push(recordTo);
    }
  }
  return [
    leavingRecords,
    updatingRecords,
    enteringRecords
  ];
}
/*!
 * vue-router v4.6.4
 * (c) 2025 Eduardo San Martin Morote
 * @license MIT
 */
let createBaseLocation = () => location.protocol + "//" + location.host;
function createCurrentLocation(base, location$1) {
  const { pathname, search, hash } = location$1;
  const hashPos = base.indexOf("#");
  if (hashPos > -1) {
    let slicePos = hash.includes(base.slice(hashPos)) ? base.slice(hashPos).length : 1;
    let pathFromHash = hash.slice(slicePos);
    if (pathFromHash[0] !== "/") pathFromHash = "/" + pathFromHash;
    return stripBase(pathFromHash, "");
  }
  return stripBase(pathname, base) + search + hash;
}
function useHistoryListeners(base, historyState, currentLocation, replace) {
  let listeners = [];
  let teardowns = [];
  let pauseState = null;
  const popStateHandler = ({ state }) => {
    const to = createCurrentLocation(base, location);
    const from = currentLocation.value;
    const fromState = historyState.value;
    let delta = 0;
    if (state) {
      currentLocation.value = to;
      historyState.value = state;
      if (pauseState && pauseState === from) {
        pauseState = null;
        return;
      }
      delta = fromState ? state.position - fromState.position : 0;
    } else replace(to);
    listeners.forEach((listener) => {
      listener(currentLocation.value, from, {
        delta,
        type: NavigationType.pop,
        direction: delta ? delta > 0 ? NavigationDirection.forward : NavigationDirection.back : NavigationDirection.unknown
      });
    });
  };
  function pauseListeners() {
    pauseState = currentLocation.value;
  }
  function listen(callback) {
    listeners.push(callback);
    const teardown = () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
    teardowns.push(teardown);
    return teardown;
  }
  function beforeUnloadListener() {
    if (document.visibilityState === "hidden") {
      const { history: history$1 } = window;
      if (!history$1.state) return;
      history$1.replaceState(assign({}, history$1.state, { scroll: computeScrollPosition() }), "");
    }
  }
  function destroy() {
    for (const teardown of teardowns) teardown();
    teardowns = [];
    window.removeEventListener("popstate", popStateHandler);
    window.removeEventListener("pagehide", beforeUnloadListener);
    document.removeEventListener("visibilitychange", beforeUnloadListener);
  }
  window.addEventListener("popstate", popStateHandler);
  window.addEventListener("pagehide", beforeUnloadListener);
  document.addEventListener("visibilitychange", beforeUnloadListener);
  return {
    pauseListeners,
    listen,
    destroy
  };
}
function buildState(back, current, forward, replaced = false, computeScroll = false) {
  return {
    back,
    current,
    forward,
    replaced,
    position: window.history.length,
    scroll: computeScroll ? computeScrollPosition() : null
  };
}
function useHistoryStateNavigation(base) {
  const { history: history$1, location: location$1 } = window;
  const currentLocation = { value: createCurrentLocation(base, location$1) };
  const historyState = { value: history$1.state };
  if (!historyState.value) changeLocation(currentLocation.value, {
    back: null,
    current: currentLocation.value,
    forward: null,
    position: history$1.length - 1,
    replaced: true,
    scroll: null
  }, true);
  function changeLocation(to, state, replace$1) {
    const hashIndex = base.indexOf("#");
    const url = hashIndex > -1 ? (location$1.host && document.querySelector("base") ? base : base.slice(hashIndex)) + to : createBaseLocation() + base + to;
    try {
      history$1[replace$1 ? "replaceState" : "pushState"](state, "", url);
      historyState.value = state;
    } catch (err) {
      console.error(err);
      location$1[replace$1 ? "replace" : "assign"](url);
    }
  }
  function replace(to, data) {
    changeLocation(to, assign({}, history$1.state, buildState(historyState.value.back, to, historyState.value.forward, true), data, { position: historyState.value.position }), true);
    currentLocation.value = to;
  }
  function push(to, data) {
    const currentState = assign({}, historyState.value, history$1.state, {
      forward: to,
      scroll: computeScrollPosition()
    });
    changeLocation(currentState.current, currentState, true);
    changeLocation(to, assign({}, buildState(currentLocation.value, to, null), { position: currentState.position + 1 }, data), false);
    currentLocation.value = to;
  }
  return {
    location: currentLocation,
    state: historyState,
    push,
    replace
  };
}
function createWebHistory(base) {
  base = normalizeBase(base);
  const historyNavigation = useHistoryStateNavigation(base);
  const historyListeners = useHistoryListeners(base, historyNavigation.state, historyNavigation.location, historyNavigation.replace);
  function go(delta, triggerListeners = true) {
    if (!triggerListeners) historyListeners.pauseListeners();
    history.go(delta);
  }
  const routerHistory = assign({
    location: "",
    base,
    go,
    createHref: createHref.bind(null, base)
  }, historyNavigation, historyListeners);
  Object.defineProperty(routerHistory, "location", {
    enumerable: true,
    get: () => historyNavigation.location.value
  });
  Object.defineProperty(routerHistory, "state", {
    enumerable: true,
    get: () => historyNavigation.state.value
  });
  return routerHistory;
}
function createWebHashHistory(base) {
  base = location.host ? base || location.pathname + location.search : "";
  if (!base.includes("#")) base += "#";
  return createWebHistory(base);
}
let TokenType = /* @__PURE__ */ (function(TokenType$1) {
  TokenType$1[TokenType$1["Static"] = 0] = "Static";
  TokenType$1[TokenType$1["Param"] = 1] = "Param";
  TokenType$1[TokenType$1["Group"] = 2] = "Group";
  return TokenType$1;
})({});
var TokenizerState = /* @__PURE__ */ (function(TokenizerState$1) {
  TokenizerState$1[TokenizerState$1["Static"] = 0] = "Static";
  TokenizerState$1[TokenizerState$1["Param"] = 1] = "Param";
  TokenizerState$1[TokenizerState$1["ParamRegExp"] = 2] = "ParamRegExp";
  TokenizerState$1[TokenizerState$1["ParamRegExpEnd"] = 3] = "ParamRegExpEnd";
  TokenizerState$1[TokenizerState$1["EscapeNext"] = 4] = "EscapeNext";
  return TokenizerState$1;
})(TokenizerState || {});
const ROOT_TOKEN = {
  type: TokenType.Static,
  value: ""
};
const VALID_PARAM_RE = /[a-zA-Z0-9_]/;
function tokenizePath(path) {
  if (!path) return [[]];
  if (path === "/") return [[ROOT_TOKEN]];
  if (!path.startsWith("/")) throw new Error(`Invalid path "${path}"`);
  function crash(message) {
    throw new Error(`ERR (${state})/"${buffer}": ${message}`);
  }
  let state = TokenizerState.Static;
  let previousState = state;
  const tokens = [];
  let segment;
  function finalizeSegment() {
    if (segment) tokens.push(segment);
    segment = [];
  }
  let i = 0;
  let char;
  let buffer = "";
  let customRe = "";
  function consumeBuffer() {
    if (!buffer) return;
    if (state === TokenizerState.Static) segment.push({
      type: TokenType.Static,
      value: buffer
    });
    else if (state === TokenizerState.Param || state === TokenizerState.ParamRegExp || state === TokenizerState.ParamRegExpEnd) {
      if (segment.length > 1 && (char === "*" || char === "+")) crash(`A repeatable param (${buffer}) must be alone in its segment. eg: '/:ids+.`);
      segment.push({
        type: TokenType.Param,
        value: buffer,
        regexp: customRe,
        repeatable: char === "*" || char === "+",
        optional: char === "*" || char === "?"
      });
    } else crash("Invalid state to consume buffer");
    buffer = "";
  }
  function addCharToBuffer() {
    buffer += char;
  }
  while (i < path.length) {
    char = path[i++];
    if (char === "\\" && state !== TokenizerState.ParamRegExp) {
      previousState = state;
      state = TokenizerState.EscapeNext;
      continue;
    }
    switch (state) {
      case TokenizerState.Static:
        if (char === "/") {
          if (buffer) consumeBuffer();
          finalizeSegment();
        } else if (char === ":") {
          consumeBuffer();
          state = TokenizerState.Param;
        } else addCharToBuffer();
        break;
      case TokenizerState.EscapeNext:
        addCharToBuffer();
        state = previousState;
        break;
      case TokenizerState.Param:
        if (char === "(") state = TokenizerState.ParamRegExp;
        else if (VALID_PARAM_RE.test(char)) addCharToBuffer();
        else {
          consumeBuffer();
          state = TokenizerState.Static;
          if (char !== "*" && char !== "?" && char !== "+") i--;
        }
        break;
      case TokenizerState.ParamRegExp:
        if (char === ")") if (customRe[customRe.length - 1] == "\\") customRe = customRe.slice(0, -1) + char;
        else state = TokenizerState.ParamRegExpEnd;
        else customRe += char;
        break;
      case TokenizerState.ParamRegExpEnd:
        consumeBuffer();
        state = TokenizerState.Static;
        if (char !== "*" && char !== "?" && char !== "+") i--;
        customRe = "";
        break;
      default:
        crash("Unknown state");
        break;
    }
  }
  if (state === TokenizerState.ParamRegExp) crash(`Unfinished custom RegExp for param "${buffer}"`);
  consumeBuffer();
  finalizeSegment();
  return tokens;
}
const BASE_PARAM_PATTERN = "[^/]+?";
const BASE_PATH_PARSER_OPTIONS = {
  sensitive: false,
  strict: false,
  start: true,
  end: true
};
var PathScore = /* @__PURE__ */ (function(PathScore$1) {
  PathScore$1[PathScore$1["_multiplier"] = 10] = "_multiplier";
  PathScore$1[PathScore$1["Root"] = 90] = "Root";
  PathScore$1[PathScore$1["Segment"] = 40] = "Segment";
  PathScore$1[PathScore$1["SubSegment"] = 30] = "SubSegment";
  PathScore$1[PathScore$1["Static"] = 40] = "Static";
  PathScore$1[PathScore$1["Dynamic"] = 20] = "Dynamic";
  PathScore$1[PathScore$1["BonusCustomRegExp"] = 10] = "BonusCustomRegExp";
  PathScore$1[PathScore$1["BonusWildcard"] = -50] = "BonusWildcard";
  PathScore$1[PathScore$1["BonusRepeatable"] = -20] = "BonusRepeatable";
  PathScore$1[PathScore$1["BonusOptional"] = -8] = "BonusOptional";
  PathScore$1[PathScore$1["BonusStrict"] = 0.7000000000000001] = "BonusStrict";
  PathScore$1[PathScore$1["BonusCaseSensitive"] = 0.25] = "BonusCaseSensitive";
  return PathScore$1;
})(PathScore || {});
const REGEX_CHARS_RE = /[.+*?^${}()[\]/\\]/g;
function tokensToParser(segments, extraOptions) {
  const options = assign({}, BASE_PATH_PARSER_OPTIONS, extraOptions);
  const score = [];
  let pattern = options.start ? "^" : "";
  const keys = [];
  for (const segment of segments) {
    const segmentScores = segment.length ? [] : [PathScore.Root];
    if (options.strict && !segment.length) pattern += "/";
    for (let tokenIndex = 0; tokenIndex < segment.length; tokenIndex++) {
      const token = segment[tokenIndex];
      let subSegmentScore = PathScore.Segment + (options.sensitive ? PathScore.BonusCaseSensitive : 0);
      if (token.type === TokenType.Static) {
        if (!tokenIndex) pattern += "/";
        pattern += token.value.replace(REGEX_CHARS_RE, "\\$&");
        subSegmentScore += PathScore.Static;
      } else if (token.type === TokenType.Param) {
        const { value, repeatable, optional, regexp } = token;
        keys.push({
          name: value,
          repeatable,
          optional
        });
        const re$1 = regexp ? regexp : BASE_PARAM_PATTERN;
        if (re$1 !== BASE_PARAM_PATTERN) {
          subSegmentScore += PathScore.BonusCustomRegExp;
          try {
            `${re$1}`;
          } catch (err) {
            throw new Error(`Invalid custom RegExp for param "${value}" (${re$1}): ` + err.message);
          }
        }
        let subPattern = repeatable ? `((?:${re$1})(?:/(?:${re$1}))*)` : `(${re$1})`;
        if (!tokenIndex) subPattern = optional && segment.length < 2 ? `(?:/${subPattern})` : "/" + subPattern;
        if (optional) subPattern += "?";
        pattern += subPattern;
        subSegmentScore += PathScore.Dynamic;
        if (optional) subSegmentScore += PathScore.BonusOptional;
        if (repeatable) subSegmentScore += PathScore.BonusRepeatable;
        if (re$1 === ".*") subSegmentScore += PathScore.BonusWildcard;
      }
      segmentScores.push(subSegmentScore);
    }
    score.push(segmentScores);
  }
  if (options.strict && options.end) {
    const i = score.length - 1;
    score[i][score[i].length - 1] += PathScore.BonusStrict;
  }
  if (!options.strict) pattern += "/?";
  if (options.end) pattern += "$";
  else if (options.strict && !pattern.endsWith("/")) pattern += "(?:/|$)";
  const re = new RegExp(pattern, options.sensitive ? "" : "i");
  function parse(path) {
    const match = path.match(re);
    const params = {};
    if (!match) return null;
    for (let i = 1; i < match.length; i++) {
      const value = match[i] || "";
      const key = keys[i - 1];
      params[key.name] = value && key.repeatable ? value.split("/") : value;
    }
    return params;
  }
  function stringify(params) {
    let path = "";
    let avoidDuplicatedSlash = false;
    for (const segment of segments) {
      if (!avoidDuplicatedSlash || !path.endsWith("/")) path += "/";
      avoidDuplicatedSlash = false;
      for (const token of segment) if (token.type === TokenType.Static) path += token.value;
      else if (token.type === TokenType.Param) {
        const { value, repeatable, optional } = token;
        const param = value in params ? params[value] : "";
        if (isArray(param) && !repeatable) throw new Error(`Provided param "${value}" is an array but it is not repeatable (* or + modifiers)`);
        const text = isArray(param) ? param.join("/") : param;
        if (!text) if (optional) {
          if (segment.length < 2) if (path.endsWith("/")) path = path.slice(0, -1);
          else avoidDuplicatedSlash = true;
        } else throw new Error(`Missing required param "${value}"`);
        path += text;
      }
    }
    return path || "/";
  }
  return {
    re,
    score,
    keys,
    parse,
    stringify
  };
}
function compareScoreArray(a, b) {
  let i = 0;
  while (i < a.length && i < b.length) {
    const diff = b[i] - a[i];
    if (diff) return diff;
    i++;
  }
  if (a.length < b.length) return a.length === 1 && a[0] === PathScore.Static + PathScore.Segment ? -1 : 1;
  else if (a.length > b.length) return b.length === 1 && b[0] === PathScore.Static + PathScore.Segment ? 1 : -1;
  return 0;
}
function comparePathParserScore(a, b) {
  let i = 0;
  const aScore = a.score;
  const bScore = b.score;
  while (i < aScore.length && i < bScore.length) {
    const comp = compareScoreArray(aScore[i], bScore[i]);
    if (comp) return comp;
    i++;
  }
  if (Math.abs(bScore.length - aScore.length) === 1) {
    if (isLastScoreNegative(aScore)) return 1;
    if (isLastScoreNegative(bScore)) return -1;
  }
  return bScore.length - aScore.length;
}
function isLastScoreNegative(score) {
  const last = score[score.length - 1];
  return score.length > 0 && last[last.length - 1] < 0;
}
const PATH_PARSER_OPTIONS_DEFAULTS = {
  strict: false,
  end: true,
  sensitive: false
};
function createRouteRecordMatcher(record, parent, options) {
  const parser = tokensToParser(tokenizePath(record.path), options);
  const matcher = assign(parser, {
    record,
    parent,
    children: [],
    alias: []
  });
  if (parent) {
    if (!matcher.record.aliasOf === !parent.record.aliasOf) parent.children.push(matcher);
  }
  return matcher;
}
function createRouterMatcher(routes, globalOptions) {
  const matchers = [];
  const matcherMap = /* @__PURE__ */ new Map();
  globalOptions = mergeOptions(PATH_PARSER_OPTIONS_DEFAULTS, globalOptions);
  function getRecordMatcher(name) {
    return matcherMap.get(name);
  }
  function addRoute(record, parent, originalRecord) {
    const isRootAdd = !originalRecord;
    const mainNormalizedRecord = normalizeRouteRecord(record);
    mainNormalizedRecord.aliasOf = originalRecord && originalRecord.record;
    const options = mergeOptions(globalOptions, record);
    const normalizedRecords = [mainNormalizedRecord];
    if ("alias" in record) {
      const aliases = typeof record.alias === "string" ? [record.alias] : record.alias;
      for (const alias of aliases) normalizedRecords.push(normalizeRouteRecord(assign({}, mainNormalizedRecord, {
        components: originalRecord ? originalRecord.record.components : mainNormalizedRecord.components,
        path: alias,
        aliasOf: originalRecord ? originalRecord.record : mainNormalizedRecord
      })));
    }
    let matcher;
    let originalMatcher;
    for (const normalizedRecord of normalizedRecords) {
      const { path } = normalizedRecord;
      if (parent && path[0] !== "/") {
        const parentPath = parent.record.path;
        const connectingSlash = parentPath[parentPath.length - 1] === "/" ? "" : "/";
        normalizedRecord.path = parent.record.path + (path && connectingSlash + path);
      }
      matcher = createRouteRecordMatcher(normalizedRecord, parent, options);
      if (originalRecord) {
        originalRecord.alias.push(matcher);
      } else {
        originalMatcher = originalMatcher || matcher;
        if (originalMatcher !== matcher) originalMatcher.alias.push(matcher);
        if (isRootAdd && record.name && !isAliasRecord(matcher)) {
          removeRoute(record.name);
        }
      }
      if (isMatchable(matcher)) insertMatcher(matcher);
      if (mainNormalizedRecord.children) {
        const children = mainNormalizedRecord.children;
        for (let i = 0; i < children.length; i++) addRoute(children[i], matcher, originalRecord && originalRecord.children[i]);
      }
      originalRecord = originalRecord || matcher;
    }
    return originalMatcher ? () => {
      removeRoute(originalMatcher);
    } : noop;
  }
  function removeRoute(matcherRef) {
    if (isRouteName(matcherRef)) {
      const matcher = matcherMap.get(matcherRef);
      if (matcher) {
        matcherMap.delete(matcherRef);
        matchers.splice(matchers.indexOf(matcher), 1);
        matcher.children.forEach(removeRoute);
        matcher.alias.forEach(removeRoute);
      }
    } else {
      const index = matchers.indexOf(matcherRef);
      if (index > -1) {
        matchers.splice(index, 1);
        if (matcherRef.record.name) matcherMap.delete(matcherRef.record.name);
        matcherRef.children.forEach(removeRoute);
        matcherRef.alias.forEach(removeRoute);
      }
    }
  }
  function getRoutes() {
    return matchers;
  }
  function insertMatcher(matcher) {
    const index = findInsertionIndex(matcher, matchers);
    matchers.splice(index, 0, matcher);
    if (matcher.record.name && !isAliasRecord(matcher)) matcherMap.set(matcher.record.name, matcher);
  }
  function resolve2(location$1, currentLocation) {
    let matcher;
    let params = {};
    let path;
    let name;
    if ("name" in location$1 && location$1.name) {
      matcher = matcherMap.get(location$1.name);
      if (!matcher) throw createRouterError(ErrorTypes.MATCHER_NOT_FOUND, { location: location$1 });
      name = matcher.record.name;
      params = assign(pickParams(currentLocation.params, matcher.keys.filter((k) => !k.optional).concat(matcher.parent ? matcher.parent.keys.filter((k) => k.optional) : []).map((k) => k.name)), location$1.params && pickParams(location$1.params, matcher.keys.map((k) => k.name)));
      path = matcher.stringify(params);
    } else if (location$1.path != null) {
      path = location$1.path;
      matcher = matchers.find((m) => m.re.test(path));
      if (matcher) {
        params = matcher.parse(path);
        name = matcher.record.name;
      }
    } else {
      matcher = currentLocation.name ? matcherMap.get(currentLocation.name) : matchers.find((m) => m.re.test(currentLocation.path));
      if (!matcher) throw createRouterError(ErrorTypes.MATCHER_NOT_FOUND, {
        location: location$1,
        currentLocation
      });
      name = matcher.record.name;
      params = assign({}, currentLocation.params, location$1.params);
      path = matcher.stringify(params);
    }
    const matched = [];
    let parentMatcher = matcher;
    while (parentMatcher) {
      matched.unshift(parentMatcher.record);
      parentMatcher = parentMatcher.parent;
    }
    return {
      name,
      path,
      params,
      matched,
      meta: mergeMetaFields(matched)
    };
  }
  routes.forEach((route) => addRoute(route));
  function clearRoutes() {
    matchers.length = 0;
    matcherMap.clear();
  }
  return {
    addRoute,
    resolve: resolve2,
    removeRoute,
    clearRoutes,
    getRoutes,
    getRecordMatcher
  };
}
function pickParams(params, keys) {
  const newParams = {};
  for (const key of keys) if (key in params) newParams[key] = params[key];
  return newParams;
}
function normalizeRouteRecord(record) {
  const normalized = {
    path: record.path,
    redirect: record.redirect,
    name: record.name,
    meta: record.meta || {},
    aliasOf: record.aliasOf,
    beforeEnter: record.beforeEnter,
    props: normalizeRecordProps(record),
    children: record.children || [],
    instances: {},
    leaveGuards: /* @__PURE__ */ new Set(),
    updateGuards: /* @__PURE__ */ new Set(),
    enterCallbacks: {},
    components: "components" in record ? record.components || null : record.component && { default: record.component }
  };
  Object.defineProperty(normalized, "mods", { value: {} });
  return normalized;
}
function normalizeRecordProps(record) {
  const propsObject = {};
  const props = record.props || false;
  if ("component" in record) propsObject.default = props;
  else for (const name in record.components) propsObject[name] = typeof props === "object" ? props[name] : props;
  return propsObject;
}
function isAliasRecord(record) {
  while (record) {
    if (record.record.aliasOf) return true;
    record = record.parent;
  }
  return false;
}
function mergeMetaFields(matched) {
  return matched.reduce((meta, record) => assign(meta, record.meta), {});
}
function findInsertionIndex(matcher, matchers) {
  let lower = 0;
  let upper = matchers.length;
  while (lower !== upper) {
    const mid = lower + upper >> 1;
    if (comparePathParserScore(matcher, matchers[mid]) < 0) upper = mid;
    else lower = mid + 1;
  }
  const insertionAncestor = getInsertionAncestor(matcher);
  if (insertionAncestor) {
    upper = matchers.lastIndexOf(insertionAncestor, upper - 1);
  }
  return upper;
}
function getInsertionAncestor(matcher) {
  let ancestor = matcher;
  while (ancestor = ancestor.parent) if (isMatchable(ancestor) && comparePathParserScore(matcher, ancestor) === 0) return ancestor;
}
function isMatchable({ record }) {
  return !!(record.name || record.components && Object.keys(record.components).length || record.redirect);
}
function useLink(props) {
  const router2 = inject(routerKey);
  const currentRoute = inject(routeLocationKey);
  const route = computed(() => {
    const to = unref(props.to);
    return router2.resolve(to);
  });
  const activeRecordIndex = computed(() => {
    const { matched } = route.value;
    const { length } = matched;
    const routeMatched = matched[length - 1];
    const currentMatched = currentRoute.matched;
    if (!routeMatched || !currentMatched.length) return -1;
    const index = currentMatched.findIndex(isSameRouteRecord.bind(null, routeMatched));
    if (index > -1) return index;
    const parentRecordPath = getOriginalPath(matched[length - 2]);
    return length > 1 && getOriginalPath(routeMatched) === parentRecordPath && currentMatched[currentMatched.length - 1].path !== parentRecordPath ? currentMatched.findIndex(isSameRouteRecord.bind(null, matched[length - 2])) : index;
  });
  const isActive = computed(() => activeRecordIndex.value > -1 && includesParams(currentRoute.params, route.value.params));
  const isExactActive = computed(() => activeRecordIndex.value > -1 && activeRecordIndex.value === currentRoute.matched.length - 1 && isSameRouteLocationParams(currentRoute.params, route.value.params));
  function navigate(e = {}) {
    if (guardEvent(e)) {
      const p2 = router2[unref(props.replace) ? "replace" : "push"](unref(props.to)).catch(noop);
      if (props.viewTransition && typeof document !== "undefined" && "startViewTransition" in document) document.startViewTransition(() => p2);
      return p2;
    }
    return Promise.resolve();
  }
  return {
    route,
    href: computed(() => route.value.href),
    isActive,
    isExactActive,
    navigate
  };
}
function preferSingleVNode(vnodes) {
  return vnodes.length === 1 ? vnodes[0] : vnodes;
}
const RouterLinkImpl = /* @__PURE__ */ defineComponent({
  name: "RouterLink",
  compatConfig: { MODE: 3 },
  props: {
    to: {
      type: [String, Object],
      required: true
    },
    replace: Boolean,
    activeClass: String,
    exactActiveClass: String,
    custom: Boolean,
    ariaCurrentValue: {
      type: String,
      default: "page"
    },
    viewTransition: Boolean
  },
  useLink,
  setup(props, { slots }) {
    const link = /* @__PURE__ */ reactive(useLink(props));
    const { options } = inject(routerKey);
    const elClass = computed(() => ({
      [getLinkClass(props.activeClass, options.linkActiveClass, "router-link-active")]: link.isActive,
      [getLinkClass(props.exactActiveClass, options.linkExactActiveClass, "router-link-exact-active")]: link.isExactActive
    }));
    return () => {
      const children = slots.default && preferSingleVNode(slots.default(link));
      return props.custom ? children : h("a", {
        "aria-current": link.isExactActive ? props.ariaCurrentValue : null,
        href: link.href,
        onClick: link.navigate,
        class: elClass.value
      }, children);
    };
  }
});
const RouterLink = RouterLinkImpl;
function guardEvent(e) {
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
  if (e.defaultPrevented) return;
  if (e.button !== void 0 && e.button !== 0) return;
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute("target");
    if (/\b_blank\b/i.test(target)) return;
  }
  if (e.preventDefault) e.preventDefault();
  return true;
}
function includesParams(outer, inner) {
  for (const key in inner) {
    const innerValue = inner[key];
    const outerValue = outer[key];
    if (typeof innerValue === "string") {
      if (innerValue !== outerValue) return false;
    } else if (!isArray(outerValue) || outerValue.length !== innerValue.length || innerValue.some((value, i) => value.valueOf() !== outerValue[i].valueOf())) return false;
  }
  return true;
}
function getOriginalPath(record) {
  return record ? record.aliasOf ? record.aliasOf.path : record.path : "";
}
const getLinkClass = (propClass, globalClass, defaultClass) => propClass != null ? propClass : globalClass != null ? globalClass : defaultClass;
const RouterViewImpl = /* @__PURE__ */ defineComponent({
  name: "RouterView",
  inheritAttrs: false,
  props: {
    name: {
      type: String,
      default: "default"
    },
    route: Object
  },
  compatConfig: { MODE: 3 },
  setup(props, { attrs, slots }) {
    const injectedRoute = inject(routerViewLocationKey);
    const routeToDisplay = computed(() => props.route || injectedRoute.value);
    const injectedDepth = inject(viewDepthKey, 0);
    const depth = computed(() => {
      let initialDepth = unref(injectedDepth);
      const { matched } = routeToDisplay.value;
      let matchedRoute;
      while ((matchedRoute = matched[initialDepth]) && !matchedRoute.components) initialDepth++;
      return initialDepth;
    });
    const matchedRouteRef = computed(() => routeToDisplay.value.matched[depth.value]);
    provide(viewDepthKey, computed(() => depth.value + 1));
    provide(matchedRouteKey, matchedRouteRef);
    provide(routerViewLocationKey, routeToDisplay);
    const viewRef = /* @__PURE__ */ ref();
    watch(() => [
      viewRef.value,
      matchedRouteRef.value,
      props.name
    ], ([instance, to, name], [oldInstance, from, oldName]) => {
      if (to) {
        to.instances[name] = instance;
        if (from && from !== to && instance && instance === oldInstance) {
          if (!to.leaveGuards.size) to.leaveGuards = from.leaveGuards;
          if (!to.updateGuards.size) to.updateGuards = from.updateGuards;
        }
      }
      if (instance && to && (!from || !isSameRouteRecord(to, from) || !oldInstance)) (to.enterCallbacks[name] || []).forEach((callback) => callback(instance));
    }, { flush: "post" });
    return () => {
      const route = routeToDisplay.value;
      const currentName = props.name;
      const matchedRoute = matchedRouteRef.value;
      const ViewComponent = matchedRoute && matchedRoute.components[currentName];
      if (!ViewComponent) return normalizeSlot(slots.default, {
        Component: ViewComponent,
        route
      });
      const routePropsOption = matchedRoute.props[currentName];
      const routeProps = routePropsOption ? routePropsOption === true ? route.params : typeof routePropsOption === "function" ? routePropsOption(route) : routePropsOption : null;
      const onVnodeUnmounted = (vnode) => {
        if (vnode.component.isUnmounted) matchedRoute.instances[currentName] = null;
      };
      const component = h(ViewComponent, assign({}, routeProps, attrs, {
        onVnodeUnmounted,
        ref: viewRef
      }));
      return normalizeSlot(slots.default, {
        Component: component,
        route
      }) || component;
    };
  }
});
function normalizeSlot(slot, data) {
  if (!slot) return null;
  const slotContent = slot(data);
  return slotContent.length === 1 ? slotContent[0] : slotContent;
}
const RouterView = RouterViewImpl;
function createRouter(options) {
  const matcher = createRouterMatcher(options.routes, options);
  const parseQuery$1 = options.parseQuery || parseQuery;
  const stringifyQuery$1 = options.stringifyQuery || stringifyQuery;
  const routerHistory = options.history;
  const beforeGuards = useCallbacks();
  const beforeResolveGuards = useCallbacks();
  const afterGuards = useCallbacks();
  const currentRoute = /* @__PURE__ */ shallowRef(START_LOCATION_NORMALIZED);
  let pendingLocation = START_LOCATION_NORMALIZED;
  if (isBrowser && options.scrollBehavior && "scrollRestoration" in history) history.scrollRestoration = "manual";
  const normalizeParams = applyToParams.bind(null, (paramValue) => "" + paramValue);
  const encodeParams = applyToParams.bind(null, encodeParam);
  const decodeParams = applyToParams.bind(null, decode);
  function addRoute(parentOrRoute, route) {
    let parent;
    let record;
    if (isRouteName(parentOrRoute)) {
      parent = matcher.getRecordMatcher(parentOrRoute);
      record = route;
    } else record = parentOrRoute;
    return matcher.addRoute(record, parent);
  }
  function removeRoute(name) {
    const recordMatcher = matcher.getRecordMatcher(name);
    if (recordMatcher) matcher.removeRoute(recordMatcher);
  }
  function getRoutes() {
    return matcher.getRoutes().map((routeMatcher) => routeMatcher.record);
  }
  function hasRoute(name) {
    return !!matcher.getRecordMatcher(name);
  }
  function resolve2(rawLocation, currentLocation) {
    currentLocation = assign({}, currentLocation || currentRoute.value);
    if (typeof rawLocation === "string") {
      const locationNormalized = parseURL(parseQuery$1, rawLocation, currentLocation.path);
      const matchedRoute$1 = matcher.resolve({ path: locationNormalized.path }, currentLocation);
      const href$1 = routerHistory.createHref(locationNormalized.fullPath);
      return assign(locationNormalized, matchedRoute$1, {
        params: decodeParams(matchedRoute$1.params),
        hash: decode(locationNormalized.hash),
        redirectedFrom: void 0,
        href: href$1
      });
    }
    let matcherLocation;
    if (rawLocation.path != null) {
      matcherLocation = assign({}, rawLocation, { path: parseURL(parseQuery$1, rawLocation.path, currentLocation.path).path });
    } else {
      const targetParams = assign({}, rawLocation.params);
      for (const key in targetParams) if (targetParams[key] == null) delete targetParams[key];
      matcherLocation = assign({}, rawLocation, { params: encodeParams(targetParams) });
      currentLocation.params = encodeParams(currentLocation.params);
    }
    const matchedRoute = matcher.resolve(matcherLocation, currentLocation);
    const hash = rawLocation.hash || "";
    matchedRoute.params = normalizeParams(decodeParams(matchedRoute.params));
    const fullPath = stringifyURL(stringifyQuery$1, assign({}, rawLocation, {
      hash: encodeHash(hash),
      path: matchedRoute.path
    }));
    const href = routerHistory.createHref(fullPath);
    return assign({
      fullPath,
      hash,
      query: stringifyQuery$1 === stringifyQuery ? normalizeQuery(rawLocation.query) : rawLocation.query || {}
    }, matchedRoute, {
      redirectedFrom: void 0,
      href
    });
  }
  function locationAsObject(to) {
    return typeof to === "string" ? parseURL(parseQuery$1, to, currentRoute.value.path) : assign({}, to);
  }
  function checkCanceledNavigation(to, from) {
    if (pendingLocation !== to) return createRouterError(ErrorTypes.NAVIGATION_CANCELLED, {
      from,
      to
    });
  }
  function push(to) {
    return pushWithRedirect(to);
  }
  function replace(to) {
    return push(assign(locationAsObject(to), { replace: true }));
  }
  function handleRedirectRecord(to, from) {
    const lastMatched = to.matched[to.matched.length - 1];
    if (lastMatched && lastMatched.redirect) {
      const { redirect } = lastMatched;
      let newTargetLocation = typeof redirect === "function" ? redirect(to, from) : redirect;
      if (typeof newTargetLocation === "string") {
        newTargetLocation = newTargetLocation.includes("?") || newTargetLocation.includes("#") ? newTargetLocation = locationAsObject(newTargetLocation) : { path: newTargetLocation };
        newTargetLocation.params = {};
      }
      return assign({
        query: to.query,
        hash: to.hash,
        params: newTargetLocation.path != null ? {} : to.params
      }, newTargetLocation);
    }
  }
  function pushWithRedirect(to, redirectedFrom) {
    const targetLocation = pendingLocation = resolve2(to);
    const from = currentRoute.value;
    const data = to.state;
    const force = to.force;
    const replace$1 = to.replace === true;
    const shouldRedirect = handleRedirectRecord(targetLocation, from);
    if (shouldRedirect) return pushWithRedirect(assign(locationAsObject(shouldRedirect), {
      state: typeof shouldRedirect === "object" ? assign({}, data, shouldRedirect.state) : data,
      force,
      replace: replace$1
    }), redirectedFrom || targetLocation);
    const toLocation = targetLocation;
    toLocation.redirectedFrom = redirectedFrom;
    let failure;
    if (!force && isSameRouteLocation(stringifyQuery$1, from, targetLocation)) {
      failure = createRouterError(ErrorTypes.NAVIGATION_DUPLICATED, {
        to: toLocation,
        from
      });
      handleScroll(from, from, true, false);
    }
    return (failure ? Promise.resolve(failure) : navigate(toLocation, from)).catch((error) => isNavigationFailure(error) ? isNavigationFailure(error, ErrorTypes.NAVIGATION_GUARD_REDIRECT) ? error : markAsReady(error) : triggerError(error, toLocation, from)).then((failure$1) => {
      if (failure$1) {
        if (isNavigationFailure(failure$1, ErrorTypes.NAVIGATION_GUARD_REDIRECT)) {
          return pushWithRedirect(assign({ replace: replace$1 }, locationAsObject(failure$1.to), {
            state: typeof failure$1.to === "object" ? assign({}, data, failure$1.to.state) : data,
            force
          }), redirectedFrom || toLocation);
        }
      } else failure$1 = finalizeNavigation(toLocation, from, true, replace$1, data);
      triggerAfterEach(toLocation, from, failure$1);
      return failure$1;
    });
  }
  function checkCanceledNavigationAndReject(to, from) {
    const error = checkCanceledNavigation(to, from);
    return error ? Promise.reject(error) : Promise.resolve();
  }
  function runWithContext(fn) {
    const app2 = installedApps.values().next().value;
    return app2 && typeof app2.runWithContext === "function" ? app2.runWithContext(fn) : fn();
  }
  function navigate(to, from) {
    let guards;
    const [leavingRecords, updatingRecords, enteringRecords] = extractChangingRecords(to, from);
    guards = extractComponentsGuards(leavingRecords.reverse(), "beforeRouteLeave", to, from);
    for (const record of leavingRecords) record.leaveGuards.forEach((guard) => {
      guards.push(guardToPromiseFn(guard, to, from));
    });
    const canceledNavigationCheck = checkCanceledNavigationAndReject.bind(null, to, from);
    guards.push(canceledNavigationCheck);
    return runGuardQueue(guards).then(() => {
      guards = [];
      for (const guard of beforeGuards.list()) guards.push(guardToPromiseFn(guard, to, from));
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      guards = extractComponentsGuards(updatingRecords, "beforeRouteUpdate", to, from);
      for (const record of updatingRecords) record.updateGuards.forEach((guard) => {
        guards.push(guardToPromiseFn(guard, to, from));
      });
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      guards = [];
      for (const record of enteringRecords) if (record.beforeEnter) if (isArray(record.beforeEnter)) for (const beforeEnter of record.beforeEnter) guards.push(guardToPromiseFn(beforeEnter, to, from));
      else guards.push(guardToPromiseFn(record.beforeEnter, to, from));
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      to.matched.forEach((record) => record.enterCallbacks = {});
      guards = extractComponentsGuards(enteringRecords, "beforeRouteEnter", to, from, runWithContext);
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).then(() => {
      guards = [];
      for (const guard of beforeResolveGuards.list()) guards.push(guardToPromiseFn(guard, to, from));
      guards.push(canceledNavigationCheck);
      return runGuardQueue(guards);
    }).catch((err) => isNavigationFailure(err, ErrorTypes.NAVIGATION_CANCELLED) ? err : Promise.reject(err));
  }
  function triggerAfterEach(to, from, failure) {
    afterGuards.list().forEach((guard) => runWithContext(() => guard(to, from, failure)));
  }
  function finalizeNavigation(toLocation, from, isPush, replace$1, data) {
    const error = checkCanceledNavigation(toLocation, from);
    if (error) return error;
    const isFirstNavigation = from === START_LOCATION_NORMALIZED;
    const state = !isBrowser ? {} : history.state;
    if (isPush) if (replace$1 || isFirstNavigation) routerHistory.replace(toLocation.fullPath, assign({ scroll: isFirstNavigation && state && state.scroll }, data));
    else routerHistory.push(toLocation.fullPath, data);
    currentRoute.value = toLocation;
    handleScroll(toLocation, from, isPush, isFirstNavigation);
    markAsReady();
  }
  let removeHistoryListener;
  function setupListeners() {
    if (removeHistoryListener) return;
    removeHistoryListener = routerHistory.listen((to, _from, info) => {
      if (!router2.listening) return;
      const toLocation = resolve2(to);
      const shouldRedirect = handleRedirectRecord(toLocation, router2.currentRoute.value);
      if (shouldRedirect) {
        pushWithRedirect(assign(shouldRedirect, {
          replace: true,
          force: true
        }), toLocation).catch(noop);
        return;
      }
      pendingLocation = toLocation;
      const from = currentRoute.value;
      if (isBrowser) saveScrollPosition(getScrollKey(from.fullPath, info.delta), computeScrollPosition());
      navigate(toLocation, from).catch((error) => {
        if (isNavigationFailure(error, ErrorTypes.NAVIGATION_ABORTED | ErrorTypes.NAVIGATION_CANCELLED)) return error;
        if (isNavigationFailure(error, ErrorTypes.NAVIGATION_GUARD_REDIRECT)) {
          pushWithRedirect(assign(locationAsObject(error.to), { force: true }), toLocation).then((failure) => {
            if (isNavigationFailure(failure, ErrorTypes.NAVIGATION_ABORTED | ErrorTypes.NAVIGATION_DUPLICATED) && !info.delta && info.type === NavigationType.pop) routerHistory.go(-1, false);
          }).catch(noop);
          return Promise.reject();
        }
        if (info.delta) routerHistory.go(-info.delta, false);
        return triggerError(error, toLocation, from);
      }).then((failure) => {
        failure = failure || finalizeNavigation(toLocation, from, false);
        if (failure) {
          if (info.delta && !isNavigationFailure(failure, ErrorTypes.NAVIGATION_CANCELLED)) routerHistory.go(-info.delta, false);
          else if (info.type === NavigationType.pop && isNavigationFailure(failure, ErrorTypes.NAVIGATION_ABORTED | ErrorTypes.NAVIGATION_DUPLICATED)) routerHistory.go(-1, false);
        }
        triggerAfterEach(toLocation, from, failure);
      }).catch(noop);
    });
  }
  let readyHandlers = useCallbacks();
  let errorListeners = useCallbacks();
  let ready;
  function triggerError(error, to, from) {
    markAsReady(error);
    const list = errorListeners.list();
    if (list.length) list.forEach((handler) => handler(error, to, from));
    else {
      console.error(error);
    }
    return Promise.reject(error);
  }
  function isReady() {
    if (ready && currentRoute.value !== START_LOCATION_NORMALIZED) return Promise.resolve();
    return new Promise((resolve$1, reject) => {
      readyHandlers.add([resolve$1, reject]);
    });
  }
  function markAsReady(err) {
    if (!ready) {
      ready = !err;
      setupListeners();
      readyHandlers.list().forEach(([resolve$1, reject]) => err ? reject(err) : resolve$1());
      readyHandlers.reset();
    }
    return err;
  }
  function handleScroll(to, from, isPush, isFirstNavigation) {
    const { scrollBehavior } = options;
    if (!isBrowser || !scrollBehavior) return Promise.resolve();
    const scrollPosition = !isPush && getSavedScrollPosition(getScrollKey(to.fullPath, 0)) || (isFirstNavigation || !isPush) && history.state && history.state.scroll || null;
    return nextTick().then(() => scrollBehavior(to, from, scrollPosition)).then((position) => position && scrollToPosition(position)).catch((err) => triggerError(err, to, from));
  }
  const go = (delta) => routerHistory.go(delta);
  let started;
  const installedApps = /* @__PURE__ */ new Set();
  const router2 = {
    currentRoute,
    listening: true,
    addRoute,
    removeRoute,
    clearRoutes: matcher.clearRoutes,
    hasRoute,
    getRoutes,
    resolve: resolve2,
    options,
    push,
    replace,
    go,
    back: () => go(-1),
    forward: () => go(1),
    beforeEach: beforeGuards.add,
    beforeResolve: beforeResolveGuards.add,
    afterEach: afterGuards.add,
    onError: errorListeners.add,
    isReady,
    install(app2) {
      app2.component("RouterLink", RouterLink);
      app2.component("RouterView", RouterView);
      app2.config.globalProperties.$router = router2;
      Object.defineProperty(app2.config.globalProperties, "$route", {
        enumerable: true,
        get: () => unref(currentRoute)
      });
      if (isBrowser && !started && currentRoute.value === START_LOCATION_NORMALIZED) {
        started = true;
        push(routerHistory.location).catch((err) => {
        });
      }
      const reactiveRoute = {};
      for (const key in START_LOCATION_NORMALIZED) Object.defineProperty(reactiveRoute, key, {
        get: () => currentRoute.value[key],
        enumerable: true
      });
      app2.provide(routerKey, router2);
      app2.provide(routeLocationKey, /* @__PURE__ */ shallowReactive(reactiveRoute));
      app2.provide(routerViewLocationKey, currentRoute);
      const unmountApp = app2.unmount;
      installedApps.add(app2);
      app2.unmount = function() {
        installedApps.delete(app2);
        if (installedApps.size < 1) {
          pendingLocation = START_LOCATION_NORMALIZED;
          removeHistoryListener && removeHistoryListener();
          removeHistoryListener = null;
          currentRoute.value = START_LOCATION_NORMALIZED;
          started = false;
          ready = false;
        }
        unmountApp();
      };
    }
  };
  function runGuardQueue(guards) {
    return guards.reduce((promise, guard) => promise.then(() => runWithContext(guard)), Promise.resolve());
  }
  return router2;
}
function useRouter() {
  return inject(routerKey);
}
function useRoute(_name) {
  return inject(routeLocationKey);
}
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
  return false;
};
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const isEmptyString = (value) => value === "";
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const mergeClasses = (...classes) => classes.filter((className, index, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const toCamelCase = (string) => string.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Icon = ({
  name,
  iconNode,
  absoluteStrokeWidth,
  "absolute-stroke-width": absoluteStrokeWidthKebabCase,
  strokeWidth,
  "stroke-width": strokeWidthKebabCase,
  size = defaultAttributes.width,
  color = defaultAttributes.stroke,
  ...props
}, { slots }) => {
  return h(
    "svg",
    {
      ...defaultAttributes,
      ...props,
      width: size,
      height: size,
      stroke: color,
      "stroke-width": isEmptyString(absoluteStrokeWidth) || isEmptyString(absoluteStrokeWidthKebabCase) || absoluteStrokeWidth === true || absoluteStrokeWidthKebabCase === true ? Number(strokeWidth || strokeWidthKebabCase || defaultAttributes["stroke-width"]) * 24 / Number(size) : strokeWidth || strokeWidthKebabCase || defaultAttributes["stroke-width"],
      class: mergeClasses(
        "lucide",
        props.class,
        ...name ? [`lucide-${toKebabCase(toPascalCase(name))}-icon`, `lucide-${toKebabCase(name)}`] : ["lucide-icon"]
      ),
      ...!slots.default && !hasA11yProp(props) && { "aria-hidden": "true" }
    },
    [...iconNode.map((child) => h(...child)), ...slots.default ? [slots.default()] : []]
  );
};
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const createLucideIcon = (iconName, iconNode) => (props, { slots, attrs }) => h(
  Icon,
  {
    ...attrs,
    ...props,
    iconNode,
    name: iconName
  },
  slots
);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const BookOpen = createLucideIcon("book-open", [
  ["path", { d: "M12 7v14", key: "1akyts" }],
  [
    "path",
    {
      d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
      key: "ruj8y"
    }
  ]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Calendar = createLucideIcon("calendar", [
  ["path", { d: "M8 2v4", key: "1cmpym" }],
  ["path", { d: "M16 2v4", key: "4m81vk" }],
  ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
  ["path", { d: "M3 10h18", key: "8toen8" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ChartNoAxesColumn = createLucideIcon("chart-no-axes-column", [
  ["path", { d: "M5 21v-6", key: "1hz6c0" }],
  ["path", { d: "M12 21V3", key: "1lcnhd" }],
  ["path", { d: "M19 21V9", key: "unv183" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ChevronDown = createLucideIcon("chevron-down", [
  ["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ChevronUp = createLucideIcon("chevron-up", [
  ["path", { d: "m18 15-6-6-6 6", key: "153udz" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const CircleCheck = createLucideIcon("circle-check", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const CircleX = createLucideIcon("circle-x", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
  ["path", { d: "m9 9 6 6", key: "z0biqf" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ClipboardList = createLucideIcon("clipboard-list", [
  ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
  [
    "path",
    {
      d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
      key: "116196"
    }
  ],
  ["path", { d: "M12 11h4", key: "1jrz19" }],
  ["path", { d: "M12 16h4", key: "n85exb" }],
  ["path", { d: "M8 11h.01", key: "1dfujw" }],
  ["path", { d: "M8 16h.01", key: "18s6g9" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Clock = createLucideIcon("clock", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M12 6v6l4 2", key: "mmk7yg" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Download = createLucideIcon("download", [
  ["path", { d: "M12 15V3", key: "m9g1x1" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ExternalLink = createLucideIcon("external-link", [
  ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
  ["path", { d: "M10 14 21 3", key: "gplh6r" }],
  ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const FileText = createLucideIcon("file-text", [
  [
    "path",
    {
      d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
      key: "1oefj6"
    }
  ],
  ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
  ["path", { d: "M10 9H8", key: "b1mrlr" }],
  ["path", { d: "M16 13H8", key: "t4e002" }],
  ["path", { d: "M16 17H8", key: "z1uh3a" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Link2 = createLucideIcon("link-2", [
  ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2", key: "8i5ue5" }],
  ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2", key: "1b9ql8" }],
  ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const List = createLucideIcon("list", [
  ["path", { d: "M3 5h.01", key: "18ugdj" }],
  ["path", { d: "M3 12h.01", key: "nlz23k" }],
  ["path", { d: "M3 19h.01", key: "noohij" }],
  ["path", { d: "M8 5h13", key: "1pao27" }],
  ["path", { d: "M8 12h13", key: "1za7za" }],
  ["path", { d: "M8 19h13", key: "m83p4d" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Lock = createLucideIcon("lock", [
  ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2", key: "1w4ew1" }],
  ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4", key: "fwvmzm" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const LogOut = createLucideIcon("log-out", [
  ["path", { d: "m16 17 5-5-5-5", key: "1bji2h" }],
  ["path", { d: "M21 12H9", key: "dn1m92" }],
  ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1uf3rs" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const MessageSquare = createLucideIcon("message-square", [
  [
    "path",
    {
      d: "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",
      key: "18887p"
    }
  ]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const PinOff = createLucideIcon("pin-off", [
  ["path", { d: "M12 17v5", key: "bb1du9" }],
  ["path", { d: "M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89", key: "znwnzq" }],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }],
  [
    "path",
    {
      d: "M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11",
      key: "c9qhm2"
    }
  ]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Pin = createLucideIcon("pin", [
  ["path", { d: "M12 17v5", key: "bb1du9" }],
  [
    "path",
    {
      d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
      key: "1nkz8b"
    }
  ]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Plus = createLucideIcon("plus", [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "M12 5v14", key: "s699le" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Search = createLucideIcon("search", [
  ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Send = createLucideIcon("send", [
  [
    "path",
    {
      d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
      key: "1ffxy3"
    }
  ],
  ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Smile = createLucideIcon("smile", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M8 14s1.5 2 4 2 4-2 4-2", key: "1y1vjs" }],
  ["line", { x1: "9", x2: "9.01", y1: "9", y2: "9", key: "yxxnd0" }],
  ["line", { x1: "15", x2: "15.01", y1: "9", y2: "9", key: "1p4y9e" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Trash2 = createLucideIcon("trash-2", [
  ["path", { d: "M10 11v6", key: "nco0om" }],
  ["path", { d: "M14 11v6", key: "outv1u" }],
  ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" }],
  ["path", { d: "M3 6h18", key: "d0wm0j" }],
  ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Type = createLucideIcon("type", [
  ["path", { d: "M12 4v16", key: "1654pz" }],
  ["path", { d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2", key: "e0r10z" }],
  ["path", { d: "M9 20h6", key: "s66wpe" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Upload = createLucideIcon("upload", [
  ["path", { d: "M12 3v12", key: "1x0j5s" }],
  ["path", { d: "m17 8-5-5-5 5", key: "7q97r8" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Users = createLucideIcon("users", [
  ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
  ["path", { d: "M16 3.128a4 4 0 0 1 0 7.744", key: "16gr8j" }],
  ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
  ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }]
]);
/**
 * @license lucide-vue-next v0.577.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const X = createLucideIcon("x", [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
]);
const toastState = /* @__PURE__ */ reactive({
  message: "",
  type: "error",
  visible: false
});
let _timer = null;
function useToast() {
  function showToast(msg, type = "error") {
    if (_timer) clearTimeout(_timer);
    toastState.message = msg;
    toastState.type = type;
    toastState.visible = true;
    toastState.onUndo = void 0;
    _timer = setTimeout(() => {
      toastState.visible = false;
    }, 4e3);
  }
  function showUndoToast(msg, duration = 5e3) {
    return new Promise((resolve2) => {
      if (_timer) clearTimeout(_timer);
      toastState.message = msg;
      toastState.type = "undo";
      toastState.visible = true;
      let settled = false;
      toastState.onUndo = () => {
        if (settled) return;
        settled = true;
        if (_timer) clearTimeout(_timer);
        toastState.visible = false;
        resolve2(true);
      };
      _timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          toastState.visible = false;
          resolve2(false);
        }
      }, duration);
    });
  }
  return { showToast, showUndoToast };
}
const SESSION_KEY = "cc_session";
const useAppStore = /* @__PURE__ */ defineStore("app", () => {
  const { showToast } = useToast();
  const currentUser = /* @__PURE__ */ ref(null);
  const activeChannelId = /* @__PURE__ */ ref(null);
  const activeDmStudentId = /* @__PURE__ */ ref(null);
  const activePromoId = /* @__PURE__ */ ref(null);
  const activeChannelType = /* @__PURE__ */ ref("chat");
  const activeChannelName = /* @__PURE__ */ ref("");
  const rightPanel = /* @__PURE__ */ ref(null);
  const currentTravailId = /* @__PURE__ */ ref(null);
  const pendingNoteDepotId = /* @__PURE__ */ ref(null);
  const unread = /* @__PURE__ */ ref({});
  const isStudent = computed(() => currentUser.value?.type === "student");
  const isTeacher = computed(() => currentUser.value?.type === "teacher");
  const isReadonly2 = computed(
    () => activeChannelType.value === "annonce" && isStudent.value
  );
  function restoreSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        currentUser.value = JSON.parse(raw);
        return true;
      }
    } catch {
    }
    return false;
  }
  function login(user) {
    currentUser.value = user;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
    }
  }
  function logout() {
    currentUser.value = null;
    activeChannelId.value = null;
    activeDmStudentId.value = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
    }
  }
  function impersonate(user) {
    currentUser.value = user;
  }
  function openChannel(id, promoId, name, type = "chat") {
    activeChannelId.value = id;
    activeDmStudentId.value = null;
    activePromoId.value = promoId;
    activeChannelType.value = type;
    activeChannelName.value = name;
    markRead(id);
  }
  function openDm(studentId, promoId, name) {
    activeDmStudentId.value = studentId;
    activeChannelId.value = null;
    activePromoId.value = promoId;
    activeChannelType.value = "chat";
    activeChannelName.value = name;
  }
  function markRead(channelId) {
    const next = { ...unread.value };
    delete next[channelId];
    unread.value = next;
  }
  function initUnreadListener() {
    return window.api.onNewMessage(({ channelId }) => {
      if (!channelId) return;
      if (channelId === activeChannelId.value) return;
      unread.value = { ...unread.value, [channelId]: (unread.value[channelId] ?? 0) + 1 };
    });
  }
  async function api(call, errorMsg) {
    try {
      const res = await call();
      if (!res.ok) {
        showToast(res.error ?? errorMsg ?? "Erreur serveur");
        return null;
      }
      return res.data;
    } catch (e) {
      showToast(errorMsg ?? "Erreur réseau");
      console.error(e);
      return null;
    }
  }
  return {
    // état
    currentUser,
    activeChannelId,
    activeDmStudentId,
    activePromoId,
    activeChannelType,
    activeChannelName,
    rightPanel,
    currentTravailId,
    pendingNoteDepotId,
    unread,
    // calculs
    isStudent,
    isTeacher,
    isReadonly: isReadonly2,
    // actions
    restoreSession,
    login,
    logout,
    impersonate,
    openChannel,
    openDm,
    markRead,
    initUnreadListener,
    api
  };
});
const GROUP_THRESHOLD_MS = 5 * 60 * 1e3;
const PAGE_SIZE = 50;
const useMessagesStore = /* @__PURE__ */ defineStore("messages", () => {
  const appStore = useAppStore();
  const messages = /* @__PURE__ */ ref([]);
  const pinned = /* @__PURE__ */ ref([]);
  const loading = /* @__PURE__ */ ref(false);
  const loadingMore = /* @__PURE__ */ ref(false);
  const hasMore = /* @__PURE__ */ ref(false);
  const searchTerm = /* @__PURE__ */ ref("");
  const firstUnreadId = /* @__PURE__ */ ref(null);
  const reactions = /* @__PURE__ */ reactive({});
  const userVotes = /* @__PURE__ */ reactive({});
  function isGrouped(msg, prev) {
    if (!prev || searchTerm.value) return false;
    if (msg.author_name !== prev.author_name) return false;
    return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_THRESHOLD_MS;
  }
  function _lrKey() {
    const { activeChannelId, activeDmStudentId } = appStore;
    if (activeChannelId) return `lastRead:ch:${activeChannelId}`;
    if (activeDmStudentId) return `lastRead:dm:${activeDmStudentId}`;
    return null;
  }
  async function fetchMessages() {
    loading.value = true;
    hasMore.value = false;
    firstUnreadId.value = null;
    try {
      const { activeChannelId, activeDmStudentId } = appStore;
      const lrKey = _lrKey();
      const lastReadId = lrKey ? parseInt(localStorage.getItem(lrKey) ?? "0", 10) : 0;
      let fetched = [];
      if (searchTerm.value && activeChannelId) {
        const res = await window.api.searchMessages(activeChannelId, searchTerm.value);
        fetched = res?.ok ? res.data : [];
        hasMore.value = false;
      } else if (activeChannelId) {
        const res = await window.api.getChannelMessagesPage(activeChannelId);
        const page = res?.ok ? res.data : [];
        fetched = page.slice().reverse();
        hasMore.value = page.length === PAGE_SIZE;
      } else if (activeDmStudentId) {
        const res = await window.api.getDmMessagesPage(activeDmStudentId);
        const page = res?.ok ? res.data : [];
        fetched = page.slice().reverse();
        hasMore.value = page.length === PAGE_SIZE;
      }
      messages.value = fetched;
      if (!searchTerm.value && lastReadId > 0) {
        const first = fetched.find((m) => m.id > lastReadId);
        firstUnreadId.value = first?.id ?? null;
      }
      if (lrKey && fetched.length) {
        localStorage.setItem(lrKey, String(fetched[fetched.length - 1].id));
      }
    } finally {
      loading.value = false;
    }
  }
  async function loadOlderMessages() {
    if (loadingMore.value || !hasMore.value) return;
    const oldestId = messages.value[0]?.id;
    if (!oldestId) return;
    loadingMore.value = true;
    try {
      const { activeChannelId, activeDmStudentId } = appStore;
      let page = [];
      if (activeChannelId) {
        const res = await window.api.getChannelMessagesPage(activeChannelId, oldestId);
        page = res?.ok ? res.data : [];
      } else if (activeDmStudentId) {
        const res = await window.api.getDmMessagesPage(activeDmStudentId, oldestId);
        page = res?.ok ? res.data : [];
      }
      const older = page.slice().reverse();
      hasMore.value = page.length === PAGE_SIZE;
      messages.value = [...older, ...messages.value];
    } finally {
      loadingMore.value = false;
    }
  }
  async function fetchPinned(channelId) {
    const res = await window.api.getPinnedMessages(channelId);
    pinned.value = res?.ok ? res.data : [];
  }
  async function sendMessage(content) {
    if (!appStore.currentUser || !content.trim()) return;
    await window.api.sendMessage({
      channelId: appStore.activeChannelId ?? void 0,
      dmStudentId: appStore.activeDmStudentId ?? void 0,
      authorId: appStore.currentUser.id,
      content: content.trim()
    });
    await fetchMessages();
  }
  async function togglePin(messageId, pinned_) {
    if (!appStore.activeChannelId) return;
    await window.api.togglePinMessage({ messageId, pinned: pinned_ });
    await fetchPinned(appStore.activeChannelId);
    await fetchMessages();
  }
  function initReactions(msgId, dbJson) {
    if (reactions[msgId]) return;
    const base = { check: 0, thumb: 0, bulb: 0, question: 0, eye: 0 };
    if (dbJson) {
      try {
        Object.assign(base, JSON.parse(dbJson));
      } catch {
      }
    }
    reactions[msgId] = base;
    if (!userVotes[msgId]) userVotes[msgId] = /* @__PURE__ */ new Set();
  }
  function toggleReaction(msgId, type) {
    const r = reactions[msgId];
    const mine = userVotes[msgId];
    if (!r || !mine) return;
    if (mine.has(type)) {
      mine.delete(type);
      r[type] = Math.max(0, (r[type] ?? 1) - 1);
    } else {
      mine.add(type);
      r[type] = (r[type] ?? 0) + 1;
    }
  }
  function clearSearch() {
    searchTerm.value = "";
  }
  return {
    messages,
    pinned,
    loading,
    loadingMore,
    hasMore,
    searchTerm,
    firstUnreadId,
    reactions,
    userVotes,
    isGrouped,
    fetchMessages,
    loadOlderMessages,
    fetchPinned,
    sendMessage,
    togglePin,
    initReactions,
    toggleReaction,
    clearSearch
  };
});
function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function formatDateSeparator(isoStr) {
  const d = new Date(isoStr);
  const today = /* @__PURE__ */ new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}
function isoForDatetimeLocal() {
  const d = /* @__PURE__ */ new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
}
function deadlineClass(deadlineStr) {
  const diff = new Date(deadlineStr).getTime() - Date.now();
  if (diff < 0) return "deadline-passed";
  if (diff < 24 * 60 * 60 * 1e3) return "deadline-critical";
  if (diff < 3 * 24 * 60 * 60 * 1e3) return "deadline-soon";
  if (diff < 7 * 24 * 60 * 60 * 1e3) return "deadline-warning";
  return "deadline-ok";
}
function deadlineLabel(deadlineStr) {
  const diff = new Date(deadlineStr).getTime() - Date.now();
  if (diff < 0) {
    const d2 = Math.ceil(-diff / (24 * 3600 * 1e3));
    return d2 === 1 ? "Retard d'1 jour" : `Retard de ${d2}j`;
  }
  const h2 = diff / (3600 * 1e3);
  if (h2 < 1) return "Moins d'1h !";
  if (h2 < 24) return `Dans ${Math.ceil(h2)}h`;
  const d = Math.ceil(h2 / 24);
  if (d === 1) return "Demain";
  if (d <= 7) return `Dans ${d} jours`;
  if (d <= 30) return `Dans ${Math.round(d / 7)} sem.`;
  return `Dans ${Math.ceil(d / 30)} mois`;
}
const useTravauxStore = /* @__PURE__ */ defineStore("travaux", () => {
  const appStore = useAppStore();
  const travaux = /* @__PURE__ */ ref([]);
  const currentTravail = /* @__PURE__ */ ref(null);
  const depots = /* @__PURE__ */ ref([]);
  const ressources = /* @__PURE__ */ ref([]);
  const ganttData = /* @__PURE__ */ ref([]);
  const allRendus = /* @__PURE__ */ ref([]);
  const loading = /* @__PURE__ */ ref(false);
  const view = /* @__PURE__ */ ref("gantt");
  const pendingTravaux = computed(
    () => travaux.value.filter((t) => t.depot_id == null && t.type !== "jalon")
  );
  const hasPendingUrgent = computed(
    () => pendingTravaux.value.some(
      (t) => ["deadline-passed", "deadline-critical"].includes(deadlineClass(t.deadline))
    )
  );
  async function fetchStudentTravaux() {
    if (!appStore.currentUser) return;
    loading.value = true;
    try {
      const res = await window.api.getStudentTravaux(appStore.currentUser.id);
      travaux.value = res?.ok ? res.data : [];
    } finally {
      loading.value = false;
    }
  }
  async function fetchGantt(promoId) {
    loading.value = true;
    try {
      const res = await window.api.getGanttData(promoId);
      ganttData.value = res?.ok ? res.data : [];
    } finally {
      loading.value = false;
    }
  }
  async function fetchRendus(promoId) {
    loading.value = true;
    try {
      const res = await window.api.getAllRendus(promoId);
      allRendus.value = res?.ok ? res.data : [];
    } finally {
      loading.value = false;
    }
  }
  async function fetchDepots(travailId) {
    const res = await window.api.getDepots(travailId);
    depots.value = res?.ok ? res.data : [];
  }
  async function fetchRessources(travailId) {
    const res = await window.api.getRessources(travailId);
    ressources.value = res?.ok ? res.data : [];
  }
  async function openTravail(travailId) {
    const res = await window.api.getTravailById(travailId);
    if (res?.ok) {
      currentTravail.value = res.data;
      appStore.currentTravailId = travailId;
      await fetchDepots(travailId);
      await fetchRessources(travailId);
    }
  }
  async function createTravail(payload) {
    const res = await window.api.createTravail(payload);
    return res?.ok ? res.data : null;
  }
  async function addDepot(payload) {
    const res = await window.api.addDepot(payload);
    if (res?.ok && appStore.currentTravailId) await fetchDepots(appStore.currentTravailId);
    return res?.ok ?? false;
  }
  async function setNote(payload) {
    await window.api.setNote(payload);
    if (appStore.currentTravailId) await fetchDepots(appStore.currentTravailId);
  }
  async function setFeedback(payload) {
    await window.api.setFeedback(payload);
    if (appStore.currentTravailId) await fetchDepots(appStore.currentTravailId);
  }
  async function markNonSubmittedAsD(travailId) {
    await window.api.markNonSubmittedAsD(travailId);
    await fetchDepots(travailId);
  }
  function setView(v) {
    view.value = v;
  }
  return {
    travaux,
    currentTravail,
    depots,
    ressources,
    ganttData,
    allRendus,
    loading,
    view,
    pendingTravaux,
    hasPendingUrgent,
    fetchStudentTravaux,
    fetchGantt,
    fetchRendus,
    fetchDepots,
    fetchRessources,
    openTravail,
    createTravail,
    addDepot,
    setNote,
    setFeedback,
    markNonSubmittedAsD,
    setView
  };
});
const useModalsStore = /* @__PURE__ */ defineStore("modals", () => {
  const depots = /* @__PURE__ */ ref(false);
  const suivi = /* @__PURE__ */ ref(false);
  const gestionDevoir = /* @__PURE__ */ ref(false);
  const ressources = /* @__PURE__ */ ref(false);
  const timeline = /* @__PURE__ */ ref(false);
  const echeancier = /* @__PURE__ */ ref(false);
  const settings = /* @__PURE__ */ ref(false);
  const documentPreview = /* @__PURE__ */ ref(false);
  const newTravail = /* @__PURE__ */ ref(false);
  const createChannel = /* @__PURE__ */ ref(false);
  const cmdPalette = /* @__PURE__ */ ref(false);
  const impersonate = /* @__PURE__ */ ref(false);
  function closeAll() {
    depots.value = false;
    suivi.value = false;
    gestionDevoir.value = false;
    ressources.value = false;
    timeline.value = false;
    echeancier.value = false;
    settings.value = false;
    documentPreview.value = false;
    newTravail.value = false;
    createChannel.value = false;
    cmdPalette.value = false;
    impersonate.value = false;
  }
  return {
    depots,
    suivi,
    gestionDevoir,
    ressources,
    timeline,
    echeancier,
    settings,
    documentPreview,
    newTravail,
    createChannel,
    cmdPalette,
    impersonate,
    closeAll
  };
});
const _hoisted_1$r = ["src", "alt"];
const _hoisted_2$p = { key: 1 };
const _sfc_main$s = /* @__PURE__ */ defineComponent({
  __name: "Avatar",
  props: {
    initials: {},
    color: {},
    size: { default: 34 },
    photoData: { default: null }
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: "msg-avatar",
        style: normalizeStyle({
          width: `${props.size}px`,
          height: `${props.size}px`,
          fontSize: `${Math.round(props.size * 0.33)}px`,
          flexShrink: 0,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: props.photoData ? "transparent" : props.color,
          color: "#fff"
        })
      }, [
        props.photoData ? (openBlock(), createElementBlock("img", {
          key: 0,
          src: props.photoData,
          alt: props.initials,
          style: { "width": "100%", "height": "100%", "object-fit": "cover" }
        }, null, 8, _hoisted_1$r)) : (openBlock(), createElementBlock("span", _hoisted_2$p, toDisplayString(props.initials), 1))
      ], 4);
    };
  }
});
const _hoisted_1$q = {
  class: "reaction-picker-root",
  style: { "position": "relative", "display": "inline-flex" }
};
const _hoisted_2$o = {
  key: 0,
  class: "reaction-picker",
  style: { "position": "absolute", "bottom": "28px", "left": "0", "z-index": "200" }
};
const _hoisted_3$m = ["aria-label", "onClick"];
const _sfc_main$r = /* @__PURE__ */ defineComponent({
  __name: "ReactionPicker",
  props: {
    msgId: {}
  },
  setup(__props) {
    const props = __props;
    const messagesStore = useMessagesStore();
    const REACT_TYPES = [
      { type: "check", emoji: "✅" },
      { type: "thumb", emoji: "👍" },
      { type: "bulb", emoji: "💡" },
      { type: "question", emoji: "❓" },
      { type: "eye", emoji: "👁️" }
    ];
    const open = /* @__PURE__ */ ref(false);
    function toggle() {
      open.value = !open.value;
    }
    function pick(type) {
      messagesStore.toggleReaction(props.msgId, type);
      open.value = false;
    }
    function onDocClick(e) {
      const el = e.target.closest(".reaction-picker-root");
      if (!el) open.value = false;
    }
    onMounted(() => document.addEventListener("click", onDocClick));
    onUnmounted(() => document.removeEventListener("click", onDocClick));
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$q, [
        createBaseVNode("button", {
          class: "btn-icon msg-action-btn add-reaction-btn",
          title: "Ajouter une réaction",
          "aria-label": "Ajouter une réaction",
          onClick: withModifiers(toggle, ["stop"])
        }, [
          createVNode(unref(Smile), { size: 14 })
        ]),
        open.value ? (openBlock(), createElementBlock("div", _hoisted_2$o, [
          (openBlock(), createElementBlock(Fragment, null, renderList(REACT_TYPES, (r) => {
            return createBaseVNode("button", {
              key: r.type,
              class: "reaction-picker-btn",
              "aria-label": r.type,
              onClick: withModifiers(($event) => pick(r.type), ["stop"])
            }, toDisplayString(r.emoji), 9, _hoisted_3$m);
          }), 64))
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
const PALETTE = [
  "#e53935",
  "#8e24aa",
  "#1e88e5",
  "#00897b",
  "#43a047",
  "#fb8c00",
  "#6d4c41",
  "#546e7a"
];
function avatarColor(str) {
  let hash = 0;
  for (const c of str) hash = (hash << 5) - hash + c.charCodeAt(0);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
function formatGrade(note) {
  if (note == null) return "";
  if (typeof note === "number" || typeof note === "string" && !isNaN(parseFloat(note)) && !["A", "B", "C", "D"].includes(note)) {
    return `${note}/20`;
  }
  return String(note);
}
function gradeClass(note) {
  if (note == null) return "grade-empty";
  const s = String(note).toUpperCase();
  if (s === "A") return "grade-a";
  if (s === "B") return "grade-b";
  if (s === "C") return "grade-c";
  if (s === "D") return "grade-d";
  if (s === "NA") return "grade-na";
  const n = parseFloat(s);
  if (isNaN(n)) return "grade-empty";
  return n >= 14 ? "grade-a" : n >= 10 ? "grade-b" : n >= 8 ? "grade-c" : "grade-d";
}
function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function highlightTerm(text, term) {
  if (!term) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedT = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(
    new RegExp(escapedT, "gi"),
    (m) => `<mark class="search-highlight">${m}</mark>`
  );
}
function parseMarkdown(html) {
  return html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
}
function applyMentions(html, currentUserName = "") {
  return html.replace(/@([\w][\w.\-]*)/g, (match, name) => {
    const isEveryone = name.toLowerCase() === "everyone";
    const isMine = !isEveryone && !!currentUserName && currentUserName.toLowerCase().includes(name.toLowerCase());
    const cls = isEveryone || isMine ? "mention-me" : "mention-tag";
    return `<span class="${cls}">${match}</span>`;
  });
}
function renderMessageContent(raw, searchTerm = "", currentUserName = "") {
  const escaped = searchTerm ? highlightTerm(raw, searchTerm) : escapeHtml(raw);
  return applyMentions(parseMarkdown(escaped), currentUserName);
}
const _hoisted_1$p = ["data-msg-id"];
const _hoisted_2$n = {
  key: 1,
  class: "msg-avatar-placeholder"
};
const _hoisted_3$l = { class: "msg-body" };
const _hoisted_4$j = { class: "msg-author" };
const _hoisted_5$f = { class: "msg-time" };
const _hoisted_6$e = {
  key: 0,
  class: "pin-badge",
  title: "Message épinglé"
};
const _hoisted_7$b = ["innerHTML"];
const _hoisted_8$a = {
  key: 1,
  class: "msg-reactions"
};
const _hoisted_9$a = ["aria-label", "onClick"];
const _hoisted_10$a = { class: "msg-actions" };
const _hoisted_11$a = ["title", "aria-label"];
const _sfc_main$q = /* @__PURE__ */ defineComponent({
  __name: "MessageBubble",
  props: {
    msg: {},
    grouped: { type: Boolean, default: false },
    searchTerm: { default: "" }
  },
  setup(__props) {
    const props = __props;
    const appStore = useAppStore();
    const messagesStore = useMessagesStore();
    const content = computed(
      () => renderMessageContent(props.msg.content, props.searchTerm, appStore.currentUser?.name ?? "")
    );
    const color = computed(() => avatarColor(props.msg.author_name));
    const isPinned = computed(() => !!props.msg.is_pinned);
    function togglePin() {
      messagesStore.togglePin(props.msg.id, !isPinned.value);
    }
    const REACT_TYPES = [
      { type: "check", icon: "check" },
      { type: "thumb", icon: "thumbs-up" },
      { type: "bulb", icon: "lightbulb" },
      { type: "question", icon: "help-circle" },
      { type: "eye", icon: "eye" }
    ];
    const reactionsToShow = computed(() => {
      const r = messagesStore.reactions[props.msg.id] ?? {};
      const mine = messagesStore.userVotes[props.msg.id] ?? /* @__PURE__ */ new Set();
      return REACT_TYPES.filter((t) => (r[t.type] ?? 0) > 0).map((t) => ({
        ...t,
        count: r[t.type],
        isMine: mine.has(t.type)
      }));
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["msg-row", { grouped: __props.grouped, pinned: isPinned.value }]),
        "data-msg-id": __props.msg.id
      }, [
        !__props.grouped ? (openBlock(), createBlock(_sfc_main$s, {
          key: 0,
          initials: __props.msg.author_initials || __props.msg.author_name.slice(0, 2).toUpperCase(),
          color: color.value,
          "photo-data": __props.msg.author_photo
        }, null, 8, ["initials", "color", "photo-data"])) : (openBlock(), createElementBlock("div", _hoisted_2$n)),
        createBaseVNode("div", _hoisted_3$l, [
          !__props.grouped ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
            createBaseVNode("span", _hoisted_4$j, toDisplayString(__props.msg.author_name), 1),
            createBaseVNode("span", _hoisted_5$f, toDisplayString(unref(formatTime)(__props.msg.created_at)), 1),
            isPinned.value ? (openBlock(), createElementBlock("span", _hoisted_6$e, "📌")) : createCommentVNode("", true)
          ], 64)) : createCommentVNode("", true),
          createBaseVNode("p", {
            class: "msg-text",
            innerHTML: content.value
          }, null, 8, _hoisted_7$b),
          reactionsToShow.value.length ? (openBlock(), createElementBlock("div", _hoisted_8$a, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(reactionsToShow.value, (r) => {
              return openBlock(), createElementBlock("button", {
                key: r.type,
                class: normalizeClass(["msg-reaction-pill", { mine: r.isMine }]),
                "aria-label": `Réaction ${r.type}`,
                onClick: ($event) => unref(messagesStore).toggleReaction(__props.msg.id, r.type)
              }, [
                createBaseVNode("span", null, toDisplayString(r.count), 1)
              ], 10, _hoisted_9$a);
            }), 128))
          ])) : createCommentVNode("", true)
        ]),
        createBaseVNode("div", _hoisted_10$a, [
          createVNode(_sfc_main$r, {
            "msg-id": __props.msg.id
          }, null, 8, ["msg-id"]),
          unref(appStore).isTeacher ? (openBlock(), createElementBlock("button", {
            key: 0,
            class: "btn-icon msg-action-btn",
            title: isPinned.value ? "Désépingler" : "Épingler",
            "aria-label": isPinned.value ? "Désépingler le message" : "Épingler le message",
            onClick: togglePin
          }, [
            isPinned.value ? (openBlock(), createBlock(unref(PinOff), {
              key: 0,
              size: 14
            })) : (openBlock(), createBlock(unref(Pin), {
              key: 1,
              size: 14
            }))
          ], 8, _hoisted_11$a)) : createCommentVNode("", true)
        ])
      ], 10, _hoisted_1$p);
    };
  }
});
const _hoisted_1$o = {
  key: 0,
  class: "load-more-indicator"
};
const _hoisted_2$m = { class: "date-separator" };
const _hoisted_3$k = {
  key: 0,
  class: "unread-divider"
};
const _hoisted_4$i = {
  key: 2,
  class: "empty-state"
};
const _sfc_main$p = /* @__PURE__ */ defineComponent({
  __name: "MessageList",
  setup(__props) {
    const store = useMessagesStore();
    const listEl = /* @__PURE__ */ ref(null);
    watch(
      () => store.messages,
      (msgs) => msgs.forEach((m) => store.initReactions(m.id, m.reactions)),
      { immediate: true }
    );
    let initialScrollDone = false;
    watch(
      () => store.messages.length,
      () => nextTick(() => {
        if (!listEl.value) return;
        const el = listEl.value;
        if (!initialScrollDone && store.firstUnreadId) {
          const marker = el.querySelector(".unread-divider");
          if (marker) {
            marker.scrollIntoView({ block: "center" });
            initialScrollDone = true;
            return;
          }
        }
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (atBottom || !initialScrollDone) {
          el.scrollTop = el.scrollHeight;
          initialScrollDone = true;
        }
      })
    );
    watch(() => store.loading, (loading) => {
      if (loading) initialScrollDone = false;
    });
    const sentinelEl = /* @__PURE__ */ ref(null);
    let observer = null;
    async function loadMore() {
      if (!listEl.value || !store.hasMore || store.loadingMore) return;
      const el = listEl.value;
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      await store.loadOlderMessages();
      await nextTick();
      el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
    }
    onMounted(() => {
      if (!sentinelEl.value) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) loadMore();
        },
        { root: listEl.value, threshold: 0.1 }
      );
      observer.observe(sentinelEl.value);
    });
    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
    });
    const dateGroups = computed(() => {
      const groups = [];
      let lastDate = "";
      let lastMsg = null;
      let unreadMarked = false;
      for (const msg of store.messages) {
        const date = new Date(msg.created_at).toDateString();
        if (date !== lastDate) {
          lastDate = date;
          lastMsg = null;
          groups.push({ date: formatDateSeparator(msg.created_at), messages: [] });
        }
        const grp = groups[groups.length - 1];
        const isFirstUnread = !unreadMarked && store.firstUnreadId !== null && msg.id === store.firstUnreadId;
        if (isFirstUnread) unreadMarked = true;
        grp.messages.push({ msg, grouped: store.isGrouped(msg, lastMsg), isFirstUnread });
        lastMsg = msg;
      }
      return groups;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        ref_key: "listEl",
        ref: listEl,
        id: "messages-list",
        class: "messages-list"
      }, [
        unref(store).loading ? (openBlock(), createElementBlock(Fragment, { key: 0 }, renderList(5, (i) => {
          return createBaseVNode("div", {
            key: i,
            class: "skel-msg-row"
          }, [..._cache[0] || (_cache[0] = [
            createStaticVNode('<div class="skel skel-avatar" data-v-6d76756c></div><div class="skel-msg-body" data-v-6d76756c><div class="skel skel-line skel-w30" data-v-6d76756c></div><div class="skel skel-line skel-w90" data-v-6d76756c></div><div class="skel skel-line skel-w70" data-v-6d76756c></div></div>', 2)
          ])]);
        }), 64)) : unref(store).messages.length ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
          createBaseVNode("div", {
            ref_key: "sentinelEl",
            ref: sentinelEl,
            class: "scroll-sentinel",
            "aria-hidden": "true"
          }, [
            unref(store).loadingMore ? (openBlock(), createElementBlock("div", _hoisted_1$o, [..._cache[1] || (_cache[1] = [
              createBaseVNode("span", { class: "load-more-dots" }, [
                createBaseVNode("span"),
                createBaseVNode("span"),
                createBaseVNode("span")
              ], -1)
            ])])) : createCommentVNode("", true)
          ], 512),
          (openBlock(true), createElementBlock(Fragment, null, renderList(dateGroups.value, (group) => {
            return openBlock(), createElementBlock(Fragment, {
              key: group.date
            }, [
              createBaseVNode("div", _hoisted_2$m, [
                createBaseVNode("span", null, toDisplayString(group.date), 1)
              ]),
              (openBlock(true), createElementBlock(Fragment, null, renderList(group.messages, ({ msg, grouped, isFirstUnread }) => {
                return openBlock(), createElementBlock(Fragment, {
                  key: msg.id
                }, [
                  isFirstUnread ? (openBlock(), createElementBlock("div", _hoisted_3$k, [..._cache[2] || (_cache[2] = [
                    createBaseVNode("span", { class: "unread-divider-label" }, "Nouveaux messages", -1)
                  ])])) : createCommentVNode("", true),
                  createVNode(_sfc_main$q, {
                    msg,
                    grouped,
                    "search-term": unref(store).searchTerm
                  }, null, 8, ["msg", "grouped", "search-term"])
                ], 64);
              }), 128))
            ], 64);
          }), 128))
        ], 64)) : (openBlock(), createElementBlock("div", _hoisted_4$i, [
          createBaseVNode("p", null, toDisplayString(unref(store).searchTerm ? "Aucun message ne correspond à cette recherche." : "Aucun message pour l'instant."), 1)
        ]))
      ], 512);
    };
  }
});
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const MessageList = /* @__PURE__ */ _export_sfc(_sfc_main$p, [["__scopeId", "data-v-6d76756c"]]);
const _hoisted_1$n = {
  id: "chat-format-toolbar",
  class: "chat-format-toolbar"
};
const _sfc_main$o = /* @__PURE__ */ defineComponent({
  __name: "FormatToolbar",
  props: {
    inputEl: {}
  },
  setup(__props) {
    const props = __props;
    function wrap(pre, post) {
      const el = props.inputEl;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const sel = el.value.slice(start, end) || "texte";
      el.value = el.value.slice(0, start) + pre + sel + post + el.value.slice(end);
      el.focus();
      el.selectionStart = start + pre.length;
      el.selectionEnd = start + pre.length + sel.length;
      el.dispatchEvent(new Event("input"));
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$n, [
        createBaseVNode("button", {
          class: "fmt-btn btn-icon",
          title: "Gras",
          "aria-label": "Gras",
          onClick: _cache[0] || (_cache[0] = ($event) => wrap("**", "**"))
        }, [..._cache[3] || (_cache[3] = [
          createBaseVNode("strong", null, "B", -1)
        ])]),
        createBaseVNode("button", {
          class: "fmt-btn btn-icon",
          title: "Italique",
          "aria-label": "Italique",
          onClick: _cache[1] || (_cache[1] = ($event) => wrap("*", "*"))
        }, [..._cache[4] || (_cache[4] = [
          createBaseVNode("em", null, "I", -1)
        ])]),
        createBaseVNode("button", {
          class: "fmt-btn btn-icon",
          title: "Code",
          "aria-label": "Code",
          onClick: _cache[2] || (_cache[2] = ($event) => wrap("`", "`"))
        }, [..._cache[5] || (_cache[5] = [
          createBaseVNode("code", { style: { "font-size": "11px" } }, "{ }", -1)
        ])])
      ]);
    };
  }
});
const _hoisted_1$m = {
  id: "message-input-wrapper",
  class: "message-input-wrapper"
};
const _hoisted_2$l = ["placeholder"];
const _hoisted_3$j = ["disabled"];
const _hoisted_4$h = {
  key: 1,
  class: "readonly-notice"
};
const _sfc_main$n = /* @__PURE__ */ defineComponent({
  __name: "MessageInput",
  setup(__props) {
    const appStore = useAppStore();
    const messagesStore = useMessagesStore();
    const inputEl = /* @__PURE__ */ ref(null);
    const content = /* @__PURE__ */ ref("");
    const showToolbar = /* @__PURE__ */ ref(false);
    const sending = /* @__PURE__ */ ref(false);
    const placeholder = computed(() => {
      if (appStore.isReadonly) return "Canal d'annonces — lecture seule";
      if (appStore.activeChannelName) return `Envoyer dans #${appStore.activeChannelName}`;
      return "Votre message…";
    });
    function autoResize() {
      if (!inputEl.value) return;
      inputEl.value.style.height = "auto";
      inputEl.value.style.height = inputEl.value.scrollHeight + "px";
    }
    async function send() {
      if (!content.value.trim() || sending.value || appStore.isReadonly) return;
      sending.value = true;
      try {
        await messagesStore.sendMessage(content.value);
        content.value = "";
        if (inputEl.value) inputEl.value.style.height = "auto";
      } finally {
        sending.value = false;
        inputEl.value?.focus();
      }
    }
    function onKeydown(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        id: "message-input-area",
        class: normalizeClass(["message-input-area", { readonly: unref(appStore).isReadonly }])
      }, [
        !unref(appStore).isReadonly ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
          showToolbar.value ? (openBlock(), createBlock(_sfc_main$o, {
            key: 0,
            "input-el": inputEl.value
          }, null, 8, ["input-el"])) : createCommentVNode("", true),
          createBaseVNode("div", _hoisted_1$m, [
            createBaseVNode("button", {
              id: "btn-toggle-format",
              class: normalizeClass(["btn-icon", { active: showToolbar.value }]),
              title: "Mise en forme",
              "aria-label": "Afficher la barre de mise en forme",
              style: { "flex-shrink": "0" },
              onClick: _cache[0] || (_cache[0] = ($event) => showToolbar.value = !showToolbar.value)
            }, [
              createVNode(unref(Type), { size: 16 })
            ], 2),
            withDirectives(createBaseVNode("textarea", {
              id: "message-input",
              ref_key: "inputEl",
              ref: inputEl,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => content.value = $event),
              class: "message-input",
              placeholder: placeholder.value,
              rows: "1",
              onInput: autoResize,
              onKeydown
            }, null, 40, _hoisted_2$l), [
              [vModelText, content.value]
            ]),
            createBaseVNode("button", {
              id: "btn-send",
              class: "btn-primary",
              disabled: !content.value.trim() || sending.value,
              "aria-label": "Envoyer le message",
              onClick: send
            }, [
              createVNode(unref(Send), { size: 16 })
            ], 8, _hoisted_3$j)
          ])
        ], 64)) : (openBlock(), createElementBlock("p", _hoisted_4$h, "Ce canal est en lecture seule."))
      ], 2);
    };
  }
});
const _hoisted_1$l = {
  key: 0,
  id: "pinned-messages-banner",
  class: "pinned-messages-banner"
};
const _hoisted_2$k = {
  key: 0,
  id: "pinned-messages-list",
  class: "pinned-list"
};
const _hoisted_3$i = { class: "pinned-author" };
const _hoisted_4$g = ["innerHTML"];
const _sfc_main$m = /* @__PURE__ */ defineComponent({
  __name: "PinnedBanner",
  setup(__props) {
    const store = useMessagesStore();
    const expanded = /* @__PURE__ */ ref(false);
    const hasPinned = computed(() => store.pinned.length > 0);
    return (_ctx, _cache) => {
      return hasPinned.value ? (openBlock(), createElementBlock("div", _hoisted_1$l, [
        createBaseVNode("div", {
          class: "pinned-header",
          onClick: _cache[0] || (_cache[0] = ($event) => expanded.value = !expanded.value)
        }, [
          createVNode(unref(Pin), { size: 14 }),
          createBaseVNode("span", null, toDisplayString(unref(store).pinned.length) + " message" + toDisplayString(unref(store).pinned.length > 1 ? "s" : "") + " épinglé" + toDisplayString(unref(store).pinned.length > 1 ? "s" : ""), 1),
          expanded.value ? (openBlock(), createBlock(unref(ChevronUp), {
            key: 0,
            size: 14,
            style: { "margin-left": "auto" }
          })) : (openBlock(), createBlock(unref(ChevronDown), {
            key: 1,
            size: 14,
            style: { "margin-left": "auto" }
          }))
        ]),
        expanded.value ? (openBlock(), createElementBlock("ul", _hoisted_2$k, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(store).pinned, (m) => {
            return openBlock(), createElementBlock("li", {
              key: m.id,
              class: "pinned-item"
            }, [
              createBaseVNode("strong", _hoisted_3$i, toDisplayString(m.author_name), 1),
              createBaseVNode("span", {
                class: "pinned-text",
                innerHTML: unref(renderMessageContent)(m.content)
              }, null, 8, _hoisted_4$g)
            ]);
          }), 128))
        ])) : createCommentVNode("", true)
      ])) : createCommentVNode("", true);
    };
  }
});
const _hoisted_1$k = {
  id: "main-area",
  class: "main-area"
};
const _hoisted_2$j = {
  key: 0,
  id: "channel-header",
  class: "channel-header"
};
const _hoisted_3$h = { class: "channel-header-left" };
const _hoisted_4$f = { id: "channel-icon" };
const _hoisted_5$e = {
  id: "channel-name",
  class: "channel-name"
};
const _hoisted_6$d = {
  key: 0,
  id: "channel-type-badge",
  class: "channel-type-badge"
};
const _hoisted_7$a = {
  id: "header-actions",
  class: "header-actions"
};
const _hoisted_8$9 = {
  id: "search-results-count",
  class: "search-results-count"
};
const _hoisted_9$9 = { key: 0 };
const _hoisted_10$9 = {
  key: 3,
  class: "messages-container",
  id: "messages-container"
};
const _hoisted_11$9 = {
  key: 4,
  class: "no-channel-hint",
  id: "no-channel-hint"
};
const _sfc_main$l = /* @__PURE__ */ defineComponent({
  __name: "MessagesView",
  setup(__props) {
    const appStore = useAppStore();
    const messagesStore = useMessagesStore();
    const travauxStore = useTravauxStore();
    const modals = useModalsStore();
    const searchInput = /* @__PURE__ */ ref("");
    watch(
      () => [appStore.activeChannelId, appStore.activeDmStudentId],
      async ([chId]) => {
        messagesStore.clearSearch();
        searchInput.value = "";
        await messagesStore.fetchMessages();
        if (chId) {
          await messagesStore.fetchPinned(chId);
          if (appStore.isStudent) await travauxStore.fetchStudentTravaux();
        }
      }
    );
    async function doSearch() {
      messagesStore.searchTerm = searchInput.value;
      await messagesStore.fetchMessages();
    }
    function clearSearch() {
      searchInput.value = "";
      messagesStore.clearSearch();
      messagesStore.fetchMessages();
    }
    const pendingForChannel = computed(() => {
      if (!appStore.isStudent || !appStore.activeChannelId) return [];
      return travauxStore.pendingTravaux.filter(
        (t) => t.channel_id === appStore.activeChannelId
      );
    });
    const bannerUrgent = computed(
      () => pendingForChannel.value.some(
        (t) => ["deadline-passed", "deadline-critical"].includes(deadlineClass(t.deadline))
      )
    );
    const channelHeader = computed(() => {
      if (appStore.activeDmStudentId) return null;
      return {
        name: appStore.activeChannelName,
        type: appStore.activeChannelType
      };
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$k, [
        unref(appStore).activeChannelId || unref(appStore).activeDmStudentId ? (openBlock(), createElementBlock("header", _hoisted_2$j, [
          createBaseVNode("div", _hoisted_3$h, [
            createBaseVNode("span", _hoisted_4$f, toDisplayString(unref(appStore).activeDmStudentId ? "@" : "#"), 1),
            createBaseVNode("span", _hoisted_5$e, toDisplayString(unref(appStore).activeChannelName), 1),
            channelHeader.value?.type === "annonce" ? (openBlock(), createElementBlock("span", _hoisted_6$d, " Annonce ")) : createCommentVNode("", true)
          ]),
          createBaseVNode("div", _hoisted_7$a, [
            createBaseVNode("div", {
              id: "search-wrapper",
              class: normalizeClass(["search-wrapper", { active: unref(messagesStore).searchTerm }])
            }, [
              withDirectives(createBaseVNode("input", {
                id: "search-input",
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => searchInput.value = $event),
                type: "text",
                class: "search-input",
                placeholder: "Rechercher…",
                onKeydown: withKeys(doSearch, ["enter"])
              }, null, 544), [
                [vModelText, searchInput.value]
              ]),
              createBaseVNode("span", _hoisted_8$9, toDisplayString(unref(messagesStore).searchTerm ? `${unref(messagesStore).messages.length} résultat${unref(messagesStore).messages.length > 1 ? "s" : ""}` : ""), 1),
              unref(messagesStore).searchTerm ? (openBlock(), createElementBlock("button", {
                key: 0,
                id: "btn-search-clear",
                class: "btn-icon",
                "aria-label": "Effacer la recherche",
                onClick: clearSearch
              }, [
                createVNode(unref(X), { size: 14 })
              ])) : createCommentVNode("", true),
              createBaseVNode("button", {
                id: "btn-search",
                class: "btn-icon",
                "aria-label": "Lancer la recherche",
                onClick: doSearch
              }, [
                createVNode(unref(Search), { size: 16 })
              ])
            ], 2),
            unref(appStore).isTeacher ? (openBlock(), createElementBlock("button", {
              key: 0,
              id: "btn-timeline",
              class: "btn-icon",
              title: "Timeline",
              "aria-label": "Ouvrir la timeline",
              onClick: _cache[1] || (_cache[1] = ($event) => unref(modals).timeline = true)
            }, [
              createVNode(unref(BookOpen), { size: 16 })
            ])) : createCommentVNode("", true)
          ])
        ])) : createCommentVNode("", true),
        unref(appStore).activeChannelId ? (openBlock(), createBlock(_sfc_main$m, { key: 1 })) : createCommentVNode("", true),
        pendingForChannel.value.length ? (openBlock(), createElementBlock("div", {
          key: 2,
          id: "channel-pending-banner",
          class: normalizeClass(["channel-pending-banner", { "channel-pending-urgent": bannerUrgent.value }])
        }, [
          createBaseVNode("span", null, [
            createVNode(unref(ClipboardList), {
              size: 14,
              style: { "margin-right": "6px", "vertical-align": "middle" }
            }),
            createTextVNode(" " + toDisplayString(pendingForChannel.value.length) + " travail" + toDisplayString(pendingForChannel.value.length > 1 ? "x" : "") + " à rendre dans ce canal" + toDisplayString(bannerUrgent.value ? " — " : "") + " ", 1),
            bannerUrgent.value ? (openBlock(), createElementBlock("strong", _hoisted_9$9, "urgent !")) : createCommentVNode("", true)
          ]),
          createBaseVNode("button", {
            class: "btn-primary",
            style: { "font-size": "11px", "padding": "3px 10px" },
            onClick: _cache[2] || (_cache[2] = ($event) => _ctx.$router.push("/travaux"))
          }, " Voir mes travaux ")
        ], 2)) : createCommentVNode("", true),
        unref(appStore).activeChannelId || unref(appStore).activeDmStudentId ? (openBlock(), createElementBlock("div", _hoisted_10$9, [
          createVNode(MessageList),
          createVNode(_sfc_main$n)
        ])) : (openBlock(), createElementBlock("div", _hoisted_11$9, [..._cache[3] || (_cache[3] = [
          createBaseVNode("p", null, "Sélectionnez un canal dans la barre latérale pour commencer.", -1)
        ])]))
      ]);
    };
  }
});
const _hoisted_1$j = { class: "travaux-area" };
const _hoisted_2$i = { class: "travaux-header" };
const _hoisted_3$g = { class: "travaux-header-title" };
const _hoisted_4$e = { class: "travaux-header-actions" };
const _hoisted_5$d = ["value"];
const _hoisted_6$c = { class: "travaux-view-toggle" };
const _hoisted_7$9 = { class: "travaux-content" };
const _hoisted_8$8 = {
  key: 0,
  class: "travaux-list"
};
const _hoisted_9$8 = {
  key: 1,
  class: "empty-hint"
};
const _hoisted_10$8 = {
  key: 2,
  class: "travaux-list"
};
const _hoisted_11$8 = { class: "travail-card-header" };
const _hoisted_12$7 = { class: "travail-card-meta" };
const _hoisted_13$6 = {
  key: 0,
  class: "tag-badge"
};
const _hoisted_14$6 = {
  key: 1,
  class: "travail-channel"
};
const _hoisted_15$6 = { class: "travail-card-title" };
const _hoisted_16$6 = {
  key: 0,
  class: "travail-card-desc"
};
const _hoisted_17$5 = {
  key: 1,
  class: "travail-submitted-info"
};
const _hoisted_18$4 = {
  key: 2,
  class: "deposit-form"
};
const _hoisted_19$4 = { class: "deposit-tabs" };
const _hoisted_20$4 = {
  key: 0,
  class: "deposit-file-row"
};
const _hoisted_21$3 = {
  key: 1,
  class: "deposit-link-row"
};
const _hoisted_22$3 = { class: "deposit-actions" };
const _hoisted_23$3 = ["disabled", "title", "onClick"];
const _hoisted_24$3 = {
  key: 3,
  class: "travail-card-footer"
};
const _hoisted_25$3 = { class: "travail-deadline-date" };
const _hoisted_26$3 = ["disabled", "title", "onClick"];
const _hoisted_27$3 = {
  key: 0,
  class: "empty-hint"
};
const _hoisted_28$2 = {
  key: 1,
  class: "empty-hint"
};
const _hoisted_29$2 = {
  key: 2,
  class: "gantt-wrapper"
};
const _hoisted_30$2 = { class: "gantt-chart" };
const _hoisted_31$1 = ["onClick"];
const _hoisted_32 = { class: "gantt-row-label" };
const _hoisted_33 = { class: "gantt-label-name" };
const _hoisted_34 = { class: "gantt-track" };
const _hoisted_35 = ["title"];
const _hoisted_36 = {
  key: 0,
  class: "travaux-list"
};
const _hoisted_37 = {
  key: 1,
  class: "empty-hint"
};
const _hoisted_38 = {
  key: 2,
  class: "travaux-list"
};
const _hoisted_39 = ["onClick"];
const _hoisted_40 = { class: "rendus-group-title" };
const _hoisted_41 = { class: "rendus-count-badge" };
const _hoisted_42 = { class: "rendus-list" };
const _hoisted_43 = { class: "rendu-info" };
const _hoisted_44 = { class: "rendu-student" };
const _hoisted_45 = { class: "rendu-file" };
const _hoisted_46 = {
  key: 0,
  class: "note-badge"
};
const _hoisted_47 = {
  key: 1,
  class: "rendu-no-note"
};
const _sfc_main$k = /* @__PURE__ */ defineComponent({
  __name: "TravauxView",
  setup(__props) {
    const appStore = useAppStore();
    const travauxStore = useTravauxStore();
    const modals = useModalsStore();
    const promoFilter = /* @__PURE__ */ ref(null);
    const promotions = /* @__PURE__ */ ref([]);
    const activePromoId = computed(() => promoFilter.value ?? appStore.activePromoId);
    const now = /* @__PURE__ */ ref(Date.now());
    let clockInterval = null;
    function isExpired(deadline) {
      return now.value >= new Date(deadline).getTime();
    }
    const depositingTravailId = /* @__PURE__ */ ref(null);
    const depositMode = /* @__PURE__ */ ref("file");
    const depositLink = /* @__PURE__ */ ref("");
    const depositFile = /* @__PURE__ */ ref(null);
    const depositFileName = /* @__PURE__ */ ref(null);
    const depositing = /* @__PURE__ */ ref(false);
    onMounted(async () => {
      clockInterval = setInterval(() => {
        now.value = Date.now();
      }, 3e4);
      const res = await window.api.getPromotions();
      promotions.value = res?.ok ? res.data : [];
      if (!promoFilter.value && promotions.value.length) {
        promoFilter.value = promotions.value[0].id;
      }
      await loadView();
    });
    onBeforeUnmount(() => {
      if (clockInterval !== null) clearInterval(clockInterval);
    });
    async function loadView() {
      if (appStore.isStudent) {
        await travauxStore.fetchStudentTravaux();
      } else {
        if (!activePromoId.value) return;
        if (travauxStore.view === "gantt") await travauxStore.fetchGantt(activePromoId.value);
        if (travauxStore.view === "rendus") await travauxStore.fetchRendus(activePromoId.value);
      }
    }
    watch(() => travauxStore.view, loadView);
    watch(promoFilter, loadView);
    function startDeposit(t) {
      depositingTravailId.value = t.id;
      depositMode.value = "file";
      depositLink.value = "";
      depositFile.value = null;
      depositFileName.value = null;
    }
    function cancelDeposit() {
      depositingTravailId.value = null;
    }
    async function pickFile() {
      const res = await window.api.openFileDialog();
      if (res?.ok && res.data) {
        depositFile.value = res.data;
        depositFileName.value = res.data.split(/[\\/]/).pop() ?? res.data;
      }
    }
    async function submitDeposit(travail) {
      if (depositing.value) return;
      if (!appStore.currentUser) return;
      if (depositMode.value === "file" && !depositFile.value) return;
      if (depositMode.value === "link" && !depositLink.value.trim()) return;
      if (isExpired(travail.deadline)) return;
      depositing.value = true;
      try {
        const ok = await travauxStore.addDepot({
          travail_id: travail.id,
          student_id: appStore.currentUser.id,
          type: depositMode.value,
          content: depositMode.value === "file" ? depositFile.value : depositLink.value.trim(),
          file_name: depositMode.value === "file" ? depositFileName.value : null
        });
        if (ok) {
          cancelDeposit();
          await travauxStore.fetchStudentTravaux();
        }
      } finally {
        depositing.value = false;
      }
    }
    async function openTravail(travailId) {
      appStore.currentTravailId = travailId;
      await travauxStore.openTravail(travailId);
      modals.gestionDevoir = true;
    }
    const ganttItems = computed(() => {
      const items = travauxStore.ganttData;
      if (!items.length) return [];
      const dates = items.flatMap((t) => [
        t.start_date ? new Date(t.start_date).getTime() : new Date(t.deadline).getTime() - 7 * 864e5,
        new Date(t.deadline).getTime()
      ]);
      const minT = Math.min(...dates);
      const maxT = Math.max(...dates);
      const span = maxT - minT || 1;
      return items.map((t) => {
        const startMs = t.start_date ? new Date(t.start_date).getTime() : new Date(t.deadline).getTime() - 7 * 864e5;
        const endMs = new Date(t.deadline).getTime();
        const left = (startMs - minT) / span * 100;
        const width = Math.max((endMs - startMs) / span * 100, 2);
        return { ...t, left, width, dlClass: deadlineClass(t.deadline) };
      });
    });
    const rendusByTravail = computed(() => {
      const map = /* @__PURE__ */ new Map();
      for (const r of travauxStore.allRendus) {
        if (!map.has(r.travail_id)) {
          map.set(r.travail_id, { travail: { id: r.travail_id }, rendus: [] });
        }
        map.get(r.travail_id).rendus.push(r);
      }
      return [...map.values()];
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$j, [
        createBaseVNode("header", _hoisted_2$i, [
          createBaseVNode("div", _hoisted_3$g, [
            createVNode(unref(ChartNoAxesColumn), { size: 18 }),
            _cache[7] || (_cache[7] = createBaseVNode("span", null, "Travaux", -1))
          ]),
          createBaseVNode("div", _hoisted_4$e, [
            unref(appStore).isTeacher && promotions.value.length ? withDirectives((openBlock(), createElementBlock("select", {
              key: 0,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => promoFilter.value = $event),
              class: "form-select",
              style: { "font-size": "13px", "padding": "5px 8px", "width": "auto" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(promotions.value, (p2) => {
                return openBlock(), createElementBlock("option", {
                  key: p2.id,
                  value: p2.id
                }, toDisplayString(p2.name), 9, _hoisted_5$d);
              }), 128))
            ], 512)), [
              [vModelSelect, promoFilter.value]
            ]) : createCommentVNode("", true),
            unref(appStore).isTeacher ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              createBaseVNode("div", _hoisted_6$c, [
                createBaseVNode("button", {
                  class: normalizeClass(["view-toggle-btn", { active: unref(travauxStore).view === "gantt" }]),
                  onClick: _cache[1] || (_cache[1] = ($event) => unref(travauxStore).setView("gantt"))
                }, [
                  createVNode(unref(ChartNoAxesColumn), { size: 13 }),
                  _cache[8] || (_cache[8] = createTextVNode(" Gantt ", -1))
                ], 2),
                createBaseVNode("button", {
                  class: normalizeClass(["view-toggle-btn", { active: unref(travauxStore).view === "rendus" }]),
                  onClick: _cache[2] || (_cache[2] = ($event) => unref(travauxStore).setView("rendus"))
                }, [
                  createVNode(unref(List), { size: 13 }),
                  _cache[9] || (_cache[9] = createTextVNode(" Rendus ", -1))
                ], 2)
              ]),
              createBaseVNode("button", {
                class: "btn-primary",
                style: { "font-size": "13px", "padding": "6px 12px" },
                onClick: _cache[3] || (_cache[3] = ($event) => unref(modals).newTravail = true)
              }, [
                createVNode(unref(Plus), { size: 14 }),
                _cache[10] || (_cache[10] = createTextVNode(" Nouveau ", -1))
              ])
            ], 64)) : createCommentVNode("", true)
          ])
        ]),
        createBaseVNode("div", _hoisted_7$9, [
          unref(appStore).isStudent ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
            unref(travauxStore).loading ? (openBlock(), createElementBlock("div", _hoisted_8$8, [
              (openBlock(), createElementBlock(Fragment, null, renderList(3, (i) => {
                return createBaseVNode("div", {
                  key: i,
                  class: "skel-travail-card"
                }, [..._cache[11] || (_cache[11] = [
                  createBaseVNode("div", {
                    class: "skel skel-line skel-w50",
                    style: { "height": "16px" }
                  }, null, -1),
                  createBaseVNode("div", {
                    class: "skel skel-line skel-w90",
                    style: { "height": "12px", "margin-top": "8px" }
                  }, null, -1),
                  createBaseVNode("div", {
                    class: "skel skel-line skel-w30",
                    style: { "height": "10px", "margin-top": "6px" }
                  }, null, -1)
                ])]);
              }), 64))
            ])) : unref(travauxStore).travaux.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_9$8, [
              createVNode(unref(CircleCheck), {
                size: 40,
                style: { "opacity": ".3", "margin-bottom": "12px" }
              }),
              _cache[12] || (_cache[12] = createBaseVNode("h3", null, "Aucun travail assigné", -1)),
              _cache[13] || (_cache[13] = createBaseVNode("p", null, "Vos travaux apparaîtront ici dès qu'un enseignant en créera.", -1))
            ])) : (openBlock(), createElementBlock("div", _hoisted_10$8, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(travauxStore).travaux, (t) => {
                return openBlock(), createElementBlock("div", {
                  key: t.id,
                  class: normalizeClass(["travail-student-card", { submitted: t.depot_id != null }])
                }, [
                  createBaseVNode("div", _hoisted_11$8, [
                    createBaseVNode("div", _hoisted_12$7, [
                      createBaseVNode("span", {
                        class: normalizeClass(["travail-type-badge", `type-${t.type}`])
                      }, toDisplayString(t.type), 3),
                      t.category ? (openBlock(), createElementBlock("span", _hoisted_13$6, toDisplayString(t.category), 1)) : createCommentVNode("", true),
                      t.channel_name ? (openBlock(), createElementBlock("span", _hoisted_14$6, "# " + toDisplayString(t.channel_name), 1)) : createCommentVNode("", true)
                    ]),
                    createBaseVNode("span", {
                      class: normalizeClass(["deadline-badge", unref(deadlineClass)(t.deadline)])
                    }, [
                      createVNode(unref(Clock), {
                        size: 10,
                        style: { "vertical-align": "middle", "margin-right": "3px" }
                      }),
                      createTextVNode(" " + toDisplayString(unref(deadlineLabel)(t.deadline)), 1)
                    ], 2)
                  ]),
                  createBaseVNode("h3", _hoisted_15$6, toDisplayString(t.title), 1),
                  t.description ? (openBlock(), createElementBlock("p", _hoisted_16$6, toDisplayString(t.description), 1)) : createCommentVNode("", true),
                  t.depot_id != null ? (openBlock(), createElementBlock("div", _hoisted_17$5, [
                    createVNode(unref(CircleCheck), {
                      size: 14,
                      style: { "color": "var(--color-success)" }
                    }),
                    _cache[14] || (_cache[14] = createBaseVNode("span", null, "Rendu déposé", -1))
                  ])) : depositingTravailId.value === t.id ? (openBlock(), createElementBlock("div", _hoisted_18$4, [
                    createBaseVNode("div", _hoisted_19$4, [
                      createBaseVNode("button", {
                        class: normalizeClass(["deposit-tab", { active: depositMode.value === "file" }]),
                        onClick: _cache[4] || (_cache[4] = ($event) => depositMode.value = "file")
                      }, [
                        createVNode(unref(FileText), { size: 12 }),
                        _cache[15] || (_cache[15] = createTextVNode(" Fichier ", -1))
                      ], 2),
                      createBaseVNode("button", {
                        class: normalizeClass(["deposit-tab", { active: depositMode.value === "link" }]),
                        onClick: _cache[5] || (_cache[5] = ($event) => depositMode.value = "link")
                      }, [
                        createVNode(unref(Link2), { size: 12 }),
                        _cache[16] || (_cache[16] = createTextVNode(" Lien ", -1))
                      ], 2)
                    ]),
                    depositMode.value === "file" ? (openBlock(), createElementBlock("div", _hoisted_20$4, [
                      createBaseVNode("button", {
                        class: "btn-ghost",
                        style: { "font-size": "12px", "flex": "1" },
                        onClick: pickFile
                      }, [
                        createVNode(unref(Upload), { size: 13 }),
                        createTextVNode(" " + toDisplayString(depositFileName.value ?? "Choisir un fichier…"), 1)
                      ])
                    ])) : (openBlock(), createElementBlock("div", _hoisted_21$3, [
                      withDirectives(createBaseVNode("input", {
                        "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => depositLink.value = $event),
                        class: "form-input",
                        placeholder: "https://…",
                        type: "url"
                      }, null, 512), [
                        [vModelText, depositLink.value]
                      ])
                    ])),
                    createBaseVNode("div", _hoisted_22$3, [
                      createBaseVNode("button", {
                        class: "btn-ghost",
                        style: { "font-size": "12px" },
                        onClick: cancelDeposit
                      }, [
                        createVNode(unref(X), { size: 12 }),
                        _cache[17] || (_cache[17] = createTextVNode(" Annuler ", -1))
                      ]),
                      createBaseVNode("button", {
                        class: "btn-primary",
                        style: { "font-size": "12px" },
                        disabled: depositing.value || isExpired(t.deadline) || (depositMode.value === "file" ? !depositFile.value : !depositLink.value.trim()),
                        title: isExpired(t.deadline) ? "Délai de soumission expiré" : void 0,
                        onClick: ($event) => submitDeposit(t)
                      }, [
                        createVNode(unref(Upload), { size: 12 }),
                        createTextVNode(" " + toDisplayString(depositing.value ? "Dépôt…" : isExpired(t.deadline) ? "Délai expiré" : "Déposer"), 1)
                      ], 8, _hoisted_23$3)
                    ])
                  ])) : (openBlock(), createElementBlock("div", _hoisted_24$3, [
                    createBaseVNode("span", _hoisted_25$3, "Échéance : " + toDisplayString(unref(formatDate)(t.deadline)), 1),
                    createBaseVNode("button", {
                      class: "btn-primary",
                      style: { "font-size": "12px", "padding": "5px 12px" },
                      disabled: isExpired(t.deadline),
                      title: isExpired(t.deadline) ? "Délai de soumission expiré" : "Déposer un travail",
                      onClick: ($event) => startDeposit(t)
                    }, [
                      isExpired(t.deadline) ? (openBlock(), createBlock(unref(Lock), {
                        key: 0,
                        size: 12
                      })) : (openBlock(), createBlock(unref(Upload), {
                        key: 1,
                        size: 12
                      })),
                      createTextVNode(" " + toDisplayString(isExpired(t.deadline) ? "Délai expiré" : "Déposer"), 1)
                    ], 8, _hoisted_26$3)
                  ]))
                ], 2);
              }), 128))
            ]))
          ], 64)) : unref(travauxStore).view === "gantt" ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
            unref(travauxStore).loading ? (openBlock(), createElementBlock("div", _hoisted_27$3, [..._cache[18] || (_cache[18] = [
              createBaseVNode("div", {
                class: "skel skel-line skel-w70",
                style: { "height": "14px", "margin": "0 auto 8px" }
              }, null, -1),
              createBaseVNode("div", {
                class: "skel skel-line skel-w90",
                style: { "height": "14px", "margin": "0 auto 8px" }
              }, null, -1),
              createBaseVNode("div", {
                class: "skel skel-line skel-w50",
                style: { "height": "14px", "margin": "0 auto" }
              }, null, -1)
            ])])) : ganttItems.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_28$2, [..._cache[19] || (_cache[19] = [
              createBaseVNode("h3", null, "Aucun travail créé", -1),
              createBaseVNode("p", null, "Créez un premier travail pour visualiser le Gantt.", -1)
            ])])) : (openBlock(), createElementBlock("div", _hoisted_29$2, [
              _cache[20] || (_cache[20] = createBaseVNode("div", { class: "gantt-legend" }, [
                createBaseVNode("span", { class: "gantt-legend-item type-devoir" }, "Devoir"),
                createBaseVNode("span", { class: "gantt-legend-item type-projet" }, "Projet"),
                createBaseVNode("span", { class: "gantt-legend-item type-jalon" }, "Jalon")
              ], -1)),
              createBaseVNode("div", _hoisted_30$2, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(ganttItems.value, (item) => {
                  return openBlock(), createElementBlock("div", {
                    key: item.id,
                    class: "gantt-row",
                    onClick: ($event) => openTravail(item.id)
                  }, [
                    createBaseVNode("div", _hoisted_32, [
                      createBaseVNode("span", _hoisted_33, toDisplayString(item.title), 1),
                      createBaseVNode("span", {
                        class: normalizeClass(["deadline-badge", item.dlClass]),
                        style: { "font-size": "10px" }
                      }, toDisplayString(unref(formatDate)(item.deadline)), 3)
                    ]),
                    createBaseVNode("div", _hoisted_34, [
                      createBaseVNode("div", {
                        class: normalizeClass(["gantt-bar", `type-${item.type}`]),
                        style: normalizeStyle({ left: item.left + "%", width: item.width + "%" }),
                        title: item.title
                      }, null, 14, _hoisted_35)
                    ])
                  ], 8, _hoisted_31$1);
                }), 128))
              ])
            ]))
          ], 64)) : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
            unref(travauxStore).loading ? (openBlock(), createElementBlock("div", _hoisted_36, [
              (openBlock(), createElementBlock(Fragment, null, renderList(3, (i) => {
                return createBaseVNode("div", {
                  key: i,
                  class: "skel-travail-card"
                }, [..._cache[21] || (_cache[21] = [
                  createBaseVNode("div", {
                    class: "skel skel-line skel-w50",
                    style: { "height": "16px" }
                  }, null, -1),
                  createBaseVNode("div", {
                    class: "skel skel-line skel-w30",
                    style: { "height": "12px", "margin-top": "8px" }
                  }, null, -1)
                ])]);
              }), 64))
            ])) : rendusByTravail.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_37, [..._cache[22] || (_cache[22] = [
              createBaseVNode("h3", null, "Aucun rendu pour cette promotion", -1),
              createBaseVNode("p", null, "Les rendus des étudiants apparaîtront ici.", -1)
            ])])) : (openBlock(), createElementBlock("div", _hoisted_38, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(rendusByTravail.value, (group) => {
                return openBlock(), createElementBlock("div", {
                  key: group.travail.id,
                  class: "rendus-group"
                }, [
                  createBaseVNode("div", {
                    class: "rendus-group-header",
                    onClick: ($event) => openTravail(group.travail.id)
                  }, [
                    createBaseVNode("span", _hoisted_40, "Travail #" + toDisplayString(group.travail.id), 1),
                    createBaseVNode("span", _hoisted_41, toDisplayString(group.rendus.length) + " rendu" + toDisplayString(group.rendus.length > 1 ? "s" : ""), 1)
                  ], 8, _hoisted_39),
                  createBaseVNode("div", _hoisted_42, [
                    (openBlock(true), createElementBlock(Fragment, null, renderList(group.rendus, (r) => {
                      return openBlock(), createElementBlock("div", {
                        key: r.id,
                        class: "rendu-row"
                      }, [
                        createBaseVNode("div", {
                          class: "avatar",
                          style: normalizeStyle({ background: unref(avatarColor)(r.student_name), width: "28px", height: "28px", fontSize: "10px" })
                        }, toDisplayString(unref(initials)(r.student_name)), 5),
                        createBaseVNode("div", _hoisted_43, [
                          createBaseVNode("span", _hoisted_44, toDisplayString(r.student_name), 1),
                          createBaseVNode("span", _hoisted_45, toDisplayString(r.type === "file" ? r.file_name ?? r.content : r.content), 1)
                        ]),
                        r.note ? (openBlock(), createElementBlock("span", _hoisted_46, toDisplayString(r.note), 1)) : (openBlock(), createElementBlock("span", _hoisted_47, "Non noté"))
                      ]);
                    }), 128))
                  ])
                ]);
              }), 128))
            ]))
          ], 64))
        ])
      ]);
    };
  }
});
const TravauxView = /* @__PURE__ */ _export_sfc(_sfc_main$k, [["__scopeId", "data-v-7e20499b"]]);
const useDocumentsStore = /* @__PURE__ */ defineStore("documents", () => {
  const appStore = useAppStore();
  const documents = /* @__PURE__ */ ref([]);
  const categories = /* @__PURE__ */ ref([]);
  const loading = /* @__PURE__ */ ref(false);
  const searchQuery = /* @__PURE__ */ ref("");
  const activeCategory = /* @__PURE__ */ ref("");
  const previewDoc = /* @__PURE__ */ ref(null);
  async function fetchDocuments(channelId, promoId) {
    loading.value = true;
    try {
      let res;
      if (channelId) {
        res = await window.api.getChannelDocuments(channelId);
      } else if (promoId) {
        res = await window.api.getPromoDocuments(promoId);
      } else {
        documents.value = [];
        return;
      }
      documents.value = res?.ok ? res.data : [];
    } finally {
      loading.value = false;
    }
  }
  async function fetchCategories(channelId) {
    const res = await window.api.getChannelDocumentCategories(channelId);
    categories.value = res?.ok ? res.data : [];
  }
  async function addDocument(payload) {
    const res = await window.api.addChannelDocument(payload);
    if (res?.ok && appStore.activeChannelId) {
      await fetchDocuments(appStore.activeChannelId);
    }
    return res?.ok ?? false;
  }
  async function deleteDocument(id) {
    const res = await window.api.deleteChannelDocument(id);
    if (res?.ok && appStore.activeChannelId) {
      await fetchDocuments(appStore.activeChannelId);
    }
  }
  function openPreview(doc2) {
    previewDoc.value = doc2;
  }
  function closePreview() {
    previewDoc.value = null;
  }
  return {
    documents,
    categories,
    loading,
    searchQuery,
    activeCategory,
    previewDoc,
    fetchDocuments,
    fetchCategories,
    addDocument,
    deleteDocument,
    openPreview,
    closePreview
  };
});
const _hoisted_1$i = {
  id: "documents-area",
  class: "documents-area"
};
const _hoisted_2$h = { class: "documents-area-header" };
const _hoisted_3$f = { class: "documents-area-title" };
const _hoisted_4$d = { style: { "display": "flex", "gap": "8px", "align-items": "center" } };
const _hoisted_5$c = ["value"];
const _hoisted_6$b = ["value"];
const _hoisted_7$8 = {
  class: "documents-main-content",
  id: "documents-main-content"
};
const _hoisted_8$7 = {
  key: 1,
  class: "documents-table",
  style: { "width": "100%", "border-collapse": "collapse" }
};
const _hoisted_9$7 = ["onClick"];
const _hoisted_10$7 = { style: { "padding": "8px 12px" } };
const _hoisted_11$7 = { style: { "padding": "8px 12px", "font-size": "12px", "color": "var(--text-muted)" } };
const _hoisted_12$6 = { style: { "padding": "8px 12px", "font-size": "12px", "color": "var(--text-muted)" } };
const _hoisted_13$5 = { style: { "padding": "8px 12px", "text-align": "right" } };
const _hoisted_14$5 = ["onClick"];
const _hoisted_15$5 = ["onClick"];
const _hoisted_16$5 = ["onClick"];
const _hoisted_17$4 = {
  key: 2,
  class: "empty-state"
};
const _sfc_main$j = /* @__PURE__ */ defineComponent({
  __name: "DocumentsView",
  setup(__props) {
    const api = window.api;
    const appStore = useAppStore();
    const docStore = useDocumentsStore();
    const modals = useModalsStore();
    const promotions = /* @__PURE__ */ ref([]);
    const promoFilter = /* @__PURE__ */ ref(null);
    const channelFilter = /* @__PURE__ */ ref(null);
    const channelsList = /* @__PURE__ */ ref([]);
    onMounted(async () => {
      const res = await api.getPromotions();
      promotions.value = res?.ok ? res.data : [];
      if (!promoFilter.value && promotions.value.length) {
        promoFilter.value = promotions.value[0].id;
        await loadChannels();
      }
    });
    async function loadChannels() {
      if (!promoFilter.value) return;
      const res = await api.getChannels(promoFilter.value);
      channelsList.value = res?.ok ? res.data : [];
      await loadDocuments();
    }
    async function loadDocuments() {
      if (channelFilter.value) {
        await docStore.fetchDocuments(channelFilter.value);
      } else if (promoFilter.value) {
        await docStore.fetchDocuments(void 0, promoFilter.value);
      }
    }
    watch(promoFilter, loadChannels);
    watch(channelFilter, loadDocuments);
    const filtered = computed(() => {
      const q = docStore.searchQuery.trim().toLowerCase();
      return docStore.documents.filter((d) => {
        if (q && !d.name.toLowerCase().includes(q)) return false;
        if (docStore.activeCategory && d.category !== docStore.activeCategory) return false;
        return true;
      });
    });
    async function openDoc(doc2) {
      if (doc2.type === "link") {
        await api.openExternal(doc2.content);
      } else {
        const res = await api.readFileBase64(doc2.content);
        if (res?.ok && res.data) {
          docStore.openPreview(doc2);
          modals.documentPreview = true;
        }
      }
    }
    async function deleteDoc(id) {
      if (!confirm("Supprimer ce document ?")) return;
      await docStore.deleteDocument(id);
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$i, [
        createBaseVNode("header", _hoisted_2$h, [
          createBaseVNode("div", _hoisted_3$f, [
            createVNode(unref(FileText), { size: 18 }),
            _cache[4] || (_cache[4] = createBaseVNode("span", { id: "documents-area-channel-name" }, "Documents", -1))
          ]),
          createBaseVNode("div", _hoisted_4$d, [
            promotions.value.length ? withDirectives((openBlock(), createElementBlock("select", {
              key: 0,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => promoFilter.value = $event),
              class: "form-select",
              style: { "font-size": "12px", "padding": "4px 8px", "width": "auto" }
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(promotions.value, (p2) => {
                return openBlock(), createElementBlock("option", {
                  key: p2.id,
                  value: p2.id
                }, toDisplayString(p2.name), 9, _hoisted_5$c);
              }), 128))
            ], 512)), [
              [vModelSelect, promoFilter.value]
            ]) : createCommentVNode("", true),
            channelsList.value.length ? withDirectives((openBlock(), createElementBlock("select", {
              key: 1,
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => channelFilter.value = $event),
              class: "form-select",
              style: { "font-size": "12px", "padding": "4px 8px", "width": "auto" }
            }, [
              _cache[5] || (_cache[5] = createBaseVNode("option", { value: null }, "Tous les canaux", -1)),
              (openBlock(true), createElementBlock(Fragment, null, renderList(channelsList.value, (c) => {
                return openBlock(), createElementBlock("option", {
                  key: c.id,
                  value: c.id
                }, toDisplayString(c.name), 9, _hoisted_6$b);
              }), 128))
            ], 512)), [
              [vModelSelect, channelFilter.value]
            ]) : createCommentVNode("", true),
            withDirectives(createBaseVNode("input", {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => unref(docStore).searchQuery = $event),
              type: "text",
              class: "form-input",
              placeholder: "Rechercher…",
              style: { "font-size": "12px", "padding": "4px 8px", "width": "160px" }
            }, null, 512), [
              [vModelText, unref(docStore).searchQuery]
            ])
          ]),
          unref(appStore).isTeacher ? (openBlock(), createElementBlock("button", {
            key: 0,
            id: "btn-add-doc",
            class: "btn-primary",
            style: { "font-size": "12px" },
            onClick: _cache[3] || (_cache[3] = ($event) => {
              unref(modals).documentPreview = false;
              unref(modals).newTravail = false;
            })
          }, [
            createVNode(unref(Plus), { size: 14 }),
            _cache[6] || (_cache[6] = createTextVNode(" Ajouter ", -1))
          ])) : createCommentVNode("", true)
        ]),
        createBaseVNode("div", _hoisted_7$8, [
          unref(docStore).loading ? (openBlock(), createElementBlock(Fragment, { key: 0 }, renderList(6, (i) => {
            return createBaseVNode("div", {
              key: i,
              class: "skel-list-row",
              style: { "padding": "10px 16px" }
            }, [..._cache[7] || (_cache[7] = [
              createBaseVNode("div", { class: "skel skel-line skel-w70" }, null, -1)
            ])]);
          }), 64)) : filtered.value.length ? (openBlock(), createElementBlock("table", _hoisted_8$7, [
            _cache[8] || (_cache[8] = createBaseVNode("thead", null, [
              createBaseVNode("tr", { style: { "font-size": "11px", "color": "var(--text-muted)", "border-bottom": "1px solid var(--border)" } }, [
                createBaseVNode("th", { style: { "text-align": "left", "padding": "8px 12px" } }, "Nom"),
                createBaseVNode("th", { style: { "text-align": "left", "padding": "8px 12px" } }, "Catégorie"),
                createBaseVNode("th", { style: { "text-align": "left", "padding": "8px 12px" } }, "Date"),
                createBaseVNode("th", { style: { "width": "80px" } })
              ])
            ], -1)),
            createBaseVNode("tbody", null, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(filtered.value, (doc2) => {
                return openBlock(), createElementBlock("tr", {
                  key: doc2.id,
                  class: "doc-row",
                  style: { "border-bottom": "1px solid var(--border)", "cursor": "pointer" },
                  onClick: ($event) => openDoc(doc2)
                }, [
                  createBaseVNode("td", _hoisted_10$7, [
                    createVNode(unref(FileText), {
                      size: 14,
                      style: { "margin-right": "6px", "color": "var(--accent)" }
                    }),
                    createTextVNode(" " + toDisplayString(doc2.name), 1)
                  ]),
                  createBaseVNode("td", _hoisted_11$7, toDisplayString(doc2.category ?? "—"), 1),
                  createBaseVNode("td", _hoisted_12$6, toDisplayString(unref(formatDate)(doc2.created_at)), 1),
                  createBaseVNode("td", _hoisted_13$5, [
                    doc2.type === "link" ? (openBlock(), createElementBlock("button", {
                      key: 0,
                      class: "btn-icon",
                      title: "Ouvrir le lien",
                      onClick: withModifiers(($event) => unref(api).openExternal(doc2.content), ["stop"])
                    }, [
                      createVNode(unref(ExternalLink), { size: 14 })
                    ], 8, _hoisted_14$5)) : (openBlock(), createElementBlock("button", {
                      key: 1,
                      class: "btn-icon",
                      title: "Télécharger",
                      onClick: withModifiers(($event) => unref(api).downloadFile(doc2.content), ["stop"])
                    }, [
                      createVNode(unref(Download), { size: 14 })
                    ], 8, _hoisted_15$5)),
                    unref(appStore).isTeacher ? (openBlock(), createElementBlock("button", {
                      key: 2,
                      class: "btn-icon",
                      title: "Supprimer",
                      onClick: withModifiers(($event) => deleteDoc(doc2.id), ["stop"])
                    }, [
                      createVNode(unref(Trash2), { size: 14 })
                    ], 8, _hoisted_16$5)) : createCommentVNode("", true)
                  ])
                ], 8, _hoisted_9$7);
              }), 128))
            ])
          ])) : (openBlock(), createElementBlock("div", _hoisted_17$4, [..._cache[9] || (_cache[9] = [
            createBaseVNode("p", null, "Aucun document dans ce canal.", -1)
          ])]))
        ])
      ]);
    };
  }
});
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/messages" },
    { path: "/messages", component: _sfc_main$l, name: "messages" },
    { path: "/travaux", component: TravauxView, name: "travaux" },
    { path: "/documents", component: _sfc_main$j, name: "documents" }
  ]
});
const _hoisted_1$h = { class: "toast-msg" };
const _sfc_main$i = /* @__PURE__ */ defineComponent({
  __name: "Toast",
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Teleport, { to: "body" }, [
        createVNode(Transition, { name: "toast" }, {
          default: withCtx(() => [
            unref(toastState).visible ? (openBlock(), createElementBlock("div", {
              key: 0,
              id: "app-toast",
              class: normalizeClass(`toast-${unref(toastState).type}`)
            }, [
              createBaseVNode("span", _hoisted_1$h, toDisplayString(unref(toastState).message), 1),
              unref(toastState).type === "undo" && unref(toastState).onUndo ? (openBlock(), createElementBlock("button", {
                key: 0,
                class: "toast-undo-btn",
                onClick: _cache[0] || (_cache[0] = ($event) => unref(toastState).onUndo?.())
              }, " Annuler ")) : createCommentVNode("", true)
            ], 2)) : createCommentVNode("", true)
          ]),
          _: 1
        })
      ]);
    };
  }
});
const Toast = /* @__PURE__ */ _export_sfc(_sfc_main$i, [["__scopeId", "data-v-e0afbc14"]]);
const _hoisted_1$g = {
  class: "nav-rail",
  "aria-label": "Navigation principale"
};
const _hoisted_2$g = {
  key: 0,
  id: "nav-badge-travaux",
  class: "nav-badge"
};
const _hoisted_3$e = ["title"];
const _hoisted_4$c = ["src", "alt"];
const _hoisted_5$b = { key: 1 };
const _sfc_main$h = /* @__PURE__ */ defineComponent({
  __name: "NavRail",
  setup(__props) {
    const appStore = useAppStore();
    const modals = useModalsStore();
    const travauxStore = useTravauxStore();
    const router2 = useRouter();
    const route = useRoute();
    const user = computed(() => appStore.currentUser);
    const avatarStyle = computed(() => {
      if (!user.value) return {};
      return user.value.type === "teacher" ? { background: "var(--accent)" } : { background: avatarColor(user.value.name) };
    });
    const pendingCount = computed(() => travauxStore.pendingTravaux.length);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("nav", _hoisted_1$g, [
        _cache[5] || (_cache[5] = createBaseVNode("div", { class: "nav-logo" }, [
          createBaseVNode("div", {
            class: "logo-mark",
            style: { "font-size": "10px", "width": "32px", "height": "32px", "letter-spacing": "-0.5px" }
          }, "CeS")
        ], -1)),
        createBaseVNode("button", {
          class: normalizeClass(["nav-btn", { active: unref(route).name === "messages" }]),
          title: "Messages",
          "aria-label": "Section Messages",
          onClick: _cache[0] || (_cache[0] = ($event) => unref(router2).push("/messages"))
        }, [
          createVNode(unref(MessageSquare), { size: 20 })
        ], 2),
        createBaseVNode("button", {
          class: normalizeClass(["nav-btn", { active: unref(route).name === "travaux" }]),
          title: "Travaux",
          "aria-label": "Section Travaux",
          style: { "position": "relative" },
          onClick: _cache[1] || (_cache[1] = ($event) => unref(router2).push("/travaux"))
        }, [
          createVNode(unref(BookOpen), { size: 20 }),
          unref(appStore).isStudent && pendingCount.value > 0 ? (openBlock(), createElementBlock("span", _hoisted_2$g, toDisplayString(pendingCount.value > 9 ? "9+" : pendingCount.value), 1)) : createCommentVNode("", true)
        ], 2),
        createBaseVNode("button", {
          class: normalizeClass(["nav-btn", { active: unref(route).name === "documents" }]),
          title: "Documents",
          "aria-label": "Section Documents",
          onClick: _cache[2] || (_cache[2] = ($event) => unref(router2).push("/documents"))
        }, [
          createVNode(unref(FileText), { size: 20 })
        ], 2),
        _cache[6] || (_cache[6] = createBaseVNode("div", { style: { "flex": "1" } }, null, -1)),
        unref(appStore).isTeacher ? (openBlock(), createElementBlock("button", {
          key: 0,
          class: "nav-btn",
          title: "Échéancier",
          "aria-label": "Ouvrir l'échéancier",
          onClick: _cache[3] || (_cache[3] = ($event) => unref(modals).echeancier = true)
        }, [
          createVNode(unref(Calendar), { size: 20 })
        ])) : createCommentVNode("", true),
        createBaseVNode("button", {
          id: "nav-user-avatar",
          class: "nav-btn nav-avatar",
          style: normalizeStyle(avatarStyle.value),
          title: user.value?.name,
          "aria-label": "Paramètres du compte",
          onClick: _cache[4] || (_cache[4] = ($event) => unref(modals).settings = true)
        }, [
          user.value?.photo_data ? (openBlock(), createElementBlock("img", {
            key: 0,
            src: user.value.photo_data,
            alt: user.value.name
          }, null, 8, _hoisted_4$c)) : (openBlock(), createElementBlock("span", _hoisted_5$b, toDisplayString(user.value?.avatar_initials), 1))
        ], 12, _hoisted_3$e)
      ]);
    };
  }
});
const NavRail = /* @__PURE__ */ _export_sfc(_sfc_main$h, [["__scopeId", "data-v-ba56c692"]]);
const _hoisted_1$f = {
  id: "nav-promo-list",
  class: "nav-promo-list",
  "aria-label": "Promotions"
};
const _hoisted_2$f = ["title", "onClick"];
const _sfc_main$g = /* @__PURE__ */ defineComponent({
  __name: "PromoRail",
  props: {
    promotions: {}
  },
  emits: ["select"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const appStore = useAppStore();
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("ul", _hoisted_1$f, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(props.promotions, (p2) => {
          return openBlock(), createElementBlock("li", {
            key: p2.id
          }, [
            createBaseVNode("button", {
              class: normalizeClass(["nav-promo-btn", { active: unref(appStore).activePromoId === p2.id }]),
              title: p2.name,
              style: normalizeStyle({ "--promo-color": p2.color }),
              onClick: ($event) => emit2("select", p2.id)
            }, toDisplayString(p2.name), 15, _hoisted_2$f)
          ]);
        }), 128))
      ]);
    };
  }
});
const _hoisted_1$e = { class: "channel-prefix" };
const _hoisted_2$e = { class: "channel-name" };
const _hoisted_3$d = {
  key: 0,
  class: "unread-badge"
};
const _sfc_main$f = /* @__PURE__ */ defineComponent({
  __name: "ChannelItem",
  props: {
    channelId: {},
    name: {},
    prefix: { default: "#" },
    type: { default: "chat" }
  },
  emits: ["click"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const appStore = useAppStore();
    const isActive = computed(() => appStore.activeChannelId === props.channelId);
    const unread = computed(() => appStore.unread[props.channelId] ?? 0);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("button", {
        class: normalizeClass(["sidebar-item", { active: isActive.value, "has-unread": unread.value > 0 }]),
        onClick: _cache[0] || (_cache[0] = ($event) => emit2("click"))
      }, [
        createBaseVNode("span", _hoisted_1$e, toDisplayString(__props.prefix), 1),
        createBaseVNode("span", _hoisted_2$e, toDisplayString(__props.name), 1),
        unread.value > 0 ? (openBlock(), createElementBlock("span", _hoisted_3$d, toDisplayString(unread.value > 9 ? "9+" : unread.value), 1)) : createCommentVNode("", true)
      ], 2);
    };
  }
});
const _hoisted_1$d = {
  id: "sidebar",
  class: "sidebar"
};
const _hoisted_2$d = {
  id: "sidebar-header",
  class: "sidebar-header"
};
const _hoisted_3$c = {
  key: 0,
  id: "teacher-badge",
  class: "teacher-badge"
};
const _hoisted_4$b = { class: "sidebar-user-info" };
const _hoisted_5$a = { class: "sidebar-user-name" };
const _hoisted_6$a = { class: "sidebar-user-role" };
const _hoisted_7$7 = { id: "sidebar-section-messages" };
const _hoisted_8$6 = {
  id: "sidebar-channels-header",
  class: "sidebar-section-header"
};
const _hoisted_9$6 = {
  id: "sidebar-nav",
  "aria-label": "Canaux"
};
const _hoisted_10$6 = { "aria-label": "Messages directs" };
const _hoisted_11$6 = ["onClick"];
const _hoisted_12$5 = { class: "channel-name" };
const _sfc_main$e = /* @__PURE__ */ defineComponent({
  __name: "Sidebar",
  setup(__props) {
    const appStore = useAppStore();
    const modals = useModalsStore();
    const messagesStore = useMessagesStore();
    const travauxStore = useTravauxStore();
    const route = useRoute();
    const promotions = /* @__PURE__ */ ref([]);
    const channels = /* @__PURE__ */ ref([]);
    const students = /* @__PURE__ */ ref([]);
    const loading = /* @__PURE__ */ ref(false);
    const user = computed(() => appStore.currentUser);
    async function loadTeacherSidebar() {
      loading.value = true;
      try {
        const [promRes, stuRes] = await Promise.all([
          window.api.getPromotions(),
          window.api.getAllStudents()
        ]);
        promotions.value = promRes?.ok ? promRes.data : [];
        students.value = stuRes?.ok ? stuRes.data : [];
        if (promotions.value.length && !appStore.activePromoId) {
          appStore.activePromoId = promotions.value[0].id;
        }
        await loadTeacherChannels();
      } finally {
        loading.value = false;
      }
    }
    async function loadTeacherChannels() {
      if (!appStore.activePromoId) return;
      const res = await window.api.getChannels(appStore.activePromoId);
      channels.value = res?.ok ? res.data : [];
    }
    async function loadStudentSidebar() {
      if (!user.value?.promo_id) return;
      loading.value = true;
      try {
        const [chRes, stuRes] = await Promise.all([
          window.api.getChannels(user.value.promo_id),
          window.api.getStudents(user.value.promo_id)
        ]);
        channels.value = chRes?.ok ? chRes.data : [];
        students.value = stuRes?.ok ? stuRes.data : [];
      } finally {
        loading.value = false;
      }
    }
    async function load() {
      if (appStore.isTeacher) await loadTeacherSidebar();
      else await loadStudentSidebar();
    }
    const visibleChannels = computed(() => {
      if (appStore.isTeacher) return channels.value;
      return channels.value.filter((ch) => {
        if (!ch.is_private) return true;
        try {
          const members = Array.isArray(ch.members) ? ch.members : JSON.parse(ch.members ?? "[]");
          return members.includes(user.value?.id ?? -1);
        } catch {
          return false;
        }
      });
    });
    const dmStudents = computed(
      () => students.value.filter((s) => s.id !== user.value?.id)
    );
    function selectChannel(ch) {
      appStore.openChannel(ch.id, ch.promo_id, ch.name, ch.type);
      messagesStore.fetchMessages();
      messagesStore.fetchPinned(ch.id);
      if (appStore.isStudent) travauxStore.fetchStudentTravaux();
    }
    function selectDm(s) {
      appStore.openDm(s.id, s.promo_id, s.name);
      messagesStore.fetchMessages();
    }
    async function selectPromo(promoId) {
      appStore.activePromoId = promoId;
      await loadTeacherChannels();
    }
    onMounted(load);
    watch(() => route.name, (n) => {
      if (n === "messages") load();
    });
    watch(() => modals.createChannel, (open) => {
      if (!open) load();
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$d, [
        createBaseVNode("div", _hoisted_2$d, [
          user.value ? (openBlock(), createElementBlock("div", _hoisted_3$c, [
            createBaseVNode("div", {
              class: "avatar teacher-avatar",
              style: normalizeStyle({
                background: user.value.type === "teacher" ? "var(--accent)" : unref(avatarColor)(user.value.name),
                color: "#fff"
              })
            }, toDisplayString(user.value.avatar_initials), 5),
            createBaseVNode("div", _hoisted_4$b, [
              createBaseVNode("span", _hoisted_5$a, toDisplayString(user.value.name), 1),
              createBaseVNode("span", _hoisted_6$a, toDisplayString(user.value.type === "teacher" ? "Professeur" : user.value.promo_name ?? ""), 1)
            ])
          ])) : createCommentVNode("", true)
        ]),
        createBaseVNode("div", _hoisted_7$7, [
          unref(appStore).isTeacher && promotions.value.length ? (openBlock(), createBlock(_sfc_main$g, {
            key: 0,
            promotions: promotions.value,
            onSelect: selectPromo
          }, null, 8, ["promotions"])) : createCommentVNode("", true),
          loading.value ? (openBlock(), createElementBlock(Fragment, { key: 1 }, renderList(5, (i) => {
            return createBaseVNode("div", {
              key: i,
              class: "skel-list-row"
            }, [..._cache[1] || (_cache[1] = [
              createBaseVNode("div", { class: "skel skel-avatar skel-avatar-sm" }, null, -1),
              createBaseVNode("div", { class: "skel skel-line skel-w70" }, null, -1)
            ])]);
          }), 64)) : (openBlock(), createElementBlock(Fragment, { key: 2 }, [
            createBaseVNode("div", _hoisted_8$6, [
              _cache[2] || (_cache[2] = createBaseVNode("span", null, "Canaux", -1)),
              unref(appStore).isTeacher ? (openBlock(), createElementBlock("button", {
                key: 0,
                class: "btn-icon",
                title: "Créer un canal",
                "aria-label": "Créer un canal",
                style: { "padding": "2px" },
                onClick: _cache[0] || (_cache[0] = ($event) => unref(modals).createChannel = true)
              }, [
                createVNode(unref(Plus), { size: 14 })
              ])) : createCommentVNode("", true)
            ]),
            createBaseVNode("nav", _hoisted_9$6, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(visibleChannels.value, (ch) => {
                return openBlock(), createBlock(_sfc_main$f, {
                  key: ch.id,
                  "channel-id": ch.id,
                  name: ch.name,
                  prefix: ch.type === "annonce" ? "📢" : "#",
                  type: ch.type,
                  onClick: ($event) => selectChannel(ch)
                }, null, 8, ["channel-id", "name", "prefix", "type", "onClick"]);
              }), 128))
            ]),
            unref(appStore).isStudent && dmStudents.value.length ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
              _cache[4] || (_cache[4] = createBaseVNode("div", {
                class: "sidebar-section-header",
                style: { "margin-top": "12px" }
              }, "Messages directs", -1)),
              createBaseVNode("nav", _hoisted_10$6, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(dmStudents.value, (s) => {
                  return openBlock(), createElementBlock("button", {
                    key: s.id,
                    class: normalizeClass(["sidebar-item", { active: unref(appStore).activeDmStudentId === s.id }]),
                    onClick: ($event) => selectDm(s)
                  }, [
                    _cache[3] || (_cache[3] = createBaseVNode("span", { class: "channel-prefix" }, "@", -1)),
                    createBaseVNode("span", _hoisted_12$5, toDisplayString(s.name), 1)
                  ], 10, _hoisted_11$6);
                }), 128))
              ])
            ], 64)) : createCommentVNode("", true)
          ], 64))
        ])
      ]);
    };
  }
});
const _hoisted_1$c = { id: "login-overlay" };
const _hoisted_2$c = {
  key: 0,
  id: "login-panel"
};
const _hoisted_3$b = { class: "form-group" };
const _hoisted_4$a = { class: "form-group" };
const _hoisted_5$9 = {
  key: 0,
  class: "field-error"
};
const _hoisted_6$9 = ["disabled"];
const _hoisted_7$6 = {
  key: 1,
  id: "login-panel",
  style: { "max-width": "480px" }
};
const _hoisted_8$5 = { class: "register-photo-row" };
const _hoisted_9$5 = ["src"];
const _hoisted_10$5 = { key: 1 };
const _hoisted_11$5 = { style: { "display": "flex", "gap": "10px" } };
const _hoisted_12$4 = {
  class: "form-group",
  style: { "flex": "1" }
};
const _hoisted_13$4 = {
  class: "form-group",
  style: { "flex": "1" }
};
const _hoisted_14$4 = { class: "form-group" };
const _hoisted_15$4 = {
  key: 0,
  class: "field-error"
};
const _hoisted_16$4 = { class: "form-group" };
const _hoisted_17$3 = ["value"];
const _hoisted_18$3 = { class: "form-group" };
const _hoisted_19$3 = { style: { "display": "flex", "gap": "10px", "margin-top": "6px" } };
const _hoisted_20$3 = ["disabled"];
const _sfc_main$d = /* @__PURE__ */ defineComponent({
  __name: "LoginOverlay",
  setup(__props) {
    const appStore = useAppStore();
    const router2 = useRouter();
    const screen = /* @__PURE__ */ ref("login");
    const email = /* @__PURE__ */ ref("");
    const password = /* @__PURE__ */ ref("");
    const loginErr = /* @__PURE__ */ ref("");
    const submitting = /* @__PURE__ */ ref(false);
    async function handleLogin() {
      loginErr.value = "";
      submitting.value = true;
      try {
        const res = await window.api.loginWithCredentials(email.value.trim(), password.value);
        if (!res.ok || !res.data) {
          loginErr.value = "Email ou mot de passe incorrect.";
          password.value = "";
          return;
        }
        const u = res.data;
        const initials_ = u.avatar_initials ?? u.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
        appStore.login({ ...u, avatar_initials: initials_ });
        router2.replace("/messages");
      } finally {
        submitting.value = false;
      }
    }
    const firstName = /* @__PURE__ */ ref("");
    const lastName = /* @__PURE__ */ ref("");
    const regEmail = /* @__PURE__ */ ref("");
    const regPassword = /* @__PURE__ */ ref("");
    const regPromoId = /* @__PURE__ */ ref("");
    const regEmailErr = /* @__PURE__ */ ref("");
    const regSubmitting = /* @__PURE__ */ ref(false);
    const pendingPhoto = /* @__PURE__ */ ref(null);
    const promotions = /* @__PURE__ */ ref([]);
    async function loadPromos() {
      const res = await window.api.getPromotions();
      promotions.value = res?.ok ? res.data : [];
    }
    const previewInitials = () => {
      const n = `${firstName.value} ${lastName.value}`.trim();
      return n.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
    };
    const previewColor = () => avatarColor(`${firstName.value} ${lastName.value}`.trim() || "?");
    async function pickPhoto() {
      const res = await window.api.openImageDialog();
      if (res?.ok && res.data) pendingPhoto.value = res.data;
    }
    async function handleRegister() {
      regEmailErr.value = "";
      if (!regEmail.value.endsWith("@viacesi.fr")) {
        regEmailErr.value = "L'adresse doit se terminer par @viacesi.fr";
        return;
      }
      if (!regPromoId.value) return;
      regSubmitting.value = true;
      try {
        const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`;
        const res = await window.api.registerStudent({
          name: fullName,
          email: regEmail.value.trim().toLowerCase(),
          promoId: regPromoId.value,
          photoData: pendingPhoto.value,
          password: regPassword.value
        });
        if (!res?.ok) {
          regEmailErr.value = res?.error ?? "Erreur lors de la création du compte.";
          return;
        }
        const stuRes = await window.api.getStudentByEmail(regEmail.value.trim().toLowerCase());
        if (!stuRes?.ok || !stuRes.data) return;
        const stu = stuRes.data;
        const initials_ = fullName.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
        appStore.login({ ...stu, avatar_initials: initials_, type: "student" });
        router2.replace("/messages");
      } catch (e) {
        regEmailErr.value = e.message ?? "Erreur lors de la création du compte.";
      } finally {
        regSubmitting.value = false;
      }
    }
    async function goToRegister() {
      screen.value = "register";
      await loadPromos();
    }
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$c, [
        screen.value === "login" ? (openBlock(), createElementBlock("div", _hoisted_2$c, [
          _cache[11] || (_cache[11] = createStaticVNode('<div id="login-logo"><div class="logo-mark">CeS</div><span class="logo-text">CeSlack</span></div><h2 id="login-title">Connexion</h2><p id="login-subtitle">Entrez vos identifiants pour continuer</p>', 3)),
          createBaseVNode("form", {
            style: { "width": "100%", "display": "flex", "flex-direction": "column", "gap": "12px", "margin-top": "8px" },
            onSubmit: withModifiers(handleLogin, ["prevent"])
          }, [
            createBaseVNode("div", _hoisted_3$b, [
              _cache[9] || (_cache[9] = createBaseVNode("label", {
                class: "form-label",
                for: "login-email"
              }, "Adresse email", -1)),
              withDirectives(createBaseVNode("input", {
                id: "login-email",
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => email.value = $event),
                type: "email",
                class: "form-input",
                placeholder: "prenom.nom@viacesi.fr",
                autocomplete: "email",
                required: "",
                autofocus: ""
              }, null, 512), [
                [vModelText, email.value]
              ])
            ]),
            createBaseVNode("div", _hoisted_4$a, [
              _cache[10] || (_cache[10] = createBaseVNode("label", {
                class: "form-label",
                for: "login-password"
              }, "Mot de passe", -1)),
              withDirectives(createBaseVNode("input", {
                id: "login-password",
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => password.value = $event),
                type: "password",
                class: "form-input",
                placeholder: "••••••••",
                autocomplete: "current-password",
                required: ""
              }, null, 512), [
                [vModelText, password.value]
              ])
            ]),
            loginErr.value ? (openBlock(), createElementBlock("span", _hoisted_5$9, toDisplayString(loginErr.value), 1)) : createCommentVNode("", true),
            createBaseVNode("button", {
              type: "submit",
              class: "btn-primary",
              style: { "margin-top": "4px" },
              disabled: submitting.value
            }, toDisplayString(submitting.value ? "Connexion…" : "Se connecter"), 9, _hoisted_6$9)
          ], 32),
          createBaseVNode("button", {
            class: "btn-ghost",
            style: { "margin-top": "16px", "width": "100%", "font-size": "13px" },
            onClick: goToRegister
          }, " Nouveau compte étudiant ")
        ])) : (openBlock(), createElementBlock("div", _hoisted_7$6, [
          _cache[18] || (_cache[18] = createStaticVNode('<div id="login-logo"><div class="logo-mark">CeS</div><span class="logo-text">CeSlack</span></div><h2 id="login-title">Nouveau compte étudiant</h2><p id="login-subtitle">Seules les adresses @viacesi.fr sont acceptées</p>', 3)),
          createBaseVNode("form", {
            style: { "width": "100%", "display": "flex", "flex-direction": "column", "gap": "12px", "margin-top": "8px" },
            onSubmit: withModifiers(handleRegister, ["prevent"])
          }, [
            createBaseVNode("div", _hoisted_8$5, [
              createBaseVNode("div", {
                id: "register-avatar-preview",
                class: "register-avatar-preview",
                style: normalizeStyle({ background: pendingPhoto.value ? "transparent" : previewColor() })
              }, [
                pendingPhoto.value ? (openBlock(), createElementBlock("img", {
                  key: 0,
                  src: pendingPhoto.value,
                  style: { "width": "100%", "height": "100%", "object-fit": "cover", "border-radius": "50%" }
                }, null, 8, _hoisted_9$5)) : (openBlock(), createElementBlock("span", _hoisted_10$5, toDisplayString(previewInitials()), 1))
              ], 4),
              createBaseVNode("button", {
                type: "button",
                class: "btn-ghost",
                style: { "font-size": "12px" },
                onClick: pickPhoto
              }, "Choisir une photo"),
              pendingPhoto.value ? (openBlock(), createElementBlock("button", {
                key: 0,
                type: "button",
                class: "btn-ghost register-btn-remove",
                style: { "font-size": "12px" },
                onClick: _cache[2] || (_cache[2] = ($event) => pendingPhoto.value = null)
              }, "Supprimer")) : createCommentVNode("", true)
            ]),
            createBaseVNode("div", _hoisted_11$5, [
              createBaseVNode("div", _hoisted_12$4, [
                _cache[12] || (_cache[12] = createBaseVNode("label", { class: "form-label" }, "Prénom", -1)),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => firstName.value = $event),
                  type: "text",
                  class: "form-input",
                  placeholder: "ex : Alice",
                  required: ""
                }, null, 512), [
                  [vModelText, firstName.value]
                ])
              ]),
              createBaseVNode("div", _hoisted_13$4, [
                _cache[13] || (_cache[13] = createBaseVNode("label", { class: "form-label" }, "Nom", -1)),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => lastName.value = $event),
                  type: "text",
                  class: "form-input",
                  placeholder: "ex : Martin",
                  required: ""
                }, null, 512), [
                  [vModelText, lastName.value]
                ])
              ])
            ]),
            createBaseVNode("div", _hoisted_14$4, [
              _cache[14] || (_cache[14] = createBaseVNode("label", { class: "form-label" }, "Adresse email CESI", -1)),
              withDirectives(createBaseVNode("input", {
                "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => regEmail.value = $event),
                type: "email",
                class: "form-input",
                placeholder: "prenom.nom@viacesi.fr",
                required: ""
              }, null, 512), [
                [vModelText, regEmail.value]
              ]),
              regEmailErr.value ? (openBlock(), createElementBlock("span", _hoisted_15$4, toDisplayString(regEmailErr.value), 1)) : createCommentVNode("", true)
            ]),
            createBaseVNode("div", _hoisted_16$4, [
              _cache[16] || (_cache[16] = createBaseVNode("label", { class: "form-label" }, "Promotion", -1)),
              withDirectives(createBaseVNode("select", {
                "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => regPromoId.value = $event),
                class: "form-select",
                required: ""
              }, [
                _cache[15] || (_cache[15] = createBaseVNode("option", { value: "" }, "Choisir une promotion…", -1)),
                (openBlock(true), createElementBlock(Fragment, null, renderList(promotions.value, (p2) => {
                  return openBlock(), createElementBlock("option", {
                    key: p2.id,
                    value: p2.id
                  }, toDisplayString(p2.name), 9, _hoisted_17$3);
                }), 128))
              ], 512), [
                [vModelSelect, regPromoId.value]
              ])
            ]),
            createBaseVNode("div", _hoisted_18$3, [
              _cache[17] || (_cache[17] = createBaseVNode("label", { class: "form-label" }, "Mot de passe", -1)),
              withDirectives(createBaseVNode("input", {
                "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => regPassword.value = $event),
                type: "password",
                class: "form-input",
                placeholder: "Choisissez un mot de passe",
                required: "",
                minlength: "4"
              }, null, 512), [
                [vModelText, regPassword.value]
              ])
            ]),
            createBaseVNode("div", _hoisted_19$3, [
              createBaseVNode("button", {
                type: "button",
                class: "btn-ghost",
                style: { "flex": "1" },
                onClick: _cache[8] || (_cache[8] = ($event) => screen.value = "login")
              }, "Retour"),
              createBaseVNode("button", {
                type: "submit",
                class: "btn-primary",
                style: { "flex": "2" },
                disabled: regSubmitting.value
              }, toDisplayString(regSubmitting.value ? "Création…" : "Créer mon compte"), 9, _hoisted_20$3)
            ])
          ], 32)
        ]))
      ]);
    };
  }
});
const _hoisted_1$b = { class: "cmd-palette-box" };
const _hoisted_2$b = { class: "cmd-search-bar" };
const _hoisted_3$a = ["onClick", "onMouseenter"];
const _hoisted_4$9 = { class: "cmd-result-label" };
const _hoisted_5$8 = { class: "cmd-result-sub" };
const _hoisted_6$8 = {
  key: 1,
  class: "cmd-empty"
};
const _hoisted_7$5 = {
  key: 2,
  class: "cmd-empty"
};
const _sfc_main$c = /* @__PURE__ */ defineComponent({
  __name: "CmdPalette",
  setup(__props) {
    const appStore = useAppStore();
    const modals = useModalsStore();
    const messagesStore = useMessagesStore();
    const router2 = useRouter();
    const query = /* @__PURE__ */ ref("");
    const inputEl = /* @__PURE__ */ ref(null);
    const listEl = /* @__PURE__ */ ref(null);
    const selected = /* @__PURE__ */ ref(0);
    const allChannels = /* @__PURE__ */ ref([]);
    const allStudents = /* @__PURE__ */ ref([]);
    const allPromos = /* @__PURE__ */ ref([]);
    async function loadData() {
      const [pRes, sRes] = await Promise.all([
        window.api.getPromotions(),
        window.api.getAllStudents()
      ]);
      allPromos.value = pRes?.ok ? pRes.data : [];
      allStudents.value = sRes?.ok ? sRes.data : [];
      const chArrays = await Promise.all(
        allPromos.value.map((p2) => window.api.getChannels(p2.id))
      );
      allChannels.value = chArrays.flatMap(
        (r, i) => r?.ok ? r.data.map((c) => ({ ...c, promo_name: allPromos.value[i].name })) : []
      );
    }
    function fuzzyScore(str, q) {
      if (!q) return 0;
      const s = str.toLowerCase();
      const query_ = q.toLowerCase();
      let si = 0, qi = 0, score = 0, lastMatchIdx = -1;
      while (si < s.length && qi < query_.length) {
        if (s[si] === query_[qi]) {
          const consecutive = lastMatchIdx === si - 1 ? 5 : 0;
          const wordStart = si === 0 || /[\s\-_.]/.test(s[si - 1]) ? 3 : 0;
          score += 1 + consecutive + wordStart;
          lastMatchIdx = si;
          qi++;
        }
        si++;
      }
      return qi < query_.length ? -1 : score;
    }
    const SECTIONS = [
      { key: "messages", label: "Messages" },
      { key: "travaux", label: "Travaux" },
      { key: "documents", label: "Documents" }
    ];
    const results = computed(() => {
      const q = query.value.trim();
      if (!q) return [];
      const channels = allChannels.value.map((c) => ({ item: c, score: fuzzyScore(c.name, q) })).filter(({ score }) => score >= 0).sort((a, b) => b.score - a.score).slice(0, 5).map(({ item: c }) => ({
        type: "channel",
        label: `#${c.name}`,
        sub: c.promo_name,
        data: c
      }));
      const students = allStudents.value.map((s) => ({ item: s, score: fuzzyScore(s.name, q) })).filter(({ score }) => score >= 0).sort((a, b) => b.score - a.score).slice(0, 5).map(({ item: s }) => ({
        type: "dm",
        label: `@${s.name}`,
        sub: s.promo_name,
        data: s
      }));
      const sections = SECTIONS.filter(({ key }) => fuzzyScore(key, q) >= 0).map(({ key, label }) => ({
        type: "section",
        label,
        sub: "Section",
        data: key
      }));
      return [...channels, ...students, ...sections];
    });
    watch(results, () => {
      selected.value = 0;
    });
    watch(selected, () => {
      nextTick(() => {
        if (!listEl.value) return;
        const items = listEl.value.querySelectorAll("[data-result-item]");
        items[selected.value]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
    function moveSelection(delta) {
      selected.value = Math.max(0, Math.min(selected.value + delta, results.value.length - 1));
    }
    function select(i) {
      const item = results.value[i];
      if (!item) return;
      modals.cmdPalette = false;
      query.value = "";
      if (item.type === "channel") {
        const c = item.data;
        appStore.openChannel(c.id, c.promo_id, c.name, c.type);
        messagesStore.fetchMessages();
      } else if (item.type === "dm") {
        const s = item.data;
        appStore.openDm(s.id, s.promo_id, s.name);
        messagesStore.fetchMessages();
      } else {
        router2.push("/" + item.data);
      }
    }
    function onGlobalKey(e) {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        modals.cmdPalette = true;
      }
    }
    onMounted(() => {
      document.addEventListener("keydown", onGlobalKey);
      loadData();
    });
    onUnmounted(() => document.removeEventListener("keydown", onGlobalKey));
    watch(() => modals.cmdPalette, (open) => {
      if (open) {
        query.value = "";
        selected.value = 0;
        setTimeout(() => inputEl.value?.focus(), 50);
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Teleport, { to: "body" }, [
        unref(modals).cmdPalette ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: "modal-overlay",
          onClick: _cache[5] || (_cache[5] = withModifiers(($event) => unref(modals).cmdPalette = false, ["self"]))
        }, [
          createBaseVNode("div", _hoisted_1$b, [
            createBaseVNode("div", _hoisted_2$b, [
              createVNode(unref(Search), {
                size: 16,
                style: { "color": "var(--text-muted)", "flex-shrink": "0" }
              }),
              withDirectives(createBaseVNode("input", {
                ref_key: "inputEl",
                ref: inputEl,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => query.value = $event),
                type: "text",
                placeholder: "Chercher un canal, un étudiant, une section…",
                class: "cmd-search-input",
                onKeydown: [
                  _cache[1] || (_cache[1] = withKeys(($event) => unref(modals).cmdPalette = false, ["escape"])),
                  _cache[2] || (_cache[2] = withKeys(withModifiers(($event) => moveSelection(1), ["prevent"]), ["arrow-down"])),
                  _cache[3] || (_cache[3] = withKeys(withModifiers(($event) => moveSelection(-1), ["prevent"]), ["arrow-up"])),
                  _cache[4] || (_cache[4] = withKeys(withModifiers(($event) => select(selected.value), ["prevent"]), ["enter"]))
                ]
              }, null, 544), [
                [vModelText, query.value]
              ]),
              _cache[6] || (_cache[6] = createBaseVNode("kbd", { class: "cmd-kbd" }, "Esc", -1))
            ]),
            createBaseVNode("ul", {
              ref_key: "listEl",
              ref: listEl,
              class: "cmd-results"
            }, [
              results.value.length ? (openBlock(true), createElementBlock(Fragment, { key: 0 }, renderList(results.value, (r, i) => {
                return openBlock(), createElementBlock("li", {
                  key: i,
                  "data-result-item": "",
                  class: normalizeClass(["cmd-result-item", { active: i === selected.value }]),
                  onClick: ($event) => select(i),
                  onMouseenter: ($event) => selected.value = i
                }, [
                  createBaseVNode("span", _hoisted_4$9, toDisplayString(r.label), 1),
                  createBaseVNode("span", _hoisted_5$8, toDisplayString(r.sub), 1)
                ], 42, _hoisted_3$a);
              }), 128)) : query.value ? (openBlock(), createElementBlock("li", _hoisted_6$8, "Aucun résultat pour « " + toDisplayString(query.value) + " »", 1)) : (openBlock(), createElementBlock("li", _hoisted_7$5, "Tapez pour chercher…"))
            ], 512)
          ])
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
const CmdPalette = /* @__PURE__ */ _export_sfc(_sfc_main$c, [["__scopeId", "data-v-bb91a0ea"]]);
const PREFS_KEY = "cc_prefs";
const DEFAULTS = {
  docsOpenByDefault: false,
  theme: "dark"
};
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}
function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
  }
}
function usePrefs() {
  function getPref(key) {
    return loadPrefs()[key];
  }
  function setPref(key, value) {
    const prefs = loadPrefs();
    prefs[key] = value;
    savePrefs(prefs);
  }
  return { getPref, setPref };
}
const _hoisted_1$a = {
  key: 0,
  class: "modal-header"
};
const _hoisted_2$a = { class: "modal-title" };
const _sfc_main$b = /* @__PURE__ */ defineComponent({
  __name: "Modal",
  props: {
    modelValue: { type: Boolean },
    title: {},
    maxWidth: { default: "540px" }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    function close() {
      emit2("update:modelValue", false);
    }
    function onKey(e) {
      if (e.key === "Escape" && props.modelValue) close();
    }
    onMounted(() => document.addEventListener("keydown", onKey));
    onUnmounted(() => document.removeEventListener("keydown", onKey));
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Teleport, { to: "body" }, [
        createVNode(Transition, { name: "modal" }, {
          default: withCtx(() => [
            __props.modelValue ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: "modal-overlay",
              onClick: withModifiers(close, ["self"])
            }, [
              createBaseVNode("div", {
                class: "modal-box",
                style: normalizeStyle({ maxWidth: __props.maxWidth })
              }, [
                __props.title ? (openBlock(), createElementBlock("div", _hoisted_1$a, [
                  createBaseVNode("h3", _hoisted_2$a, toDisplayString(__props.title), 1),
                  createBaseVNode("button", {
                    class: "modal-close",
                    "aria-label": "Fermer",
                    onClick: close
                  }, [
                    createVNode(unref(X), { size: 16 })
                  ])
                ])) : createCommentVNode("", true),
                renderSlot(_ctx.$slots, "default", {}, void 0, true)
              ], 4)
            ])) : createCommentVNode("", true)
          ]),
          _: 3
        })
      ]);
    };
  }
});
const Modal = /* @__PURE__ */ _export_sfc(_sfc_main$b, [["__scopeId", "data-v-cc962c09"]]);
const _hoisted_1$9 = {
  class: "settings-layout",
  style: { "display": "flex", "min-height": "340px" }
};
const _hoisted_2$9 = {
  class: "settings-nav",
  style: { "width": "160px", "border-right": "1px solid var(--border)", "padding": "8px 0", "flex-shrink": "0" }
};
const _hoisted_3$9 = {
  class: "settings-body",
  style: { "flex": "1", "padding": "20px 24px", "overflow-y": "auto" }
};
const _hoisted_4$8 = {
  key: 0,
  class: "settings-section"
};
const _hoisted_5$7 = { class: "settings-toggle-row" };
const _hoisted_6$7 = {
  key: 1,
  class: "settings-section"
};
const _hoisted_7$4 = { style: { "display": "flex", "align-items": "center", "gap": "16px", "margin-bottom": "16px" } };
const _hoisted_8$4 = {
  class: "avatar",
  style: { "width": "56px", "height": "56px", "font-size": "20px", "border-radius": "50%", "overflow": "hidden", "display": "flex", "align-items": "center", "justify-content": "center", "background": "var(--accent)", "color": "#fff" }
};
const _hoisted_9$4 = ["src"];
const _hoisted_10$4 = { key: 1 };
const _hoisted_11$4 = { style: { "display": "flex", "flex-direction": "column", "gap": "6px" } };
const _hoisted_12$3 = { class: "form-group" };
const _hoisted_13$3 = ["value"];
const _hoisted_14$3 = {
  class: "form-group",
  style: { "margin-top": "8px" }
};
const _hoisted_15$3 = ["value"];
const _hoisted_16$3 = {
  class: "modal-footer",
  style: { "padding": "12px 16px", "border-top": "1px solid var(--border)", "display": "flex", "justify-content": "flex-end" }
};
const _sfc_main$a = /* @__PURE__ */ defineComponent({
  __name: "SettingsModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    const appStore = useAppStore();
    const router2 = useRouter();
    const { getPref, setPref } = usePrefs();
    const { showToast } = useToast();
    const activeSection = /* @__PURE__ */ ref("general");
    const docsDefault = /* @__PURE__ */ ref(getPref("docsOpenByDefault"));
    const pendingPhoto = /* @__PURE__ */ ref(appStore.currentUser?.photo_data ?? null);
    watch(docsDefault, (v) => setPref("docsOpenByDefault", v));
    async function pickPhoto() {
      const res = await window.api.openImageDialog();
      if (res?.ok && res.data) pendingPhoto.value = res.data;
    }
    function handleLogout() {
      emit2("update:modelValue", false);
      appStore.logout();
      router2.replace("/");
      showToast("Déconnexion réussie.", "info");
    }
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: "Paramètres",
        "max-width": "680px",
        "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_1$9, [
            createBaseVNode("nav", _hoisted_2$9, [
              createBaseVNode("button", {
                class: normalizeClass(["settings-nav-item", { active: activeSection.value === "general" }]),
                onClick: _cache[0] || (_cache[0] = ($event) => activeSection.value = "general")
              }, " Général ", 2),
              createBaseVNode("button", {
                class: normalizeClass(["settings-nav-item", { active: activeSection.value === "compte" }]),
                onClick: _cache[1] || (_cache[1] = ($event) => activeSection.value = "compte")
              }, " Mon compte ", 2)
            ]),
            createBaseVNode("div", _hoisted_3$9, [
              activeSection.value === "general" ? (openBlock(), createElementBlock("section", _hoisted_4$8, [
                _cache[6] || (_cache[6] = createBaseVNode("h4", { class: "settings-section-title" }, "Documents", -1)),
                createBaseVNode("label", _hoisted_5$7, [
                  withDirectives(createBaseVNode("input", {
                    id: "settings-docs-default",
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => docsDefault.value = $event),
                    type: "checkbox"
                  }, null, 512), [
                    [vModelCheckbox, docsDefault.value]
                  ]),
                  _cache[5] || (_cache[5] = createBaseVNode("span", null, "Ouvrir les fichiers dans l'explorateur par défaut", -1))
                ])
              ])) : (openBlock(), createElementBlock("section", _hoisted_6$7, [
                _cache[9] || (_cache[9] = createBaseVNode("h4", { class: "settings-section-title" }, "Photo de profil", -1)),
                createBaseVNode("div", _hoisted_7$4, [
                  createBaseVNode("div", _hoisted_8$4, [
                    pendingPhoto.value ? (openBlock(), createElementBlock("img", {
                      key: 0,
                      src: pendingPhoto.value,
                      style: { "width": "100%", "height": "100%", "object-fit": "cover" }
                    }, null, 8, _hoisted_9$4)) : (openBlock(), createElementBlock("span", _hoisted_10$4, toDisplayString(unref(appStore).currentUser?.avatar_initials), 1))
                  ]),
                  createBaseVNode("div", _hoisted_11$4, [
                    createBaseVNode("button", {
                      class: "btn-ghost",
                      style: { "font-size": "12px" },
                      onClick: pickPhoto
                    }, "Changer la photo"),
                    pendingPhoto.value ? (openBlock(), createElementBlock("button", {
                      key: 0,
                      class: "btn-ghost",
                      style: { "font-size": "12px", "color": "var(--error)" },
                      onClick: _cache[3] || (_cache[3] = ($event) => pendingPhoto.value = null)
                    }, "Supprimer")) : createCommentVNode("", true)
                  ])
                ]),
                createBaseVNode("div", _hoisted_12$3, [
                  _cache[7] || (_cache[7] = createBaseVNode("label", { class: "form-label" }, "Nom", -1)),
                  createBaseVNode("input", {
                    value: unref(appStore).currentUser?.name,
                    type: "text",
                    class: "form-input",
                    disabled: "",
                    style: { "opacity": ".6" }
                  }, null, 8, _hoisted_13$3)
                ]),
                createBaseVNode("div", _hoisted_14$3, [
                  _cache[8] || (_cache[8] = createBaseVNode("label", { class: "form-label" }, "Type", -1)),
                  createBaseVNode("input", {
                    value: unref(appStore).currentUser?.type === "teacher" ? "Professeur" : "Étudiant",
                    type: "text",
                    class: "form-input",
                    disabled: "",
                    style: { "opacity": ".6" }
                  }, null, 8, _hoisted_15$3)
                ])
              ]))
            ])
          ]),
          createBaseVNode("div", _hoisted_16$3, [
            createBaseVNode("button", {
              class: "btn-danger",
              style: { "display": "flex", "align-items": "center", "gap": "6px" },
              onClick: handleLogout
            }, [
              createVNode(unref(LogOut), { size: 14 }),
              _cache[10] || (_cache[10] = createTextVNode(" Se déconnecter ", -1))
            ])
          ])
        ]),
        _: 1
      }, 8, ["model-value"]);
    };
  }
});
const _hoisted_1$8 = { style: { "padding": "16px", "display": "flex", "flex-direction": "column", "gap": "14px" } };
const _hoisted_2$8 = { class: "form-group" };
const _hoisted_3$8 = { class: "form-group" };
const _hoisted_4$7 = { style: { "display": "flex", "gap": "16px" } };
const _hoisted_5$6 = { class: "radio-label" };
const _hoisted_6$6 = { class: "radio-label" };
const _hoisted_7$3 = {
  key: 0,
  class: "form-group"
};
const _hoisted_8$3 = {
  id: "channel-members-checkboxes",
  style: { "max-height": "180px", "overflow-y": "auto", "display": "flex", "flex-direction": "column", "gap": "4px" }
};
const _hoisted_9$3 = ["checked", "onChange"];
const _hoisted_10$3 = {
  class: "modal-footer",
  style: { "padding": "12px 16px", "border-top": "1px solid var(--border)", "display": "flex", "justify-content": "flex-end", "gap": "8px" }
};
const _hoisted_11$3 = ["disabled"];
const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  __name: "CreateChannelModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const appStore = useAppStore();
    const { showToast } = useToast();
    const channelName = /* @__PURE__ */ ref("");
    const visibility = /* @__PURE__ */ ref("public");
    const members = /* @__PURE__ */ ref([]);
    const students = /* @__PURE__ */ ref([]);
    const creating = /* @__PURE__ */ ref(false);
    watch(() => props.modelValue, async (open) => {
      if (open && appStore.activePromoId) {
        const res = await window.api.getStudents(appStore.activePromoId);
        students.value = res?.ok ? res.data : [];
        channelName.value = "";
        visibility.value = "public";
        members.value = [];
      }
    });
    async function create() {
      if (!channelName.value.trim() || !appStore.activePromoId) return;
      creating.value = true;
      try {
        const res = await window.api.createChannel({
          name: channelName.value.trim(),
          promoId: appStore.activePromoId,
          isPrivate: visibility.value === "private",
          members: visibility.value === "private" ? members.value : []
        });
        if (!res?.ok) {
          showToast(res?.error ?? "Erreur lors de la création.");
          return;
        }
        showToast("Canal créé.", "success");
        emit2("update:modelValue", false);
      } finally {
        creating.value = false;
      }
    }
    function toggleMember(id) {
      const idx = members.value.indexOf(id);
      if (idx === -1) members.value.push(id);
      else members.value.splice(idx, 1);
    }
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: "Créer un canal",
        "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_1$8, [
            createBaseVNode("div", _hoisted_2$8, [
              _cache[5] || (_cache[5] = createBaseVNode("label", { class: "form-label" }, "Nom du canal", -1)),
              withDirectives(createBaseVNode("input", {
                id: "new-channel-name",
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => channelName.value = $event),
                type: "text",
                class: "form-input",
                placeholder: "ex : général, tp-réseaux…",
                autofocus: ""
              }, null, 512), [
                [vModelText, channelName.value]
              ])
            ]),
            createBaseVNode("div", _hoisted_3$8, [
              _cache[8] || (_cache[8] = createBaseVNode("label", { class: "form-label" }, "Visibilité", -1)),
              createBaseVNode("div", _hoisted_4$7, [
                createBaseVNode("label", _hoisted_5$6, [
                  withDirectives(createBaseVNode("input", {
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => visibility.value = $event),
                    type: "radio",
                    value: "public"
                  }, null, 512), [
                    [vModelRadio, visibility.value]
                  ]),
                  _cache[6] || (_cache[6] = createTextVNode(" Public ", -1))
                ]),
                createBaseVNode("label", _hoisted_6$6, [
                  withDirectives(createBaseVNode("input", {
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => visibility.value = $event),
                    type: "radio",
                    value: "private"
                  }, null, 512), [
                    [vModelRadio, visibility.value]
                  ]),
                  _cache[7] || (_cache[7] = createTextVNode(" Privé (membres restreints) ", -1))
                ])
              ])
            ]),
            visibility.value === "private" ? (openBlock(), createElementBlock("div", _hoisted_7$3, [
              _cache[9] || (_cache[9] = createBaseVNode("label", { class: "form-label" }, "Membres autorisés", -1)),
              createBaseVNode("div", _hoisted_8$3, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(students.value, (s) => {
                  return openBlock(), createElementBlock("label", {
                    key: s.id,
                    class: "checkbox-label",
                    style: { "display": "flex", "align-items": "center", "gap": "8px", "padding": "4px" }
                  }, [
                    createBaseVNode("input", {
                      type: "checkbox",
                      checked: members.value.includes(s.id),
                      onChange: ($event) => toggleMember(s.id)
                    }, null, 40, _hoisted_9$3),
                    createBaseVNode("span", null, toDisplayString(s.name), 1)
                  ]);
                }), 128))
              ])
            ])) : createCommentVNode("", true)
          ]),
          createBaseVNode("div", _hoisted_10$3, [
            createBaseVNode("button", {
              class: "btn-ghost",
              onClick: _cache[3] || (_cache[3] = ($event) => emit2("update:modelValue", false))
            }, "Annuler"),
            createBaseVNode("button", {
              class: "btn-primary",
              disabled: !channelName.value.trim() || creating.value,
              onClick: create
            }, toDisplayString(creating.value ? "Création…" : "Créer"), 9, _hoisted_11$3)
          ])
        ]),
        _: 1
      }, 8, ["model-value"]);
    };
  }
});
const _hoisted_1$7 = { class: "form-group" };
const _hoisted_2$7 = ["value"];
const _hoisted_3$7 = { style: { "display": "flex", "gap": "10px" } };
const _hoisted_4$6 = {
  class: "form-group",
  style: { "flex": "2" }
};
const _hoisted_5$5 = {
  class: "form-group",
  style: { "flex": "1" }
};
const _hoisted_6$5 = { class: "form-group" };
const _hoisted_7$2 = { style: { "display": "flex", "gap": "10px" } };
const _hoisted_8$2 = {
  key: 0,
  class: "form-group",
  style: { "flex": "1" }
};
const _hoisted_9$2 = {
  class: "form-group",
  style: { "flex": "1" }
};
const _hoisted_10$2 = { class: "form-label" };
const _hoisted_11$2 = { style: { "display": "flex", "gap": "10px" } };
const _hoisted_12$2 = {
  class: "form-group",
  style: { "flex": "1" }
};
const _hoisted_13$2 = {
  key: 0,
  class: "form-group",
  style: { "flex": "1" }
};
const _hoisted_14$2 = { style: { "display": "flex", "gap": "16px", "padding-top": "8px" } };
const _hoisted_15$2 = { class: "radio-label" };
const _hoisted_16$2 = { class: "radio-label" };
const _hoisted_17$2 = {
  key: 0,
  class: "group-builder"
};
const _hoisted_18$2 = {
  class: "form-label",
  style: { "margin-bottom": "8px" }
};
const _hoisted_19$2 = {
  key: 0,
  class: "group-list"
};
const _hoisted_20$2 = ["onClick"];
const _hoisted_21$2 = { class: "group-card-name" };
const _hoisted_22$2 = {
  key: 0,
  class: "group-card-count"
};
const _hoisted_23$2 = {
  key: 1,
  class: "group-empty"
};
const _hoisted_24$2 = {
  key: 2,
  class: "group-form"
};
const _hoisted_25$2 = { class: "group-members-grid" };
const _hoisted_26$2 = ["onClick"];
const _hoisted_27$2 = { style: { "display": "flex", "gap": "8px", "justify-content": "flex-end", "margin-top": "8px" } };
const _hoisted_28$1 = ["disabled"];
const _hoisted_29$1 = {
  class: "checkbox-label",
  style: { "display": "flex", "align-items": "center", "gap": "8px" }
};
const _hoisted_30$1 = {
  class: "modal-footer",
  style: { "padding": "12px 16px", "border-top": "1px solid var(--border)", "display": "flex", "justify-content": "flex-end", "gap": "8px", "flex-shrink": "0" }
};
const _hoisted_31 = ["disabled"];
const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  __name: "NewTravailModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const appStore = useAppStore();
    const travauxStore = useTravauxStore();
    const { showToast } = useToast();
    const title = /* @__PURE__ */ ref("");
    const description = /* @__PURE__ */ ref("");
    const type = /* @__PURE__ */ ref("devoir");
    const category = /* @__PURE__ */ ref("");
    const deadline = /* @__PURE__ */ ref(isoForDatetimeLocal());
    const startDate = /* @__PURE__ */ ref(isoForDatetimeLocal());
    const isDraft = /* @__PURE__ */ ref(false);
    const assignTo = /* @__PURE__ */ ref("all");
    const channelId = /* @__PURE__ */ ref(null);
    const channels = /* @__PURE__ */ ref([]);
    const creating = /* @__PURE__ */ ref(false);
    const students = /* @__PURE__ */ ref([]);
    const groups = /* @__PURE__ */ ref([]);
    const selectedGroupId = /* @__PURE__ */ ref(null);
    const newGroupName = /* @__PURE__ */ ref("");
    const newGroupMembers = /* @__PURE__ */ ref([]);
    const creatingGroup = /* @__PURE__ */ ref(false);
    const showGroupForm = /* @__PURE__ */ ref(false);
    const groupMembers = /* @__PURE__ */ ref({});
    watch(() => props.modelValue, async (open) => {
      if (open && appStore.activePromoId) {
        const [chRes, stuRes, grpRes] = await Promise.all([
          window.api.getChannels(appStore.activePromoId),
          window.api.getStudents(appStore.activePromoId),
          window.api.getGroups(appStore.activePromoId)
        ]);
        channels.value = chRes?.ok ? chRes.data : [];
        students.value = stuRes?.ok ? stuRes.data : [];
        groups.value = grpRes?.ok ? grpRes.data : [];
        channelId.value = appStore.activeChannelId;
        title.value = description.value = category.value = "";
        type.value = "devoir";
        assignTo.value = "all";
        isDraft.value = false;
        deadline.value = startDate.value = isoForDatetimeLocal();
        selectedGroupId.value = null;
        showGroupForm.value = false;
        newGroupName.value = "";
        newGroupMembers.value = [];
      }
    });
    async function selectGroup(g) {
      selectedGroupId.value = g.id;
      if (!groupMembers.value[g.id]) {
        const res = await window.api.getGroupMembers(g.id);
        groupMembers.value[g.id] = res?.ok ? res.data.map((m) => m.student_id) : [];
      }
    }
    async function createGroup() {
      if (!newGroupName.value.trim() || !appStore.activePromoId) return;
      creatingGroup.value = true;
      try {
        const res = await window.api.createGroup({ name: newGroupName.value.trim(), promoId: appStore.activePromoId });
        if (!res?.ok) return;
        const newId = res.data.id;
        await window.api.setGroupMembers({ groupId: newId, memberIds: newGroupMembers.value });
        groupMembers.value[newId] = [...newGroupMembers.value];
        const grpRes = await window.api.getGroups(appStore.activePromoId);
        groups.value = grpRes?.ok ? grpRes.data : [];
        selectedGroupId.value = newId;
        showGroupForm.value = false;
        newGroupName.value = "";
        newGroupMembers.value = [];
      } finally {
        creatingGroup.value = false;
      }
    }
    function toggleMember(studentId) {
      const idx = newGroupMembers.value.indexOf(studentId);
      if (idx >= 0) newGroupMembers.value.splice(idx, 1);
      else newGroupMembers.value.push(studentId);
    }
    const isJalon = computed(() => type.value === "jalon");
    async function submit() {
      if (!title.value.trim() || !channelId.value) return;
      creating.value = true;
      try {
        const res = await travauxStore.createTravail({
          title: title.value.trim(),
          description: description.value.trim() || null,
          type: type.value,
          category: category.value.trim() || null,
          deadline: deadline.value,
          startDate: isJalon.value ? null : startDate.value,
          isPublished: !isDraft.value,
          assignedTo: assignTo.value,
          groupId: assignTo.value === "group" ? selectedGroupId.value : null,
          channelId: channelId.value
        });
        if (!res) return;
        showToast("Travail créé.", "success");
        emit2("update:modelValue", false);
      } finally {
        creating.value = false;
      }
    }
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: "Nouveau travail",
        "max-width": "620px",
        "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          createBaseVNode("form", {
            style: { "padding": "16px", "display": "flex", "flex-direction": "column", "gap": "12px" },
            onSubmit: withModifiers(submit, ["prevent"])
          }, [
            createBaseVNode("div", _hoisted_1$7, [
              _cache[16] || (_cache[16] = createBaseVNode("label", { class: "form-label" }, "Canal", -1)),
              withDirectives(createBaseVNode("select", {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => channelId.value = $event),
                class: "form-select",
                required: ""
              }, [
                _cache[15] || (_cache[15] = createBaseVNode("option", { value: null }, "Choisir un canal…", -1)),
                (openBlock(true), createElementBlock(Fragment, null, renderList(channels.value, (c) => {
                  return openBlock(), createElementBlock("option", {
                    key: c.id,
                    value: c.id
                  }, toDisplayString(c.name), 9, _hoisted_2$7);
                }), 128))
              ], 512), [
                [vModelSelect, channelId.value]
              ])
            ]),
            createBaseVNode("div", _hoisted_3$7, [
              createBaseVNode("div", _hoisted_4$6, [
                _cache[17] || (_cache[17] = createBaseVNode("label", { class: "form-label" }, "Titre", -1)),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => title.value = $event),
                  type: "text",
                  class: "form-input",
                  placeholder: "Titre du travail",
                  required: ""
                }, null, 512), [
                  [vModelText, title.value]
                ])
              ]),
              createBaseVNode("div", _hoisted_5$5, [
                _cache[19] || (_cache[19] = createBaseVNode("label", { class: "form-label" }, "Type", -1)),
                withDirectives(createBaseVNode("select", {
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => type.value = $event),
                  class: "form-select"
                }, [..._cache[18] || (_cache[18] = [
                  createBaseVNode("option", { value: "devoir" }, "Devoir", -1),
                  createBaseVNode("option", { value: "jalon" }, "Jalon", -1),
                  createBaseVNode("option", { value: "projet" }, "Projet", -1)
                ])], 512), [
                  [vModelSelect, type.value]
                ])
              ])
            ]),
            createBaseVNode("div", _hoisted_6$5, [
              _cache[20] || (_cache[20] = createBaseVNode("label", { class: "form-label" }, [
                createTextVNode("Description "),
                createBaseVNode("span", { style: { "opacity": ".6" } }, "(optionnel)")
              ], -1)),
              withDirectives(createBaseVNode("textarea", {
                "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => description.value = $event),
                class: "form-input",
                rows: "3",
                style: { "resize": "vertical" },
                placeholder: "Instructions, objectifs…"
              }, null, 512), [
                [vModelText, description.value]
              ])
            ]),
            createBaseVNode("div", _hoisted_7$2, [
              !isJalon.value ? (openBlock(), createElementBlock("div", _hoisted_8$2, [
                _cache[21] || (_cache[21] = createBaseVNode("label", { class: "form-label" }, "Date de début", -1)),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => startDate.value = $event),
                  type: "datetime-local",
                  class: "form-input"
                }, null, 512), [
                  [vModelText, startDate.value]
                ])
              ])) : createCommentVNode("", true),
              createBaseVNode("div", _hoisted_9$2, [
                createBaseVNode("label", _hoisted_10$2, toDisplayString(isJalon.value ? "Date du jalon" : "Date limite"), 1),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => deadline.value = $event),
                  type: "datetime-local",
                  class: "form-input",
                  required: ""
                }, null, 512), [
                  [vModelText, deadline.value]
                ])
              ])
            ]),
            createBaseVNode("div", _hoisted_11$2, [
              createBaseVNode("div", _hoisted_12$2, [
                _cache[22] || (_cache[22] = createBaseVNode("label", { class: "form-label" }, [
                  createTextVNode("Catégorie "),
                  createBaseVNode("span", { style: { "opacity": ".6" } }, "(optionnel)")
                ], -1)),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => category.value = $event),
                  type: "text",
                  class: "form-input",
                  placeholder: "ex : TP, Projet…"
                }, null, 512), [
                  [vModelText, category.value]
                ])
              ]),
              !isJalon.value ? (openBlock(), createElementBlock("div", _hoisted_13$2, [
                _cache[25] || (_cache[25] = createBaseVNode("label", { class: "form-label" }, "Assigné à", -1)),
                createBaseVNode("div", _hoisted_14$2, [
                  createBaseVNode("label", _hoisted_15$2, [
                    withDirectives(createBaseVNode("input", {
                      "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => assignTo.value = $event),
                      type: "radio",
                      value: "all"
                    }, null, 512), [
                      [vModelRadio, assignTo.value]
                    ]),
                    _cache[23] || (_cache[23] = createTextVNode(" Toute la promo", -1))
                  ]),
                  createBaseVNode("label", _hoisted_16$2, [
                    withDirectives(createBaseVNode("input", {
                      "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => assignTo.value = $event),
                      type: "radio",
                      value: "group"
                    }, null, 512), [
                      [vModelRadio, assignTo.value]
                    ]),
                    _cache[24] || (_cache[24] = createTextVNode(" Par groupe", -1))
                  ])
                ])
              ])) : createCommentVNode("", true)
            ]),
            assignTo.value === "group" && !isJalon.value ? (openBlock(), createElementBlock("div", _hoisted_17$2, [
              createBaseVNode("div", _hoisted_18$2, [
                createVNode(unref(Users), {
                  size: 13,
                  style: { "vertical-align": "middle", "margin-right": "4px" }
                }),
                _cache[26] || (_cache[26] = createTextVNode(" Groupes disponibles ", -1))
              ]),
              groups.value.length ? (openBlock(), createElementBlock("div", _hoisted_19$2, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(groups.value, (g) => {
                  return openBlock(), createElementBlock("button", {
                    key: g.id,
                    class: normalizeClass(["group-card", { selected: selectedGroupId.value === g.id }]),
                    type: "button",
                    onClick: ($event) => selectGroup(g)
                  }, [
                    createBaseVNode("span", _hoisted_21$2, toDisplayString(g.name), 1),
                    groupMembers.value[g.id] ? (openBlock(), createElementBlock("span", _hoisted_22$2, toDisplayString(groupMembers.value[g.id].length) + " membre" + toDisplayString(groupMembers.value[g.id].length > 1 ? "s" : ""), 1)) : createCommentVNode("", true)
                  ], 10, _hoisted_20$2);
                }), 128))
              ])) : !showGroupForm.value ? (openBlock(), createElementBlock("p", _hoisted_23$2, "Aucun groupe créé pour cette promotion.")) : createCommentVNode("", true),
              showGroupForm.value ? (openBlock(), createElementBlock("div", _hoisted_24$2, [
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => newGroupName.value = $event),
                  class: "form-input",
                  placeholder: "Nom du groupe…",
                  style: { "font-size": "13px" }
                }, null, 512), [
                  [vModelText, newGroupName.value]
                ]),
                createBaseVNode("div", _hoisted_25$2, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(students.value, (s) => {
                    return openBlock(), createElementBlock("button", {
                      key: s.id,
                      class: normalizeClass(["group-member-btn", { selected: newGroupMembers.value.includes(s.id) }]),
                      type: "button",
                      onClick: ($event) => toggleMember(s.id)
                    }, [
                      createBaseVNode("div", {
                        class: "avatar",
                        style: normalizeStyle({ background: unref(avatarColor)(s.name), width: "22px", height: "22px", fontSize: "9px", borderRadius: "4px" })
                      }, toDisplayString(unref(initials)(s.name)), 5),
                      createBaseVNode("span", null, toDisplayString(s.name), 1)
                    ], 10, _hoisted_26$2);
                  }), 128))
                ]),
                createBaseVNode("div", _hoisted_27$2, [
                  createBaseVNode("button", {
                    class: "btn-ghost",
                    type: "button",
                    style: { "font-size": "12px" },
                    onClick: _cache[10] || (_cache[10] = ($event) => showGroupForm.value = false)
                  }, [
                    createVNode(unref(X), { size: 12 }),
                    _cache[27] || (_cache[27] = createTextVNode(" Annuler ", -1))
                  ]),
                  createBaseVNode("button", {
                    class: "btn-primary",
                    type: "button",
                    style: { "font-size": "12px" },
                    disabled: !newGroupName.value.trim() || creatingGroup.value,
                    onClick: createGroup
                  }, toDisplayString(creatingGroup.value ? "Création…" : "Créer le groupe"), 9, _hoisted_28$1)
                ])
              ])) : createCommentVNode("", true),
              !showGroupForm.value ? (openBlock(), createElementBlock("button", {
                key: 3,
                class: "btn-ghost",
                type: "button",
                style: { "font-size": "12px", "margin-top": "8px" },
                onClick: _cache[11] || (_cache[11] = ($event) => showGroupForm.value = true)
              }, [
                createVNode(unref(Plus), { size: 12 }),
                _cache[28] || (_cache[28] = createTextVNode(" Nouveau groupe ", -1))
              ])) : createCommentVNode("", true)
            ])) : createCommentVNode("", true),
            createBaseVNode("label", _hoisted_29$1, [
              withDirectives(createBaseVNode("input", {
                "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => isDraft.value = $event),
                type: "checkbox"
              }, null, 512), [
                [vModelCheckbox, isDraft.value]
              ]),
              _cache[29] || (_cache[29] = createTextVNode(" Enregistrer comme brouillon (non visible par les étudiants) ", -1))
            ])
          ], 32),
          createBaseVNode("div", _hoisted_30$1, [
            createBaseVNode("button", {
              class: "btn-ghost",
              onClick: _cache[13] || (_cache[13] = ($event) => emit2("update:modelValue", false))
            }, "Annuler"),
            createBaseVNode("button", {
              class: "btn-primary",
              disabled: !title.value.trim() || !channelId.value || creating.value,
              onClick: submit
            }, toDisplayString(creating.value ? "Création…" : isDraft.value ? "Enregistrer brouillon" : "Publier"), 9, _hoisted_31)
          ])
        ]),
        _: 1
      }, 8, ["model-value"]);
    };
  }
});
const NewTravailModal = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["__scopeId", "data-v-13ade38d"]]);
const _hoisted_1$6 = {
  key: 0,
  class: "depots-subheader"
};
const _hoisted_2$6 = { class: "depots-meta-row" };
const _hoisted_3$6 = { class: "depots-deadline" };
const _hoisted_4$5 = { class: "depots-progress-row" };
const _hoisted_5$4 = { class: "depots-progress-label" };
const _hoisted_6$4 = {
  class: "linear-progress",
  style: { "flex": "1" }
};
const _hoisted_7$1 = { class: "depots-progress-pct" };
const _hoisted_8$1 = { class: "depots-body" };
const _hoisted_9$1 = {
  key: 0,
  class: "empty-hint",
  style: { "padding": "32px 0" }
};
const _hoisted_10$1 = { class: "depot-card-body" };
const _hoisted_11$1 = { class: "depot-card-top" };
const _hoisted_12$1 = { class: "depot-student-name" };
const _hoisted_13$1 = { class: "depot-date" };
const _hoisted_14$1 = ["onClick"];
const _hoisted_15$1 = {
  key: 0,
  class: "depot-feedback-text"
};
const _hoisted_16$1 = {
  key: 1,
  class: "depot-feedback-form"
};
const _hoisted_17$1 = { class: "feedback-bank" };
const _hoisted_18$1 = ["onClick"];
const _hoisted_19$1 = { class: "depot-feedback-actions" };
const _hoisted_20$1 = ["disabled", "onClick"];
const _hoisted_21$1 = { class: "depot-card-actions" };
const _hoisted_22$1 = { class: "note-selector" };
const _hoisted_23$1 = ["onClick"];
const _hoisted_24$1 = { style: { "display": "flex", "gap": "6px", "margin-top": "6px" } };
const _hoisted_25$1 = ["disabled", "onClick"];
const _hoisted_26$1 = ["title", "onClick"];
const _hoisted_27$1 = ["onClick"];
const _hoisted_28 = ["onClick"];
const _hoisted_29 = { class: "depots-footer" };
const _hoisted_30 = { style: { "display": "flex", "gap": "8px" } };
const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "DepotsModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const travauxStore = useTravauxStore();
    const appStore = useAppStore();
    const { showToast } = useToast();
    const editingNoteId = /* @__PURE__ */ ref(null);
    const noteInput = /* @__PURE__ */ ref("");
    const editingFeedbackId = /* @__PURE__ */ ref(null);
    const feedbackInput = /* @__PURE__ */ ref("");
    const saving = /* @__PURE__ */ ref(false);
    const NOTES = ["A", "B", "C", "D", "NA"];
    const FEEDBACK_BANK = [
      "Excellent travail, bravo !",
      "Bonne structure et organisation",
      "Code insuffisamment commenté",
      "Rendu incomplet",
      "Hors sujet par rapport aux consignes",
      "À retravailler et soumettre à nouveau",
      "Manque de profondeur dans l'analyse",
      "Bon effort, quelques ajustements nécessaires"
    ];
    function insertFeedback(text) {
      feedbackInput.value = feedbackInput.value ? feedbackInput.value.trimEnd() + " " + text : text;
    }
    watch(() => props.modelValue, async (open) => {
      if (open && appStore.currentTravailId) {
        await travauxStore.openTravail(appStore.currentTravailId);
      }
    });
    const totalStudents = computed(() => travauxStore.depots.length);
    const notedCount = computed(() => travauxStore.depots.filter((d) => d.note != null).length);
    const progressPct = computed(
      () => totalStudents.value ? Math.round(notedCount.value / totalStudents.value * 100) : 0
    );
    function startNote(d) {
      editingNoteId.value = d.id;
      noteInput.value = d.note ?? "";
      editingFeedbackId.value = null;
    }
    async function saveNote(d) {
      saving.value = true;
      try {
        await travauxStore.setNote({ depotId: d.id, note: noteInput.value });
        editingNoteId.value = null;
        showToast("Note enregistrée", "success");
      } finally {
        saving.value = false;
      }
    }
    function startFeedback(d) {
      editingFeedbackId.value = d.id;
      feedbackInput.value = d.feedback ?? "";
      editingNoteId.value = null;
    }
    async function saveFeedback(d) {
      saving.value = true;
      try {
        await travauxStore.setFeedback({ depotId: d.id, feedback: feedbackInput.value });
        editingFeedbackId.value = null;
        showToast("Commentaire enregistré", "success");
      } finally {
        saving.value = false;
      }
    }
    async function openDepot(d) {
      if (d.type === "link") {
        await window.api.openExternal(d.content);
      } else {
        await window.api.openPath(d.content);
      }
    }
    async function downloadDepot(d) {
      if (d.type === "file") {
        await window.api.downloadFile(d.content);
      }
    }
    async function markAllD() {
      if (!appStore.currentTravailId) return;
      await travauxStore.markNonSubmittedAsD(appStore.currentTravailId);
      showToast("Rendus manquants marqués D", "success");
    }
    async function exportCsv() {
      if (!appStore.currentTravailId) return;
      const res = await window.api.exportCsv(appStore.currentTravailId);
      if (res?.ok && res.data) showToast(`Export : ${res.data}`, "success");
    }
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: unref(travauxStore).currentTravail?.title ?? "Dépôts",
        "max-width": "820px",
        "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          unref(travauxStore).currentTravail ? (openBlock(), createElementBlock("div", _hoisted_1$6, [
            createBaseVNode("div", _hoisted_2$6, [
              createBaseVNode("span", {
                class: normalizeClass(["travail-type-badge", `type-${unref(travauxStore).currentTravail.type}`])
              }, toDisplayString(unref(travauxStore).currentTravail.type), 3),
              createBaseVNode("span", _hoisted_3$6, " Échéance : " + toDisplayString(unref(formatDate)(unref(travauxStore).currentTravail.deadline)), 1)
            ]),
            createBaseVNode("div", _hoisted_4$5, [
              createBaseVNode("span", _hoisted_5$4, [
                createBaseVNode("strong", null, toDisplayString(notedCount.value), 1),
                createTextVNode(" / " + toDisplayString(totalStudents.value) + " noté" + toDisplayString(notedCount.value > 1 ? "s" : ""), 1)
              ]),
              createBaseVNode("div", _hoisted_6$4, [
                createBaseVNode("div", {
                  class: "linear-progress-fill",
                  style: normalizeStyle({ width: progressPct.value + "%" })
                }, null, 4)
              ]),
              createBaseVNode("span", _hoisted_7$1, toDisplayString(progressPct.value) + " %", 1)
            ])
          ])) : createCommentVNode("", true),
          createBaseVNode("div", _hoisted_8$1, [
            unref(travauxStore).depots.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_9$1, [..._cache[5] || (_cache[5] = [
              createBaseVNode("p", null, "Aucun rendu déposé pour l'instant.", -1)
            ])])) : createCommentVNode("", true),
            (openBlock(true), createElementBlock(Fragment, null, renderList(unref(travauxStore).depots, (d) => {
              return openBlock(), createElementBlock("div", {
                key: d.id,
                class: normalizeClass(["depot-card", { "has-note": d.note != null }])
              }, [
                createBaseVNode("div", {
                  class: "avatar",
                  style: normalizeStyle({ background: unref(avatarColor)(d.student_name), width: "36px", height: "36px", fontSize: "12px", borderRadius: "8px" })
                }, toDisplayString(unref(initials)(d.student_name)), 5),
                createBaseVNode("div", _hoisted_10$1, [
                  createBaseVNode("div", _hoisted_11$1, [
                    createBaseVNode("span", _hoisted_12$1, toDisplayString(d.student_name), 1),
                    createBaseVNode("span", _hoisted_13$1, toDisplayString(unref(formatDate)(d.submitted_at)), 1)
                  ]),
                  createBaseVNode("button", {
                    class: "depot-file-btn",
                    onClick: ($event) => openDepot(d)
                  }, [
                    (openBlock(), createBlock(resolveDynamicComponent(d.type === "link" ? unref(Link2) : unref(FileText)), { size: 12 })),
                    createTextVNode(" " + toDisplayString(d.type === "file" ? d.file_name ?? d.content : d.content), 1)
                  ], 8, _hoisted_14$1),
                  d.feedback && editingFeedbackId.value !== d.id ? (openBlock(), createElementBlock("p", _hoisted_15$1, " 💬 " + toDisplayString(d.feedback), 1)) : createCommentVNode("", true),
                  editingFeedbackId.value === d.id ? (openBlock(), createElementBlock("div", _hoisted_16$1, [
                    createBaseVNode("div", _hoisted_17$1, [
                      (openBlock(), createElementBlock(Fragment, null, renderList(FEEDBACK_BANK, (fb) => {
                        return createBaseVNode("button", {
                          key: fb,
                          class: "feedback-bank-pill",
                          type: "button",
                          onClick: ($event) => insertFeedback(fb)
                        }, toDisplayString(fb), 9, _hoisted_18$1);
                      }), 64))
                    ]),
                    withDirectives(createBaseVNode("textarea", {
                      "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => feedbackInput.value = $event),
                      class: "form-textarea",
                      rows: "2",
                      placeholder: "Commentaire pour l'étudiant…",
                      style: { "font-size": "13px" }
                    }, null, 512), [
                      [vModelText, feedbackInput.value]
                    ]),
                    createBaseVNode("div", _hoisted_19$1, [
                      createBaseVNode("button", {
                        class: "btn-ghost",
                        style: { "font-size": "12px" },
                        onClick: _cache[1] || (_cache[1] = ($event) => editingFeedbackId.value = null)
                      }, [
                        createVNode(unref(X), { size: 11 }),
                        _cache[6] || (_cache[6] = createTextVNode(" Annuler ", -1))
                      ]),
                      createBaseVNode("button", {
                        class: "btn-primary",
                        style: { "font-size": "12px" },
                        disabled: saving.value,
                        onClick: ($event) => saveFeedback(d)
                      }, " Enregistrer ", 8, _hoisted_20$1)
                    ])
                  ])) : createCommentVNode("", true)
                ]),
                createBaseVNode("div", _hoisted_21$1, [
                  editingNoteId.value === d.id ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                    createBaseVNode("div", _hoisted_22$1, [
                      (openBlock(), createElementBlock(Fragment, null, renderList(NOTES, (n) => {
                        return createBaseVNode("button", {
                          key: n,
                          class: normalizeClass(["note-btn", { active: noteInput.value === n, [unref(gradeClass)(n)]: true }]),
                          onClick: ($event) => noteInput.value = n
                        }, toDisplayString(n), 11, _hoisted_23$1);
                      }), 64))
                    ]),
                    createBaseVNode("div", _hoisted_24$1, [
                      createBaseVNode("button", {
                        class: "btn-ghost",
                        style: { "font-size": "11px", "padding": "3px 8px" },
                        onClick: _cache[2] || (_cache[2] = ($event) => editingNoteId.value = null)
                      }, " Annuler "),
                      createBaseVNode("button", {
                        class: "btn-primary",
                        style: { "font-size": "11px", "padding": "3px 8px" },
                        disabled: saving.value || !noteInput.value,
                        onClick: ($event) => saveNote(d)
                      }, " OK ", 8, _hoisted_25$1)
                    ])
                  ], 64)) : (openBlock(), createElementBlock("button", {
                    key: 1,
                    class: normalizeClass(["note-display-btn", d.note ? unref(gradeClass)(d.note) : "grade-empty"]),
                    title: d.note ? `Note : ${d.note}` : "Cliquer pour noter",
                    onClick: ($event) => startNote(d)
                  }, toDisplayString(d.note ? unref(formatGrade)(d.note) : "—"), 11, _hoisted_26$1)),
                  createBaseVNode("button", {
                    class: "btn-icon",
                    title: "Ajouter un commentaire",
                    style: { "margin-top": "4px" },
                    onClick: ($event) => startFeedback(d)
                  }, [
                    createVNode(unref(MessageSquare), { size: 13 })
                  ], 8, _hoisted_27$1),
                  d.type === "file" ? (openBlock(), createElementBlock("button", {
                    key: 2,
                    class: "btn-icon",
                    title: "Télécharger",
                    onClick: ($event) => downloadDepot(d)
                  }, [
                    createVNode(unref(Download), { size: 13 })
                  ], 8, _hoisted_28)) : createCommentVNode("", true)
                ])
              ], 2);
            }), 128))
          ]),
          createBaseVNode("div", _hoisted_29, [
            createBaseVNode("button", {
              class: "btn-ghost",
              style: { "font-size": "13px" },
              onClick: markAllD
            }, " Marquer non soumis → D "),
            createBaseVNode("div", _hoisted_30, [
              createBaseVNode("button", {
                class: "btn-ghost",
                style: { "font-size": "13px" },
                onClick: exportCsv
              }, " Export CSV "),
              createBaseVNode("button", {
                class: "btn-primary",
                style: { "font-size": "13px" },
                onClick: _cache[3] || (_cache[3] = ($event) => emit2("update:modelValue", false))
              }, " Fermer ")
            ])
          ])
        ]),
        _: 1
      }, 8, ["model-value", "title"]);
    };
  }
});
const DepotsModal = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["__scopeId", "data-v-509f6477"]]);
const _hoisted_1$5 = { style: { "padding": "24px", "min-height": "200px" } };
const _hoisted_2$5 = { style: { "margin-bottom": "16px" } };
const _hoisted_3$5 = { style: { "display": "flex", "justify-content": "space-between", "font-size": "13px", "margin-bottom": "6px" } };
const _hoisted_4$4 = { style: { "height": "8px", "background": "var(--bg-tertiary)", "border-radius": "4px" } };
const _hoisted_5$3 = { style: { "color": "var(--text-muted)", "font-size": "12px", "text-align": "center", "margin-top": "8px" } };
const _hoisted_6$3 = {
  class: "modal-footer",
  style: { "padding": "12px 16px", "border-top": "1px solid var(--border)", "display": "flex", "gap": "8px", "justify-content": "flex-end" }
};
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "SuiviModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const api = window.api;
    const props = __props;
    const emit2 = __emit;
    const travauxStore = useTravauxStore();
    const appStore = useAppStore();
    const pct = computed(() => {
      const suivi = travauxStore.depots;
      return suivi.length ? Math.round(suivi.filter((d) => d.submitted_at).length / suivi.length * 100) : 0;
    });
    watch(() => props.modelValue, async (open) => {
      if (open && appStore.currentTravailId) {
        await travauxStore.fetchDepots(appStore.currentTravailId);
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: "Suivi du travail",
        "max-width": "760px",
        "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_1$5, [
            createBaseVNode("div", _hoisted_2$5, [
              createBaseVNode("div", _hoisted_3$5, [
                _cache[3] || (_cache[3] = createBaseVNode("span", null, "Rendus", -1)),
                createBaseVNode("span", null, toDisplayString(pct.value) + "%", 1)
              ]),
              createBaseVNode("div", _hoisted_4$4, [
                createBaseVNode("div", {
                  id: "suivi-progress-fill",
                  style: normalizeStyle([{ "height": "100%", "border-radius": "4px", "background": "var(--accent)", "transition": "width .3s" }, { width: `${pct.value}%` }])
                }, null, 4)
              ])
            ]),
            _cache[4] || (_cache[4] = createBaseVNode("p", { style: { "color": "var(--text-muted)", "font-size": "13px", "text-align": "center" } }, [
              createTextVNode(" Liste des rendus à implémenter."),
              createBaseVNode("br"),
              createTextVNode(" Référence : "),
              createBaseVNode("code", null, "renderer/js/views/suivi.js")
            ], -1)),
            createBaseVNode("p", _hoisted_5$3, toDisplayString(unref(travauxStore).depots.length) + " entrées chargées. ", 1)
          ]),
          createBaseVNode("div", _hoisted_6$3, [
            createBaseVNode("button", {
              class: "btn-ghost",
              style: { "font-size": "12px" },
              onClick: _cache[0] || (_cache[0] = ($event) => unref(appStore).currentTravailId && unref(api).exportCsv(unref(appStore).currentTravailId))
            }, " Exporter CSV "),
            createBaseVNode("button", {
              class: "btn-danger",
              style: { "font-size": "12px" },
              onClick: _cache[1] || (_cache[1] = ($event) => unref(appStore).currentTravailId && unref(travauxStore).markNonSubmittedAsD(unref(appStore).currentTravailId))
            }, " Non rendus → D ")
          ])
        ]),
        _: 1
      }, 8, ["model-value"]);
    };
  }
});
const _hoisted_1$4 = {
  key: 0,
  class: "gd-loading"
};
const _hoisted_2$4 = { class: "gd-meta" };
const _hoisted_3$4 = { class: "gd-meta-badges" };
const _hoisted_4$3 = {
  key: 0,
  class: "tag-badge"
};
const _hoisted_5$2 = { class: "gd-meta-info" };
const _hoisted_6$2 = { class: "gd-info-item" };
const _hoisted_7 = {
  key: 0,
  class: "gd-info-item"
};
const _hoisted_8 = {
  key: 1,
  class: "gd-info-item"
};
const _hoisted_9 = { class: "gd-info-item" };
const _hoisted_10 = {
  key: 0,
  class: "gd-description"
};
const _hoisted_11 = { class: "gd-progress-block" };
const _hoisted_12 = { class: "gd-progress-header" };
const _hoisted_13 = { class: "gd-progress-counts" };
const _hoisted_14 = { class: "linear-progress" };
const _hoisted_15 = { class: "gd-columns" };
const _hoisted_16 = { class: "gd-column" };
const _hoisted_17 = { class: "gd-column-header" };
const _hoisted_18 = { class: "gd-column-body" };
const _hoisted_19 = { class: "gd-student-name" };
const _hoisted_20 = {
  key: 1,
  class: "gd-no-grade"
};
const _hoisted_21 = {
  key: 0,
  class: "gd-empty"
};
const _hoisted_22 = { class: "gd-column" };
const _hoisted_23 = { class: "gd-column-header" };
const _hoisted_24 = { class: "gd-column-body" };
const _hoisted_25 = {
  class: "gd-student-name",
  style: { "opacity": ".6" }
};
const _hoisted_26 = {
  key: 0,
  class: "gd-empty",
  style: { "color": "var(--color-success)" }
};
const _hoisted_27 = { class: "gd-footer" };
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "GestionDevoirModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const travauxStore = useTravauxStore();
    const appStore = useAppStore();
    const modals = useModalsStore();
    watch(() => props.modelValue, async (open) => {
      if (open && appStore.currentTravailId) {
        await travauxStore.openTravail(appStore.currentTravailId);
      }
    });
    const travail = computed(() => travauxStore.currentTravail);
    const depots = computed(() => travauxStore.depots);
    const submittedDepots = computed(() => depots.value.filter((d) => d.submitted_at));
    const notedDepots = computed(() => depots.value.filter((d) => d.note != null));
    const totalCount = computed(() => depots.value.length);
    const submitPct = computed(
      () => totalCount.value ? Math.round(submittedDepots.value.length / totalCount.value * 100) : 0
    );
    function openDepots() {
      emit2("update:modelValue", false);
      modals.depots = true;
    }
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: travail.value?.title ?? "Détail du travail",
        "max-width": "680px",
        "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          !travail.value ? (openBlock(), createElementBlock("div", _hoisted_1$4, [..._cache[2] || (_cache[2] = [
            createBaseVNode("div", {
              class: "skel skel-line skel-w50",
              style: { "height": "16px", "margin-bottom": "10px" }
            }, null, -1),
            createBaseVNode("div", {
              class: "skel skel-line skel-w90",
              style: { "height": "12px", "margin-bottom": "8px" }
            }, null, -1),
            createBaseVNode("div", {
              class: "skel skel-line skel-w70",
              style: { "height": "12px" }
            }, null, -1)
          ])])) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
            createBaseVNode("div", _hoisted_2$4, [
              createBaseVNode("div", _hoisted_3$4, [
                createBaseVNode("span", {
                  class: normalizeClass(["travail-type-badge", `type-${travail.value.type}`])
                }, toDisplayString(travail.value.type), 3),
                travail.value.category ? (openBlock(), createElementBlock("span", _hoisted_4$3, toDisplayString(travail.value.category), 1)) : createCommentVNode("", true),
                createBaseVNode("span", {
                  class: normalizeClass(["deadline-badge", unref(deadlineClass)(travail.value.deadline)])
                }, [
                  createVNode(unref(Clock), {
                    size: 10,
                    style: { "vertical-align": "middle", "margin-right": "3px" }
                  }),
                  createTextVNode(" " + toDisplayString(unref(deadlineLabel)(travail.value.deadline)), 1)
                ], 2)
              ]),
              createBaseVNode("div", _hoisted_5$2, [
                createBaseVNode("span", _hoisted_6$2, [
                  _cache[3] || (_cache[3] = createBaseVNode("strong", null, "Échéance :", -1)),
                  createTextVNode(" " + toDisplayString(unref(formatDate)(travail.value.deadline)), 1)
                ]),
                travail.value.start_date ? (openBlock(), createElementBlock("span", _hoisted_7, [
                  _cache[4] || (_cache[4] = createBaseVNode("strong", null, "Début :", -1)),
                  createTextVNode(" " + toDisplayString(unref(formatDate)(travail.value.start_date)), 1)
                ])) : createCommentVNode("", true),
                travail.value.channel_name ? (openBlock(), createElementBlock("span", _hoisted_8, [
                  _cache[5] || (_cache[5] = createBaseVNode("strong", null, "Canal :", -1)),
                  createTextVNode(" # " + toDisplayString(travail.value.channel_name), 1)
                ])) : createCommentVNode("", true),
                createBaseVNode("span", _hoisted_9, [
                  _cache[6] || (_cache[6] = createBaseVNode("strong", null, "Assigné à :", -1)),
                  createTextVNode(" " + toDisplayString(travail.value.assigned_to === "group" ? `Groupe ${travail.value.group_name ?? ""}` : "Tous les étudiants"), 1)
                ])
              ]),
              travail.value.description ? (openBlock(), createElementBlock("p", _hoisted_10, toDisplayString(travail.value.description), 1)) : createCommentVNode("", true)
            ]),
            createBaseVNode("div", _hoisted_11, [
              createBaseVNode("div", _hoisted_12, [
                _cache[7] || (_cache[7] = createBaseVNode("span", { class: "gd-progress-title" }, "Rendus", -1)),
                createBaseVNode("span", _hoisted_13, [
                  createBaseVNode("strong", null, toDisplayString(submittedDepots.value.length), 1),
                  createTextVNode(" déposé" + toDisplayString(submittedDepots.value.length > 1 ? "s" : "") + " · ", 1),
                  createBaseVNode("strong", null, toDisplayString(notedDepots.value.length), 1),
                  createTextVNode(" noté" + toDisplayString(notedDepots.value.length > 1 ? "s" : "") + " sur " + toDisplayString(totalCount.value), 1)
                ])
              ]),
              createBaseVNode("div", _hoisted_14, [
                createBaseVNode("div", {
                  class: "linear-progress-fill",
                  style: normalizeStyle({ width: submitPct.value + "%" })
                }, null, 4)
              ])
            ]),
            createBaseVNode("div", _hoisted_15, [
              createBaseVNode("div", _hoisted_16, [
                createBaseVNode("div", _hoisted_17, [
                  createVNode(unref(CircleCheck), {
                    size: 14,
                    style: { "color": "var(--color-success)" }
                  }),
                  createTextVNode(" Rendus (" + toDisplayString(submittedDepots.value.length) + ") ", 1)
                ]),
                createBaseVNode("div", _hoisted_18, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(submittedDepots.value, (d) => {
                    return openBlock(), createElementBlock("div", {
                      key: d.id,
                      class: "gd-student-row"
                    }, [
                      createBaseVNode("div", {
                        class: "avatar",
                        style: normalizeStyle({ background: unref(avatarColor)(d.student_name), width: "26px", height: "26px", fontSize: "9px", borderRadius: "5px" })
                      }, toDisplayString(unref(initials)(d.student_name)), 5),
                      createBaseVNode("span", _hoisted_19, toDisplayString(d.student_name), 1),
                      d.note ? (openBlock(), createElementBlock("span", {
                        key: 0,
                        class: normalizeClass(["gd-grade", unref(gradeClass)(d.note)])
                      }, toDisplayString(unref(formatGrade)(d.note)), 3)) : (openBlock(), createElementBlock("span", _hoisted_20, "—"))
                    ]);
                  }), 128)),
                  submittedDepots.value.length === 0 ? (openBlock(), createElementBlock("div", _hoisted_21, " Aucun rendu pour l'instant. ")) : createCommentVNode("", true)
                ])
              ]),
              createBaseVNode("div", _hoisted_22, [
                createBaseVNode("div", _hoisted_23, [
                  createVNode(unref(CircleX), {
                    size: 14,
                    style: { "color": "var(--color-danger)" }
                  }),
                  createTextVNode(" En attente (" + toDisplayString(totalCount.value - submittedDepots.value.length) + ") ", 1)
                ]),
                createBaseVNode("div", _hoisted_24, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(depots.value.filter((d) => !d.submitted_at), (d) => {
                    return openBlock(), createElementBlock("div", {
                      key: d.id,
                      class: "gd-student-row pending"
                    }, [
                      createBaseVNode("div", {
                        class: "avatar",
                        style: normalizeStyle({ background: unref(avatarColor)(d.student_name), width: "26px", height: "26px", fontSize: "9px", borderRadius: "5px", opacity: ".5" })
                      }, toDisplayString(unref(initials)(d.student_name)), 5),
                      createBaseVNode("span", _hoisted_25, toDisplayString(d.student_name), 1)
                    ]);
                  }), 128)),
                  totalCount.value === submittedDepots.value.length ? (openBlock(), createElementBlock("div", _hoisted_26, " Tout le monde a rendu ! 🎉 ")) : createCommentVNode("", true)
                ])
              ])
            ]),
            createBaseVNode("div", _hoisted_27, [
              createBaseVNode("button", {
                class: "btn-ghost",
                style: { "font-size": "13px" },
                onClick: _cache[0] || (_cache[0] = ($event) => emit2("update:modelValue", false))
              }, " Fermer "),
              createBaseVNode("button", {
                class: "btn-primary",
                style: { "font-size": "13px" },
                onClick: openDepots
              }, [
                createVNode(unref(Users), { size: 14 }),
                _cache[8] || (_cache[8] = createTextVNode(" Voir tous les dépôts ", -1))
              ])
            ])
          ], 64))
        ]),
        _: 1
      }, 8, ["model-value", "title"]);
    };
  }
});
const GestionDevoirModal = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-bf4311dd"]]);
const _hoisted_1$3 = { style: { "padding": "16px", "min-height": "160px" } };
const _hoisted_2$3 = {
  id: "ressources-list",
  style: { "list-style": "none", "display": "flex", "flex-direction": "column", "gap": "6px" }
};
const _hoisted_3$3 = ["onClick"];
const _hoisted_4$2 = ["onClick"];
const _hoisted_5$1 = {
  key: 0,
  style: { "color": "var(--text-muted)", "font-size": "13px", "text-align": "center", "padding": "20px" }
};
const _hoisted_6$1 = {
  key: 0,
  style: { "margin-top": "16px", "font-size": "12px", "color": "var(--text-muted)", "text-align": "center" }
};
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "RessourcesModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const travauxStore = useTravauxStore();
    const appStore = useAppStore();
    watch(() => props.modelValue, async (open2) => {
      if (open2 && appStore.currentTravailId) {
        await travauxStore.fetchRessources(appStore.currentTravailId);
      }
    });
    async function open(content, type) {
      if (type === "link") await window.api.openExternal(content);
      else await window.api.openPath(content);
    }
    async function remove2(id) {
      await window.api.deleteRessource(id);
      if (appStore.currentTravailId) await travauxStore.fetchRessources(appStore.currentTravailId);
    }
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: "Ressources pédagogiques",
        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_1$3, [
            createBaseVNode("ul", _hoisted_2$3, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(travauxStore).ressources, (r) => {
                return openBlock(), createElementBlock("li", {
                  key: r.id,
                  style: { "display": "flex", "align-items": "center", "gap": "8px", "padding": "8px", "background": "var(--bg-tertiary)", "border-radius": "6px" }
                }, [
                  r.type === "link" ? (openBlock(), createBlock(unref(ExternalLink), {
                    key: 0,
                    size: 14,
                    style: { "color": "var(--accent)" }
                  })) : (openBlock(), createBlock(unref(FileText), {
                    key: 1,
                    size: 14,
                    style: { "color": "var(--accent)" }
                  })),
                  createBaseVNode("button", {
                    class: "btn-ghost",
                    style: { "flex": "1", "text-align": "left", "font-size": "13px" },
                    onClick: ($event) => open(r.content, r.type)
                  }, toDisplayString(r.name), 9, _hoisted_3$3),
                  unref(appStore).isTeacher ? (openBlock(), createElementBlock("button", {
                    key: 2,
                    class: "btn-icon",
                    title: "Supprimer",
                    onClick: ($event) => remove2(r.id)
                  }, [
                    createVNode(unref(Trash2), { size: 13 })
                  ], 8, _hoisted_4$2)) : createCommentVNode("", true)
                ]);
              }), 128)),
              !unref(travauxStore).ressources.length ? (openBlock(), createElementBlock("li", _hoisted_5$1, " Aucune ressource. ")) : createCommentVNode("", true)
            ]),
            unref(appStore).isTeacher ? (openBlock(), createElementBlock("p", _hoisted_6$1, [..._cache[1] || (_cache[1] = [
              createTextVNode(" Formulaire d'ajout à implémenter — voir ", -1),
              createBaseVNode("code", null, "renderer/js/views/ressources.js", -1)
            ])])) : createCommentVNode("", true)
          ])
        ]),
        _: 1
      }, 8, ["model-value"]);
    };
  }
});
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "TimelineModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const emit2 = __emit;
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: "Timeline",
        "max-width": "880px",
        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [..._cache[1] || (_cache[1] = [
          createBaseVNode("div", { style: { "padding": "24px", "min-height": "300px", "display": "flex", "align-items": "center", "justify-content": "center" } }, [
            createBaseVNode("div", { style: { "text-align": "center" } }, [
              createBaseVNode("p", { style: { "color": "var(--text-muted)", "font-size": "13px" } }, " Timeline à implémenter. "),
              createBaseVNode("p", { style: { "color": "var(--text-muted)", "font-size": "12px", "margin-top": "8px" } }, [
                createTextVNode(" Référence : "),
                createBaseVNode("code", null, "renderer/js/views/timeline.js")
              ])
            ])
          ], -1)
        ])]),
        _: 1
      }, 8, ["model-value"]);
    };
  }
});
const _hoisted_1$2 = { style: { "padding": "24px", "min-height": "300px", "display": "flex", "align-items": "center", "justify-content": "center" } };
const _hoisted_2$2 = {
  key: 0,
  style: { "color": "var(--text-muted)", "font-size": "13px" }
};
const _hoisted_3$2 = {
  key: 1,
  style: { "text-align": "center" }
};
const _hoisted_4$1 = { style: { "color": "var(--text-muted)", "font-size": "12px", "margin-top": "8px" } };
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "EcheancierModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit2 = __emit;
    const data = /* @__PURE__ */ ref(null);
    const loading = /* @__PURE__ */ ref(false);
    watch(() => props.modelValue, async (open) => {
      if (open) {
        loading.value = true;
        try {
          const res = await window.api.getTeacherSchedule();
          data.value = res?.ok ? res.data : null;
        } finally {
          loading.value = false;
        }
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: "Échéancier",
        "max-width": "760px",
        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_1$2, [
            loading.value ? (openBlock(), createElementBlock("div", _hoisted_2$2, "Chargement…")) : (openBlock(), createElementBlock("div", _hoisted_3$2, [
              _cache[4] || (_cache[4] = createBaseVNode("p", { style: { "color": "var(--text-muted)", "font-size": "13px" } }, " Échéancier à implémenter. ", -1)),
              createBaseVNode("p", _hoisted_4$1, [
                _cache[1] || (_cache[1] = createTextVNode(" Référence : ", -1)),
                _cache[2] || (_cache[2] = createBaseVNode("code", null, "renderer/js/views/echeancier.js", -1)),
                _cache[3] || (_cache[3] = createBaseVNode("br", null, null, -1)),
                createTextVNode("Données chargées : " + toDisplayString(data.value ? "✓" : "—"), 1)
              ])
            ]))
          ])
        ]),
        _: 1
      }, 8, ["model-value"]);
    };
  }
});
const _hoisted_1$1 = {
  id: "doc-preview-body",
  style: { "padding": "16px", "min-height": "400px", "display": "flex", "align-items": "center", "justify-content": "center" }
};
const _hoisted_2$1 = {
  key: 0,
  style: { "color": "var(--text-muted)" }
};
const _hoisted_3$1 = ["src"];
const _hoisted_4 = {
  key: 2,
  style: { "text-align": "center", "color": "var(--text-muted)", "font-size": "13px" }
};
const _hoisted_5 = {
  key: 3,
  style: { "text-align": "center" }
};
const _hoisted_6 = {
  class: "modal-footer",
  style: { "padding": "12px 16px", "border-top": "1px solid var(--border)", "display": "flex", "gap": "8px", "justify-content": "flex-end" }
};
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "DocumentPreviewModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const api = window.api;
    const props = __props;
    const emit2 = __emit;
    const docStore = useDocumentsStore();
    const previewSrc = /* @__PURE__ */ ref(null);
    const loading = /* @__PURE__ */ ref(false);
    watch(() => props.modelValue, async (open) => {
      if (open && docStore.previewDoc?.type === "file") {
        loading.value = true;
        try {
          const res = await api.readFileBase64(docStore.previewDoc.content);
          if (res?.ok) {
            previewSrc.value = `data:${res.data.mime};base64,${res.data.b64}`;
          }
        } finally {
          loading.value = false;
        }
      } else if (!open) {
        previewSrc.value = null;
      }
    });
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Modal, {
        "model-value": __props.modelValue,
        title: unref(docStore).previewDoc?.name ?? "Aperçu",
        "max-width": "900px",
        "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => emit2("update:modelValue", $event))
      }, {
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_1$1, [
            loading.value ? (openBlock(), createElementBlock("div", _hoisted_2$1, "Chargement du fichier…")) : previewSrc.value && previewSrc.value.startsWith("data:image") ? (openBlock(), createElementBlock("img", {
              key: 1,
              src: previewSrc.value,
              style: { "max-width": "100%", "max-height": "600px", "object-fit": "contain", "border-radius": "var(--radius)" }
            }, null, 8, _hoisted_3$1)) : previewSrc.value ? (openBlock(), createElementBlock("div", _hoisted_4, [..._cache[3] || (_cache[3] = [
              createBaseVNode("p", null, "Prévisualisation non disponible pour ce type de fichier.", -1),
              createBaseVNode("p", { style: { "font-size": "12px", "margin-top": "8px" } }, [
                createTextVNode("À implémenter — voir "),
                createBaseVNode("code", null, "renderer/js/views/documents-view.js")
              ], -1)
            ])])) : unref(docStore).previewDoc?.type === "link" ? (openBlock(), createElementBlock("div", _hoisted_5, [
              createVNode(unref(ExternalLink), {
                size: 32,
                style: { "color": "var(--accent)", "margin-bottom": "12px" }
              }),
              createBaseVNode("p", null, toDisplayString(unref(docStore).previewDoc.content), 1),
              createBaseVNode("button", {
                class: "btn-primary",
                style: { "margin-top": "12px" },
                onClick: _cache[0] || (_cache[0] = ($event) => unref(docStore).previewDoc && unref(api).openExternal(unref(docStore).previewDoc.content))
              }, " Ouvrir le lien ")
            ])) : createCommentVNode("", true)
          ]),
          createBaseVNode("div", _hoisted_6, [
            unref(docStore).previewDoc?.type === "file" ? (openBlock(), createElementBlock("button", {
              key: 0,
              class: "btn-ghost",
              style: { "display": "flex", "align-items": "center", "gap": "6px" },
              onClick: _cache[1] || (_cache[1] = ($event) => unref(docStore).previewDoc && unref(api).downloadFile(unref(docStore).previewDoc.content))
            }, [
              createVNode(unref(Download), { size: 14 }),
              _cache[4] || (_cache[4] = createTextVNode(" Télécharger ", -1))
            ])) : createCommentVNode("", true)
          ])
        ]),
        _: 1
      }, 8, ["model-value", "title"]);
    };
  }
});
const _hoisted_1 = {
  key: 1,
  id: "app-shell",
  class: "app-shell"
};
const _hoisted_2 = { class: "sidebar-wrapper" };
const _hoisted_3 = { class: "main-wrapper" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "App",
  setup(__props) {
    const appStore = useAppStore();
    const modals = useModalsStore();
    const router2 = useRouter();
    let unsubUnread = null;
    onMounted(() => {
      const restored = appStore.restoreSession();
      if (restored) router2.replace("/messages");
      unsubUnread = appStore.initUnreadListener();
    });
    onUnmounted(() => {
      unsubUnread?.();
    });
    return (_ctx, _cache) => {
      const _component_RouterView = resolveComponent("RouterView");
      return openBlock(), createElementBlock(Fragment, null, [
        createVNode(Toast),
        !unref(appStore).currentUser ? (openBlock(), createBlock(_sfc_main$d, { key: 0 })) : (openBlock(), createElementBlock("div", _hoisted_1, [
          createVNode(NavRail),
          createBaseVNode("aside", _hoisted_2, [
            createVNode(_sfc_main$e)
          ]),
          createBaseVNode("main", _hoisted_3, [
            createVNode(_component_RouterView)
          ])
        ])),
        unref(appStore).currentUser ? (openBlock(), createElementBlock(Fragment, { key: 2 }, [
          createVNode(CmdPalette),
          createVNode(_sfc_main$a, {
            modelValue: unref(modals).settings,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => unref(modals).settings = $event)
          }, null, 8, ["modelValue"]),
          createVNode(_sfc_main$9, {
            modelValue: unref(modals).createChannel,
            "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => unref(modals).createChannel = $event)
          }, null, 8, ["modelValue"]),
          createVNode(NewTravailModal, {
            modelValue: unref(modals).newTravail,
            "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => unref(modals).newTravail = $event)
          }, null, 8, ["modelValue"]),
          createVNode(DepotsModal, {
            modelValue: unref(modals).depots,
            "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => unref(modals).depots = $event)
          }, null, 8, ["modelValue"]),
          createVNode(_sfc_main$6, {
            modelValue: unref(modals).suivi,
            "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => unref(modals).suivi = $event)
          }, null, 8, ["modelValue"]),
          createVNode(GestionDevoirModal, {
            modelValue: unref(modals).gestionDevoir,
            "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => unref(modals).gestionDevoir = $event)
          }, null, 8, ["modelValue"]),
          createVNode(_sfc_main$4, {
            modelValue: unref(modals).ressources,
            "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => unref(modals).ressources = $event)
          }, null, 8, ["modelValue"]),
          createVNode(_sfc_main$3, {
            modelValue: unref(modals).timeline,
            "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => unref(modals).timeline = $event)
          }, null, 8, ["modelValue"]),
          createVNode(_sfc_main$2, {
            modelValue: unref(modals).echeancier,
            "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => unref(modals).echeancier = $event)
          }, null, 8, ["modelValue"]),
          createVNode(_sfc_main$1, {
            modelValue: unref(modals).documentPreview,
            "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => unref(modals).documentPreview = $event)
          }, null, 8, ["modelValue"])
        ], 64)) : createCommentVNode("", true)
      ], 64);
    };
  }
});
const app = createApp(_sfc_main);
app.use(createPinia());
app.use(router);
app.mount("#app");
