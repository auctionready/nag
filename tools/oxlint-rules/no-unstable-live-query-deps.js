/**
 * Flags freshly-constructed values passed to drizzle's useLiveQuery deps array.
 *
 * react-hooks/exhaustive-deps can't help here because useLiveQuery's first
 * argument is a query object, not an inline callback — so the analyzer can't
 * see what the deps need to cover. This rule catches the specific class of
 * bug where a dep is a fresh reference each render (Date, {}, [], or a const
 * initialized to one of those), which causes useLiveQuery to re-subscribe
 * its change listener on every setData and lock the JS thread.
 *
 * Fix: pass a stable scalar key instead, e.g. `date.getTime()` or `obj.id`.
 */

const STABLE_HOOK_RETURNS = new Set([
  "useState",
  "useRef",
  "useMemo",
  "useCallback",
  "useReducer",
  "useId",
]);

const directReason = (expr) => {
  if (!expr) return null;
  switch (expr.type) {
    case "NewExpression": {
      const name = expr.callee.type === "Identifier" ? expr.callee.name : "X";
      return `\`new ${name}(...)\` returns a fresh reference each render`;
    }
    case "ObjectExpression":
      return "object literal creates a fresh reference each render";
    case "ArrayExpression":
      return "array literal creates a fresh reference each render";
    default:
      return null;
  }
};

const initializerReason = (expr) => {
  const direct = directReason(expr);
  if (direct) return direct;
  if (!expr) return null;
  if (expr.type === "ConditionalExpression") {
    const c = initializerReason(expr.consequent);
    if (c) return c;
    const a = initializerReason(expr.alternate);
    if (a) return a;
    if (
      expr.consequent.type === "CallExpression" ||
      expr.alternate.type === "CallExpression"
    ) {
      return "conditional branch is a function call (likely a fresh reference each render)";
    }
  }
  return null;
};

const findVariable = (scope, name) => {
  for (let s = scope; s; s = s.upper) {
    const v = s.variables.find((v) => v.name === name);
    if (v) return v;
  }
  return null;
};

const isStableHookReturn = (init) => {
  if (!init || init.type !== "CallExpression") return false;
  const callee = init.callee;
  return callee.type === "Identifier" && STABLE_HOOK_RETURNS.has(callee.name);
};

export const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow freshly-constructed values in drizzle useLiveQuery dependency arrays",
    },
    schema: [
      {
        type: "object",
        properties: {
          hooks: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      directUnstable:
        "Unstable dependency: {{reason}}. Replace with a stable scalar key (e.g. `.getTime()` for Dates, an id, or memoize the value).",
      identifierUnstable:
        "Dependency `{{name}}` is recreated each render: {{reason}}. Replace with a stable scalar key (e.g. `.getTime()` for Dates) before passing to deps.",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const hookNames = new Set(opts.hooks ?? ["useLiveQuery"]);

    const checkElement = (el) => {
      if (!el) return;
      const direct = directReason(el);
      if (direct) {
        context.report({
          node: el,
          messageId: "directUnstable",
          data: { reason: direct },
        });
        return;
      }
      if (el.type !== "Identifier") return;
      const variable = findVariable(context.sourceCode.getScope(el), el.name);
      const def = variable?.defs[0];
      if (!def || def.type !== "Variable") return;
      const init = def.node.init;
      if (!init || isStableHookReturn(init)) return;
      const reason = initializerReason(init);
      if (reason) {
        context.report({
          node: el,
          messageId: "identifierUnstable",
          data: { name: el.name, reason },
        });
      }
    };

    return {
      CallExpression(node) {
        if (
          node.callee.type !== "Identifier" ||
          !hookNames.has(node.callee.name)
        ) {
          return;
        }
        const deps = node.arguments[1];
        if (!deps || deps.type !== "ArrayExpression") return;
        for (const el of deps.elements) checkElement(el);
      },
    };
  },
};
