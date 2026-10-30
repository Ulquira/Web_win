import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter, Search, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export interface ColumnFilterState {
  search: string;
  selected: string[];
}

interface ExcelFilterHeaderProps {
  title: string;
  field: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  columnFilters: Record<string, ColumnFilterState>;
  onFilterChange: (field: string, filter: ColumnFilterState | null) => void;
  activeDropdown: string | null;
  setActiveDropdown: (field: string | null) => void;
  allValues: string[];
  align?: 'left' | 'right' | 'center';
  alignRight?: boolean;
  className?: string;
}

export const ExcelFilterHeader: React.FC<ExcelFilterHeaderProps> = ({
  title,
  field,
  sortField,
  sortOrder,
  onSort,
  columnFilters,
  onFilterChange,
  activeDropdown,
  setActiveDropdown,
  allValues,
  align = 'left',
  alignRight = false,
  className = ''
}) => {
  const isOpen = activeDropdown === field;
  const currentFilter = columnFilters[field];
  const isFiltered = Boolean(
    currentFilter && (currentFilter.search || (currentFilter.selected && currentFilter.selected.length > 0))
  );

  const [localSearch, setLocalSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sincronizar estado local al abrir
  useEffect(() => {
    if (isOpen) {
      setLocalSearch(currentFilter?.search || '');
      setLocalSelected(currentFilter?.selected || []);
    }
  }, [isOpen, currentFilter]);

  // Lista de opciones filtradas por el buscador del popover
  const filteredOptions = useMemo(() => {
    if (!localSearch.trim()) return allValues;
    const term = localSearch.toLowerCase().trim();
    return allValues.filter(v => v.toLowerCase().includes(term));
  }, [allValues, localSearch]);

  const selectedSet = useMemo(() => new Set(localSelected), [localSelected]);
  const isAllChecked = filteredOptions.length > 0 && filteredOptions.every(opt => selectedSet.has(opt));

  const handleToggleOption = (opt: string) => {
    setLocalSelected(prev => {
      const next = prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt];
      return next;
    });
  };

  const handleToggleAll = () => {
    if (isAllChecked) {
      // Deseleccionar todas las visibles
      setLocalSelected(prev => prev.filter(x => !filteredOptions.includes(x)));
    } else {
      // Seleccionar todas las visibles
      setLocalSelected(prev => Array.from(new Set([...prev, ...filteredOptions])));
    }
  };

  const handleApply = () => {
    if (!localSearch.trim() && localSelected.length === 0) {
      onFilterChange(field, null);
    } else {
      onFilterChange(field, {
        search: localSearch.trim(),
        selected: localSelected
      });
    }
    setActiveDropdown(null);
  };

  const handleClear = () => {
    setLocalSearch('');
    setLocalSelected([]);
    onFilterChange(field, null);
    setActiveDropdown(null);
  };

  const renderSortIndicator = () => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-orange-400 font-bold" />
      : <ArrowDown className="w-3.5 h-3.5 text-orange-400 font-bold" />;
  };

  return (
    <th className={`py-3 px-3 relative select-none group ${className}`}>
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between'}`}>
        <div
          onClick={() => onSort(field)}
          className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors truncate"
          title={`Ordenar por ${title}`}
        >
          <span className="truncate text-[11px] font-semibold text-slate-300 group-hover:text-white tracking-wider uppercase">
            {title}
          </span>
          {renderSortIndicator()}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveDropdown(isOpen ? null : field);
          }}
          className={`excel-filter-trigger p-1 rounded-md transition-all cursor-pointer relative shrink-0 ${
            isFiltered
              ? 'bg-[#FF5A0A]/20 text-[#FF5A0A] border border-[#FF5A0A]/50 shadow-sm'
              : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/80'
          }`}
          title={`Filtro tipo Excel para ${title}`}
        >
          <Filter className="w-3 h-3" />
          {isFiltered && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF5A0A] ring-2 ring-[#0F141F]" />
          )}
        </button>
      </div>

      {/* Popover tipo Excel */}
      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className={`excel-filter-popover absolute top-full mt-1.5 z-50 min-w-[240px] max-w-[290px] bg-[#0E131F] border border-slate-700/90 rounded-xl shadow-2xl p-3 text-slate-200 normal-case font-normal text-left backdrop-blur-md space-y-2.5 ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {/* Header del Popover */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-300">
            <span className="truncate flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-[#FF5A0A]" />
              Filtro: {title}
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] text-orange-400 hover:text-orange-300 font-medium cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Buscador de palabra o texto */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={`Buscar valor...`}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApply();
                } else if (e.key === 'Escape') {
                  setActiveDropdown(null);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              autoFocus
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Opciones con checkboxes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={isAllChecked}
                  onChange={handleToggleAll}
                  className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                />
                <span>(Seleccionar todo)</span>
              </label>
              <span className="font-mono">{filteredOptions.length}</span>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
              {filteredOptions.map((opt) => {
                const isChecked = selectedSet.has(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-800/80 cursor-pointer text-xs text-slate-300 transition-colors select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleOption(opt)}
                      className="rounded border-slate-700 bg-slate-950 text-orange-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                    />
                    <span className="truncate font-mono text-[11px]">{opt}</span>
                  </label>
                );
              })}
              {filteredOptions.length === 0 && (
                <div className="py-3 text-center text-[11px] text-slate-500 italic">
                  Sin resultados para "{localSearch}"
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
            >
              Restablecer
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveDropdown(null)}
                className="px-2.5 py-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-3 py-1 bg-[#FF5A0A] hover:bg-[#e04f08] active:scale-95 text-white font-bold rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </th>
  );
};
