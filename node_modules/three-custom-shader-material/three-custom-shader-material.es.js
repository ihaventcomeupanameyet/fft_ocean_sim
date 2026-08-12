import { jsx as c } from "react/jsx-runtime";
import * as r from "react";
import a from "./vanilla/three-custom-shader-material.es.js";
function l(u, e) {
  const t = r.useRef(!1);
  r.useEffect(() => {
    if (t.current)
      return u();
    t.current = !0;
  }, e);
}
function p({
  baseMaterial: u,
  vertexShader: e,
  fragmentShader: t,
  uniforms: i,
  cacheKey: f,
  patchMap: s,
  attach: d,
  ...n
}, m) {
  const o = r.useMemo(() => new a({
    baseMaterial: u,
    vertexShader: e,
    fragmentShader: t,
    uniforms: i,
    cacheKey: f,
    patchMap: s,
    ...n
  }), [u]);
  return l(() => {
    o.dispose(), o.update({
      vertexShader: e,
      fragmentShader: t,
      uniforms: i,
      patchMap: s,
      cacheKey: f
    });
  }, [e, t, i, s, f]), r.useEffect(() => () => o.dispose(), [o]), /* @__PURE__ */ c(
    "primitive",
    {
      ref: m,
      attach: d ?? "material",
      object: o,
      ...n
    }
  );
}
const j = r.forwardRef(p);
export {
  j as default
};
//# sourceMappingURL=three-custom-shader-material.es.js.map
