import { describe, expect, it } from 'vitest';
import { buildPagination } from '../../src/utils/pagination.util';

describe('buildPagination', () => {
  it('an empty list has 0 pages and no neighbours', () => {
    expect(buildPagination(1, 10, 0)).toEqual({
      page: 1,
      limit: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  // 25 items with 10 per page = 3 pages
  it.each([
    { page: 1, hasNextPage: true, hasPreviousPage: false },
    { page: 2, hasNextPage: true, hasPreviousPage: true },
    { page: 3, hasNextPage: false, hasPreviousPage: true },
  ])(
    'page $page of 3: next=$hasNextPage previous=$hasPreviousPage',
    ({ page, hasNextPage, hasPreviousPage }) => {
      const result = buildPagination(page, 10, 25);

      expect(result.totalPages).toBe(3);
      expect(result.hasNextPage).toBe(hasNextPage);
      expect(result.hasPreviousPage).toBe(hasPreviousPage);
    },
  );

  it('an exact multiple does not create an extra empty page', () => {
    const result = buildPagination(2, 10, 20);

    expect(result.totalPages).toBe(2);
    expect(result.hasNextPage).toBe(false);
  });

  it('one item more than a multiple creates one more page', () => {
    expect(buildPagination(1, 10, 21).totalPages).toBe(3);
  });

  it('a page after the last one has no next page, but has a previous page', () => {
    const result = buildPagination(5, 10, 25);

    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(true);
  });

  it('a page after the last one of an empty list has no previous page', () => {
    expect(buildPagination(5, 10, 0).hasPreviousPage).toBe(false);
  });
});
