// Mock historical sales events for supervisor charts
// Each event: { id, advisorId, date (ISO), outcome: 'accepted'|'rejected', amount }
export const mockSalesHistory = [
  { id: 'h-1', advisorId: 'advisor-vero', date: '2026-07-20', outcome: 'accepted', amount: 49.9 },
  { id: 'h-2', advisorId: 'advisor-gabriela', date: '2026-07-20', outcome: 'accepted', amount: 44.9 },
  { id: 'h-3', advisorId: 'advisor-anthony', date: '2026-07-21', outcome: 'rejected', amount: 39.9 },
  { id: 'h-4', advisorId: 'advisor-vero', date: '2026-07-22', outcome: 'accepted', amount: 69.9 },
  { id: 'h-5', advisorId: 'advisor-gabriela', date: '2026-07-23', outcome: 'accepted', amount: 49.9 },
  { id: 'h-6', advisorId: 'advisor-anthony', date: '2026-07-24', outcome: 'accepted', amount: 49.9 },
  { id: 'h-7', advisorId: 'advisor-vero', date: '2026-07-25', outcome: 'rejected', amount: 39.9 },
  { id: 'h-8', advisorId: 'advisor-gabriela', date: '2026-07-26', outcome: 'accepted', amount: 44.9 },
  { id: 'h-9', advisorId: 'advisor-anthony', date: '2026-07-27', outcome: 'accepted', amount: 49.9 },
  { id: 'h-10', advisorId: 'advisor-vero', date: '2026-07-28', outcome: 'accepted', amount: 49.9 },
  { id: 'h-11', advisorId: 'advisor-gabriela', date: '2026-07-29', outcome: 'rejected', amount: 39.9 },
  { id: 'h-12', advisorId: 'advisor-anthony', date: '2026-07-30', outcome: 'accepted', amount: 69.9 },
  { id: 'h-13', advisorId: 'advisor-vero', date: '2026-07-31', outcome: 'accepted', amount: 49.9 },
  { id: 'h-14', advisorId: 'advisor-gabriela', date: '2026-08-01', outcome: 'accepted', amount: 44.9 },
  { id: 'h-15', advisorId: 'advisor-anthony', date: '2026-08-02', outcome: 'accepted', amount: 49.9 },
  { id: 'h-16', advisorId: 'advisor-vero', date: '2026-08-03', outcome: 'accepted', amount: 69.9 },
  { id: 'h-17', advisorId: 'advisor-gabriela', date: '2026-08-04', outcome: 'accepted', amount: 49.9 },
  { id: 'h-18', advisorId: 'advisor-anthony', date: '2026-08-05', outcome: 'rejected', amount: 39.9 },
  { id: 'h-19', advisorId: 'advisor-vero', date: '2026-08-06', outcome: 'accepted', amount: 49.9 },
  { id: 'h-20', advisorId: 'advisor-gabriela', date: '2026-08-07', outcome: 'accepted', amount: 69.9 },
  { id: 'h-21', advisorId: 'advisor-anthony', date: '2026-08-08', outcome: 'accepted', amount: 49.9 },
]

export default mockSalesHistory
