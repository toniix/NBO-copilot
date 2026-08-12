import { LoaderCircle, RotateCcw, Search, Sparkles, X } from "lucide-react";

const SEARCH_PATTERN = /^(CLI\d{3,}|\d{8}|\d{9})$/i;

const QUICK_SEARCHES = [
  { label: "Demo Principal", value: "999999999" },
  { label: "Cliente Frecuente", value: "CLI000013" },
  { label: "Prepago Alto Churn", value: "987654321" },
];

const normalizeInput = (value) => value.toUpperCase().replace(/[^0-9A-Z]/g, "");

const SearchBar = ({
  searchQuery,
  isLoading,
  onChange,
  onSearch,
  onClear,
  hasResults,
  compact = false,
}) => {
  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalized = normalizeInput(
      event.currentTarget.elements.search?.value || searchQuery,
    );

    if (!SEARCH_PATTERN.test(normalized) || isLoading) return;

    await onSearch(normalized);
  };

  const handleQuickSelect = (value) => {
    onChange(value);
    onSearch(value);
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1 sm:w-64">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
          </div>
          <input
            type="text"
            name="search"
            value={searchQuery}
            onChange={(event) => onChange(normalizeInput(event.target.value))}
            maxLength={12}
            placeholder="Buscar otro cliente..."
            autoComplete="off"
            disabled={isLoading}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-[#313235] shadow-2xs outline-none transition placeholder:text-slate-400 focus:border-[#019DF4] focus:ring-2 focus:ring-[#019DF4]/15 disabled:bg-slate-50"
          />
          {searchQuery && !isLoading && (
            <button
              type="button"
              onClick={onClear}
              title="Limpiar búsqueda"
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!SEARCH_PATTERN.test(searchQuery) || isLoading}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#019DF4] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#008bd8] focus:outline-none focus:ring-2 focus:ring-[#019DF4]/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <LoaderCircle
              className="h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>Buscar</span>
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            title="Nueva Búsqueda"
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Nueva Búsqueda</span>
          </button>
        )}
      </form>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2.5 sm:flex-row"
      >
        <label className="sr-only" htmlFor="customer-search">
          Código de cliente (CLI), número de celular o DNI del cliente
        </label>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <input
            id="customer-search"
            type="text"
            name="search"
            value={searchQuery}
            onChange={(event) => onChange(normalizeInput(event.target.value))}
            maxLength={12}
            title="Ingrese un código de cliente (ej. CLI000013), celular de 9 dígitos o DNI de 8 dígitos"
            placeholder="Ingrese celular (999999999), CLI000013 o DNI..."
            autoComplete="off"
            disabled={isLoading}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-medium text-[#313235] shadow-xs outline-none transition placeholder:text-slate-400 focus:border-[#019DF4] focus:ring-4 focus:ring-[#019DF4]/15 disabled:bg-slate-50"
          />
          {searchQuery && !isLoading && (
            <button
              type="button"
              onClick={onClear}
              title="Limpiar búsqueda"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!SEARCH_PATTERN.test(searchQuery) || isLoading}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#019DF4] px-6 text-sm font-bold text-white shadow-md shadow-[#019DF4]/20 transition hover:bg-[#008bd8] focus:outline-none focus:ring-4 focus:ring-[#019DF4]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:min-w-36"
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Analizando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Analizar Cliente
              </>
            )}
          </button>
          {hasResults && !isLoading && (
            <button
              type="button"
              onClick={onClear}
              title="Nueva búsqueda"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </form>

      {/* Quick Search Chips */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
        <span className="font-semibold text-slate-400">Consultas demo:</span>
        {QUICK_SEARCHES.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => handleQuickSelect(chip.value)}
            disabled={isLoading}
            className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 font-medium text-slate-600 shadow-2xs hover:border-[#019DF4] hover:text-[#019DF4] transition-all disabled:opacity-50"
          >
            {chip.label} ({chip.value})
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchBar;
