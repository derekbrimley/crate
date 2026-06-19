import React, { useState } from "react";
import { FIELD_DEFS, makeRuleId } from "../../lib/filters";
import type { FilterRule, FieldKey } from "../../lib/filters";

interface AdvancedFiltersProps {
  rules: FilterRule[];
  matchMode: "AND" | "OR";
  availableGenres: string[];
  onChangeRules: (rules: FilterRule[]) => void;
  onChangeMatchMode: (m: "AND" | "OR") => void;
}

const selectStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 4px",
  border: "1px solid #3d2815",
  background: "#1a1210",
  color: "#f2e8d2",
  outline: "none",
};

const inputStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  width: 64,
  border: "1px solid #3d2815",
  background: "#1a1210",
  color: "#f2e8d2",
  outline: "none",
};

export default function AdvancedFilters({
  rules,
  matchMode,
  availableGenres,
  onChangeRules,
  onChangeMatchMode,
}: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  function addRule() {
    const field: FieldKey = "year";
    const rule: FilterRule = {
      id: makeRuleId(Date.now() + rules.length),
      field,
      operator: FIELD_DEFS[field].operators[0].key,
      value: "",
    };
    onChangeRules([...rules, rule]);
  }

  function updateRule(id: string, patch: Partial<FilterRule>) {
    onChangeRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRule(id: string) {
    onChangeRules(rules.filter((r) => r.id !== id));
  }

  function changeField(id: string, field: FieldKey) {
    const def = FIELD_DEFS[field];
    updateRule(id, { field, operator: def.operators[0].key, value: "", value2: undefined });
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono cursor-pointer"
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          background: "transparent",
          border: "none",
          color: rules.length > 0 ? "#ff5e00" : "#907558",
          padding: 0,
        }}
      >
        ADVANCED FILTERS {open ? "▴" : "▾"}
        {rules.length > 0 ? ` (${rules.length})` : ""}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {rules.map((rule) => {
            const def = FIELD_DEFS[rule.field];
            const needsV2 = def.needsValue2?.(rule.operator) ?? false;
            return (
              <div key={rule.id} className="flex items-center gap-1 flex-wrap">
                <select
                  value={rule.field}
                  onChange={(e) => changeField(rule.id, e.target.value as FieldKey)}
                  style={selectStyle}
                  className="font-mono cursor-pointer"
                >
                  {(Object.keys(FIELD_DEFS) as FieldKey[]).map((k) => (
                    <option key={k} value={k}>{FIELD_DEFS[k].label}</option>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value, value2: undefined })}
                  style={selectStyle}
                  className="font-mono cursor-pointer"
                >
                  {def.operators.map((op) => (
                    <option key={op.key} value={op.key}>{op.label}</option>
                  ))}
                </select>

                {def.valueType === "list" ? (
                  <select
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    style={selectStyle}
                    className="font-mono cursor-pointer"
                  >
                    <option value="">—</option>
                    <option value="favorite">Favorite</option>
                    <option value="recommendation">Recommendation</option>
                  </select>
                ) : def.valueType === "genre" ? (
                  <input
                    list="adv-genres"
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder="genre"
                    style={inputStyle}
                    className="font-mono"
                  />
                ) : (
                  <input
                    type={def.valueType === "number" ? "number" : "text"}
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    placeholder={def.valueType === "number" ? "0" : "value"}
                    style={inputStyle}
                    className="font-mono"
                  />
                )}

                {needsV2 && (
                  <>
                    <span className="font-mono" style={{ fontSize: 10, color: "#907558" }}>–</span>
                    <input
                      type="number"
                      value={rule.value2 ?? ""}
                      onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                      placeholder="0"
                      style={inputStyle}
                      className="font-mono"
                    />
                  </>
                )}

                <button
                  onClick={() => removeRule(rule.id)}
                  className="cursor-pointer"
                  style={{ background: "transparent", border: "none", color: "#907558", fontSize: 12 }}
                  title="Remove rule"
                >
                  ×
                </button>
              </div>
            );
          })}

          <datalist id="adv-genres">
            {availableGenres.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          <div className="flex items-center gap-2">
            <button
              onClick={addRule}
              className="font-mono cursor-pointer"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                letterSpacing: "0.08em",
                border: "1px solid #3d2815",
                background: "transparent",
                color: "#907558",
              }}
            >
              + ADD RULE
            </button>

            {rules.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="font-mono" style={{ fontSize: 10, color: "#907558", letterSpacing: "0.1em" }}>
                  MATCH
                </span>
                {(["AND", "OR"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onChangeMatchMode(m)}
                    className="font-mono cursor-pointer"
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      border: matchMode === m ? "1px solid #ff5e00" : "1px solid #3d2815",
                      background: matchMode === m ? "rgba(255,94,0,0.1)" : "transparent",
                      color: matchMode === m ? "#ff5e00" : "#907558",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
