import { Check, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { rankSuppliers } from "../api/supplierSearch";
import type { Invoice } from "../api/types";

type SupplierComboboxProps = {
  value: string;
  rows: Invoice[];
  placeholder?: string;
  onChange: (value: string) => void;
  onSelect: (row: Invoice) => void;
};

export function SupplierCombobox({ value, rows, placeholder, onChange, onSelect }: SupplierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => rankSuppliers(rows, value), [rows, value]);

  function choose(row: Invoice) {
    onSelect(row);
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="supplier-combobox">
      <Search size={17} aria-hidden="true" />
      <input
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="supplier-suggestion-list"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={event => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(index => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && suggestions[activeIndex]) {
            event.preventDefault();
            choose(suggestions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && value.trim() && (
        <div className="supplier-suggestion-list" id="supplier-suggestion-list" role="listbox">
          {suggestions.map((row, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "is-active" : ""}
              key={row.invoiceRegistrationNumber}
              onMouseDown={event => event.preventDefault()}
              onClick={() => choose(row)}
            >
              <Store size={17} />
              <span><strong>{row.supplierName}</strong><small>{row.supplierCategory || "その他"}</small></span>
              <em>{String(row.taxFlag) === "1" ? "税込" : "税抜"}</em>
              {row.supplierName === value && <Check size={16} />}
            </button>
          ))}
          {suggestions.length === 0 && <div className="supplier-suggestion-empty">一致する登録店舗はありません</div>}
        </div>
      )}
    </div>
  );
}
