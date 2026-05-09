import path from 'path';
import { resolveOutputDir } from '../src/utils/paths';

describe('paths', () => {
  it('uses explicit output directory when provided', () => {
    expect(resolveOutputDir('/tmp/repo', './output/custom')).toBe(path.resolve('./output/custom'));
  });

  it('supports absolute default output directories', () => {
    const defaultOutput = path.resolve('output/example-repo');
    expect(resolveOutputDir('/tmp/repo', undefined, defaultOutput)).toBe(defaultOutput);
  });

  it('keeps relative defaults under the scanned repo for compatibility', () => {
    expect(resolveOutputDir('/tmp/repo')).toBe(path.join(path.resolve('/tmp/repo'), '.agentlens'));
  });
});
