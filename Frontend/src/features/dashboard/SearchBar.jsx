import { LoaderCircle, Search } from 'lucide-react'

const SEARCH_PATTERN = /^(CLI\d{3,}|\d{8}|\d{9})$/i

const normalizeInput = (value) => value.toUpperCase().replace(/[^0-9A-Z]/g, '')

const SearchBar = ({ searchQuery, isLoading, onChange, onSearch }) => {

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalized = normalizeInput(event.currentTarget.elements.search.value)

    if (!SEARCH_PATTERN.test(normalized) || isLoading) return

    await onSearch(normalized)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl flex-col gap-3 md:flex-row">
      <label className="sr-only" htmlFor="customer-search">
        Código de cliente (CLI), número de celular o DNI del cliente
      </label>
      <div className="relative flex-1">
        <input
          id="customer-search"
          type="text"
          name="search"
          value={searchQuery}
          onChange={(event) => onChange(normalizeInput(event.target.value))}
          maxLength={12}
          title="Ingrese un código de cliente (ej. CLI000013), un celular de 9 dígitos o un DNI de 8 dígitos"
          placeholder="CLI000013, número de celular o DNI del cliente..."
          autoComplete="off"
          disabled={isLoading}
          className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-base text-[#313235] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#019DF4] focus:ring-4 focus:ring-[#019DF4]/10 disabled:bg-slate-50"
        />
      </div>
      <button
        type="submit"
        disabled={!SEARCH_PATTERN.test(searchQuery) || isLoading}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#019DF4] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#008bd8] focus:outline-none focus:ring-4 focus:ring-[#019DF4]/20 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:min-w-44"
      >
        {isLoading ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Procesando IA...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" aria-hidden="true" />
            Analizar Cliente
          </>
        )}
      </button>
    </form>
  )
}

export default SearchBar
