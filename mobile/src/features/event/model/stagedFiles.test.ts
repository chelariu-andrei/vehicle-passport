import type { StagedFile } from './stagedFiles';
import { addStaged, pdfProblem, removeStaged } from './stagedFiles';

const file = (n: number): StagedFile => ({ uri: `file:///f${n}.jpg`, size: 100, name: `f${n}`, kind: 'photo' });
const files = (count: number, from = 0) => Array.from({ length: count }, (_, i) => file(from + i));

test('files are added in order', () => {
  expect(addStaged(files(1), files(2, 1))).toEqual({ list: files(3), overflow: false });
});

test('the list stops at 10 and says so', () => {
  const result = addStaged(files(8), files(5, 8));
  expect(result.list).toHaveLength(10);
  expect(result.list[9]).toEqual(file(9));
  expect(result.overflow).toBe(true);
});

test('exactly 10 is not an overflow, one more is', () => {
  expect(addStaged(files(5), files(5, 5)).overflow).toBe(false);
  expect(addStaged(files(10), files(1, 10))).toEqual({ list: files(10), overflow: true });
});

test('a file is removed by its position', () => {
  expect(removeStaged(files(3), 1)).toEqual([file(0), file(2)]);
});

test('a PDF over 10 MB is refused, 10 MB exactly is not', () => {
  expect(pdfProblem(10_485_761)).toBe('tooLarge');
  expect(pdfProblem(10_485_760)).toBeNull();
});
