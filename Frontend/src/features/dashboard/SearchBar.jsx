import { LoaderCircle, Search } from 'lucide-react'

const SearchBar = ({ searchQuery, isLoading, onChange, onSearch }) => {

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedPhone = event.currentTarget.elements.phone.value.trim()

    if (!/^\d{9}$/.test(normalizedPhone) || isLoading) return

    await onSearch(normalizedPhone)
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl flex-col gap-3 md:flex-row">
      <label className="sr-only" htmlFor="customer-phone">
        Número de celular del cliente
      </label>
      <div className="relative flex-1">
        <input
          id="customer-phone"
          type="tel"
          inputMode="numeric"
          name="phone"
          value={searchQuery}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          maxLength={9}
          pattern="[0-9]{9}"
          title="Ingrese exactamente 9 números"
          placeholder="Ingrese número de celular del cliente..."
          disabled={isLoading}
          className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-base text-[#313235] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#019DF4] focus:ring-4 focus:ring-[#019DF4]/10 disabled:bg-slate-50"
        />
      </div>
      <button
        type="submit"
        disabled={!/^\d{9}$/.test(searchQuery) || isLoading}
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
