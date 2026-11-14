export const DASHBOARD_PAGE_SIZE = 5;
export function pageWindow(total: number, requestedPage = 1, pageSize = DASHBOARD_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const offset = (page - 1) * pageSize;
  return {page, page_size: pageSize, total, total_pages: totalPages, offset, first: total ? offset + 1 : 0, last: Math.min(offset + pageSize, total)};
}
